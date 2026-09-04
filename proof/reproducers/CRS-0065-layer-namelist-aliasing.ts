/**
 * Reproducer for CRS-0065/C17 (src/CSSOM.ts CSSLayerStatementRule). The
 * constructor stores the caller-supplied array by reference
 * (`this.nameList = nameList`). css-cascade-5 #csslayerstatementrule types
 * nameList as `readonly attribute FrozenArray<CSSOMString>`, so the attribute
 * exposes a frozen snapshot of the layer names. A later caller-side push
 * therefore must not change the rule's nameList or its cssText.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSLayerStatementRule } from '../../src/CSSOM.ts';

test('CRS-0065/C17: a caller-side push does not change the rule nameList', () => {
  const names = ['a'];
  const rule = new CSSLayerStatementRule(names as never);
  names.push('b');
  assert.deepEqual(
    (rule as unknown as { nameList: string[] }).nameList,
    ['a'],
    'css-cascade-5: nameList is a FrozenArray snapshot of the declared names'
  );
});

test('CRS-0065/C17: cssText keeps the constructed names after a caller-side push', () => {
  const names = ['a'];
  const rule = new CSSLayerStatementRule(names as never);
  names.push('b');
  assert.equal(rule.cssText, '@layer a;');
});

test('control: a two-name statement still serializes both names', () => {
  const rule = new CSSLayerStatementRule(['a', 'b'] as never);
  assert.equal(rule.cssText, '@layer a, b;');
});
