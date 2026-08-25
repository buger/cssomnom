/**
 * Overlay reproducer for KI-125.  This file stays red until the generated
 * PropertyRegistry syntax strings match current property grammars, so that
 * grammar-valid values pass CSSStyleValue.parse.
 *
 * Reproduces: KI-125
 * Verifies: SYS-REQ-260825-7T66
 *
 * Spec anchors (grammar text verified against local submodules today):
 * - css-overflow-3 #scrollbar-gutter-property (~line 882):
 *       Value: auto | stable && both-edges?
 *   so 'stable both-edges' is grammar-valid.
 * - css-fonts-4 #font-variant-alternates-prop (~line 5821):
 *       normal | [ stylistic(<font-feature-value-name>) || historical-forms ||
 *       styleset(<font-feature-value-name>#) || character-variant(...)# ||
 *       swash(...) || ornaments(...) || annotation(...) ]
 *   with #font-feature-value-name-value: <font-feature-value-name> = <ident>,
 *   so 'styleset(ss01)' and 'character-variant(3,5)' are grammar-valid.
 * - css-text-4 #text-indent-property (~line 11439):
 *       Value: [ <length-percentage> ] && hanging? && each-line?
 *   so '10px hanging' is grammar-valid.  (Bare 'hanging' is NOT; the length
 *   carries no '?' — the reproducer uses only valid spellings.)
 * - css-fonts-4 #font-palette-prop (~line 7482) + #palette-identifier
 *   (~line 7589, "<palette-identifier> is parsed as a <dashed-ident>"), so
 *   '--my-palette' is grammar-valid for font-palette.
 *
 * Registry strings observed at HEAD (error messages quote them):
 *   scrollbar-gutter          -> 'auto | stable'
 *   font-variant-alternates   -> 'normal | historical-forms'
 *   text-indent               -> '<length-percentage>'
 *   font-palette              -> 'normal | light | dark'
 * Each rejects a spelling its own specification defines.  Distinct from
 * KI-35/KI-111 (registry ACCEPTS invalid syntax strings / initial values) and
 * KI-38 (cascade ignores the registry): here the registry data itself is stale
 * and rejects VALID input on CSSStyleValue.parse.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleValue } from '../../src/index.ts';

// Verifies: SYS-REQ-260825-7T66 (KI-125 control helper)
// reqproof:proptest:skip single-argument parse wrapper over public CSSStyleValue.parse; assertions live in the enclosing overlay tests below
function parseOk(property: string, value: string) {
  return CSSStyleValue.parse(property, value);
}

test('control: registry-covered spellings keep parsing', () => {
  assert.equal(String(parseOk('scrollbar-gutter', 'stable')), 'stable');
  assert.equal(String(parseOk('font-palette', 'dark')), 'dark');
});

test('control: var()-containing values defer as unparsed instead of rejecting', () => {
  // css-variables substitution defers validation; this must stay accepted.
  const v = parseOk('font-variant-alternates', 'swash(var(--x))');
  assert.ok(v.constructor.name === 'CSSUnparsedValue');
});

test('defect: scrollbar-gutter accepts stable both-edges per css-overflow-3', () => {
  const v = parseOk('scrollbar-gutter', 'stable both-edges');
  assert.match(String(v), /both-edges/);
});

test('defect: font-variant-alternates accepts styleset() per css-fonts-4', () => {
  const v = parseOk('font-variant-alternates', 'styleset(ss01)');
  assert.match(String(v), /styleset\(/);
});

test('defect: text-indent accepts length plus hanging per css-text-4', () => {
  const v = parseOk('text-indent', '10px hanging');
  assert.match(String(v), /hanging/);
});

test('defect: font-palette accepts dashed-ident palette name per css-fonts-4', () => {
  const v = parseOk('font-palette', '--my-palette');
  assert.match(String(v), /--my-palette/);
});
