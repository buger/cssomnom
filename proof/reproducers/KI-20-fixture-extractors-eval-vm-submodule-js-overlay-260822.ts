/**
 * Overlay reproducer for KI-20: fixture extractors execute vendored
 * submodule JavaScript via eval/vm.
 *
 * Three fixture-harvest scripts treat vendored submodule JS as code, not
 * data (sinks verified at HEAD 83ce08f):
 *
 *   - scripts/external_suites/extract_nv_cssom.ts:55 — bare
 *     `eval(executableCode)` over the sliced `var TESTS = [...]` array of a
 *     vendored CSSOM parse.spec.js; array-element expressions run in the
 *     HOST realm during eval.
 *   - scripts/external_suites/extract_rrweb.ts:49 —
 *     `vm.runInContext(content, sandbox)` over vendored rrweb-cssom fixture
 *     content with a plain-object sandbox and no process freeze; node:vm is
 *     documented as not a security boundary, so `this.constructor.constructor`
 *     chains reach host process/mainModule.
 *   - scripts/external_suites/extract_wpt.ts:126 and :257 —
 *     `vm.runInNewContext(\`(${match[1]})\`)` over regex-matched object
 *     literals pulled from WPT HTML fixtures; literal-value expressions are
 *     arbitrary JS evaluated cross-realm.
 *
 * A compromised upstream bump or malicious PR moving a submodule pin turns
 * the next `pnpm run fixtures:generate` into maintainer/CI host code
 * execution. These are pure script surfaces (each extractor runs its harvest
 * in its module body on import), so this reproducer mirrors each sink's exact
 * construction against hostile vendored-content stand-ins inside disposable
 * temp storage and cites the source lines above. Spawn-free: no child
 * processes anywhere — the demonstrated impact is host-realm execution
 * (global mutation + host filesystem write via process.mainModule.require),
 * which is the same primitive with less noise than spawning.
 *
 * Asserts the SAFE contract: extracting vendored fixture content must NOT
 * produce any host-realm side effect; benign vendored content must still
 * extract correctly (control).
 *
 * Reproduces: KI-20
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
const SINK_NV_CSSOM = 'scripts/external_suites/extract_nv_cssom.ts:55';
const SINK_RRWEB = 'scripts/external_suites/extract_rrweb.ts:49';
const SINK_WPT = 'scripts/external_suites/extract_wpt.ts:126/:257';

/**
 * Mirror of extract_nv_cssom.ts:44-55: locate `var TESTS = [` through the
 * last `];` before the describe call, strip the declaration, and eval.
 */
function mirrorNvCssomExtract(content: string): unknown[] {
  const describeIndex = content.indexOf('describe(');
  const startIndex = content.indexOf('var TESTS = [');
  const arrayEndIndex = content.lastIndexOf('];', describeIndex);
  assert.ok(startIndex !== -1 && arrayEndIndex !== -1, 'nv_cssom mirror out of sync with extractor slicing');
  const testsCode = content.substring(startIndex, arrayEndIndex + 2);
  const executableCode = testsCode.replace('var TESTS = [', '[');
  // eslint-disable-next-line no-eval -- mirroring extract_nv_cssom.ts:55 exactly
  const tests = eval(executableCode) as unknown[];
  return Array.isArray(tests) ? tests : [tests];
}

/** Mirror of extract_rrweb.ts:26-50 sandbox + vm.runInContext. */
function mirrorRrwebExtract(content: string): { TESTS: unknown[] } {
  const specificTests: unknown[] = [];
  const sandbox: Record<string, unknown> = {
    TESTS: [],
    describe: (_name: string, fn: () => void) => fn(),
    given: (input: string, fn: () => void) => specificTests.push({ input, fn }),
    expect: () => ({
      toEqualOwnProperties: () => {},
      toBe: () => {},
    }),
    uncircularOwnProperties: () => {},
    removeUnderscored: () => {},
    CSSOM: {
      parse: () => ({ cssRules: [{ style: {} }] }),
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(content, sandbox); // extract_rrweb.ts:49
  return { TESTS: (sandbox.TESTS as unknown[]) ?? [] };
}

/** Mirror of extract_wpt.ts:120-126 / 255-257 regex + vm.runInNewContext. */
function mirrorWptExtractObjectLiteral(content: string): Record<string, unknown> {
  const match = content.match(/var\s+tests\s*=\s*({[\s\S]*?})\n\s*(?:if|for|<)/);
  if (!match) throw new Error('wpt object-literal mirror out of sync with extractor regex');
  return vm.runInNewContext(`(${match[1]})`) as Record<string, unknown>; // extract_wpt.ts:126
}

function mirrorWptExtractMapLiteral(content: string): Record<string, unknown> {
  const mapMatch = content.match(/var\s+test_map\s*=\s*({[\s\S]*?});/);
  if (!mapMatch) throw new Error('wpt test_map mirror out of sync with extractor regex');
  return vm.runInNewContext(`(${mapMatch[1]})`) as Record<string, unknown>; // extract_wpt.ts:257
}

describe('KI-20 fixture extractors must not execute vendored JS', () => {
  let lab: string;

  test('positive control: benign vendored content extracts to expected fixtures', () => {
    lab = fs.mkdtempSync(path.join(os.tmpdir(), 'ki20-control-'));
    try {
      const benignArray = `var TESTS = [ { name: "ok", input: "a{b:c}", expected: "b:c" } ];\ndescribe("suite", function() {});\n`;
      const extracted = mirrorNvCssomExtract(benignArray);
      assert.equal(extracted.length, 1);
      assert.equal((extracted[0] as { name?: string }).name, 'ok');

      const rr = mirrorRrwebExtract(`var TESTS = [{ input: "x", expected: "y" }];\n`);
      assert.equal(rr.TESTS.length, 1);

      const wptObj = mirrorWptExtractObjectLiteral(`var tests = { "a": ["OK"] }\nif (true) {}\n`);
      assert.equal(JSON.stringify(wptObj), JSON.stringify({ a: ['OK'] }));

      const wptMap = mirrorWptExtractMapLiteral(`var test_map = { "b": "PASS" };`);
      assert.equal(JSON.stringify(wptMap), JSON.stringify({ b: 'PASS' }));

      assert.equal(fs.readdirSync(lab).length, 0, 'benign extraction must leave no side-effect markers');
    } finally {
      fs.rmSync(lab, { recursive: true, force: true });
      lab = '';
    }
  });

  // Reproduces: KI-20
  test('hostile leg: nv_cssom TESTS-array element expressions must not run in the host realm', () => {
    const markerFile = path.join(os.tmpdir(), `ki20-nv-${process.pid}-${Date.now()}.pwned`);
    const hostile =
      `var TESTS = [ { name: (globalThis.process.getBuiltinModule("node:fs").writeFileSync(${JSON.stringify(markerFile)}, "ki20-host-realm-exec"), "pwned"), input: "a", expected: "b" } ];\ndescribe("suite", function() {});\n`;
    let escaped = false;
    try {
      mirrorNvCssomExtract(hostile); // sink at extract_nv_cssom.ts:55 executes this in HOST realm
      escaped = fs.existsSync(markerFile);
    } catch {
      escaped = fs.existsSync(markerFile);
    } finally {
      fs.rmSync(markerFile, { force: true });
    }
    assert.ok(
      !escaped,
      `SAFE contract violated: bare eval at ${SINK_NV_CSSOM} executed vendored array-element expressions in the host realm (marker file written)`,
    );
  });

  // Reproduces: KI-20
  test('hostile leg: rrweb vm.runInContext content must not escape into the host realm', () => {
    const markerFile = path.join(os.tmpdir(), `ki20-rrweb-${process.pid}-${Date.now()}.pwned`);
    // Route B from the scan writeup: on the contextified global,
    // this.constructor.constructor reaches the HOST Function; the returned
    // process.getBuiltinModule('fs') is a host module object.
    const hostile = [
      `var proc = this.constructor.constructor("return process")();`,
      `proc.getBuiltinModule("node:fs").writeFileSync(${JSON.stringify(markerFile)}, "ki20-vm-escape");`,
      `var TESTS = [{ input: "x", expected: "y" }];`,
    ].join('\n');
    let escaped = false;
    try {
      mirrorRrwebExtract(hostile); // sink at extract_rrweb.ts:49
      escaped = fs.existsSync(markerFile);
    } catch {
      escaped = fs.existsSync(markerFile);
    } finally {
      fs.rmSync(markerFile, { force: true });
    }
    assert.ok(
      !escaped,
      `SAFE contract violated: vm.runInContext at ${SINK_RRWEB} allowed constructor-chain escape to host process.mainModule (marker file written)`,
    );
  });

  // Reproduces: KI-20
  test('hostile leg: wpt object-literal / test_map values must not evaluate cross-realm expressions', () => {
    const markerObj = path.join(os.tmpdir(), `ki20-wptobj-${process.pid}-${Date.now()}.pwned`);
    const markerMap = path.join(os.tmpdir(), `ki20-wptmap-${process.pid}-${Date.now()}.pwned`);
    const objFixture = `var tests = { pwned: (this.constructor.constructor("return process")().getBuiltinModule("node:fs").writeFileSync(${JSON.stringify(markerObj)}, "ki20"), "x") }\nif (true) {}\n`;
    const mapFixture = `var test_map = { pwned: (this.constructor.constructor("return process")().getBuiltinModule("node:fs").writeFileSync(${JSON.stringify(markerMap)}, "ki20"), "y") };`;
    let escapedObj = false;
    let escapedMap = false;
    try {
      mirrorWptExtractObjectLiteral(objFixture); // sink at extract_wpt.ts:126
      escapedObj = fs.existsSync(markerObj);
    } catch {
      escapedObj = fs.existsSync(markerObj);
    }
    try {
      mirrorWptExtractMapLiteral(mapFixture); // sink at extract_wpt.ts:257
      escapedMap = fs.existsSync(markerMap);
    } catch {
      escapedMap = fs.existsSync(markerMap);
    } finally {
      fs.rmSync(markerObj, { force: true });
      fs.rmSync(markerMap, { force: true });
    }
    assert.ok(
      !escapedObj && !escapedMap,
      `SAFE contract violated: vm.runInNewContext at ${SINK_WPT} evaluated attacker expressions that wrote into the host filesystem (obj=${escapedObj} map=${escapedMap})`,
    );
  });
});
