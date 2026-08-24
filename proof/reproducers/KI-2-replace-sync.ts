/**
 * Overlay reproducer for KI-2. Not a product-suite test.
 * Import parser first so ParseHooks inject. Asserts the intended README
 * contract (replace() parses synchronously via replaceSync and returns
 * Promise.resolve(this)). Regression tripwire after the KI-2 class-fix.
 *
 * Reproduces: KI-2
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { CSSStyleSheet } from '../../src/CSSOM.ts';

async function ki2Contract(): Promise<{ setupOk: boolean; holds: boolean; message: string }> {
  const sheet = new CSSStyleSheet();
  if (sheet.cssRules.length !== 0) {
    return { setupOk: false, holds: false, message: 'setup failed: constructed sheet should start empty' };
  }

  const pending = sheet.replace('div { color: red; }');
  if (!(pending instanceof Promise)) {
    return { setupOk: false, holds: false, message: 'setup failed: replace() must return a Promise' };
  }

  // README: executes parsing synchronously via replaceSync() and returns
  // Promise.resolve(this). cssRules must already contain the parsed rule.
  if (sheet.cssRules.length !== 1 || sheet.cssRules[0].cssText !== 'div { color: red; }') {
    return {
      setupOk: true,
      holds: false,
      message: `KI-2: replace() did not parse synchronously; cssRules.length=${sheet.cssRules.length} cssText=${JSON.stringify(sheet.cssRules[0]?.cssText)}`,
    };
  }

  await pending;
  return { setupOk: true, holds: true, message: 'KI-2 contract holds: replace() populated cssRules before return' };
}

// Reproduces: KI-2
// Verifies: SW-REQ-260821-PAKB
// MCDC SW-REQ-260821-PAKB: deviation_applies=T, documented_deviation_honored=T, replace_sync_parse_runs=T => TRUE
// Verifies: SYS-REQ-260821-GR67
// MCDC SYS-REQ-260821-GR67: deviation_applies=T, documented_deviation_honored=T => TRUE
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
test('KI-2: replace() parses synchronously', async () => {
  const outcome = await ki2Contract();
  assert.equal(outcome.setupOk, true, outcome.message);
  assert.equal(outcome.holds, true, outcome.message);
});
