/**
 * Overlay reproducer for KI-24: sandbox.fetch /interfaces/ join escapes the
 * WPT root.
 *
 * scripts/wpt/node/run.ts intercepts fixture fetches whose URL starts with
 * '/interfaces/' and serves the referenced IDL from local disk:
 * `const idlFileName = urlStr.slice('/interfaces/'.length);
 *  const fullPath = path.join(WPT_ROOT, 'interfaces', idlFileName);`
 * (L143-145, verified at HEAD 83ce08f) followed by existsSync/readFileSync
 * (L146-147) — with no normalize+containment check on idlFileName. A hostile
 * or compromised WPT fixture therefore reads arbitrary files readable by the
 * runner identity ('/interfaces/../../../package.json' climbs out of
 * <WPT_ROOT>/interfaces/) and hands their contents to sandboxed page JS as a
 * 200 Response.
 *
 * Containment expectation anchoring (honest): README.md § "Web Platform Test
 * (WPT) Conformance & Parity" contains only conformance stats, NOT a
 * containment contract. The expectation is derived from (a) the bridge's own
 * documented purpose in run.ts source comments — "// Intercept relative
 * /interfaces/*.idl fetch calls" (run.ts:140), i.e. serve VENDORED IDL from
 * <WPT_ROOT>/interfaces and nothing else — and (b) CWE-22 path-containment
 * normative practice (normalize + contain before any disk read).
 *
 * Asserts the SAFE contract: a /interfaces/ URL carrying ../ traversal must
 * NOT return an out-of-tree file to page JS; an in-tree IDL must still be
 * served (control).
 *
 * Live leg imports the REAL production runner after chdir into a synthetic
 * WPT-shaped tree so WPT_ROOT (run.ts:24, resolved from cwd at module load)
 * points at disposable temp storage; nothing in the real repository is read.
 *
 * Reproduces: KI-24
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const RUNNER_TS = path.resolve('scripts/wpt/node/run.ts');
const TRAVERSAL_URL = '/interfaces/../../../package.json';

/** Faithful mirror of scripts/wpt/node/run.ts:143-156. */
// Verifies: SYS-REQ-260823-KYB6 (KI-24 reproducer: /interfaces/ fetch bridge mirror)
// reqproof:proptest:skip fs.existsSync/readFileSync fetch bridge mirroring scripts/wpt/node/run.ts interfaces lookup; performs filesystem I/O so not isolable
function mirrorInterfacesFetch(wptRoot: string, urlStr: string): { handled: boolean; fullPath?: string; content?: string } {
  if (!urlStr.startsWith('/interfaces/')) return { handled: false };
  const idlFileName = urlStr.slice('/interfaces/'.length);
  const fullPath = path.join(wptRoot, 'interfaces', idlFileName);
  if (!fs.existsSync(fullPath)) return { handled: true, fullPath };
  return { handled: true, fullPath, content: fs.readFileSync(fullPath, 'utf-8') };
}

// Verifies: SYS-REQ-260823-KYB6 (KI-24 reproducer: interfaces-dir containment predicate)
// reqproof:proptest:skip three-line stdlib composition of path.relative plus path.resolve; an independent oracle would restate the same stdlib prefix semantics
function containedUnder(candidate: string, rootDir: string): boolean {
  const rel = path.relative(path.resolve(rootDir), path.resolve(candidate));
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}

// Verifies: SYS-REQ-260823-KYB6 (KI-24 reproducer: synthetic WPT tree + traversal fixture)
// reqproof:proptest:skip writes a synthetic WPT fixture tree via mkdirSync/writeFileSync; filesystem I/O makes it uncallable as an isolated pure function
function buildTree(root: string): { wptRoot: string; hostileHtml: string } {
  const wptRoot = path.join(root, 'submodules', 'web-platform-tests');
  const interfacesDir = path.join(wptRoot, 'interfaces');
  const cssDir = path.join(wptRoot, 'css', 'cssom');
  fs.mkdirSync(interfacesDir, { recursive: true });
  fs.mkdirSync(cssDir, { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), '{ "name": "ki24-fixture-package" }\n');
  fs.writeFileSync(path.join(interfacesDir, 'KI24InTree.idl'), 'interface KI24InTree {};\n');
  const hostileHtml = path.join(cssDir, 'hostile-idl-fetch.html');
  fs.writeFileSync(
    hostileHtml,
    [
      '<!doctype html>',
      '<meta charset="utf-8">',
      '<script>',
      'promise_test(async () => {',
      '  const resp = await fetch("/interfaces/KI24InTree.idl");',
      '  const text = await resp.text();',
      '  assert_true(resp.ok && text.indexOf("KI24InTree") !== -1, "control: in-tree IDL must be served locally");',
      '}, "ki24 control: in-tree IDL served");',
      'promise_test(async () => {',
      `  const resp = await fetch(${JSON.stringify(TRAVERSAL_URL)});`,
      '  const text = await resp.text();',
      '  assert_false(',
      '    resp.ok && text.indexOf("ki24-fixture-package") !== -1,',
      '    "SAFE contract violated: traversal /interfaces/ fetch disclosed out-of-tree file",',
      '  );',
      '}, "ki24 safe: /interfaces/ traversal blocked");',
      '</script>',
      '',
    ].join('\n'),
  );
  return { wptRoot, hostileHtml };
}

// Verifies: SYS-REQ-260823-KYB6 (KI-24 reproducer suite: IDL fetch containment)
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
describe('KI-24 sandbox.fetch /interfaces/ containment', () => {
  test('positive control: in-tree IDL path stays contained under mirror resolver', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ki24-control-'));
    try {
      const { wptRoot } = buildTree(root);
      const r = mirrorInterfacesFetch(wptRoot, '/interfaces/KI24InTree.idl');
      assert.ok(r.handled && r.fullPath && containedUnder(r.fullPath, wptRoot), 'in-tree IDL must resolve inside WPT_ROOT');
      assert.equal(r.content, 'interface KI24InTree {};\n');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  // Reproduces: KI-24
  test('mirror leg: traversal idlFileName must resolve inside <WPT_ROOT>/interfaces', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ki24-mirror-'));
    try {
      const { wptRoot } = buildTree(root);
      const r = mirrorInterfacesFetch(wptRoot, TRAVERSAL_URL);
      assert.ok(r.handled, 'prefix gate did not match — mirror out of sync with run.ts:143');
      assert.ok(
        r.fullPath !== undefined && containedUnder(r.fullPath, wptRoot),
        `/interfaces/ join escaped WPT_ROOT: ${r.fullPath} resolved outside ${wptRoot} (run.ts:145 path.join(WPT_ROOT, 'interfaces', idlFileName))`,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  // Reproduces: KI-24
  test('live leg: real runWptFile sandbox.fetch must not disclose out-of-tree files via /interfaces/', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ki24-live-'));
    const prevCwd = process.cwd();
    let mod: { runWptFile: (p: string) => { tests: { name: string; fn: () => unknown }[]; cleanup: () => void } };
    let hostileHtml: string;
    try {
      const built = buildTree(root);
      hostileHtml = built.hostileHtml;
      process.chdir(root); // WPT_ROOT anchors at cwd on module load (run.ts:24)
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
      const names: string[] = [];
      for (const t of result.tests) names.push(t.name); // Proxy queue — for..of only (run.ts:446)
      assert.ok(names.some((n) => n.includes('ki24 control')), 'setup failure: control test not registered');
      assert.ok(names.some((n) => n.includes('ki24 safe')), 'safe-contract test not registered');
      for (const t of result.tests) {
        await t.fn(); // throws while the traversal disclosure is live
      }
      result.cleanup();
    } finally {
      process.chdir(prevCwd);
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
