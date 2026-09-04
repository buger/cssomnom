/**
 * Reproducer for CRS-0031/C03 (CSSStyleSheet.replace must not reject).
 *
 * cssom-1 #dom-cssstylesheet-replace resolves the promise with the sheet:
 * step 4 runs parse a stylesheet's contents, which never throws, then
 * resolves. The implementation delegates to replaceSync inside a try/catch
 * and maps every escape into a rejection. The only input family that makes
 * the parse pipeline throw today is the unbounded-nesting RangeError owned
 * by KI-18; through replace() it surfaces as a rejected promise with the
 * raw engine error, and cssRules keeps the stale rules.
 *
 * Asserts the SAFE contract: replace() resolves with the sheet (or at
 * minimum never rejects with a raw RangeError) for pathological input.
 *
 * Reproduces: KI-18 (replace() entry point)
 * Verifies: cssom-1 #dom-cssstylesheet-replace
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleSheet } from '../../src/CSSOM.ts';

test('CRS-0031/C03: replace() resolves instead of rejecting a raw RangeError', async () => {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync('a { color: red }');
  let captured: unknown = null;
  const result = await sheet.replace('@media all{'.repeat(20000) + '}'.repeat(20000)).catch((e: unknown) => {
    captured = e;
    return null;
  });
  assert.equal(captured, null, 'replace() must reject with nothing; parse a stylesheet\'s contents never throws');
  assert.ok(result instanceof CSSStyleSheet, 'the promise resolves with the sheet');
});
