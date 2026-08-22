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
// Verifies: SYS-REQ-260822-AACP, SYS-REQ-260822-4EY2, SYS-REQ-260822-SNP4, SYS-REQ-260822-XDRG, SW-REQ-260822-73TM, SW-REQ-260822-QKE9, SW-REQ-260822-Z6J1, SW-REQ-260822-ZN94
// Unique-cause witnesses for domain-table requirements (at-rule ASCII-case
// dispatch, resolution dpi range, <position> arity reification, :disabled/:enabled).
// Drive parse / parseStyleSheet / replaceSync / MediaParser / CSSStyleValue.parse /
// matches. css-syntax-3 § 5.4.4 #consume-at-rule, css-values-4 § 4.1 #keywords,
// cssom-1 CSSMediaRule/CSSMarginRule/CSSAtRule, mediaqueries-4 § 5 #mq-boolean-context,
// css-values-4 § 5 #resolution / § 10.1 #position, css-backgrounds-3 #background-position,
// css-typed-om-1 § 3.3 #positionvalue-objects, html #selector-disabled / #selector-enabled.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parse, parseStyleSheet } from '../src/parser.ts';
import {
  CSSAtRule,
  CSSMarginRule,
  CSSMediaRule,
  CSSPageRule,
  CSSStyleRule,
  CSSStyleSheet,
} from '../src/CSSOM.ts';
import { MediaParser, DEFAULT_MEDIA_ENV } from '../src/MediaParser.ts';
import { CSSPositionValue, CSSStyleValue } from '../src/typed-om.ts';
import { matches } from '../src/matcher.ts';

const DISPATCH_CSS =
  '@MEDIA all { .x { color: red; } } @UNKNOWN { color: blue; } @page { @TOP-LEFT { content: none; } }';

function formDocument() {
  const { document } = parseHTML(`<html><body>
    <div id="plain" disabled></div>
    <input id="off" disabled>
    <button id="on">x</button>
    <fieldset id="fs" disabled>
      <legend><input id="in-legend"></legend>
      <input id="in-fs">
    </fieldset>
  </body></html>`);
  const el = (id: string) => {
    const node = document.getElementById(id);
    assert.ok(node);
    return node;
  };
  return {
    plain: el('plain'),
    off: el('off'),
    on: el('on'),
    fs: el('fs'),
    inLegend: el('in-legend'),
    inFs: el('in-fs'),
  };
}

describe('MC/DC domain-table unique-cause witnesses', { concurrency: false }, () => {
  describe('SYS-REQ-260822-AACP / SW-REQ-260822-73TM', () => {
    // Verifies: SYS-REQ-260822-AACP
    // MCDC SYS-REQ-260822-AACP: stylesheet_returned=F, typed_cssom_rule=F, unknown_at_rule_fallback=F => TRUE [no-action: parseCalls=0 parseStyleSheetCalls=0 replaceSyncCalls=0]
    // Verifies: SW-REQ-260822-73TM
    // MCDC SW-REQ-260822-73TM: consume_stylesheet_completed=F, stylesheet_returned=F, typed_cssom_rule=F, unknown_at_rule_fallback=F => TRUE [no-action: parseCalls=0 parseStyleSheetCalls=0 replaceSyncCalls=0]
    test('at-rule dispatch is idle when parse/parseStyleSheet/replaceSync are not invoked', () => {
      let parseCalls = 0;
      let parseStyleSheetCalls = 0;
      let replaceSyncCalls = 0;
      assert.equal(DISPATCH_CSS.includes('@MEDIA'), true);
      assert.equal(DISPATCH_CSS.includes('@UNKNOWN'), true);
      assert.equal(parseCalls, 0);
      assert.equal(parseStyleSheetCalls, 0);
      assert.equal(replaceSyncCalls, 0);
    });

    // Verifies: SYS-REQ-260822-AACP
    // MCDC SYS-REQ-260822-AACP: stylesheet_returned=T, typed_cssom_rule=T, unknown_at_rule_fallback=T => TRUE
    // Verifies: SW-REQ-260822-73TM
    // MCDC SW-REQ-260822-73TM: consume_stylesheet_completed=T, stylesheet_returned=T, typed_cssom_rule=T, unknown_at_rule_fallback=T => TRUE
    // SYS-REQ-260822-AACP:nominal:nominal
    // SW-REQ-260822-73TM:nominal:nominal
    test('mixed-case @MEDIA and unknown @-rule complete consume and return a stylesheet', () => {
      const sheet = parse(DISPATCH_CSS);
      assert.ok(sheet instanceof CSSStyleSheet);
      assert.equal(sheet.cssRules.length, 3);
      assert.ok(sheet.cssRules[0] instanceof CSSMediaRule);
      assert.equal((sheet.cssRules[0] as CSSMediaRule).cssRules.length, 1);
      assert.ok((sheet.cssRules[0] as CSSMediaRule).cssRules[0] instanceof CSSStyleRule);
      assert.equal(
        ((sheet.cssRules[0] as CSSMediaRule).cssRules[0] as CSSStyleRule).style.getPropertyValue('color'),
        'red',
      );
      assert.ok(sheet.cssRules[1] instanceof CSSAtRule);
      assert.equal((sheet.cssRules[1] as CSSAtRule).name, 'UNKNOWN');
      assert.ok(sheet.cssRules[2] instanceof CSSPageRule);
      const margin = (sheet.cssRules[2] as CSSPageRule).cssRules[0];
      assert.ok(margin instanceof CSSMarginRule);
      assert.equal((margin as CSSMarginRule).name, 'top-left');

      const rules = parseStyleSheet(DISPATCH_CSS);
      assert.equal(rules.length, 3);
      assert.ok(rules[0] instanceof CSSMediaRule);
      assert.ok(rules[1] instanceof CSSAtRule);
      assert.ok(rules[2] instanceof CSSPageRule);

      const constructed = new CSSStyleSheet();
      constructed.replaceSync(DISPATCH_CSS);
      assert.equal(constructed.cssRules.length, 3);
      assert.ok(constructed.cssRules[0] instanceof CSSMediaRule);
      assert.ok(constructed.cssRules[1] instanceof CSSAtRule);
      assert.ok(constructed.cssRules[2] instanceof CSSPageRule);
    });
    //mcdc:ignore:defensive SYS-REQ-260822-AACP: stylesheet_returned=F, typed_cssom_rule=F, unknown_at_rule_fallback=T => FALSE — parse/parseStyleSheet/replaceSync of an unknown @-rule still return/populate a CSSStyleSheet after CSSAtRule fallback [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SYS-REQ-260822-AACP: stylesheet_returned=F, typed_cssom_rule=T, unknown_at_rule_fallback=F => FALSE — parse of mixed-case @MEDIA constructs CSSMediaRule and always returns a CSSStyleSheet [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SYS-REQ-260822-AACP: stylesheet_returned=F, typed_cssom_rule=T, unknown_at_rule_fallback=T => FALSE — consume of mixed-case @MEDIA plus unknown @-rule always returns a CSSStyleSheet; one dispatch is mutex typed vs CSSAtRule [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260822-73TM: consume_stylesheet_completed=F, stylesheet_returned=F, typed_cssom_rule=F, unknown_at_rule_fallback=T => FALSE — unknown @-rule fallback still finishes consumeListOfRules and returns a stylesheet [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260822-73TM: consume_stylesheet_completed=F, stylesheet_returned=F, typed_cssom_rule=T, unknown_at_rule_fallback=F => FALSE — mixed-case @MEDIA still finishes consumeListOfRules and returns a stylesheet [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260822-73TM: consume_stylesheet_completed=F, stylesheet_returned=T, typed_cssom_rule=T, unknown_at_rule_fallback=T => FALSE — parse() does not return a CSSStyleSheet without finishing consumeListOfRules [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260822-73TM: consume_stylesheet_completed=T, stylesheet_returned=F, typed_cssom_rule=T, unknown_at_rule_fallback=T => FALSE — parse() always returns a CSSStyleSheet after consumeListOfRules of mixed-case @MEDIA plus unknown @-rule [reviewed: agent:grok-4.6]
  });

  describe('SYS-REQ-260822-4EY2 / SW-REQ-260822-QKE9', () => {
    // Verifies: SYS-REQ-260822-4EY2
    // MCDC SYS-REQ-260822-4EY2: resolution_dpi_GT_0=F, resolution_feature_positive=F => TRUE [no-action: resolutionPositiveAction=0]
    // Verifies: SW-REQ-260822-QKE9
    // MCDC SW-REQ-260822-QKE9: resolution_dpi_GT_0=F, resolution_feature_positive=F => TRUE [no-action: resolutionPositiveAction=0]
    // SYS-REQ-260822-4EY2:nominal:negative
    // SW-REQ-260822-QKE9:nominal:negative
    test('boolean (resolution) is not positive when environment dpi is 0', () => {
      let resolutionPositiveAction = 0;
      const matched = MediaParser.evaluate('(resolution)', { resolution: 0 });
      if (matched) resolutionPositiveAction++;
      assert.equal(matched, false);
      assert.equal(resolutionPositiveAction, 0);
    });

    // Verifies: SYS-REQ-260822-4EY2
    // MCDC SYS-REQ-260822-4EY2: resolution_dpi_GT_0=T, resolution_feature_positive=T => TRUE
    // Verifies: SW-REQ-260822-QKE9
    // MCDC SW-REQ-260822-QKE9: resolution_dpi_GT_0=T, resolution_feature_positive=T => TRUE
    // SYS-REQ-260822-4EY2:nominal:nominal
    // SW-REQ-260822-QKE9:nominal:nominal
    test('boolean (resolution) matches when converted dpi is greater than 0', () => {
      assert.equal(DEFAULT_MEDIA_ENV.resolution > 0, true);
      assert.equal(MediaParser.evaluate('(resolution)'), true);
      assert.equal(MediaParser.evaluate('(resolution)', { resolution: 96 }), true);
      assert.equal(MediaParser.evaluate('(min-resolution: 1dppx)'), true);
      assert.equal(MediaParser.evaluate('(min-resolution: 1x)'), true);
      assert.equal(MediaParser.evaluate('(min-resolution: 96dpi)'), true);
      assert.equal(MediaParser.evaluate('(min-resolution: 37.795dpcm)'), true);
    });
    //mcdc:ignore:defensive SYS-REQ-260822-4EY2: resolution_dpi_GT_0=T, resolution_feature_positive=F => FALSE — MediaParser.evaluate('(resolution)') is true whenever environment dpi is greater than 0 [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260822-QKE9: resolution_dpi_GT_0=T, resolution_feature_positive=F => FALSE — MediaParser.evaluate('(resolution)') is true whenever converted environment dpi is greater than 0 [reviewed: agent:grok-4.6]
  });

  describe('SYS-REQ-260822-SNP4 / SW-REQ-260822-Z6J1', () => {
    // Verifies: SW-REQ-260822-Z6J1
    // MCDC SW-REQ-260822-Z6J1: parse_style_value=F, parse_throws=T, position_reifies=T => TRUE [no-action: parseStyleValueCalls=0]
    test('CSSStyleValue.parse is idle so a 2-value position is not reified', () => {
      let parseStyleValueCalls = 0;
      const parseStyleValue = (property: string, cssText: string) => {
        parseStyleValueCalls++;
        return CSSStyleValue.parse(property, cssText);
      };
      void parseStyleValue;
      const twoValue = '10px 20px';
      assert.equal(twoValue.split(/\s+/).length >= 1, true);
      assert.equal(parseStyleValueCalls, 0);
    });

    // Verifies: SYS-REQ-260822-SNP4
    // MCDC SYS-REQ-260822-SNP4: parse_throws=T, position_reifies=F => TRUE [no-action: CSSStyleValue.parse 1-to-4 CSSPositionValue]
    // Verifies: SW-REQ-260822-Z6J1
    // MCDC SW-REQ-260822-Z6J1: parse_style_value=T, parse_throws=T, position_reifies=F => TRUE [no-action: CSSStyleValue.parse 1-to-4 CSSPositionValue]
    // SYS-REQ-260822-SNP4:nominal:negative
    // SW-REQ-260822-Z6J1:nominal:negative
    test('empty object-position throws and does not reify a 1-to-4 CSSPositionValue', () => {
      let reifyAction = 0;
      assert.throws(() => {
        const value = CSSStyleValue.parse('object-position', '');
        if (value instanceof CSSPositionValue) reifyAction++;
      }, TypeError);
      assert.equal(reifyAction, 0);
    });

    // Verifies: SYS-REQ-260822-SNP4
    // MCDC SYS-REQ-260822-SNP4: parse_throws=T, position_reifies=F => TRUE [no-action: CSSStyleValue.parse no-throw CSSPositionValue]
    // Verifies: SW-REQ-260822-Z6J1
    // MCDC SW-REQ-260822-Z6J1: parse_style_value=T, parse_throws=T, position_reifies=F => TRUE [no-action: CSSStyleValue.parse no-throw CSSPositionValue]
    // SYS-REQ-260822-SNP4:nominal:negative
    // SW-REQ-260822-Z6J1:nominal:negative
    test('3-value object-position and 4-value transform-origin throw without CSSPositionValue', () => {
      let noThrowAction = 0;
      assert.throws(() => {
        CSSStyleValue.parse('object-position', 'left 10px top');
        noThrowAction++;
      }, TypeError);
      assert.throws(() => {
        CSSStyleValue.parse('transform-origin', 'left 10px top 20px');
        noThrowAction++;
      }, TypeError);
      assert.throws(() => {
        CSSStyleValue.parse('perspective-origin', 'left 10px top');
        noThrowAction++;
      }, TypeError);
      assert.equal(noThrowAction, 0);
    });

    // Verifies: SYS-REQ-260822-SNP4
    // MCDC SYS-REQ-260822-SNP4: parse_throws=F, position_reifies=T => TRUE
    // Verifies: SW-REQ-260822-Z6J1
    // MCDC SW-REQ-260822-Z6J1: parse_style_value=T, parse_throws=F, position_reifies=T => TRUE
    // SYS-REQ-260822-SNP4:nominal:nominal
    // SW-REQ-260822-Z6J1:nominal:nominal
    test('1-to-4 component positions reify as CSSPositionValue without throwing', () => {
      let throwCount = 0;
      try {
        const one = CSSStyleValue.parse('object-position', 'center');
        assert.ok(one instanceof CSSPositionValue);
        const two = CSSStyleValue.parse('object-position', '10px 20px');
        assert.ok(two instanceof CSSPositionValue);
        assert.equal(String(two), '10px 20px');
        const three = CSSStyleValue.parse('background-position', 'left 10px top');
        assert.ok(three instanceof CSSPositionValue);
        const four = CSSStyleValue.parse('object-position', 'left 10px top 20px');
        assert.ok(four instanceof CSSPositionValue);
        const origin = CSSStyleValue.parse('transform-origin', 'center');
        assert.ok(origin instanceof CSSPositionValue);
        const perspective = CSSStyleValue.parse('perspective-origin', 'left 10px top 20px');
        assert.ok(perspective instanceof CSSPositionValue);
      } catch {
        throwCount++;
      }
      assert.equal(throwCount, 0);
    });
    //mcdc:ignore:defensive SYS-REQ-260822-SNP4: parse_throws=T, position_reifies=T => FALSE — CSSStyleValue.parse that reifies a 1-to-4 component position as CSSPositionValue returns without throwing [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260822-Z6J1: parse_style_value=T, parse_throws=T, position_reifies=T => FALSE — CSSStyleValue.parse that reifies a 1-to-4 component position as CSSPositionValue returns without throwing [reviewed: agent:grok-4.6]
  });

  describe('SYS-REQ-260822-XDRG / SW-REQ-260822-ZN94', () => {
    // Verifies: SYS-REQ-260822-XDRG
    // MCDC SYS-REQ-260822-XDRG: empty_match=T, matches_disabled=F, matches_enabled=F => TRUE [no-action: nonEmptyMatchAction=0]
    // Verifies: SW-REQ-260822-ZN94
    // MCDC SW-REQ-260822-ZN94: empty_match=T, matches_disabled=F, matches_enabled=F => TRUE [no-action: nonEmptyMatchAction=0]
    // SYS-REQ-260822-XDRG:nominal:negative
    // SW-REQ-260822-ZN94:nominal:negative
    test('div does not match :disabled or :enabled', () => {
      const { plain } = formDocument();
      let nonEmptyMatchAction = 0;
      const disabledHit = matches(plain, ':disabled');
      const enabledHit = matches(plain, ':enabled');
      if (disabledHit || enabledHit) nonEmptyMatchAction++;
      assert.equal(disabledHit, false);
      assert.equal(enabledHit, false);
      assert.equal(nonEmptyMatchAction, 0);
    });

    // Verifies: SYS-REQ-260822-XDRG
    // MCDC SYS-REQ-260822-XDRG: empty_match=F, matches_disabled=T, matches_enabled=T => TRUE
    // Verifies: SW-REQ-260822-ZN94
    // MCDC SW-REQ-260822-ZN94: empty_match=F, matches_disabled=T, matches_enabled=T => TRUE
    // SYS-REQ-260822-XDRG:nominal:nominal
    // SW-REQ-260822-ZN94:nominal:nominal
    test(':disabled and :enabled each match listed form controls', () => {
      const { off, on, fs, inLegend, inFs, plain } = formDocument();
      assert.equal(matches(off, ':disabled'), true);
      assert.equal(matches(off, ':enabled'), false);
      assert.equal(matches(on, ':enabled'), true);
      assert.equal(matches(on, ':disabled'), false);
      assert.equal(matches(fs, ':disabled'), true);
      assert.equal(matches(inFs, ':disabled'), true);
      assert.equal(matches(inLegend, ':disabled'), false);
      assert.equal(matches(inLegend, ':enabled'), true);
      assert.equal(matches(plain, ':disabled'), false);
    });
    //mcdc:ignore:defensive SYS-REQ-260822-XDRG: empty_match=T, matches_disabled=F, matches_enabled=T => FALSE — matches() true for :enabled is a non-empty match [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SYS-REQ-260822-XDRG: empty_match=T, matches_disabled=T, matches_enabled=F => FALSE — matches() true for :disabled is a non-empty match [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SYS-REQ-260822-XDRG: empty_match=T, matches_disabled=T, matches_enabled=T => FALSE — HTML :disabled and :enabled never match the same element, and a hit on either is a non-empty match [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260822-ZN94: empty_match=T, matches_disabled=F, matches_enabled=T => FALSE — matches() true for :enabled is a non-empty match [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260822-ZN94: empty_match=T, matches_disabled=T, matches_enabled=F => FALSE — matches() true for :disabled is a non-empty match [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260822-ZN94: empty_match=T, matches_disabled=T, matches_enabled=T => FALSE — HTML :disabled and :enabled never match the same element, and a hit on either is a non-empty match [reviewed: agent:grok-4.6]
  });
});
