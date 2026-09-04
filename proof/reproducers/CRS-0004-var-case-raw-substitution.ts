/**
 * Reproducer for CRS-0004/C13 (requirement INT-REQ-260821-HJVC,
 * src/cascade/rule-filter.ts collectInlineDeclarations +
 * src/cascade/variable-resolver.ts resolveCustomProperties).
 *
 * Custom property values are classified as "already resolved" with a
 * case-sensitive substring test on the raw declaration text
 * (`raw.includes('var(')`), so an ASCII-uppercase `VAR()` reference in a custom
 * property value is stored verbatim and never substituted. CSS function names
 * are ASCII case-insensitive (css-variables-1 #variables, css-syntax-3
 #tokenization), so `--a: VAR(--c)` must resolve like `--a: var(--c)`.
 * Asserts the intended contract so this command FAILS while the hole is
 * present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parse } from '../../src/parser.ts';
import { getCascadedStyle } from '../../src/cascade/index.ts';

const document = parseHTML('<html><body><div class="t"></div></body></html>').document;
const el = document.querySelector('.t');
const sheet = parse(':root { --c: red }');

test('CRS-0004/C13: uppercase VAR() in a custom property value is substituted', () => {
  el.setAttribute('style', '--a: VAR(--c); color: var(--a)');
  const style = getCascadedStyle(el, sheet.cssRules);
  assert.equal(style.getPropertyValue('--a'), 'red',
    'VAR() must resolve case-insensitively inside custom property values');
  assert.equal(style.getPropertyValue('color'), 'rgb(255, 0, 0)',
    'the consuming property must see the substituted value');
});

test('CRS-0004/C13 control: lowercase var() in the same position resolves', () => {
  el.setAttribute('style', '--a: var(--c); color: var(--a)');
  const style = getCascadedStyle(el, sheet.cssRules);
  assert.equal(style.getPropertyValue('--a'), 'red');
  assert.equal(style.getPropertyValue('color'), 'rgb(255, 0, 0)');
});
