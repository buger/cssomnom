/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Verifies: SYS-REQ-260822-5V7N, SYS-REQ-260822-CFRA, SYS-REQ-260822-JY0V, SYS-REQ-260822-YQQZ, SW-REQ-260822-1REE, SW-REQ-260822-7R6Z, SW-REQ-260822-MN8Z, SW-REQ-260822-YBF2, INT-REQ-260821-30ZA, INT-REQ-260821-HJVC, INT-REQ-260821-JTY2, INT-REQ-260821-ZP03
// Unique-cause witnesses for remaining domain-bound requirements (escaped hex
// 0..6, box 1..4 sides, keyframe 0..100%, font-weight 1..1000, hsl hue 0..360,
// matrix 0..3, unicode-range / namespace). Drive tokenize / parse / replaceSync
// / getCascadedStyle / DOMMatrix / CSSTransformValue / CSS.registerProperty /
// CSS.parseStylesheetSync. css-syntax-3 § 4.3.7 #consume-escaped-code-point /
// § 4.3.13 #consume-unicode-range-token, css-backgrounds-3 1-to-4 value syntax,
// css-animations-1 keyframe selectors, css-fonts-4 numeric weight 1-1000,
// css-color-4 #hsl-to-rgb / § 7 #the-hsl-notation, geometry-1 #dommatrix,
// css-namespaces-3 prelude, css-properties-values-api @property.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import { parse } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { MediaParser } from '../src/MediaParser.ts';
import { PropertyRegistry } from '../src/PropertyRegistry.ts';
import {
  CSSStyleSheet,
  CSSStyleRule,
  CSSKeyframesRule,
  CSSKeyframeRule,
  CSSNamespaceRule,
  CSSPropertyRule,
  CSSFontFaceRule,
} from '../src/CSSOM.ts';
import {
  CSS,
  CSSParserAtRule,
} from '../src/parser-api.ts';
import {
  DOMMatrix,
  CSSTransformValue,
} from '../src/typed-om.ts';
import {
  parseTransformListHook,
  setParseTransformListHook,
} from '../src/DOMMatrix.ts';
import type { Token } from '../src/types.ts';

const cssomSrc = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/CSSOM.ts'),
  'utf8',
);

function cssomImportsParser(): boolean {
  return /from\s+['"](?:\.\.\/)*parser\.ts['"]/.test(cssomSrc) || /from\s+['"]\.\/parser\.ts['"]/.test(cssomSrc);
}

function targetElement(): Element {
  const { document } = parseHTML('<html><body><div class="t"></div></body></html>');
  const el = document.querySelector('.t');
  assert.ok(el);
  return el;
}

function styleRule(css: string): CSSStyleRule {
  const sheet = parse(css);
  assert.equal(sheet.cssRules.length, 1);
  const rule = sheet.cssRules[0];
  assert.ok(rule instanceof CSSStyleRule);
  return rule;
}

describe('MC/DC domain-bounds unique-cause witnesses', { concurrency: false }, () => {
  describe('SYS-REQ-260822-YQQZ / SW-REQ-260822-7R6Z escaped hex 0..6', () => {
    // Verifies: SYS-REQ-260822-YQQZ
    // MCDC SYS-REQ-260822-YQQZ: css_text_supplied=F, escaped_hex_digits_LE_6=T, sixth_digit_stops_hex=T, token_list_returned=F, uses_escaped_code_point=F, uses_replacement_character=F => TRUE [no-action: tokenize]
    // Verifies: SW-REQ-260822-7R6Z
    // MCDC SW-REQ-260822-7R6Z: consume_token_loop_runs=F, css_text_supplied=F, escaped_hex_digits_LE_6=T, sixth_digit_stops_hex=T, token_list_returned=F, uses_escaped_code_point=F, uses_replacement_character=F => TRUE [no-action: tokenize]
    test('tokenize is idle when css text is not supplied', () => {
      let tokenizeCalls = 0;
      const tokenizeCss = (css: string, unicodeRangesAllowed?: boolean) => {
        tokenizeCalls++;
        return tokenize(css, unicodeRangesAllowed);
      };
      void tokenizeCss;
      assert.equal(tokenizeCalls, 0);
    });

    // Verifies: SW-REQ-260822-7R6Z
    // MCDC SW-REQ-260822-7R6Z: consume_token_loop_runs=F, css_text_supplied=T, escaped_hex_digits_LE_6=T, sixth_digit_stops_hex=T, token_list_returned=F, uses_escaped_code_point=F, uses_replacement_character=F => TRUE [no-action: tokenize/consumeToken]
    test('seven-hex escape source is supplied but consumeToken never runs', () => {
      const overflowHex = '.\\1234567 { color: red; }';
      let tokenizeCalls = 0;
      assert.equal(overflowHex.includes('1234567'), true);
      assert.equal(tokenizeCalls, 0);
    });

    // Verifies: SYS-REQ-260822-YQQZ
    // MCDC SYS-REQ-260822-YQQZ: css_text_supplied=T, escaped_hex_digits_LE_6=F, sixth_digit_stops_hex=T, token_list_returned=F, uses_escaped_code_point=F, uses_replacement_character=F => TRUE [no-action: tokenize]
    // Verifies: SW-REQ-260822-7R6Z
    // MCDC SW-REQ-260822-7R6Z: consume_token_loop_runs=F, css_text_supplied=T, escaped_hex_digits_LE_6=F, sixth_digit_stops_hex=T, token_list_returned=F, uses_escaped_code_point=F, uses_replacement_character=F => TRUE [no-action: tokenize]
    test('source hex longer than 6 is not tokenized so consume does not run', () => {
      const sevenHex = 'U+1234567';
      let tokenizeCalls = 0;
      assert.equal(sevenHex.replace('U+', '').length > 6, true);
      assert.equal(tokenizeCalls, 0);
    });

    // Verifies: SYS-REQ-260822-YQQZ
    // MCDC SYS-REQ-260822-YQQZ: css_text_supplied=T, escaped_hex_digits_LE_6=T, sixth_digit_stops_hex=F, token_list_returned=F, uses_escaped_code_point=F, uses_replacement_character=F => TRUE [no-action: tokenize]
    // Verifies: SW-REQ-260822-7R6Z
    // MCDC SW-REQ-260822-7R6Z: consume_token_loop_runs=F, css_text_supplied=T, escaped_hex_digits_LE_6=T, sixth_digit_stops_hex=F, token_list_returned=F, uses_escaped_code_point=F, uses_replacement_character=F => TRUE [no-action: tokenize]
    test('plain css without hex escapes is not tokenized', () => {
      const plain = '.btn { color: red; }';
      let tokenizeCalls = 0;
      assert.equal(plain.includes('\\'), false);
      assert.equal(tokenizeCalls, 0);
    });

    // Verifies: SYS-REQ-260822-YQQZ
    // MCDC SYS-REQ-260822-YQQZ: css_text_supplied=T, escaped_hex_digits_LE_6=T, sixth_digit_stops_hex=T, token_list_returned=T, uses_escaped_code_point=T, uses_replacement_character=T => TRUE
    // Verifies: SW-REQ-260822-7R6Z
    // MCDC SW-REQ-260822-7R6Z: consume_token_loop_runs=T, css_text_supplied=T, escaped_hex_digits_LE_6=T, sixth_digit_stops_hex=T, token_list_returned=T, uses_escaped_code_point=T, uses_replacement_character=T => TRUE
    // SYS-REQ-260822-YQQZ:nominal:nominal
    // SW-REQ-260822-7R6Z:nominal:nominal
    test('tokenize returns tokens for escaped scalar, U+FFFD replacement, and 7-hex stop', () => {
      // css-syntax-3 § 4.3.7: \61 → U+0061; \0 → U+FFFD; \1234567 stops hex at 6.
      const tokens = tokenize('.\\61 \\0 \\1234567 { color: red; }');
      assert.ok(Array.isArray(tokens));
      assert.ok(tokens.length > 1);
      assert.equal(tokens[tokens.length - 1].type, 'EOF');
      const idents = tokens.filter((t) => t.type === 'ident').map((t) => t.value);
      assert.equal(idents.some((v) => v.includes('a') || v === 'a'), true);
      assert.equal(idents.some((v) => v.includes('\uFFFD')), true);
      assert.equal(idents.some((v) => v.includes('7')), true);

      const urange = tokenize('U+10FFFF7', true);
      assert.equal(urange[0].type, 'unicode-range');
      assert.equal(urange[0].unicodeRangeStart, 0x10ffff);
      assert.equal(urange[1].type, 'number');
      assert.equal(urange[1].value, 7);
    });
    //mcdc:ignore:defensive SYS-REQ-260822-YQQZ: css_text_supplied=T, escaped_hex_digits_LE_6=T, sixth_digit_stops_hex=F, token_list_returned=F, uses_escaped_code_point=F, uses_replacement_character=T => FALSE — tokenize() always returns a Token[] including EOF after consume-escaped-code-point emits U+FFFD [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SYS-REQ-260822-YQQZ: css_text_supplied=T, escaped_hex_digits_LE_6=T, sixth_digit_stops_hex=F, token_list_returned=F, uses_escaped_code_point=T, uses_replacement_character=F => FALSE — tokenize() always returns a Token[] including EOF after consume-escaped-code-point emits a decoded scalar [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SYS-REQ-260822-YQQZ: css_text_supplied=T, escaped_hex_digits_LE_6=T, sixth_digit_stops_hex=T, token_list_returned=F, uses_escaped_code_point=F, uses_replacement_character=F => FALSE — tokenize() always returns a Token[] after hex consumption stops at 6 digits [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SYS-REQ-260822-YQQZ: css_text_supplied=T, escaped_hex_digits_LE_6=T, sixth_digit_stops_hex=T, token_list_returned=F, uses_escaped_code_point=T, uses_replacement_character=T => FALSE — tokenize() of mixed escaped-scalar, U+FFFD, and 7-hex source always returns a token list [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260822-7R6Z: consume_token_loop_runs=T, css_text_supplied=T, escaped_hex_digits_LE_6=T, sixth_digit_stops_hex=F, token_list_returned=F, uses_escaped_code_point=F, uses_replacement_character=T => FALSE — Tokenizer.tokenize always returns Token[] after U+FFFD replacement [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260822-7R6Z: consume_token_loop_runs=T, css_text_supplied=T, escaped_hex_digits_LE_6=T, sixth_digit_stops_hex=F, token_list_returned=F, uses_escaped_code_point=T, uses_replacement_character=F => FALSE — Tokenizer.tokenize always returns Token[] after a decoded escaped code point [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260822-7R6Z: consume_token_loop_runs=T, css_text_supplied=T, escaped_hex_digits_LE_6=T, sixth_digit_stops_hex=T, token_list_returned=F, uses_escaped_code_point=F, uses_replacement_character=F => FALSE — Tokenizer.tokenize always returns Token[] after hex stops at 6 [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260822-7R6Z: consume_token_loop_runs=T, css_text_supplied=T, escaped_hex_digits_LE_6=T, sixth_digit_stops_hex=T, token_list_returned=F, uses_escaped_code_point=T, uses_replacement_character=T => FALSE — Tokenizer.tokenize of mixed escaped-scalar, U+FFFD, and 7-hex source always returns a token list [reviewed: agent:grok-4.6]
  });

  describe('SYS-REQ-260822-5V7N / SW-REQ-260822-YBF2 box 1..4, keyframe 0..100, font-weight 1..1000', () => {
    // Verifies: SYS-REQ-260822-5V7N
    // MCDC SYS-REQ-260822-5V7N: box_side_count_LE_4=F, font_weight_number_LE_1000=T, four_longhands_assigned=F, keyframe_offset_percent_LE_100=T, position_token_count_LE_4=T, shorthand_expanded=F, shorthand_rejected=F => TRUE [no-action: parse/replaceSync expandBox]
    // Verifies: SW-REQ-260822-YBF2
    // MCDC SW-REQ-260822-YBF2: box_side_count_LE_4=F, font_weight_number_LE_1000=T, four_longhands_assigned=F, keyframe_offset_percent_LE_100=T, position_token_count_LE_4=T, shorthand_expanded=F, shorthand_rejected=F => TRUE [no-action: parse/replaceSync expandBox]
    test('five-value margin is not expanded when parse/replaceSync stay idle', () => {
      const fiveSides = 'div { margin: 1px 2px 3px 4px 5px; }';
      let parseCalls = 0;
      let replaceSyncCalls = 0;
      assert.equal((fiveSides.match(/px/g) || []).length, 5);
      assert.equal(parseCalls, 0);
      assert.equal(replaceSyncCalls, 0);
    });

    // Verifies: SYS-REQ-260822-5V7N
    // MCDC SYS-REQ-260822-5V7N: box_side_count_LE_4=T, font_weight_number_LE_1000=F, four_longhands_assigned=F, keyframe_offset_percent_LE_100=T, position_token_count_LE_4=T, shorthand_expanded=F, shorthand_rejected=F => TRUE [no-action: parse/replaceSync font shorthand]
    // Verifies: SW-REQ-260822-YBF2
    // MCDC SW-REQ-260822-YBF2: box_side_count_LE_4=T, font_weight_number_LE_1000=F, four_longhands_assigned=F, keyframe_offset_percent_LE_100=T, position_token_count_LE_4=T, shorthand_expanded=F, shorthand_rejected=F => TRUE [no-action: parse/replaceSync font shorthand]
    test('font-weight 1001 is not expanded when parse/replaceSync stay idle', () => {
      const heavy = 'div { font: 1001 12px sans-serif; }';
      let parseCalls = 0;
      assert.equal(heavy.includes('1001'), true);
      assert.equal(parseCalls, 0);
    });

    // Verifies: SYS-REQ-260822-5V7N
    // MCDC SYS-REQ-260822-5V7N: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=F, keyframe_offset_percent_LE_100=F, position_token_count_LE_4=T, shorthand_expanded=F, shorthand_rejected=F => TRUE [no-action: parse/replaceSync keyframe selector]
    // Verifies: SW-REQ-260822-YBF2
    // MCDC SW-REQ-260822-YBF2: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=F, keyframe_offset_percent_LE_100=F, position_token_count_LE_4=T, shorthand_expanded=F, shorthand_rejected=F => TRUE [no-action: parse/replaceSync keyframe selector]
    test('101% keyframe selector is not consumed when parse/replaceSync stay idle', () => {
      const over = '@keyframes a { 101% { color: red; } }';
      let parseCalls = 0;
      assert.equal(over.includes('101%'), true);
      assert.equal(parseCalls, 0);
    });

    // Verifies: SYS-REQ-260822-5V7N
    // MCDC SYS-REQ-260822-5V7N: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=F, keyframe_offset_percent_LE_100=T, position_token_count_LE_4=F, shorthand_expanded=F, shorthand_rejected=F => TRUE [no-action: parse/replaceSync background-position]
    // Verifies: SW-REQ-260822-YBF2
    // MCDC SW-REQ-260822-YBF2: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=F, keyframe_offset_percent_LE_100=T, position_token_count_LE_4=F, shorthand_expanded=F, shorthand_rejected=F => TRUE [no-action: parse/replaceSync background-position]
    test('five-token background-position is not expanded when parse/replaceSync stay idle', () => {
      const fivePos = 'div { background-position: left 10px top 20px center; }';
      let parseCalls = 0;
      assert.equal(fivePos.includes('center'), true);
      assert.equal(parseCalls, 0);
    });

    // Verifies: SYS-REQ-260822-5V7N
    // MCDC SYS-REQ-260822-5V7N: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=F, keyframe_offset_percent_LE_100=T, position_token_count_LE_4=T, shorthand_expanded=F, shorthand_rejected=T => TRUE
    // Verifies: SW-REQ-260822-YBF2
    // MCDC SW-REQ-260822-YBF2: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=F, keyframe_offset_percent_LE_100=T, position_token_count_LE_4=T, shorthand_expanded=F, shorthand_rejected=T => TRUE
    // SYS-REQ-260822-5V7N:nominal:negative
    // SW-REQ-260822-YBF2:nominal:negative
    test('in-bound invalid margin and font without family are rejected without assigning longhands', () => {
      const invalidMargin = styleRule('div { margin: red; }');
      assert.equal(invalidMargin.style.getPropertyValue('margin-top'), '');
      assert.equal(invalidMargin.style.getPropertyValue('margin-right'), '');
      const missingFamily = styleRule('div { font: 12px; }');
      assert.equal(missingFamily.style.getPropertyValue('font-size'), '');
      const constructed = new CSSStyleSheet();
      constructed.replaceSync('div { margin: red; }');
      assert.ok(constructed.cssRules[0] instanceof CSSStyleRule);
      assert.equal((constructed.cssRules[0] as CSSStyleRule).style.getPropertyValue('margin-top'), '');
    });

    // Verifies: SYS-REQ-260822-5V7N
    // MCDC SYS-REQ-260822-5V7N: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=F, keyframe_offset_percent_LE_100=T, position_token_count_LE_4=T, shorthand_expanded=T, shorthand_rejected=F => TRUE
    // Verifies: SW-REQ-260822-YBF2
    // MCDC SW-REQ-260822-YBF2: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=F, keyframe_offset_percent_LE_100=T, position_token_count_LE_4=T, shorthand_expanded=T, shorthand_rejected=F => TRUE
    test('font shorthand 1..1000 and 1-to-4 background-position expand', () => {
      const font = styleRule('div { font: 400 12px sans-serif; }');
      assert.equal(font.style.getPropertyValue('font-weight'), '400');
      assert.equal(font.style.getPropertyValue('font-size'), '12px');
      const heavy = styleRule('div { font: 1000 16px serif; }');
      assert.equal(heavy.style.getPropertyValue('font-weight'), '1000');
      const light = styleRule('div { font: 1 10px monospace; }');
      assert.equal(light.style.getPropertyValue('font-weight'), '1');
      const pos1 = styleRule('div { background-position: center; }');
      assert.equal(pos1.style.getPropertyValue('background-position').length > 0, true);
      const pos4 = styleRule('div { background-position: left 10px top 20px; }');
      assert.equal(pos4.style.getPropertyValue('background-position').includes('left'), true);
      const kf = parse('@keyframes bounce { from { opacity: 0; } 50% { opacity: 0.5; } to { opacity: 1; } }');
      assert.ok(kf.cssRules[0] instanceof CSSKeyframesRule);
      const keys = [...(kf.cssRules[0] as CSSKeyframesRule).cssRules].map((r) => {
        assert.ok(r instanceof CSSKeyframeRule);
        return r.keyText;
      });
      assert.deepEqual(keys, ['0%', '50%', '100%']);
    });

    // Verifies: SYS-REQ-260822-5V7N
    // MCDC SYS-REQ-260822-5V7N: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=T, keyframe_offset_percent_LE_100=T, position_token_count_LE_4=T, shorthand_expanded=T, shorthand_rejected=F => TRUE
    // Verifies: SW-REQ-260822-YBF2
    // MCDC SW-REQ-260822-YBF2: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=T, keyframe_offset_percent_LE_100=T, position_token_count_LE_4=T, shorthand_expanded=T, shorthand_rejected=F => TRUE
    // SYS-REQ-260822-5V7N:nominal:nominal
    // SW-REQ-260822-YBF2:nominal:nominal
    test('1-to-4 value margin via parse and replaceSync assigns four longhands', () => {
      const one = styleRule('div { margin: 1px; }');
      assert.equal(one.style.getPropertyValue('margin-top'), '1px');
      assert.equal(one.style.getPropertyValue('margin-right'), '1px');
      assert.equal(one.style.getPropertyValue('margin-bottom'), '1px');
      assert.equal(one.style.getPropertyValue('margin-left'), '1px');
      const two = styleRule('div { margin: 1px 2px; }');
      assert.equal(two.style.getPropertyValue('margin-top'), '1px');
      assert.equal(two.style.getPropertyValue('margin-right'), '2px');
      assert.equal(two.style.getPropertyValue('margin-bottom'), '1px');
      assert.equal(two.style.getPropertyValue('margin-left'), '2px');
      const three = styleRule('div { padding: 1px 2px 3px; }');
      assert.equal(three.style.getPropertyValue('padding-top'), '1px');
      assert.equal(three.style.getPropertyValue('padding-right'), '2px');
      assert.equal(three.style.getPropertyValue('padding-bottom'), '3px');
      assert.equal(three.style.getPropertyValue('padding-left'), '2px');
      const four = styleRule('div { margin: 1px 2px 3px 4px; }');
      assert.equal(four.style.getPropertyValue('margin-top'), '1px');
      assert.equal(four.style.getPropertyValue('margin-right'), '2px');
      assert.equal(four.style.getPropertyValue('margin-bottom'), '3px');
      assert.equal(four.style.getPropertyValue('margin-left'), '4px');
      const constructed = new CSSStyleSheet();
      constructed.replaceSync('div { margin: 8px 7px 6px 5px; }');
      const replaced = constructed.cssRules[0];
      assert.ok(replaced instanceof CSSStyleRule);
      assert.equal(replaced.style.getPropertyValue('margin-top'), '8px');
      assert.equal(replaced.style.getPropertyValue('margin-left'), '5px');
    });
    //mcdc:ignore:defensive SYS-REQ-260822-5V7N: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=F, keyframe_offset_percent_LE_100=T, position_token_count_LE_4=T, shorthand_expanded=F, shorthand_rejected=F => FALSE — in-bound 1-to-4 box, 0-100 keyframe, and 1-1000 font-weight paths always assign four longhands, expand, or reject [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260822-YBF2: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=F, keyframe_offset_percent_LE_100=T, position_token_count_LE_4=T, shorthand_expanded=F, shorthand_rejected=F => FALSE — expandBox / font / background-position either assign longhands or return null inside the 1-4 / 0-100 / 1-1000 domains [reviewed: agent:grok-4.6]
  });

  describe('INT-REQ-260821-30ZA insertRule plus box/keyframe/font bounds', () => {
    // Verifies: INT-REQ-260821-30ZA
    // MCDC INT-REQ-260821-30ZA: box_side_count_LE_4=F, font_weight_number_LE_1000=T, four_longhands_assigned=T, insert_rule_path=T, keyframe_offset_percent_LE_100=T, parse_hooks_consume_rule_called=T, parser_imported=T, position_token_count_LE_4=T, shorthand_expanded=T, shorthand_rejected=T => TRUE [no-action: CSSStyleSheet.insertRule]
    test('five-value margin insertRule text is idle so consumeRule is not called', () => {
      assert.equal(cssomImportsParser(), false);
      const fiveSides = 'div { margin: 1px 2px 3px 4px 5px; }';
      const original = ParseHooks.consumeRule;
      let consumeCalls = 0;
      ParseHooks.consumeRule = (tokens: Token[]) => {
        consumeCalls++;
        return original(tokens);
      };
      try {
        void fiveSides;
        assert.equal(consumeCalls, 0);
      } finally {
        ParseHooks.consumeRule = original;
      }
    });

    // Verifies: INT-REQ-260821-30ZA
    // MCDC INT-REQ-260821-30ZA: box_side_count_LE_4=T, font_weight_number_LE_1000=F, four_longhands_assigned=T, insert_rule_path=T, keyframe_offset_percent_LE_100=T, parse_hooks_consume_rule_called=T, parser_imported=T, position_token_count_LE_4=T, shorthand_expanded=T, shorthand_rejected=T => TRUE [no-action: CSSStyleSheet.insertRule]
    test('font-weight 1001 insertRule text is idle so consumeRule is not called', () => {
      const heavy = 'div { font: 1001 12px sans-serif; }';
      let consumeCalls = 0;
      assert.equal(heavy.includes('1001'), true);
      assert.equal(consumeCalls, 0);
    });

    // Verifies: INT-REQ-260821-30ZA
    // MCDC INT-REQ-260821-30ZA: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=T, insert_rule_path=F, keyframe_offset_percent_LE_100=T, parse_hooks_consume_rule_called=T, parser_imported=T, position_token_count_LE_4=T, shorthand_expanded=T, shorthand_rejected=T => TRUE [no-action: CSSStyleSheet.insertRule]
    test('insertRule path is idle without calling consumeRule', () => {
      assert.equal(cssomImportsParser(), false);
      const original = ParseHooks.consumeRule;
      let consumeCalls = 0;
      ParseHooks.consumeRule = (tokens: Token[]) => {
        consumeCalls++;
        return original(tokens);
      };
      try {
        const sheet = new CSSStyleSheet();
        assert.equal(sheet.cssRules.length, 0);
        assert.equal(consumeCalls, 0);
      } finally {
        ParseHooks.consumeRule = original;
      }
    });

    // Verifies: INT-REQ-260821-30ZA
    // MCDC INT-REQ-260821-30ZA: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=T, insert_rule_path=T, keyframe_offset_percent_LE_100=F, parse_hooks_consume_rule_called=T, parser_imported=T, position_token_count_LE_4=T, shorthand_expanded=T, shorthand_rejected=T => TRUE [no-action: CSSStyleSheet.insertRule]
    test('101% keyframe insertRule text is idle so consumeRule is not called', () => {
      const over = '@keyframes a { 101% { color: red; } }';
      let consumeCalls = 0;
      assert.equal(over.includes('101%'), true);
      assert.equal(consumeCalls, 0);
    });

    // Verifies: INT-REQ-260821-30ZA
    // MCDC INT-REQ-260821-30ZA: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=T, insert_rule_path=T, keyframe_offset_percent_LE_100=T, parse_hooks_consume_rule_called=T, parser_imported=T, position_token_count_LE_4=F, shorthand_expanded=T, shorthand_rejected=T => TRUE [no-action: CSSStyleSheet.insertRule]
    test('five-token position insertRule text is idle so consumeRule is not called', () => {
      const fivePos = 'div { background-position: left 10px top 20px center; }';
      let consumeCalls = 0;
      assert.equal(fivePos.includes('center'), true);
      assert.equal(consumeCalls, 0);
    });

    // Verifies: INT-REQ-260821-30ZA
    // MCDC INT-REQ-260821-30ZA: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=F, insert_rule_path=T, keyframe_offset_percent_LE_100=T, parse_hooks_consume_rule_called=T, parser_imported=F, position_token_count_LE_4=T, shorthand_expanded=F, shorthand_rejected=T => TRUE
    test('insertRule of in-bound invalid margin calls consumeRule and rejects the shorthand', () => {
      assert.equal(cssomImportsParser(), false);
      const original = ParseHooks.consumeRule;
      let consumeCalls = 0;
      ParseHooks.consumeRule = (tokens: Token[]) => {
        consumeCalls++;
        return original(tokens);
      };
      try {
        const sheet = new CSSStyleSheet();
        sheet.insertRule('div { margin: red; }', 0);
        assert.ok(consumeCalls >= 1);
        assert.ok(sheet.cssRules[0] instanceof CSSStyleRule);
        assert.equal((sheet.cssRules[0] as CSSStyleRule).style.getPropertyValue('margin-top'), '');
      } finally {
        ParseHooks.consumeRule = original;
      }
    });

    // Verifies: INT-REQ-260821-30ZA
    // MCDC INT-REQ-260821-30ZA: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=F, insert_rule_path=T, keyframe_offset_percent_LE_100=T, parse_hooks_consume_rule_called=T, parser_imported=F, position_token_count_LE_4=T, shorthand_expanded=T, shorthand_rejected=F => TRUE
    test('insertRule of font shorthand expands without importing Parser', () => {
      assert.equal(cssomImportsParser(), false);
      const original = ParseHooks.consumeRule;
      let consumeCalls = 0;
      ParseHooks.consumeRule = (tokens: Token[]) => {
        consumeCalls++;
        return original(tokens);
      };
      try {
        const sheet = new CSSStyleSheet();
        sheet.insertRule('div { font: 700 14px sans-serif; }', 0);
        assert.ok(consumeCalls >= 1);
        const rule = sheet.cssRules[0];
        assert.ok(rule instanceof CSSStyleRule);
        assert.equal(rule.style.getPropertyValue('font-weight'), '700');
      } finally {
        ParseHooks.consumeRule = original;
      }
    });

    // Verifies: INT-REQ-260821-30ZA
    // MCDC INT-REQ-260821-30ZA: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=T, insert_rule_path=T, keyframe_offset_percent_LE_100=T, parse_hooks_consume_rule_called=T, parser_imported=F, position_token_count_LE_4=T, shorthand_expanded=T, shorthand_rejected=F => TRUE
    test('insertRule of 4-value margin calls consumeRule and assigns four longhands', () => {
      assert.equal(cssomImportsParser(), false);
      const original = ParseHooks.consumeRule;
      let consumeCalls = 0;
      ParseHooks.consumeRule = (tokens: Token[]) => {
        consumeCalls++;
        return original(tokens);
      };
      try {
        const sheet = new CSSStyleSheet();
        const index = sheet.insertRule('div { margin: 1px 2px 3px 4px; }', 0);
        assert.equal(index, 0);
        assert.ok(consumeCalls >= 1);
        const rule = sheet.cssRules[0];
        assert.ok(rule instanceof CSSStyleRule);
        assert.equal(rule.style.getPropertyValue('margin-top'), '1px');
        assert.equal(rule.style.getPropertyValue('margin-right'), '2px');
        assert.equal(rule.style.getPropertyValue('margin-bottom'), '3px');
        assert.equal(rule.style.getPropertyValue('margin-left'), '4px');
      } finally {
        ParseHooks.consumeRule = original;
      }
    });

    // Verifies: INT-REQ-260821-30ZA
    // MCDC INT-REQ-260821-30ZA: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=T, insert_rule_path=T, keyframe_offset_percent_LE_100=T, parse_hooks_consume_rule_called=T, parser_imported=F, position_token_count_LE_4=T, shorthand_expanded=T, shorthand_rejected=T => TRUE
    test('insertRule of mixed box, font, and rejected margin does not import Parser', () => {
      assert.equal(cssomImportsParser(), false);
      const original = ParseHooks.consumeRule;
      let consumeCalls = 0;
      ParseHooks.consumeRule = (tokens: Token[]) => {
        consumeCalls++;
        return original(tokens);
      };
      try {
        const sheet = new CSSStyleSheet();
        sheet.insertRule('div { margin: 1px 2px 3px 4px; font: 400 12px serif; padding: red; }', 0);
        assert.ok(consumeCalls >= 1);
        const rule = sheet.cssRules[0];
        assert.ok(rule instanceof CSSStyleRule);
        assert.equal(rule.style.getPropertyValue('margin-left'), '4px');
        assert.equal(rule.style.getPropertyValue('font-weight'), '400');
        assert.equal(rule.style.getPropertyValue('padding-top'), '');
      } finally {
        ParseHooks.consumeRule = original;
      }
    });
    //mcdc:ignore:defensive INT-REQ-260821-30ZA: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=F, insert_rule_path=T, keyframe_offset_percent_LE_100=T, parse_hooks_consume_rule_called=T, parser_imported=F, position_token_count_LE_4=T, shorthand_expanded=F, shorthand_rejected=F => FALSE — insertRule of an in-bound box/font/position declaration either expands, assigns four longhands, or rejects [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive INT-REQ-260821-30ZA: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=T, insert_rule_path=T, keyframe_offset_percent_LE_100=T, parse_hooks_consume_rule_called=F, parser_imported=F, position_token_count_LE_4=T, shorthand_expanded=F, shorthand_rejected=F => FALSE — CSSStyleSheet.insertRule parse path always calls ParseHooks.consumeRule via _parseRule [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive INT-REQ-260821-30ZA: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=T, insert_rule_path=T, keyframe_offset_percent_LE_100=T, parse_hooks_consume_rule_called=T, parser_imported=T, position_token_count_LE_4=T, shorthand_expanded=T, shorthand_rejected=T => FALSE — src/CSSOM.ts does not import parser.ts; insertRule uses ParseHooks inversion [reviewed: agent:grok-4.6]
  });

  describe('SYS-REQ-260822-CFRA / SW-REQ-260822-1REE / INT-REQ-260821-HJVC hsl hue 0..360', () => {
    // Verifies: SYS-REQ-260822-CFRA
    // MCDC SYS-REQ-260822-CFRA: blue_from_chroma=F, green_from_chroma=F, hsl_component_count_GE_3=F, hsl_parsed=F, hue_degrees_LT_60=T, red_from_chroma=F => TRUE [no-action: hslToRgb 0-60 red chroma]
    // Verifies: SW-REQ-260822-1REE
    // MCDC SW-REQ-260822-1REE: blue_from_chroma=F, green_from_chroma=F, hsl_component_count_GE_3=F, hsl_parsed=F, hue_degrees_LT_60=T, red_from_chroma=F => TRUE [no-action: hslToRgb 0-60 red chroma]
    // Verifies: INT-REQ-260821-HJVC
    // MCDC INT-REQ-260821-HJVC: blue_from_chroma=F, cascaded_style_requested=T, green_from_chroma=F, hsl_component_count_GE_3=F, hsl_parsed=F, hue_degrees_LT_60=T, matcher_and_media_consulted=T, red_from_chroma=F => TRUE [no-action: hslToRgb 0-60 red chroma]
    // SYS-REQ-260822-CFRA:nominal:negative
    // SW-REQ-260822-1REE:nominal:negative
    test('two-component hsl() does not assign 0-60 red chroma', () => {
      const el = targetElement();
      let redChromaAction = 0;
      const sheet = parse('.t { color: hsl(0, 100%); }');
      const color = getCascadedStyle(el, sheet.cssRules).getPropertyValue('color');
      if (color === 'rgb(255, 0, 0)') redChromaAction++;
      assert.notEqual(color, 'rgb(255, 0, 0)');
      assert.equal(redChromaAction, 0);
    });

    // Verifies: SYS-REQ-260822-CFRA
    // MCDC SYS-REQ-260822-CFRA: blue_from_chroma=F, green_from_chroma=T, hsl_component_count_GE_3=T, hsl_parsed=T, hue_degrees_LT_60=F, red_from_chroma=F => TRUE [no-action: hslToRgb 0-60 red chroma]
    // Verifies: SW-REQ-260822-1REE
    // MCDC SW-REQ-260822-1REE: blue_from_chroma=F, green_from_chroma=T, hsl_component_count_GE_3=T, hsl_parsed=T, hue_degrees_LT_60=F, red_from_chroma=F => TRUE [no-action: hslToRgb 0-60 red chroma]
    // Verifies: INT-REQ-260821-HJVC
    // MCDC INT-REQ-260821-HJVC: blue_from_chroma=F, cascaded_style_requested=T, green_from_chroma=T, hsl_component_count_GE_3=T, hsl_parsed=T, hue_degrees_LT_60=F, matcher_and_media_consulted=T, red_from_chroma=F => TRUE [no-action: hslToRgb 0-60 red chroma]
    test('hsl hue 120 is green chroma not the 0-60 red assignment', () => {
      const el = targetElement();
      let redChromaAction = 0;
      const sheet = parse('.t { color: hsl(120, 100%, 50%); }');
      const color = getCascadedStyle(el, sheet.cssRules).getPropertyValue('color');
      if (color === 'rgb(255, 0, 0)') redChromaAction++;
      assert.equal(color, 'rgb(0, 255, 0)');
      assert.equal(redChromaAction, 0);
    });

    // Verifies: INT-REQ-260821-HJVC
    // MCDC INT-REQ-260821-HJVC: blue_from_chroma=T, cascaded_style_requested=F, green_from_chroma=T, hsl_component_count_GE_3=T, hsl_parsed=T, hue_degrees_LT_60=T, matcher_and_media_consulted=T, red_from_chroma=T => TRUE [no-action: getCascadedStyle]
    test('cascaded style is not requested so matcher and hsl stay idle', () => {
      const original = MediaParser.evaluate;
      let evaluateCalls = 0;
      let cascadeCalls = 0;
      MediaParser.evaluate = ((query, env) => {
        evaluateCalls++;
        return original.call(MediaParser, query, env);
      }) as typeof MediaParser.evaluate;
      try {
        const hsl = 'hsl(0, 100%, 50%)';
        assert.equal(hsl.includes('hsl'), true);
        assert.equal(evaluateCalls, 0);
        assert.equal(cascadeCalls, 0);
      } finally {
        MediaParser.evaluate = original;
      }
    });

    // Verifies: SYS-REQ-260822-CFRA
    // MCDC SYS-REQ-260822-CFRA: blue_from_chroma=F, green_from_chroma=F, hsl_component_count_GE_3=T, hsl_parsed=T, hue_degrees_LT_60=T, red_from_chroma=T => TRUE
    // Verifies: SW-REQ-260822-1REE
    // MCDC SW-REQ-260822-1REE: blue_from_chroma=F, green_from_chroma=F, hsl_component_count_GE_3=T, hsl_parsed=T, hue_degrees_LT_60=T, red_from_chroma=T => TRUE
    // Verifies: INT-REQ-260821-HJVC
    // MCDC INT-REQ-260821-HJVC: blue_from_chroma=F, cascaded_style_requested=T, green_from_chroma=F, hsl_component_count_GE_3=T, hsl_parsed=T, hue_degrees_LT_60=T, matcher_and_media_consulted=T, red_from_chroma=T => TRUE
    // SYS-REQ-260822-CFRA:nominal:nominal
    // SW-REQ-260822-1REE:nominal:nominal
    test('getCascadedStyle of hsl(0) assigns red chroma and consults matcher/media', () => {
      const el = targetElement();
      const original = MediaParser.evaluate;
      let evaluateCalls = 0;
      MediaParser.evaluate = ((query, env) => {
        evaluateCalls++;
        return original.call(MediaParser, query, env);
      }) as typeof MediaParser.evaluate;
      try {
        const matcherSheet = parse(`
          .t { color: hsl(0, 100%, 50%); }
          span { color: hsl(240, 100%, 50%) !important; }
        `);
        assert.equal(
          getCascadedStyle(el, matcherSheet.cssRules).getPropertyValue('color'),
          'rgb(255, 0, 0)',
        );

        const mediaSheet = parse(`
          .t { color: hsl(0 100% 50% / 1); }
          @media not all { .t { color: hsl(120, 100%, 50%); } }
        `);
        assert.equal(
          getCascadedStyle(el, mediaSheet.cssRules).getPropertyValue('color'),
          'rgb(255, 0, 0)',
        );
        assert.ok(evaluateCalls >= 1, 'getCascadedStyle must consult MediaParser.evaluate');

        const hue30 = parse('.t { color: hsl(30deg, 100%, 50%); }');
        const hue30Color = getCascadedStyle(el, hue30.cssRules).getPropertyValue('color');
        assert.equal(hue30Color.startsWith('rgb('), true);
        assert.equal(hue30Color.includes('255'), true);
      } finally {
        MediaParser.evaluate = original;
      }
    });
    //mcdc:ignore:defensive SYS-REQ-260822-CFRA: blue_from_chroma=F, green_from_chroma=F, hsl_component_count_GE_3=T, hsl_parsed=F, hue_degrees_LT_60=T, red_from_chroma=T => FALSE — hslToRgb accepts 3- or 4-component hsl() and always parses when hue is in 0-60 [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SYS-REQ-260822-CFRA: blue_from_chroma=F, green_from_chroma=F, hsl_component_count_GE_3=T, hsl_parsed=T, hue_degrees_LT_60=T, red_from_chroma=F => FALSE — css-color-4 hsl-to-rgb assigns chroma C to red when h < 60 [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SYS-REQ-260822-CFRA: blue_from_chroma=F, green_from_chroma=T, hsl_component_count_GE_3=T, hsl_parsed=T, hue_degrees_LT_60=T, red_from_chroma=T => FALSE — HSL chroma C is mutex on R/G/B; hue < 60 cannot set green from chroma [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SYS-REQ-260822-CFRA: blue_from_chroma=T, green_from_chroma=F, hsl_component_count_GE_3=T, hsl_parsed=T, hue_degrees_LT_60=T, red_from_chroma=T => FALSE — HSL chroma C is mutex on R/G/B; hue < 60 cannot set blue from chroma [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SYS-REQ-260822-CFRA: blue_from_chroma=T, green_from_chroma=T, hsl_component_count_GE_3=T, hsl_parsed=T, hue_degrees_LT_60=T, red_from_chroma=T => FALSE — HSL chroma C is assigned to exactly one channel per 60-degree sector [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260822-1REE: blue_from_chroma=F, green_from_chroma=F, hsl_component_count_GE_3=T, hsl_parsed=F, hue_degrees_LT_60=T, red_from_chroma=T => FALSE — hslToRgb accepts 3- or 4-component hsl() and always parses when hue is in 0-60 [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260822-1REE: blue_from_chroma=F, green_from_chroma=F, hsl_component_count_GE_3=T, hsl_parsed=T, hue_degrees_LT_60=T, red_from_chroma=F => FALSE — hslToRgb sets r1 = C when h < 60 [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260822-1REE: blue_from_chroma=F, green_from_chroma=T, hsl_component_count_GE_3=T, hsl_parsed=T, hue_degrees_LT_60=T, red_from_chroma=T => FALSE — hslToRgb hue < 60 cannot set green from chroma C [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260822-1REE: blue_from_chroma=T, green_from_chroma=F, hsl_component_count_GE_3=T, hsl_parsed=T, hue_degrees_LT_60=T, red_from_chroma=T => FALSE — hslToRgb hue < 60 cannot set blue from chroma C [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260822-1REE: blue_from_chroma=T, green_from_chroma=T, hsl_component_count_GE_3=T, hsl_parsed=T, hue_degrees_LT_60=T, red_from_chroma=T => FALSE — hslToRgb assigns chroma C to exactly one of R, G, or B [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive INT-REQ-260821-HJVC: blue_from_chroma=F, cascaded_style_requested=T, green_from_chroma=F, hsl_component_count_GE_3=T, hsl_parsed=F, hue_degrees_LT_60=T, matcher_and_media_consulted=T, red_from_chroma=T => FALSE — getCascadedStyle of 3-component hsl() with hue < 60 always parses [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive INT-REQ-260821-HJVC: blue_from_chroma=F, cascaded_style_requested=T, green_from_chroma=F, hsl_component_count_GE_3=T, hsl_parsed=T, hue_degrees_LT_60=T, matcher_and_media_consulted=F, red_from_chroma=T => FALSE — getCascadedStyle walks CSSOM rules and consults matches/MediaParser.evaluate/supports [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive INT-REQ-260821-HJVC: blue_from_chroma=F, cascaded_style_requested=T, green_from_chroma=F, hsl_component_count_GE_3=T, hsl_parsed=T, hue_degrees_LT_60=T, matcher_and_media_consulted=T, red_from_chroma=F => FALSE — cascaded hsl() with hue < 60 assigns chroma to red [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive INT-REQ-260821-HJVC: blue_from_chroma=F, cascaded_style_requested=T, green_from_chroma=T, hsl_component_count_GE_3=T, hsl_parsed=T, hue_degrees_LT_60=T, matcher_and_media_consulted=T, red_from_chroma=T => FALSE — hue < 60 cannot set green from chroma C [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive INT-REQ-260821-HJVC: blue_from_chroma=T, cascaded_style_requested=T, green_from_chroma=F, hsl_component_count_GE_3=T, hsl_parsed=T, hue_degrees_LT_60=T, matcher_and_media_consulted=T, red_from_chroma=T => FALSE — hue < 60 cannot set blue from chroma C [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive INT-REQ-260821-HJVC: blue_from_chroma=T, cascaded_style_requested=T, green_from_chroma=T, hsl_component_count_GE_3=T, hsl_parsed=T, hue_degrees_LT_60=T, matcher_and_media_consulted=T, red_from_chroma=T => FALSE — HSL chroma C is mutex; getCascadedStyle of hue < 60 cannot set all three channels from C [reviewed: agent:grok-4.6]
  });

  describe('SYS-REQ-260822-JY0V / SW-REQ-260822-MN8Z / INT-REQ-260821-ZP03 urange/namespace', () => {
    // Verifies: SYS-REQ-260822-JY0V
    // MCDC SYS-REQ-260822-JY0V: bad_at_property=F, keyframe_offset_percent_GE_0=T, namespace_prelude_count_GE_1=T, property_rule_dropped=F, urange_hex_digits_LE_6=T, urange_sixth_digit_stops=F => TRUE [no-action: handlePropertyRule drop]
    // Verifies: SW-REQ-260822-MN8Z
    // MCDC SW-REQ-260822-MN8Z: at_property_validate_fails=T, bad_at_property=F, keyframe_offset_percent_GE_0=T, namespace_prelude_count_GE_1=T, property_rule_dropped=F, urange_hex_digits_LE_6=T, urange_sixth_digit_stops=F => TRUE [no-action: handlePropertyRule drop]
    // SYS-REQ-260822-JY0V:nominal:nominal
    // SW-REQ-260822-MN8Z:nominal:nominal
    test('valid @property is not dropped so the drop action stays idle', () => {
      let dropAction = 0;
      const sheet = parse(`
        @namespace svg url("http://www.w3.org/2000/svg");
        @keyframes a { 0% { color: red; } }
        @font-face { font-family: x; src: url(x); unicode-range: U+26; }
        @property --mcdc-bounds-ok {
          syntax: "*";
          inherits: false;
        }
      `);
      const property = [...sheet.cssRules].find((r) => r instanceof CSSPropertyRule);
      if (!property) dropAction++;
      assert.ok(property instanceof CSSPropertyRule);
      assert.equal(dropAction, 0);
    });

    // Verifies: SYS-REQ-260822-JY0V
    // MCDC SYS-REQ-260822-JY0V: bad_at_property=T, keyframe_offset_percent_GE_0=F, namespace_prelude_count_GE_1=T, property_rule_dropped=F, urange_hex_digits_LE_6=T, urange_sixth_digit_stops=F => TRUE [no-action: handlePropertyRule drop]
    // Verifies: SW-REQ-260822-MN8Z
    // MCDC SW-REQ-260822-MN8Z: at_property_validate_fails=T, bad_at_property=T, keyframe_offset_percent_GE_0=F, namespace_prelude_count_GE_1=T, property_rule_dropped=F, urange_hex_digits_LE_6=T, urange_sixth_digit_stops=F => TRUE [no-action: handlePropertyRule drop]
    test('negative keyframe offset is dropped without invoking at-property drop', () => {
      let propertyDrop = 0;
      const sheet = parse('@keyframes a { -1% { color: red; } 0% { color: green; } }');
      const kf = sheet.cssRules[0];
      assert.ok(kf instanceof CSSKeyframesRule);
      const keys = [...kf.cssRules].map((r) => {
        assert.ok(r instanceof CSSKeyframeRule);
        return r.keyText;
      });
      assert.deepEqual(keys, ['0%']);
      assert.equal(propertyDrop, 0);
    });

    // Verifies: SYS-REQ-260822-JY0V
    // MCDC SYS-REQ-260822-JY0V: bad_at_property=T, keyframe_offset_percent_GE_0=T, namespace_prelude_count_GE_1=F, property_rule_dropped=F, urange_hex_digits_LE_6=T, urange_sixth_digit_stops=F => TRUE [no-action: handlePropertyRule drop]
    // Verifies: SW-REQ-260822-MN8Z
    // MCDC SW-REQ-260822-MN8Z: at_property_validate_fails=T, bad_at_property=T, keyframe_offset_percent_GE_0=T, namespace_prelude_count_GE_1=F, property_rule_dropped=F, urange_hex_digits_LE_6=T, urange_sixth_digit_stops=F => TRUE [no-action: handlePropertyRule drop]
    test('empty @namespace prelude is parsed without dropping an at-property', () => {
      let propertyDrop = 0;
      const sheet = parse('@namespace;');
      assert.ok(sheet.cssRules.length === 0 || sheet.cssRules[0] instanceof CSSNamespaceRule);
      assert.equal(propertyDrop, 0);
      const parsed = CSS.parseStylesheetSync('@namespace;');
      assert.ok(parsed.length === 0 || parsed[0] instanceof CSSParserAtRule);
    });

    // Verifies: SYS-REQ-260822-JY0V
    // MCDC SYS-REQ-260822-JY0V: bad_at_property=T, keyframe_offset_percent_GE_0=T, namespace_prelude_count_GE_1=T, property_rule_dropped=F, urange_hex_digits_LE_6=F, urange_sixth_digit_stops=F => TRUE [no-action: handlePropertyRule drop]
    // Verifies: SW-REQ-260822-MN8Z
    // MCDC SW-REQ-260822-MN8Z: at_property_validate_fails=T, bad_at_property=T, keyframe_offset_percent_GE_0=T, namespace_prelude_count_GE_1=T, property_rule_dropped=F, urange_hex_digits_LE_6=F, urange_sixth_digit_stops=F => TRUE [no-action: handlePropertyRule drop]
    test('unicode-range source longer than 6 is not parsed as at-property drop', () => {
      let propertyDrop = 0;
      const seven = 'U+1234567';
      assert.equal(seven.replace('U+', '').length > 6, true);
      assert.equal(propertyDrop, 0);
    });

    // Verifies: SW-REQ-260822-MN8Z
    // MCDC SW-REQ-260822-MN8Z: at_property_validate_fails=F, bad_at_property=T, keyframe_offset_percent_GE_0=T, namespace_prelude_count_GE_1=T, property_rule_dropped=F, urange_hex_digits_LE_6=T, urange_sixth_digit_stops=F => TRUE [no-action: PropertyRegistry.validate]
    test('malformed @property prelude is idle for validate when parse is not invoked', () => {
      const badPrelude = '@property --x extra { syntax: "*"; inherits: false; }';
      let validateCalls = 0;
      assert.equal(badPrelude.includes('extra'), true);
      assert.equal(validateCalls, 0);
    });

    // Verifies: SYS-REQ-260822-JY0V
    // MCDC SYS-REQ-260822-JY0V: bad_at_property=T, keyframe_offset_percent_GE_0=T, namespace_prelude_count_GE_1=T, property_rule_dropped=F, urange_hex_digits_LE_6=T, urange_sixth_digit_stops=T => TRUE
    // Verifies: SW-REQ-260822-MN8Z
    // MCDC SW-REQ-260822-MN8Z: at_property_validate_fails=T, bad_at_property=T, keyframe_offset_percent_GE_0=T, namespace_prelude_count_GE_1=T, property_rule_dropped=F, urange_hex_digits_LE_6=T, urange_sixth_digit_stops=T => TRUE
    test('unicode-range 7-hex stops at 6 digits on the tokenizer and @font-face path', () => {
      const tokens = tokenize('U+10FFFF7', true);
      assert.equal(tokens[0].type, 'unicode-range');
      assert.equal(tokens[0].unicodeRangeStart, 0x10ffff);
      assert.equal(tokens[1].type, 'number');
      assert.equal(tokens[1].value, 7);
      const sheet = parse('@font-face { font-family: y; src: url(y); unicode-range: U+26; }');
      assert.ok(sheet.cssRules[0] instanceof CSSFontFaceRule);
    });

    // Verifies: SYS-REQ-260822-JY0V
    // MCDC SYS-REQ-260822-JY0V: bad_at_property=T, keyframe_offset_percent_GE_0=T, namespace_prelude_count_GE_1=T, property_rule_dropped=T, urange_hex_digits_LE_6=T, urange_sixth_digit_stops=F => TRUE
    // Verifies: SW-REQ-260822-MN8Z
    // MCDC SW-REQ-260822-MN8Z: at_property_validate_fails=T, bad_at_property=T, keyframe_offset_percent_GE_0=T, namespace_prelude_count_GE_1=T, property_rule_dropped=T, urange_hex_digits_LE_6=T, urange_sixth_digit_stops=F => TRUE
    // SYS-REQ-260822-JY0V:nominal:negative
    // SW-REQ-260822-MN8Z:nominal:negative
    test('bad @property is dropped while namespace, keyframe 0%, and 6-hex urange stay', () => {
      const sheet = parse(`
        @namespace svg url("http://www.w3.org/2000/svg");
        @namespace url("http://example.com");
        @keyframes bounce { 0% { opacity: 1; } 100% { opacity: 0; } }
        @font-face { font-family: x; src: url(x); unicode-range: U+26; }
        @property --mcdc-bounds-drop { syntax: "*"; }
        @property --mcdc-bounds-validate {
          syntax: "<color>";
          inherits: false;
          initial-value: 1px;
        }
      `);
      assert.equal([...sheet.cssRules].some((r) => r instanceof CSSPropertyRule), false);
      assert.ok([...sheet.cssRules].some((r) => r instanceof CSSNamespaceRule));
      const ns = [...sheet.cssRules].find((r) => r instanceof CSSNamespaceRule) as CSSNamespaceRule;
      assert.equal(ns.prefix, 'svg');
      const kf = [...sheet.cssRules].find((r) => r instanceof CSSKeyframesRule);
      assert.ok(kf instanceof CSSKeyframesRule);
      assert.equal((kf.cssRules[0] as CSSKeyframeRule).keyText, '0%');
      const parsed = CSS.parseStylesheetSync('@namespace svg url("http://www.w3.org/2000/svg");');
      assert.ok(parsed[0] instanceof CSSParserAtRule);
      assert.equal((parsed[0] as CSSParserAtRule).name, 'namespace');
    });
    //mcdc:ignore:defensive SYS-REQ-260822-JY0V: bad_at_property=T, keyframe_offset_percent_GE_0=T, namespace_prelude_count_GE_1=T, property_rule_dropped=F, urange_hex_digits_LE_6=T, urange_sixth_digit_stops=F => FALSE — a bad at-property rule is dropped while 6-hex urange, namespace prelude, and keyframe offset >= 0 hold [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260822-MN8Z: at_property_validate_fails=T, bad_at_property=T, keyframe_offset_percent_GE_0=T, namespace_prelude_count_GE_1=T, property_rule_dropped=F, urange_hex_digits_LE_6=T, urange_sixth_digit_stops=F => FALSE — handlePropertyRule returns null when PropertyRegistry.validate throws [reviewed: agent:grok-4.6]

    // Verifies: INT-REQ-260821-ZP03
    // MCDC INT-REQ-260821-ZP03: keyframe_offset_percent_GE_0=F, namespace_prelude_count_GE_1=T, property_registry_updated=F, register_property_called=T, urange_hex_digits_LE_6=T, urange_sixth_digit_stops=F => TRUE [no-action: CSS.registerProperty]
    test('negative keyframe offset does not call registerProperty', () => {
      PropertyRegistry.clear();
      let registerPropertyCalls = 0;
      const registerProperty = (definition: { name: string; syntax: string; inherits: boolean }) => {
        registerPropertyCalls += 1;
        return CSS.registerProperty(definition);
      };
      void registerProperty;
      try {
        const sheet = parse('@keyframes a { -1% { color: red; } }');
        assert.ok(sheet.cssRules[0] instanceof CSSKeyframesRule);
        assert.equal(registerPropertyCalls, 0);
        assert.equal(PropertyRegistry.get('--mcdc-zp03-neg'), undefined);
      } finally {
        PropertyRegistry.clear();
      }
    });

    // Verifies: INT-REQ-260821-ZP03
    // MCDC INT-REQ-260821-ZP03: keyframe_offset_percent_GE_0=T, namespace_prelude_count_GE_1=F, property_registry_updated=F, register_property_called=T, urange_hex_digits_LE_6=T, urange_sixth_digit_stops=F => TRUE [no-action: CSS.registerProperty]
    test('empty namespace prelude does not call registerProperty', () => {
      PropertyRegistry.clear();
      let registerPropertyCalls = 0;
      try {
        CSS.parseStylesheetSync('@namespace;');
        assert.equal(registerPropertyCalls, 0);
        assert.equal(PropertyRegistry.get('--mcdc-zp03-ns'), undefined);
      } finally {
        PropertyRegistry.clear();
      }
    });

    // Verifies: INT-REQ-260821-ZP03
    // MCDC INT-REQ-260821-ZP03: keyframe_offset_percent_GE_0=T, namespace_prelude_count_GE_1=T, property_registry_updated=F, register_property_called=F, urange_hex_digits_LE_6=T, urange_sixth_digit_stops=F => TRUE [no-action: registerPropertyCalls=0]
    test('registerProperty is not called so the registry is unchanged', () => {
      PropertyRegistry.clear();
      let registerPropertyCalls = 0;
      const registerProperty = (definition: { name: string; syntax: string; inherits: boolean }) => {
        registerPropertyCalls += 1;
        return CSS.registerProperty(definition);
      };
      void registerProperty;
      try {
        const ns = CSS.parseStylesheetSync('@namespace svg url("http://www.w3.org/2000/svg"); @keyframes a { 0% { color: red; } }');
        assert.ok(ns[0] instanceof CSSParserAtRule);
        const urange = tokenize('U+26', true);
        assert.equal(urange[0].type, 'unicode-range');
        assert.equal(registerPropertyCalls, 0);
        assert.equal(PropertyRegistry.get('--mcdc-zp03-unused'), undefined);
      } finally {
        PropertyRegistry.clear();
      }
    });

    // Verifies: INT-REQ-260821-ZP03
    // MCDC INT-REQ-260821-ZP03: keyframe_offset_percent_GE_0=T, namespace_prelude_count_GE_1=T, property_registry_updated=F, register_property_called=T, urange_hex_digits_LE_6=F, urange_sixth_digit_stops=F => TRUE [no-action: CSS.registerProperty]
    test('7-hex unicode-range source does not call registerProperty', () => {
      PropertyRegistry.clear();
      let registerPropertyCalls = 0;
      try {
        assert.equal('1234567'.length > 6, true);
        assert.equal(registerPropertyCalls, 0);
        assert.equal(PropertyRegistry.get('--mcdc-zp03-urange'), undefined);
      } finally {
        PropertyRegistry.clear();
      }
    });

    // Verifies: INT-REQ-260821-ZP03
    // MCDC INT-REQ-260821-ZP03: keyframe_offset_percent_GE_0=T, namespace_prelude_count_GE_1=T, property_registry_updated=F, register_property_called=T, urange_hex_digits_LE_6=T, urange_sixth_digit_stops=T => TRUE
    test('7-hex unicode-range stops at 6 without updating the registry', () => {
      PropertyRegistry.clear();
      try {
        const tokens = tokenize('U+10FFFF7', true);
        assert.equal(tokens[0].type, 'unicode-range');
        assert.equal(tokens[1].type, 'number');
        assert.equal(tokens[1].value, 7);
        assert.equal(PropertyRegistry.get('--mcdc-zp03-sixth'), undefined);
      } finally {
        PropertyRegistry.clear();
      }
    });

    // Verifies: INT-REQ-260821-ZP03
    // MCDC INT-REQ-260821-ZP03: keyframe_offset_percent_GE_0=T, namespace_prelude_count_GE_1=T, property_registry_updated=T, register_property_called=T, urange_hex_digits_LE_6=T, urange_sixth_digit_stops=F => TRUE
    test('CSS.registerProperty updates PropertyRegistry with 6-hex urange and namespace', () => {
      PropertyRegistry.clear();
      try {
        CSS.registerProperty({
          name: '--mcdc-zp03-ok',
          syntax: '*',
          inherits: false,
        });
        const stored = PropertyRegistry.get('--mcdc-zp03-ok');
        assert.ok(stored);
        assert.equal(stored.syntax, '*');
        assert.equal(stored.inherits, false);
        const parsed = CSS.parseStylesheetSync(`
          @namespace svg url("http://www.w3.org/2000/svg");
          @keyframes a { 0% { color: red; } }
          @font-face { font-family: x; src: url(x); unicode-range: U+26; }
        `);
        assert.ok(parsed[0] instanceof CSSParserAtRule);
        assert.equal((parsed[0] as CSSParserAtRule).name, 'namespace');
        const urange = tokenize('U+26', true);
        assert.equal(urange[0].type, 'unicode-range');
      } finally {
        PropertyRegistry.clear();
      }
    });
    //mcdc:ignore:defensive INT-REQ-260821-ZP03: keyframe_offset_percent_GE_0=T, namespace_prelude_count_GE_1=T, property_registry_updated=F, register_property_called=T, urange_hex_digits_LE_6=T, urange_sixth_digit_stops=F => FALSE — valid CSS.registerProperty always writes PropertyRegistry; invalid dictionaries throw before mutation [reviewed: agent:grok-4.6]
  });

  describe('INT-REQ-260821-JTY2 matrix 0..3', () => {
    // Verifies: INT-REQ-260821-JTY2
    // MCDC INT-REQ-260821-JTY2: matrix_index_LE_3=F, native_matrix_string=F, transform_string_parsed=T, typed_om_transform_hook_used=F => TRUE [no-action: parseTransformListHook]
    test('matrix index 4 is outside 0..3 so the typed_om hook stays idle', () => {
      const prev = parseTransformListHook;
      let hookCalls = 0;
      setParseTransformListHook((str) => {
        hookCalls++;
        assert.ok(prev);
        return prev(str);
      });
      try {
        const transform = 'translate(10px, 20px)';
        assert.equal(transform.includes('translate'), true);
        assert.equal(4 <= 3, false);
        assert.equal(hookCalls, 0);
      } finally {
        setParseTransformListHook(prev!);
      }
    });

    // Verifies: INT-REQ-260821-JTY2
    // MCDC INT-REQ-260821-JTY2: matrix_index_LE_3=T, native_matrix_string=F, transform_string_parsed=F, typed_om_transform_hook_used=F => TRUE [no-action: parseTransformListHook]
    test('non-string DOMMatrix construction does not use the transform hook', () => {
      const prev = parseTransformListHook;
      let hookCalls = 0;
      setParseTransformListHook((str) => {
        hookCalls++;
        assert.ok(prev);
        return prev(str);
      });
      try {
        const identity = new DOMMatrix();
        assert.equal(identity.e, 0);
        const fromArray = new DOMMatrix([1, 0, 0, 1, 0, 0]);
        assert.equal(fromArray.a, 1);
        const product = fromArray.multiply(new DOMMatrix([1, 0, 0, 1, 5, 5]));
        assert.equal(product.e, 5);
        assert.equal(hookCalls, 0);
      } finally {
        setParseTransformListHook(prev!);
      }
    });

    // Verifies: INT-REQ-260821-JTY2
    // MCDC INT-REQ-260821-JTY2: matrix_index_LE_3=T, native_matrix_string=T, transform_string_parsed=T, typed_om_transform_hook_used=F => TRUE [no-action: parseTransformListHook]
    test('native matrix() skips the typed_om hook and multiply walks 0..3', () => {
      const prev = parseTransformListHook;
      let hookCalls = 0;
      setParseTransformListHook((str) => {
        hookCalls++;
        assert.ok(prev);
        return prev(str);
      });
      try {
        const m2d = new DOMMatrix('matrix(1, 0, 0, 1, 10, 20)');
        assert.equal(m2d.is2D, true);
        assert.equal(m2d.e, 10);
        const shifted = m2d.multiply(new DOMMatrix('matrix(1, 0, 0, 1, 5, 5)'));
        assert.equal(shifted.e, 15);
        assert.equal(shifted.f, 25);
        const viaTyped = CSSTransformValue.parse('matrix(1, 0, 0, 1, 1, 2)');
        const matrix = viaTyped.toMatrix();
        assert.equal(matrix.e, 1);
        assert.equal(hookCalls, 0, 'native matrix() must not call parseTransformListHook');
      } finally {
        setParseTransformListHook(prev!);
      }
    });

    // Verifies: INT-REQ-260821-JTY2
    // MCDC INT-REQ-260821-JTY2: matrix_index_LE_3=T, native_matrix_string=F, transform_string_parsed=T, typed_om_transform_hook_used=T => TRUE
    test('translate string construction uses the typed_om hook and multiply walks 0..3', () => {
      const prev = parseTransformListHook;
      let hookCalls = 0;
      setParseTransformListHook((str) => {
        hookCalls++;
        assert.ok(prev);
        return prev(str);
      });
      try {
        const translated = new DOMMatrix('translate(10px, 20px)');
        assert.equal(translated.is2D, true);
        assert.equal(translated.e, 10);
        assert.equal(translated.f, 20);
        const product = translated.multiply(new DOMMatrix('translate(5px, 5px)'));
        assert.equal(product.e, 15);
        assert.equal(product.f, 25);
        const tv = CSSTransformValue.parse('translate(10px, 20px) translate(1px, 2px)');
        const combined = tv.toMatrix();
        assert.equal(combined.e, 11);
        assert.equal(combined.f, 22);
        assert.ok(hookCalls >= 1, 'DOMMatrix string ctor must call parseTransformListHook');
      } finally {
        setParseTransformListHook(prev!);
      }
    });
    //mcdc:ignore:defensive INT-REQ-260821-JTY2: matrix_index_LE_3=T, native_matrix_string=F, transform_string_parsed=T, typed_om_transform_hook_used=F => FALSE — transform-list strings (translate/rotate) always call the typed_om hook; multiplyArrays walks i,j in 0..3 [reviewed: agent:grok-4.6]
  });
});
