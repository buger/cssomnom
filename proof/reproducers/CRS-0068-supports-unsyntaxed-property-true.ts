/**
 * Reproducer for CRS-0068/C18 (src/parser-api.ts evaluateSupportsDeclaration).
 * Five legacy properties (-webkit-box-align and siblings) are listed in
 * SUPPORTED_PROPERTIES but have no STANDARD_PROPERTIES_SYNTAX entry, so
 * evaluateSupportsDeclaration reaches the unconditional `return true` and
 * reports every non-empty value as supported. css-conditional-3
 * #supports-property-value requires the value to parse according to the
 * property's grammar; CSS.supports('-webkit-box-align','zzz-not-a-value')
 * must be false. Control leg shows the grammar gate works for properties
 * that do carry a generated syntax.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSS } from '../../src/parser-api.ts';
import { SUPPORTED_PROPERTIES } from '../../src/data/gen/property-list.ts';
import { STANDARD_PROPERTIES_SYNTAX } from '../../src/data/gen/standard-syntax.ts';
import { SHORTHANDS } from '../../src/shorthands.ts';

const unsyntaxed = [...SUPPORTED_PROPERTIES].filter(
  (p) => !STANDARD_PROPERTIES_SYNTAX[p] && SHORTHANDS[p] === undefined,
);

test('CRS-0068/C18: legacy properties without generated syntax reject garbage values', () => {
  assert.ok(unsyntaxed.length > 0, 'the fixture expects at least one syntax-less property');
  for (const prop of unsyntaxed) {
    assert.equal(
      CSS.supports(prop, 'zzz-not-a-value'),
      false,
      `${prop} must reject a value that does not match its grammar`,
    );
  }
});

test('control: properties with a generated syntax still reject garbage', () => {
  assert.equal(CSS.supports('color', 'zzz-not-a-color'), false);
});

test('control: the same properties accept the CSS-wide keywords', () => {
  assert.equal(CSS.supports('-webkit-box-align', 'inherit'), true);
});
