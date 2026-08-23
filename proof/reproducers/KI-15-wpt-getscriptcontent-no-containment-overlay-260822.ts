/**
 * Overlay reproducer for KI-15: WPT runner getScriptContent reads and
 * vm-executes <script src> payloads that escape the WPT root.
 *
 * scripts/wpt/node/run.ts getScriptContent (L92-115, verified at HEAD 83ce08f)
 * resolves fixture-controlled <script src> values with
 * path.join(WPT_ROOT, src) for absolute-looking sources and
 * path.resolve(htmlDir, src) for relative ones, then fs.readFileSync's the
 * result (L109-110) without any path.relative containment check. runWptFile's
 * script-tag loop (L347-363) hands whatever bytes come back to
 * new vm.Script(code).runInContext(context) (L360-362). A hostile or
 * compromised WPT/HTML fixture therefore gains arbitrary local file read plus
 * execution of attacker-chosen out-of-tree JavaScript inside the privileged
 * runner process. This violates the project's own containment expectation for
 * fixture-loaded scripts documented in README.md § "Web Platform Test (WPT)
 * Conformance & Parity" (runner executes vendored WPT content, not host files).
 *
 * Asserts the SAFE contract: a fixture <script src> carrying ../ traversal
 * segments must NOT cause an out-of-tree payload to be read/executed; in-tree
 * scripts must continue to load (control).
 *
 * Live leg imports the REAL production runner (scripts/wpt/node/run.ts) after
 * chdir into a synthetic WPT-shaped tree so WPT_ROOT (resolved from cwd at
 * module load, L24) points at disposable temp storage; nothing in the real
 * repository is read or written by this reproducer.
 *
 * Reproduces: KI-15
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const RUNNER_TS = path.resolve('scripts/wpt/node/run.ts');
const REL_PAYLOAD = 'self.__KI15_REL_ESCAPED = true;\n';
const ABS_PAYLOAD = 'self.__KI15_ABS_ESCAPED = true;\n';

/** Faithful mirror of scripts/wpt/node/run.ts:102-107 resolution. */
function mirrorResolve(wptRoot: string, htmlDir: string, resolvedSrc: string): string {
  if (resolvedSrc.startsWith('/')) return path.join(wptRoot, resolvedSrc);
  return path.resolve(htmlDir, resolvedSrc);
}

function containedUnder(candidate: string, rootDir: string): boolean {
  const rel = path.relative(path.resolve(rootDir), path.resolve(candidate));
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}

function buildTree(root: string): string {
  const wptRoot = path.join(root, 'submodules', 'web-platform-tests');
  const cssDir = path.join(wptRoot, 'css', 'cssom');
  fs.mkdirSync(cssDir, { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), '{ "name": "ki15-fixture-package" }\n');
  fs.writeFileSync(path.join(root, 'outside-payload-rel.js'), REL_PAYLOAD);
  fs.writeFileSync(path.join(root, 'outside-payload-abs.js'), ABS_PAYLOAD);
  fs.writeFileSync(path.join(cssDir, 'in-tree-helper.js'), 'self.__KI15_INTREE = true;\n');
  fs.writeFileSync(
    path.join(cssDir, 'hostile.html'),
    [
      '<!doctype html>',
      '<meta charset="utf-8">',
      '<script src="in-tree-helper.js"></script>',
      '<script src="../../../../outside-payload-rel.js"></script>',
      '<script src="/../../outside-payload-abs.js"></script>',
      '<script>',
      'test(function() {',
      '  assert_true(self.__KI15_INTREE === true, "control: in-tree helper must load");',
      '}, "ki15 control: in-tree script loads");',
      'test(function() {',
      '  assert_false(self.__KI15_REL_ESCAPED === true, "SAFE contract violated: relative ../ payload executed");',
      '}, "ki15 safe: relative traversal blocked");',
      'test(function() {',
      '  assert_false(self.__KI15_ABS_ESCAPED === true, "SAFE contract violated: abs-join payload executed");',
      '}, "ki15 safe: absolute join traversal blocked");',
      '</script>',
      '',
    ].join('\n'),
  );
  return wptRoot;
}

describe('KI-15 WPT runner external script containment', () => {
  test('positive control: in-tree relative src stays contained under mirror resolver', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ki15-control-'));
    try {
      const wptRoot = buildTree(root);
      const cssDir = path.join(wptRoot, 'css', 'cssom');
      const fullPath = mirrorResolve(wptRoot, cssDir, 'in-tree-helper.js');
      assert.ok(containedUnder(fullPath, wptRoot), 'in-tree src must resolve inside WPT_ROOT');
      assert.equal(fs.readFileSync(fullPath, 'utf-8'), 'self.__KI15_INTREE = true;\n');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  // Reproduces: KI-15
  test('mirror leg: traversal src values must resolve inside WPT_ROOT/htmlDir', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ki15-mirror-'));
    try {
      const wptRoot = buildTree(root);
      const cssDir = path.join(wptRoot, 'css', 'cssom');
      const relResolved = mirrorResolve(wptRoot, cssDir, '../../../../outside-payload-rel.js');
      assert.ok(
        containedUnder(relResolved, wptRoot),
        `relative ../ src escaped htmlDir/WPT_ROOT: ${relResolved} (run.ts:106 path.resolve(htmlDir, src))`,
      );
      const absResolved = mirrorResolve(wptRoot, cssDir, '/../../outside-payload-abs.js');
      assert.ok(
        containedUnder(absResolved, wptRoot),
        `absolute-join /../ src escaped WPT_ROOT: ${absResolved} (run.ts:104 path.join(WPT_ROOT, src))`,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  // Reproduces: KI-15
  test('live leg: real runWptFile must not execute out-of-tree <script src> payloads', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ki15-live-'));
    const prevCwd = process.cwd();
    let mod: { runWptFile: (p: string) => { tests: { name: string; fn: () => unknown }[]; cleanup: () => void } };
    let wptRoot: string;
    let hostileHtml: string;
    try {
      wptRoot = buildTree(root);
      hostileHtml = path.join(wptRoot, 'css', 'cssom', 'hostile.html');
      // WPT_ROOT is computed at module load from process.cwd() (run.ts:24);
      // chdir BEFORE importing so the real runner anchors at the synthetic tree.
      process.chdir(root);
      assert.ok(fs.existsSync(RUNNER_TS), `real runner missing: ${RUNNER_TS}`);
      mod = (await import(pathToFileURL(RUNNER_TS).href)) as typeof mod;
      assert.equal(typeof mod.runWptFile, 'function', 'runWptFile export not found on real runner');
    } catch (e) {
      process.chdir(prevCwd);
      fs.rmSync(root, { recursive: true, force: true });
      throw e;
    }

    try {
      const result = mod.runWptFile(hostileHtml);
      // run.ts:446 wraps results.tests in a Proxy whose index/iterator traps
      // materialize wrapped tests on demand — iterate with for..of only.
      const names: string[] = [];
      for (const t of result.tests) names.push(t.name);
      assert.ok(names.some((n) => n.includes('ki15 control')), 'setup failure: control test not registered');
      assert.ok(names.filter((n) => n.includes('ki15 safe')).length >= 2, 'safe-contract tests not registered');
      for (const t of result.tests) {
        await t.fn(); // throws while an out-of-tree payload executed
      }
      result.cleanup();
    } finally {
      process.chdir(prevCwd);
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
