/**
 * Overlay reproducer for KI-112.  This file intentionally stays red until
 * setting `font` to a valid system font keyword stops producing an empty
 * shorthand serialization and keyword-stamped longhand garbage.
 *
 * Reproduces: KI-112
 * Verifies: SYS-REQ-260823-S4DW (shorthand serializes non-empty + round-trips)
 *           SYS-REQ-260823-YQPJ (longhands stay empty, no cssText pollution)
 *
 * Spec anchors:
 * - css-fonts-4 § "Shorthand font property: the 'font' property"
 *   submodules/csswg-drafts/css-fonts-4/Overview.bs#font-prop (~line 1776):
 *     Value: [ [ <<'font-style'> || <font-variant-css2> || <<'font-weight'> ||
 *            <font-width-css3> ]? <<'font-size'> [ / <<'line-height'> ]?
 *            <<'font-family'># ] | <<system-font-family-name>>
 *   A lone system keyword is therefore a grammatically valid font value.
 * - css-fonts-4 § "Syntax of <<system-font-family-name>>" (#system, ~line 397):
 *     <<system-font-family-name>> = caption | icon | menu | message-box |
 *                                   small-caption | status-bar
 *   (see also the #system-font-family-name-value definition at ~line 260).
 * - cssom-1 § "parse a CSS declaration block"
 *   submodules/csswg-drafts/cssom-1/Overview.bs#parse-a-css-declaration-block
 *   step 3.1: declarations are parsed "according to the appropriate CSS
 *   specifications, dropping parts that are said to be ignored" — dropping is
 *   licensed ONLY for grammar-failing values, never for valid ones.
 * - Local WPT fixture css/css-fonts/parsing/font-valid.html
 *   (test_system_font): after `target.style.font = keyword`, asserts
 *   `assert_not_equals(readValue, '', 'font should be set')` and that
 *   re-setting `readValue` round-trips ("serialization should round-trip").
 * - Local WPT fixture css/css-fonts/system-fonts-serialization.tentative.html
 *   asserts for every system font that `target.style.font === systemFont`
 *   ("System font serializes as-is") while each longhand serializes "":
 *     assert_equals(target.style[longhand], "",
 *                   `Longhand '${longhand}' serializes as empty string`);
 *
 * Observed defect (all three of parse(), setProperty(), cssText setter):
 * expandFont() stamps the raw keyword into all 13 font longhands
 * (src/shorthands.ts ~1311-1319), contractFont() then refuses to contract the
 * variant-polluted longhand set back into the shorthand (src/shorthands.ts
 * ~1451-1454), and getPropertyValue('font') falls back to ''
 * (src/CSSStyleDeclaration.ts ~334). cssText serializes the bogus expansion,
 * e.g. `font-style: icon; font-variant: icon icon icon icon icon icon icon; …`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/index.ts';
import type { CSSStyleRule } from '../../src/index.ts';

const SYSTEM_FONT_KEYWORDS = [
  'caption',
  'icon',
  'menu',
  'message-box',
  'small-caption',
  'status-bar',
] as const;

const FONT_LONGHANDS = [
  'font-style',
  'font-variant-caps',
  'font-variant-ligatures',
  'font-variant-alternates',
  'font-variant-numeric',
  'font-variant-east-asian',
  'font-variant-position',
  'font-variant-emoji',
  'font-weight',
  'font-stretch',
  'font-size',
  'line-height',
  'font-family',
] as const;

function firstStyleOf(cssText: string) {
  const sheet = parse(cssText);
  return (sheet.cssRules[0] as CSSStyleRule).style;
}

// Positive control (green today): the ordinary production of the same grammar
// (`[ <'font-style'> || … ]? <'font-size'> [/<'line-height'>]? <'font-family'>`)
// survives parse() and serializes back through getPropertyValue('font').
test('KI-112 control: ordinary font shorthand parses and serializes', () => {
  const style = firstStyleOf('.ki112control{font: 12px serif;}');
  assert.equal(style.getPropertyValue('font'), '12px serif');
});

// css-fonts-4 #font-prop + #system: each lone system keyword is a valid font
// value; cssom-1 #parse-a-css-declaration-block keeps grammar-passing
// declarations. WPT font-valid.html asserts font "should be set".
// Verifies: SYS-REQ-260823-S4DW
for (const keyword of SYSTEM_FONT_KEYWORDS) {
  test(`KI-112: parse(.o{font:${keyword};}) leaves font non-empty`, () => {
    const style = firstStyleOf(`.o{font:${keyword};}`);
    // WPT font-valid.html: assert_not_equals(readValue, '', 'font should be set')
    assert.notEqual(
      style.getPropertyValue('font'),
      '',
      `font:${keyword}; is grammatically valid, so the shorthand must serialize`,
    );
    assert.equal(
      style.getPropertyValue('font'),
      keyword,
      'a lone system font keyword serializes as-is',
    );
  });
}

// WPT font-valid.html round-trip leg: re-setting the serialized value must
// read back unchanged ("serialization should round-trip").
// Verifies: SYS-REQ-260823-S4DW
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
test('KI-112: system font shorthand serialization round-trips via setProperty', () => {
  const style = firstStyleOf('.o{}');
  style.setProperty('font', 'message-box');
  const readValue = style.getPropertyValue('font');
  assert.notEqual(readValue, '', 'setProperty(font, message-box) must be retained');
  style.setProperty('font', readValue);
  assert.equal(style.getPropertyValue('font'), readValue, 'serialization round-trips');
});

// WPT system-fonts-serialization.tentative.html: the shorthand serializes
// as-is while every specified longhand serializes "" — never the stamped
// keyword garbage.
// Verifies: SYS-REQ-260823-YQPJ
for (const keyword of SYSTEM_FONT_KEYWORDS) {
  test(`KI-112: font:${keyword} leaves all specified longhands empty`, () => {
    const style = firstStyleOf(`.o{font:${keyword};}`);
    for (const longhand of FONT_LONGHANDS) {
      assert.equal(
        style.getPropertyValue(longhand),
        '',
        `Longhand '${longhand}' serializes as empty string (WPT system-fonts-serialization.tentative.html)`,
      );
    }
    assert.equal(
      style.cssText,
      `font: ${keyword};`,
      'declaration block serializes the retained shorthand without longhand pollution',
    );
  });
}
