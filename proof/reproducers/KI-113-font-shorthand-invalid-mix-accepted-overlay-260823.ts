/**
 * Overlay reproducer for KI-113.  This file intentionally stays red until
 * parse() stops retaining font declarations that mix a system font keyword
 * with size/family components.
 *
 * Reproduces: KI-113
 * Verifies: SYS-REQ-260823-0BRJ (grammar-failing font declaration is dropped)
 *
 * Spec anchors:
 * - css-fonts-4 § "Shorthand font property: the 'font' property"
 *   submodules/csswg-drafts/css-fonts-4/Overview.bs#font-prop (~line 1776):
 *   the Value grammar has exactly two alternatives — the full
 *   style/variant/weight/width? size [/line-height]? family production, or a
 *   lone <<system-font-family-name>>. A value like `menu 10px serif` matches
 *   neither: `menu` cannot be a style/variant/weight/width component, and a
 *   system keyword alternative admits no trailing components.
 * - css-fonts-4 #font-prop-desc note (~line 1990): "the keywords used for the
 *   system fonts listed above are only treated as keywords when they occur in
 *   the initial position" (e.g. `font: large menu` uses a family named
 *   "menu") — initial-position keywords are still only valid ALONE, so adding
 *   size/family around them fails the grammar.
 * - cssom-1 § "parse a CSS declaration block"
 *   submodules/csswg-drafts/cssom-1/Overview.bs#parse-a-css-declaration-block
 *   step 3.1: each declaration is parsed "according to the appropriate CSS
 *   specifications, dropping parts that are said to be ignored. If the whole
 *   declaration is dropped, let parsed declaration be null." A grammar-failing
 *   font declaration must therefore be dropped, not stored verbatim.
 * - Local WPT fixture css/css-fonts/parsing/font-invalid.html:
 *     test_invalid_value('font', 'menu icon');
 *   — the same accept-invalid family this reproducer pins for the parse path.
 *
 * Observed defect: setProperty() and insertRule() honor the ignore-invalid
 * contract (they drop the declaration), but the parse-a-css-declaration-block
 * path stores the failing value verbatim, so getPropertyValue('font') returns
 * 'menu 10px serif' and cssText re-serializes the invalid declaration.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/index.ts';
import type { CSSStyleRule } from '../../src/index.ts';

function firstStyleOf(cssText: string) {
  const sheet = parse(cssText);
  return (sheet.cssRules[0] as CSSStyleRule).style;
}

// Positive controls (green today): every non-parse entry path already honors
// the ignore-invalid contract for the same values, proving the downstream
// storage can represent "dropped" and isolating the escape to the parse path.
test('KI-113 control: setProperty drops the invalid keyword+size+family mix', () => {
  const style = firstStyleOf('.o{}');
  style.setProperty('font', 'menu 10px serif');
  assert.equal(style.getPropertyValue('font'), '');
});

test('KI-113 control: insertRule drops the invalid keyword+size+family mix', () => {
  const sheet = parse('.ki113control{}');
  sheet.insertRule('.b{font: menu 10px serif;}');
  assert.equal((sheet.cssRules[1] as CSSStyleRule).style.getPropertyValue('font'), '');
});

// WPT css/css-fonts/parsing/font-invalid.html: test_invalid_value('font',
// 'menu icon'). cssom-1 #parse-a-css-declaration-block step 3.1 requires the
// dropped declaration to be absent from the parsed result.
// Verifies: SYS-REQ-260823-0BRJ
for (const invalidValue of ['menu icon', 'menu 10px serif', 'icon small-caption 12pt serif']) {
  test(`KI-113: parse(.o{font:${invalidValue};}) drops the grammar-failing declaration`, () => {
    const style = firstStyleOf(`.o{font:${invalidValue};}`);
    assert.equal(
      style.getPropertyValue('font'),
      '',
      'a system font keyword mixed with other components fails the font grammar',
    );
    assert.equal(
      style.cssText,
      '',
      'the dropped declaration must not re-serialize through cssText',
    );
  });
}

// The !important variant of the same grammar failure is equally droppable.
// Verifies: SYS-REQ-260823-0BRJ
test('KI-113: important flag does not rescue an invalid font value', () => {
  const style = firstStyleOf('.o{font: menu 10px serif !important;}');
  assert.equal(style.getPropertyValue('font'), '');
});
