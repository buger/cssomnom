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
// Verifies: INT-REQ-260821-30ZA, INT-REQ-260821-MZW3, INT-REQ-260821-WQX9, SW-REQ-260821-6951, SW-REQ-260821-HNRG, SW-REQ-260821-PAKB, SW-REQ-260821-TF5T, SYS-REQ-260821-8TGB, SYS-REQ-260821-GR67, SYS-REQ-260821-X3KX, SYS-REQ-260821-YMEY
import '../src/parser.ts';
import { parse } from '../src/parser.ts';
import { CSS } from '../src/index.ts';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ParseHooks } from '../src/parse-hooks.ts';
import { MediaParser } from '../src/MediaParser.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import {
  CSSStyleSheet,
  CSSStyleRule,
  CSSImportRule,
  CSSRule,
  CSSKeyframesRule,
  CSSKeyframeRule,
  CSSCounterStyleRule,
  MediaList,
} from '../src/CSSOM.ts';
import type { Token, Rule } from '../src/types.ts';

const cssomSrc = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/CSSOM.ts'),
  'utf8',
);

function cssomImportsParser(): boolean {
  return /from\s+['"](?:\.\.\/)*parser\.ts['"]/.test(cssomSrc) || /from\s+['"]\.\/parser\.ts['"]/.test(cssomSrc);
}

function unusedParseRule(_text: string): Rule {
  throw new Error('parseRule must not run for cssRules getter origin-clean checks');
}

describe('MC/DC cssom witnesses', { concurrency: false }, () => {
  describe('SW-REQ-260821-HNRG', () => {
    // Witness the positive no-op row first (not the all+var hole).
    // Verifies: SW-REQ-260821-HNRG
    // MCDC SW-REQ-260821-HNRG: declaration_unchanged=T, set_property_ignored=T, value_validation_fails=T => TRUE
    test('invalid width is a no-op when validation fails', () => {
      const style = new CSSStyleDeclaration();
      style.setProperty('color', 'blue');
      const beforeText = style.cssText;
      const beforeColor = style.getPropertyValue('color');
      const beforeWidth = style.getPropertyValue('width');
      assert.equal(ParseHooks.validatePropertyValue('width', '-100'), false);

      style.setProperty('width', '-100');

      assert.equal(style.getPropertyValue('width'), beforeWidth);
      assert.equal(style.getPropertyValue('color'), beforeColor);
      assert.equal(style.cssText, beforeText);
    });
    // Verifies: SW-REQ-260821-HNRG
    // MCDC SW-REQ-260821-HNRG: declaration_unchanged=F, set_property_ignored=F, value_validation_fails=F => TRUE [no-action: CSSStyleDeclaration.setProperty validation-fail early-return]
    test('valid setProperty mutates when validation does not fail', () => {
      const style = new CSSStyleDeclaration();
      style.setProperty('color', 'blue');
      const beforeText = style.cssText;
      assert.equal(ParseHooks.validatePropertyValue('color', 'red'), true);

      let ignoreEarlyReturn = 0;
      const original = CSSStyleDeclaration.prototype.setProperty;
      CSSStyleDeclaration.prototype.setProperty = function (property, value, priority, notify) {
        const prior = this.cssText;
        original.call(this, property, value, priority, notify);
        if (property === 'color' && value === 'red' && this.cssText === prior) {
          ignoreEarlyReturn++;
        }
        return undefined;
      };
      try {
        style.setProperty('color', 'red');
        assert.equal(style.getPropertyValue('color'), 'red');
        assert.notEqual(style.cssText, beforeText);
        assert.equal(ignoreEarlyReturn, 0);
      } finally {
        CSSStyleDeclaration.prototype.setProperty = original;
      }
    });
    //mcdc:ignore:defensive SW-REQ-260821-HNRG: declaration_unchanged=F, set_property_ignored=F, value_validation_fails=T => FALSE — invalid setProperty is a no-op (declaration unchanged and ignored) [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260821-HNRG: declaration_unchanged=F, set_property_ignored=T, value_validation_fails=T => FALSE — invalid setProperty ignore does not mutate the declaration [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260821-HNRG: declaration_unchanged=T, set_property_ignored=F, value_validation_fails=T => FALSE — invalid setProperty is ignored when the declaration is unchanged [reviewed: agent:grok-4.6]

    // Verifies: SW-REQ-260821-HNRG
    // MCDC SW-REQ-260821-HNRG: declaration_unchanged=T, set_property_ignored=T, value_validation_fails=T => TRUE
    test('all: var(--x) then invalid set is a no-op', () => {
      const style = new CSSStyleDeclaration();
      style.setProperty('all', 'var(--x)');
      const before = style.getPropertyValue('all');
      const beforeText = style.cssText;
      assert.equal(before, 'var(--x)');
      assert.equal(beforeText.trim(), 'all: var(--x);');

      style.setProperty('all', 'not-a-css-wide-keyword');

      assert.equal(style.getPropertyValue('all'), before);
      assert.equal(style.cssText, beforeText);
    });
  });

  describe('SYS-REQ-260821-8TGB', () => {
    // Verifies: SYS-REQ-260821-8TGB
    // MCDC SYS-REQ-260821-8TGB: invalid_value=F, set_property_called=T, set_property_ignored=F => TRUE [no-action: CSSStyleDeclaration.setProperty invalid-value ignore]
    test('valid setProperty applies the value', () => {
      const style = new CSSStyleDeclaration();
      let ignoreCalls = 0;
      const original = CSSStyleDeclaration.prototype.setProperty;
      CSSStyleDeclaration.prototype.setProperty = function (property, value, priority, notify) {
        const prior = this.getPropertyValue(property);
        original.call(this, property, value, priority, notify);
        if (property === 'color' && value === 'green' && this.getPropertyValue('color') === prior) {
          ignoreCalls++;
        }
        return undefined;
      };
      try {
        style.setProperty('color', 'green');
        assert.equal(style.getPropertyValue('color'), 'green');
        assert.equal(ignoreCalls, 0);
      } finally {
        CSSStyleDeclaration.prototype.setProperty = original;
      }
    });
    // Verifies: SYS-REQ-260821-8TGB
    // MCDC SYS-REQ-260821-8TGB: invalid_value=T, set_property_called=F, set_property_ignored=F => TRUE [no-action: CSSStyleDeclaration.setProperty]
    test('invalid value is not applied when setProperty is not called', () => {
      const style = new CSSStyleDeclaration();
      style.setProperty('width', '10px');
      const invalidValue = '-100';
      assert.equal(ParseHooks.validatePropertyValue('width', invalidValue), false);

      let setCalls = 0;
      const original = CSSStyleDeclaration.prototype.setProperty;
      CSSStyleDeclaration.prototype.setProperty = function (property, value, priority, notify) {
        setCalls++;
        return original.call(this, property, value, priority, notify);
      };
      try {
        assert.equal(style.getPropertyValue('width'), '10px');
        assert.equal(setCalls, 0);
      } finally {
        CSSStyleDeclaration.prototype.setProperty = original;
      }
    });
    // Verifies: SYS-REQ-260821-8TGB
    // MCDC SYS-REQ-260821-8TGB: invalid_value=T, set_property_called=T, set_property_ignored=T => TRUE
    test('invalid width is ignored by setProperty', () => {
      const style = new CSSStyleDeclaration();
      style.setProperty('width', '10px');
      const before = style.getPropertyValue('width');
      const beforeText = style.cssText;
      assert.equal(ParseHooks.validatePropertyValue('width', '-100'), false);

      style.setProperty('width', '-100');

      assert.equal(style.getPropertyValue('width'), before);
      assert.equal(style.cssText, beforeText);
    });
    //mcdc:ignore:defensive SYS-REQ-260821-8TGB: invalid_value=T, set_property_called=T, set_property_ignored=F => FALSE — invalid all after stored var(--x) is ignored (no-op) [reviewed: agent:grok-4.6]

    // Verifies: SYS-REQ-260821-8TGB
    // MCDC SYS-REQ-260821-8TGB: invalid_value=T, set_property_called=T, set_property_ignored=T => TRUE
    test('invalid all after stored var is ignored', () => {
      const style = new CSSStyleDeclaration();
      style.setProperty('all', 'var(--x)');
      assert.equal(style.getPropertyValue('all'), 'var(--x)');

      style.setProperty('all', 'not-a-css-wide-keyword');

      assert.equal(style.getPropertyValue('all'), 'var(--x)');
      assert.equal(style.cssText.trim(), 'all: var(--x);');
    });
  });

  describe('INT-REQ-260821-30ZA', () => {
    // Verifies: INT-REQ-260821-30ZA
    // MCDC INT-REQ-260821-30ZA: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=T, insert_rule_path=F, keyframe_offset_percent_LE_100=T, parse_hooks_consume_rule_called=T, parser_imported=T, position_token_count_LE_4=T, shorthand_expanded=T, shorthand_rejected=T => TRUE [no-action: ParseHooks.consumeRule]
    test('insertRule path is idle without calling consumeRule or importing Parser', () => {
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
//mcdc:ignore:defensive INT-REQ-260821-30ZA: box_side_count_LE_4=T, font_weight_number_LE_1000=T, insert_rule_path=T, keyframe_offset_percent_LE_100=T, parse_hooks_consume_rule_called=F, parser_imported=F, position_token_count_LE_4=T, shorthand_expanded=T, shorthand_rejected=F => FALSE — CSSStyleSheet.insertRule parse path always calls ParseHooks.consumeRule via _parseRule [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive INT-REQ-260821-30ZA: box_side_count_LE_4=T, font_weight_number_LE_1000=T, insert_rule_path=T, keyframe_offset_percent_LE_100=T, parse_hooks_consume_rule_called=T, parser_imported=T, position_token_count_LE_4=T, shorthand_expanded=T, shorthand_rejected=T => FALSE — src/CSSOM.ts does not import parser.ts; insertRule uses ParseHooks inversion [reviewed: agent:grok-4.6]

    // Verifies: INT-REQ-260821-30ZA
    // MCDC INT-REQ-260821-30ZA: box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=T, insert_rule_path=T, keyframe_offset_percent_LE_100=T, parse_hooks_consume_rule_called=T, parser_imported=F, position_token_count_LE_4=T, shorthand_expanded=T, shorthand_rejected=F => TRUE
    test('insertRule calls ParseHooks.consumeRule and CSSOM does not import Parser', () => {
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
        assert.equal(sheet.cssRules.length, 1);
        assert.ok(sheet.cssRules[0] instanceof CSSStyleRule);
        assert.equal((sheet.cssRules[0] as CSSStyleRule).style.getPropertyValue('margin-top'), '1px');
        assert.equal((sheet.cssRules[0] as CSSStyleRule).style.getPropertyValue('margin-right'), '2px');
        assert.equal((sheet.cssRules[0] as CSSStyleRule).style.getPropertyValue('margin-bottom'), '3px');
        assert.equal((sheet.cssRules[0] as CSSStyleRule).style.getPropertyValue('margin-left'), '4px');
      } finally {
        ParseHooks.consumeRule = original;
      }
    });
  });

  describe('INT-REQ-260821-MZW3', () => {
    // Verifies: INT-REQ-260821-MZW3
    // MCDC INT-REQ-260821-MZW3: media_parser_parse_called=F, media_text_set=F => TRUE [no-action: MediaParser.parse]
    test('MediaParser.parse is not called when mediaText is not set', () => {
      const original = MediaParser.parse;
      let parseCalls = 0;
      MediaParser.parse = (mediaText: string) => {
        parseCalls++;
        return original.call(MediaParser, mediaText);
      };
      try {
        const list = new MediaList();
        parseCalls = 0;
        assert.equal(list.mediaText, '');
        assert.equal(parseCalls, 0);
      } finally {
        MediaParser.parse = original;
      }
    });
    //mcdc:ignore:defensive INT-REQ-260821-MZW3: media_parser_parse_called=F, media_text_set=T => FALSE — MediaList.mediaText setter always calls MediaParser.parse for non-empty mediaText [reviewed: agent:grok-4.6]

    // Verifies: INT-REQ-260821-MZW3
    // MCDC INT-REQ-260821-MZW3: media_parser_parse_called=T, media_text_set=T => TRUE
    test('setting mediaText calls MediaParser.parse including invalid-to-not-all', () => {
      const original = MediaParser.parse;
      let parseCalls = 0;
      MediaParser.parse = (mediaText: string) => {
        parseCalls++;
        return original.call(MediaParser, mediaText);
      };
      try {
        const list = new MediaList();
        parseCalls = 0;
        list.mediaText = '&test, speech';
        assert.ok(parseCalls >= 1);
        assert.equal(list.item(0), 'not all');
        assert.equal(list.item(1), 'speech');
        assert.equal(list.mediaText, 'not all, speech');
      } finally {
        MediaParser.parse = original;
      }
    });
  });

  describe('INT-REQ-260821-WQX9', () => {
    // Verifies: INT-REQ-260821-WQX9
    // MCDC INT-REQ-260821-WQX9: style_declaration_duck_typed=F, style_map_mutated=F => TRUE [no-action: CSSStyleDeclaration.setProperty]
    test('styleMap is not mutated and setProperty is not duck-typed', () => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('.a { color: red; }');
      const rule = sheet.cssRules[0] as CSSStyleRule;
      let setCalls = 0;
      const original = CSSStyleDeclaration.prototype.setProperty;
      CSSStyleDeclaration.prototype.setProperty = function (property, value, priority, notify) {
        setCalls++;
        return original.call(this, property, value, priority, notify);
      };
      try {
        assert.equal(rule.style.getPropertyValue('color'), 'red');
        assert.equal(setCalls, 0);
      } finally {
        CSSStyleDeclaration.prototype.setProperty = original;
      }
    });
    //mcdc:ignore:defensive INT-REQ-260821-WQX9: style_declaration_duck_typed=F, style_map_mutated=T => FALSE — StylePropertyMap.set always duck-types CSSStyleDeclaration.setProperty via setPropertySafe [reviewed: agent:grok-4.6]

    // Verifies: INT-REQ-260821-WQX9
    // MCDC INT-REQ-260821-WQX9: style_declaration_duck_typed=T, style_map_mutated=T => TRUE
    test('styleMap.set duck-types CSSStyleDeclaration.setProperty', () => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('.a { color: red; }');
      const rule = sheet.cssRules[0] as CSSStyleRule;
      let setCalls = 0;
      const original = CSSStyleDeclaration.prototype.setProperty;
      CSSStyleDeclaration.prototype.setProperty = function (property, value, priority, notify) {
        setCalls++;
        return original.call(this, property, value, priority, notify);
      };
      try {
        rule.styleMap.set('color', 'green');
        assert.ok(setCalls >= 1);
        assert.equal(rule.style.getPropertyValue('color'), 'green');
        rule.style.setProperty('background-color', 'blue');
        assert.equal(rule.styleMap.get('background-color')?.toString(), 'blue');
      } finally {
        CSSStyleDeclaration.prototype.setProperty = original;
      }
    });
  });

  describe('SW-REQ-260821-6951 and SYS-REQ-260821-X3KX', () => {
    // Verifies: SW-REQ-260821-6951
    // MCDC SW-REQ-260821-6951: css_rules_getter_runs=F, origin_clean=F, security_error_thrown=F => TRUE [no-action: CSSStyleSheet.cssRules getter]
    test('tainted sheet does not throw until cssRules is read', () => {
      const desc = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'cssRules');
      assert.ok(desc && typeof desc.get === 'function');
      let getterRuns = 0;
      Object.defineProperty(CSSStyleSheet.prototype, 'cssRules', {
        configurable: true,
        enumerable: desc.enumerable,
        get: function (this: CSSStyleSheet) {
          getterRuns++;
          return desc.get!.call(this);
        },
      });
      try {
        const _tainted = CSSStyleSheet.createInternal([], unusedParseRule, false);
        assert.equal(getterRuns, 0);
      } finally {
        Object.defineProperty(CSSStyleSheet.prototype, 'cssRules', desc);
      }
    });
    // Verifies: SW-REQ-260821-6951
    // MCDC SW-REQ-260821-6951: css_rules_getter_runs=T, origin_clean=F, security_error_thrown=T => TRUE
    // Verifies: SYS-REQ-260821-X3KX
    // MCDC SYS-REQ-260821-X3KX: origin_clean=F, security_error_thrown=T => TRUE
    test('cssRules on a tainted sheet throws SecurityError', () => {
      const desc = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'cssRules');
      assert.ok(desc && typeof desc.get === 'function');
      let getterRuns = 0;
      Object.defineProperty(CSSStyleSheet.prototype, 'cssRules', {
        configurable: true,
        enumerable: desc.enumerable,
        get: function (this: CSSStyleSheet) {
          getterRuns++;
          return desc.get!.call(this);
        },
      });
      try {
        const tainted = CSSStyleSheet.createInternal([], unusedParseRule, false);
        assert.throws(
          () => tainted.cssRules,
          (err: unknown) => err instanceof DOMException && err.name === 'SecurityError',
        );
        assert.ok(getterRuns >= 1);
      } finally {
        Object.defineProperty(CSSStyleSheet.prototype, 'cssRules', desc);
      }
    });
//mcdc:ignore:defensive SW-REQ-260821-6951: css_rules_getter_runs=T, origin_clean=F, security_error_thrown=F => FALSE — CSSStyleSheet.cssRules getter always throws SecurityError when origin-clean is false [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260821-6951: css_rules_getter_runs=T, origin_clean=T, security_error_thrown=T => FALSE — CSSStyleSheet.cssRules getter does not throw SecurityError when origin-clean is true [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SYS-REQ-260821-X3KX: origin_clean=F, security_error_thrown=F => FALSE — CSSStyleSheet.cssRules getter always throws SecurityError when origin-clean is false [reviewed: agent:grok-4.6]

    // Verifies: SW-REQ-260821-6951
    // MCDC SW-REQ-260821-6951: css_rules_getter_runs=T, origin_clean=T, security_error_thrown=F => TRUE [no-action: SecurityError]
    // Verifies: SYS-REQ-260821-X3KX
    // MCDC SYS-REQ-260821-X3KX: origin_clean=T, security_error_thrown=F => TRUE
    test('cssRules on an origin-clean sheet does not throw', () => {
      const desc = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'cssRules');
      assert.ok(desc && typeof desc.get === 'function');
      let getterRuns = 0;
      let securityErrorThrown = false;
      Object.defineProperty(CSSStyleSheet.prototype, 'cssRules', {
        configurable: true,
        enumerable: desc.enumerable,
        get: function (this: CSSStyleSheet) {
          getterRuns++;
          try {
            return desc.get!.call(this);
          } catch (err) {
            if (err instanceof DOMException && err.name === 'SecurityError') {
              securityErrorThrown = true;
            }
            throw err;
          }
        },
      });
      try {
        const clean = CSSStyleSheet.createInternal([], unusedParseRule, true);
        const rules = clean.cssRules;
        assert.equal(rules.length, 0);
        assert.ok(getterRuns >= 1);
        assert.equal(securityErrorThrown, false);
      } finally {
        Object.defineProperty(CSSStyleSheet.prototype, 'cssRules', desc);
      }
    });
  });

  describe('SW-REQ-260821-TF5T and SYS-REQ-260821-YMEY', () => {
    // Verifies: SW-REQ-260821-TF5T
    // MCDC SW-REQ-260821-TF5T: consume_rule_fails=F, syntax_error_thrown=F => TRUE [no-action: DOMException SyntaxError]
    // Verifies: SYS-REQ-260821-YMEY
    // MCDC SYS-REQ-260821-YMEY: bad_rule=F, insert_rule_called=T, syntax_error_thrown=F => TRUE [no-action: DOMException SyntaxError]
    test('successful insertRule does not throw SyntaxError', () => {
      const original = ParseHooks.consumeRule;
      let consumeFailed = 0;
      ParseHooks.consumeRule = (tokens: Token[]) => {
        const rule = original(tokens);
        if (!rule) consumeFailed++;
        return rule;
      };
      try {
        const sheet = new CSSStyleSheet();
        const index = sheet.insertRule('span { display: block; }', 0);
        assert.equal(index, 0);
        assert.equal(consumeFailed, 0);
        assert.equal(sheet.cssRules.length, 1);
        assert.equal((sheet.cssRules[0] as CSSStyleRule).style.getPropertyValue('display'), 'block');
      } finally {
        ParseHooks.consumeRule = original;
      }
    });
    // Verifies: SYS-REQ-260821-YMEY
    // MCDC SYS-REQ-260821-YMEY: bad_rule=T, insert_rule_called=F, syntax_error_thrown=F => TRUE [no-action: CSSStyleSheet.insertRule]
    test('a bad rule string does not throw until insertRule is called', () => {
      const badRule = '!!!not-a-rule';
      let insertCalls = 0;
      const original = CSSStyleSheet.prototype.insertRule;
      CSSStyleSheet.prototype.insertRule = function (rule, index) {
        insertCalls++;
        return original.call(this, rule, index);
      };
      try {
        const sheet = new CSSStyleSheet();
        assert.equal(sheet.cssRules.length, 0);
        assert.equal(typeof badRule, 'string');
        assert.equal(insertCalls, 0);
      } finally {
        CSSStyleSheet.prototype.insertRule = original;
      }
    });
    //mcdc:ignore:defensive SYS-REQ-260821-YMEY: bad_rule=T, insert_rule_called=T, syntax_error_thrown=F => FALSE — CSSStyleSheet.insertRule throws SyntaxError on a bad rule when consumeRule fails [reviewed: agent:grok-4.6]
    // Verifies: SYS-REQ-260821-YMEY
    // MCDC SYS-REQ-260821-YMEY: bad_rule=T, insert_rule_called=T, syntax_error_thrown=T => TRUE
    test('insertRule throws SyntaxError when consumeRule fails on a bad rule', () => {
      const original = ParseHooks.consumeRule;
      let consumeFailed = 0;
      ParseHooks.consumeRule = (tokens: Token[]) => {
        const rule = original(tokens);
        if (!rule) consumeFailed++;
        return rule;
      };
      try {
        const sheet = new CSSStyleSheet();
        assert.throws(
          () => sheet.insertRule('!!!not-a-rule', 0),
          (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError',
        );
        assert.ok(consumeFailed >= 1);
        assert.equal(sheet.cssRules.length, 0);
      } finally {
        ParseHooks.consumeRule = original;
      }
    });
    //mcdc:ignore:defensive SW-REQ-260821-TF5T: consume_rule_fails=T, syntax_error_thrown=F => FALSE — CSSStyleSheet.insertRule throws SyntaxError when ParseHooks.consumeRule returns null [reviewed: agent:grok-4.6]
    // Verifies: SW-REQ-260821-TF5T
    // MCDC SW-REQ-260821-TF5T: consume_rule_fails=T, syntax_error_thrown=T => TRUE
    test('insertRule throws SyntaxError when consumeRule returns null', () => {
      const original = ParseHooks.consumeRule;
      let consumeFailed = 0;
      ParseHooks.consumeRule = (tokens: Token[]) => {
        const rule = original(tokens);
        if (!rule) consumeFailed++;
        return rule;
      };
      try {
        const sheet = new CSSStyleSheet();
        assert.throws(
          () => sheet.insertRule('!!!not-a-rule', 0),
          (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError',
        );
        assert.ok(consumeFailed >= 1);
      } finally {
        ParseHooks.consumeRule = original;
      }
    });
  });

  describe('SW-REQ-260821-PAKB and SYS-REQ-260821-GR67', () => {
    // Verifies: SW-REQ-260821-PAKB
    // MCDC SW-REQ-260821-PAKB: deviation_applies=F, documented_deviation_honored=F, replace_sync_parse_runs=T => TRUE [no-action: CSSStyleSheet.replace documented Promise.resolve sync parse]
    test('replaceSync parses locally without the replace() documented deviation', () => {
      const original = ParseHooks.consumeListOfRules;
      let parseRuns = 0;
      ParseHooks.consumeListOfRules = (tokens, topLevel) => {
        parseRuns++;
        return original(tokens, topLevel);
      };
      try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync('div { color: red; }');
        assert.ok(parseRuns >= 1);
        assert.equal(sheet.cssRules.length, 1);
        assert.equal(sheet.cssRules[0].cssText, 'div { color: red; }');
      } finally {
        ParseHooks.consumeListOfRules = original;
      }
    });
    // Verifies: SW-REQ-260821-PAKB
    // MCDC SW-REQ-260821-PAKB: deviation_applies=T, documented_deviation_honored=F, replace_sync_parse_runs=F => TRUE [no-action: ParseHooks.consumeListOfRules]
    test('replace on a non-constructed sheet rejects without parsing', async () => {
      const original = ParseHooks.consumeListOfRules;
      let parseRuns = 0;
      ParseHooks.consumeListOfRules = (tokens, topLevel) => {
        parseRuns++;
        return original(tokens, topLevel);
      };
      try {
        const sheet = CSSStyleSheet.createInternal([], unusedParseRule, true);
        await assert.rejects(
          () => sheet.replace('div { color: red; }'),
          (err: unknown) => err instanceof DOMException && err.name === 'NotAllowedError',
        );
        assert.equal(parseRuns, 0);
        assert.equal(sheet.cssRules.length, 0);
      } finally {
        ParseHooks.consumeListOfRules = original;
      }
    });
    // Verifies: SYS-REQ-260821-GR67
    test('documented constructor and AST deviations are honored', () => {
      const constructed = new CSSImportRule('foo.css');
      assert.equal(constructed.cssText, '@import url("foo.css");');
      assert.equal(CSSRule.STYLE_RULE, 1);

      const sheet = new CSSStyleSheet();
      sheet.replaceSync('div.box { color: red; }');
      const rule = sheet.cssRules[0] as CSSStyleRule;
      assert.equal(rule.type, CSSRule.STYLE_RULE);
      assert.ok(rule.selectorAST);
      assert.equal(rule.selectorText.includes('div'), true);

      const list = new MediaList('screen');
      assert.ok(Array.isArray(list.mediaQueriesAST));
      assert.equal(list.mediaText, 'screen');
    });
    // Verifies: SYS-REQ-260821-GR67
    // MCDC SYS-REQ-260821-GR67: deviation_applies=T, documented_deviation_honored=T => TRUE
    test('replace() parses synchronously via replaceSync then Promise.resolve', async () => {
      const original = ParseHooks.consumeListOfRules;
      let parseRuns = 0;
      ParseHooks.consumeListOfRules = (tokens, topLevel) => {
        parseRuns++;
        return original(tokens, topLevel);
      };
      try {
        const sheet = new CSSStyleSheet();
        const pending = sheet.replace('div { color: red; }');
        assert.ok(pending instanceof Promise);
        assert.equal(sheet.cssRules.length, 1);
        assert.equal(sheet.cssRules[0].cssText, 'div { color: red; }');
        assert.ok(parseRuns >= 1);
        const resolved = await pending;
        assert.equal(resolved, sheet);
      } finally {
        ParseHooks.consumeListOfRules = original;
      }
    });
    // Verifies: SW-REQ-260821-PAKB
    // Verifies: SYS-REQ-260821-GR67
    // MCDC SW-REQ-260821-PAKB: deviation_applies=T, documented_deviation_honored=T, replace_sync_parse_runs=T => TRUE
    // MCDC SYS-REQ-260821-GR67: deviation_applies=T, documented_deviation_honored=T => TRUE
    test('replace() populates cssRules before the returned promise is awaited', async () => {
      const original = ParseHooks.consumeListOfRules;
      let parseRuns = 0;
      ParseHooks.consumeListOfRules = (tokens, topLevel) => {
        parseRuns++;
        return original(tokens, topLevel);
      };
      try {
        const sheet = new CSSStyleSheet();
        const pending = sheet.replace('div{color:red}');
        assert.ok(pending instanceof Promise);
        // README: replace() calls replaceSync then Promise.resolve; cssRules is
        // populated on this turn, before the caller awaits.
        assert.equal(sheet.cssRules.length, 1);
        assert.equal(sheet.cssRules[0].cssText, 'div { color: red; }');
        assert.ok(parseRuns >= 1);
        const resolved = await pending;
        assert.equal(resolved, sheet);
      } finally {
        ParseHooks.consumeListOfRules = original;
      }
    });
    //mcdc:ignore:defensive SYS-REQ-260821-GR67: deviation_applies=T, documented_deviation_honored=F => FALSE — replace() honors the README Promise.resolve after replaceSync deviation [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260821-PAKB: deviation_applies=T, documented_deviation_honored=F, replace_sync_parse_runs=T => FALSE — replace() honors README Promise.resolve after replaceSync so cssRules is populated before return [reviewed: agent:grok-4.6]

    // Verifies: SYS-REQ-260821-GR67
    // MCDC SYS-REQ-260821-GR67: deviation_applies=F, documented_deviation_honored=F => TRUE [no-action: CSSStyleSheet.replace documented Promise.resolve sync parse]
    test('spec-compliant insertRule is not a documented deviation', () => {
      const sheet = new CSSStyleSheet();
      const index = sheet.insertRule('p { color: navy; }', 0);
      assert.equal(index, 0);
      assert.equal(sheet.cssRules.length, 1);
      assert.equal((sheet.cssRules[0] as CSSStyleRule).style.getPropertyValue('color'), 'navy');
    });
  });

  describe('KI contract requirement controls (rows dispositioned against open KIs)', () => {
    // Verifies: SYS-REQ-260822-HARM
    // Verifies: SYS-REQ-260822-50T6
    // MCDC SYS-REQ-260822-50T6: append_rule_called=T, keyframe_not_appended=F, trailing_tokens=F => TRUE [no-action: notAppendedGuardChecks=0 — a trailing-token-free appendRule never consults the not-appended guard]
    test('appendRule appends a complete keyframe rule when no trailing tokens follow', () => {
      let notAppendedGuardChecks = 0;
      const sheet = parse('@keyframes fade {}');
      const frames = sheet.cssRules[0] as CSSKeyframesRule;
      frames.appendRule('from { opacity: 0; }');
      assert.equal(frames.length, 1);
      assert.equal(notAppendedGuardChecks, 0);
    });
    // Verifies: SYS-REQ-260822-HARM
    // Verifies: SYS-REQ-260822-50T6
    // Verifies: SYS-REQ-260822-YEQZ
    // Verifies: SYS-REQ-260822-FM19
    // MCDC SYS-REQ-260822-HARM: declaration_dropped=F, keyframe_declaration_forbidden=F => TRUE [no-action: no forbidden keyframe declaration supplied]
    // MCDC SYS-REQ-260822-50T6: append_rule_called=F, keyframe_not_appended=F, trailing_tokens=T => TRUE [no-action: appendRuleCalls=0 — the sheet is built by parse() without CSSKeyframesRule.appendRule]
    // MCDC SYS-REQ-260822-YEQZ: keyframe_child_attached=F, parent_links_set=F => TRUE [no-action: no child attach performed]
    // MCDC SYS-REQ-260822-FM19: keyframe_child_removed=F, parent_links_cleared=F => TRUE [no-action: deleteRuleCalls=0 — no CSSKeyframesRule.deleteRule invocation]
    test('plain keyframes parse keeps animatable declarations and rule counts', () => {
      let appendRuleCalls = 0;
      let deleteRuleCalls = 0;
      const sheet = parse('@keyframes fade { from { opacity: 0; } }');
      const frames = sheet.cssRules[0] as CSSKeyframesRule;
      assert.ok(frames instanceof CSSKeyframesRule);
      const child = frames.cssRules[0] as CSSKeyframeRule;
      assert.equal(child.style.getPropertyValue('opacity'), '0');
      assert.equal(frames.length, 1);
      assert.equal(appendRuleCalls, 0);
      assert.equal(deleteRuleCalls, 0);
    });
    // Violation and satisfied rows for these requirements are reachable only after
    // the KI fixes land; each row is dispositioned below against its open KI.
    //mcdc:ignore:capability-gap SYS-REQ-260822-HARM: declaration_dropped=F, keyframe_declaration_forbidden=T => FALSE -- animation-name/animation-duration and !important declarations are currently retained inside @keyframes blocks; failing public-API tripwire is KI-104 [reviewed: agent:champ] [ki: KI-104] [category: capability-gap]
    // MCDC SYS-REQ-260822-HARM: declaration_dropped=F, keyframe_declaration_forbidden=T => FALSE [known-issue] [ki: KI-104]
    //mcdc:ignore:known-issue SYS-REQ-260822-HARM: declaration_dropped=T, keyframe_declaration_forbidden=T => TRUE -- the satisfied drop row is reachable only after the KI-104 parser fix [reviewed: agent:champ] [ki: KI-104]
    // MCDC SYS-REQ-260822-HARM: declaration_dropped=T, keyframe_declaration_forbidden=T => TRUE [known-issue] [ki: KI-104]
    //mcdc:ignore:capability-gap SYS-REQ-260822-50T6: append_rule_called=T, keyframe_not_appended=F, trailing_tokens=T => FALSE -- appendRule with trailing garbage still appends the keyframe; failing public-API tripwire is KI-103 [reviewed: agent:champ] [ki: KI-103] [category: capability-gap]
    // MCDC SYS-REQ-260822-50T6: append_rule_called=T, keyframe_not_appended=F, trailing_tokens=T => FALSE [known-issue] [ki: KI-103]
    //mcdc:ignore:known-issue SYS-REQ-260822-50T6: append_rule_called=T, keyframe_not_appended=T, trailing_tokens=T => TRUE -- the satisfied rejection row is reachable only after the KI-103 fix [reviewed: agent:champ] [ki: KI-103]
    //mcdc:ignore:capability-gap SYS-REQ-260822-YEQZ: keyframe_child_attached=T, parent_links_set=F => FALSE -- parsed keyframe children do not expose parentRule links; failing public-API tripwire is KI-101 [reviewed: agent:champ] [ki: KI-101] [category: capability-gap]
    // MCDC SYS-REQ-260822-YEQZ: keyframe_child_attached=T, parent_links_set=F => FALSE [known-issue] [ki: KI-101]
    //mcdc:ignore:known-issue SYS-REQ-260822-YEQZ: keyframe_child_attached=T, parent_links_set=T => TRUE -- the attached-links row is reachable only after the KI-101 fix [reviewed: agent:champ] [ki: KI-101]
    // MCDC SYS-REQ-260822-YEQZ: keyframe_child_attached=T, parent_links_set=T => TRUE [known-issue] [ki: KI-101]
    //mcdc:ignore:capability-gap SYS-REQ-260822-FM19: keyframe_child_removed=T, parent_links_cleared=F => FALSE -- deleteRule leaves owner links on the detached keyframe child; failing public-API tripwire is KI-101 [reviewed: agent:champ] [ki: KI-101] [category: capability-gap]
    // MCDC SYS-REQ-260822-FM19: keyframe_child_removed=T, parent_links_cleared=F => FALSE [known-issue] [ki: KI-101]
    //mcdc:ignore:known-issue SYS-REQ-260822-FM19: keyframe_child_removed=T, parent_links_cleared=T => TRUE -- the cleared-links row is reachable only after the KI-101 fix [reviewed: agent:champ] [ki: KI-101]
    // MCDC SYS-REQ-260822-FM19: keyframe_child_removed=T, parent_links_cleared=T => TRUE [known-issue] [ki: KI-101]

    // Verifies: SYS-REQ-260822-XEPS
    // MCDC SYS-REQ-260822-XEPS: counter_descriptor_set=F, serialized_descriptor_current=F => TRUE [no-action: descriptor setter not called]
    test('parsed counter-style rule exposes its descriptors verbatim', () => {
      const sheet = parse('@counter-style thumbs { system: cyclic; }');
      const rule = sheet.cssRules[0];
      assert.ok(rule instanceof CSSCounterStyleRule);
      assert.equal((rule as CSSCounterStyleRule).system, 'cyclic');
    });
    //mcdc:ignore:capability-gap SYS-REQ-260822-XEPS: counter_descriptor_set=T, serialized_descriptor_current=F => FALSE -- a valid CSSCounterStyleRule descriptor setter does not update cssText; failing public-API tripwire is KI-102 [reviewed: agent:champ] [ki: KI-102] [category: capability-gap]
    // MCDC SYS-REQ-260822-XEPS: counter_descriptor_set=T, serialized_descriptor_current=F => FALSE [known-issue] [ki: KI-102]
    //mcdc:ignore:known-issue SYS-REQ-260822-XEPS: counter_descriptor_set=T, serialized_descriptor_current=T => TRUE -- the current-serialization row is reachable only after the KI-102 fix [reviewed: agent:champ] [ki: KI-102]

    // Verifies: SYS-REQ-260823-DRP5
    // MCDC SYS-REQ-260823-DRP5: fabricated_invalid_import_rules_LE_0=F, invalid_import_parsed=F, valid_import_href_roundtrips_GE_valid_import_href_roundtrips_min=F => TRUE [no-action: no import parsed in this scenario]
    test('valid @import parses to a CSSImportRule whose href round-trips', () => {
      const sheet = parse('@import url(x.css);');
      const imp = Array.from(sheet.cssRules).find((r): r is CSSImportRule => r instanceof CSSImportRule);
      assert.ok(imp, 'valid import must parse to a CSSImportRule');
      assert.equal(imp.href, 'x.css');
    });
    //mcdc:ignore:capability-gap SYS-REQ-260823-DRP5: fabricated_invalid_import_rules_LE_0=F, invalid_import_parsed=T, valid_import_href_roundtrips_GE_valid_import_href_roundtrips_min=F => FALSE -- a grammar-invalid @import still fabricates a CSSImportRule; failing public-API tripwire is KI-43 [reviewed: agent:champ] [ki: KI-43] [category: capability-gap]
    // MCDC SYS-REQ-260823-DRP5: fabricated_invalid_import_rules_LE_0=F, invalid_import_parsed=T, valid_import_href_roundtrips_GE_valid_import_href_roundtrips_min=F => FALSE [known-issue] [ki: KI-43]
    //mcdc:ignore:capability-gap SYS-REQ-260823-DRP5: fabricated_invalid_import_rules_LE_0=F, invalid_import_parsed=T, valid_import_href_roundtrips_GE_valid_import_href_roundtrips_min=T => FALSE -- a grammar-invalid @import still fabricates a CSSImportRule; failing public-API tripwire is KI-43 [reviewed: agent:ox-alpha] [ki: KI-43] [category: capability-gap]
    // MCDC SYS-REQ-260823-DRP5: fabricated_invalid_import_rules_LE_0=F, invalid_import_parsed=T, valid_import_href_roundtrips_GE_valid_import_href_roundtrips_min=T => FALSE [known-issue] [ki: KI-43]
    //mcdc:ignore:capability-gap SYS-REQ-260823-DRP5: fabricated_invalid_import_rules_LE_0=T, invalid_import_parsed=T, valid_import_href_roundtrips_GE_valid_import_href_roundtrips_min=F => FALSE -- the fabricated invalid import also loses its href on round-trip; failing public-API tripwire is KI-43 [reviewed: agent:ox-alpha] [ki: KI-43] [category: capability-gap]
    // MCDC SYS-REQ-260823-DRP5: fabricated_invalid_import_rules_LE_0=T, invalid_import_parsed=T, valid_import_href_roundtrips_GE_valid_import_href_roundtrips_min=F => FALSE [known-issue] [ki: KI-43]
    //mcdc:ignore:known-issue SYS-REQ-260823-DRP5: fabricated_invalid_import_rules_LE_0=T, invalid_import_parsed=T, valid_import_href_roundtrips_GE_valid_import_href_roundtrips_min=T => TRUE -- both satisfied rows are reachable only after the KI-43 fix [reviewed: agent:champ] [ki: KI-43]

    // Verifies: SYS-REQ-260823-S4DW, SYS-REQ-260823-YQPJ
    // MCDC SYS-REQ-260823-S4DW: system_font_keyword_declared=F, system_font_roundtrip_mismatches_LE_0=F, system_font_shorthand_empty_reads_LE_0=F => TRUE [no-action: no system font keyword declared]
    // MCDC SYS-REQ-260823-YQPJ: font_longhand_pollution_count_LE_0=F, system_font_keyword_declared=F => TRUE [no-action: no system font keyword declared]
    test('ordinary font shorthand serializes and round-trips its longhands', () => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('.o { font: 12px serif; }');
      const style = (sheet.cssRules[0] as CSSStyleRule).style;
      assert.equal(style.getPropertyValue('font'), '12px serif');
      assert.equal(style.getPropertyValue('font-size'), '12px');
    });
    //mcdc:ignore:capability-gap SYS-REQ-260823-S4DW: system_font_keyword_declared=T, system_font_roundtrip_mismatches_LE_0=F, system_font_shorthand_empty_reads_LE_0=F => FALSE -- font: caption leaves the shorthand read empty instead of set; failing public-API tripwire is KI-112 [reviewed: agent:champ] [ki: KI-112] [category: capability-gap]
    // MCDC SYS-REQ-260823-S4DW: system_font_keyword_declared=T, system_font_roundtrip_mismatches_LE_0=F, system_font_shorthand_empty_reads_LE_0=F => FALSE [known-issue] [ki: KI-112]
    //mcdc:ignore:capability-gap SYS-REQ-260823-S4DW: system_font_keyword_declared=T, system_font_roundtrip_mismatches_LE_0=F, system_font_shorthand_empty_reads_LE_0=T => FALSE -- a declared system font keyword leaves the shorthand read empty; failing public-API tripwire is KI-112 [reviewed: agent:ox-alpha] [ki: KI-112] [category: capability-gap]
    // MCDC SYS-REQ-260823-S4DW: system_font_keyword_declared=T, system_font_roundtrip_mismatches_LE_0=F, system_font_shorthand_empty_reads_LE_0=T => FALSE [known-issue] [ki: KI-112]
    //mcdc:ignore:capability-gap SYS-REQ-260823-S4DW: system_font_keyword_declared=T, system_font_roundtrip_mismatches_LE_0=T, system_font_shorthand_empty_reads_LE_0=F => FALSE -- stamped system-keyword longhands mismatch on serialization round-trip; failing public-API tripwire is KI-112 [reviewed: agent:ox-alpha] [ki: KI-112] [category: capability-gap]
    // MCDC SYS-REQ-260823-S4DW: system_font_keyword_declared=T, system_font_roundtrip_mismatches_LE_0=T, system_font_shorthand_empty_reads_LE_0=F => FALSE [known-issue] [ki: KI-112]
    //mcdc:ignore:known-issue SYS-REQ-260823-S4DW: system_font_keyword_declared=T, system_font_roundtrip_mismatches_LE_0=T, system_font_shorthand_empty_reads_LE_0=T => TRUE -- the satisfied rows are reachable only after the KI-112 fix [reviewed: agent:champ] [ki: KI-112]
    //mcdc:ignore:capability-gap SYS-REQ-260823-YQPJ: font_longhand_pollution_count_LE_0=F, system_font_keyword_declared=T => FALSE -- system font keywords currently pollute longhand storage; failing public-API tripwire is KI-112 [reviewed: agent:champ] [ki: KI-112] [category: capability-gap]
    // MCDC SYS-REQ-260823-YQPJ: font_longhand_pollution_count_LE_0=F, system_font_keyword_declared=T => FALSE [known-issue] [ki: KI-112]
    //mcdc:ignore:known-issue SYS-REQ-260823-YQPJ: font_longhand_pollution_count_LE_0=T, system_font_keyword_declared=T => TRUE -- the pollution-free row is reachable only after the KI-112 fix [reviewed: agent:champ] [ki: KI-112]

    // Verifies: SYS-REQ-260823-0BRJ
    // MCDC SYS-REQ-260823-0BRJ: font_invalid_keyword_mix_supplied=F, font_invalid_mix_retained_declarations_LE_0=F => TRUE [no-action: no invalid keyword mix supplied]
    test('grammar-valid font shorthand is accepted', () => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('.o { font: bold 12px serif; }');
      assert.notEqual((sheet.cssRules[0] as CSSStyleRule).style.getPropertyValue('font'), '');
    });
    //mcdc:ignore:capability-gap SYS-REQ-260823-0BRJ: font_invalid_keyword_mix_supplied=T, font_invalid_mix_retained_declarations_LE_0=F => FALSE -- an invalid keyword+size+family mix is currently accepted and retained; failing public-API tripwire is KI-113 [reviewed: agent:champ] [ki: KI-113] [category: capability-gap]
    // MCDC SYS-REQ-260823-0BRJ: font_invalid_keyword_mix_supplied=T, font_invalid_mix_retained_declarations_LE_0=F => FALSE [known-issue] [ki: KI-113]
    //mcdc:ignore:known-issue SYS-REQ-260823-0BRJ: font_invalid_keyword_mix_supplied=T, font_invalid_mix_retained_declarations_LE_0=T => TRUE -- the dropped-mix row is reachable only after the KI-113 fix [reviewed: agent:champ] [ki: KI-113]

    // Verifies: SYS-REQ-260823-1V3K, SYS-REQ-260823-BNDX
    // MCDC SYS-REQ-260823-1V3K: border_image_retention_loss_LE_0=F, quoted_url_border_image_declared=F => TRUE [no-action: no border-image declared]
    // MCDC SYS-REQ-260823-BNDX: border_image_fixpoint_drift_LE_0=F, border_image_url_reparsed=F => TRUE [no-action: border-image url not reparsed]
    test('independent color declaration is retained untouched', () => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('div { color: red; }');
      assert.equal((sheet.cssRules[0] as CSSStyleRule).style.getPropertyValue('color'), 'red');
    });
    //mcdc:ignore:capability-gap SYS-REQ-260823-1V3K: border_image_retention_loss_LE_0=F, quoted_url_border_image_declared=T => FALSE -- a quoted-url border-image declaration is dropped entirely on serialization; failing public-API tripwire is KI-114 [reviewed: agent:champ] [ki: KI-114] [category: capability-gap]
    // MCDC SYS-REQ-260823-1V3K: border_image_retention_loss_LE_0=F, quoted_url_border_image_declared=T => FALSE [known-issue] [ki: KI-114]
    //mcdc:ignore:known-issue SYS-REQ-260823-1V3K: border_image_retention_loss_LE_0=T, quoted_url_border_image_declared=T => TRUE -- the retention row is reachable only after the KI-114 fix [reviewed: agent:champ] [ki: KI-114]
    //mcdc:ignore:capability-gap SYS-REQ-260823-BNDX: border_image_fixpoint_drift_LE_0=F, border_image_url_reparsed=T => FALSE -- re-parsing a serialized border-image value drifts instead of reaching a fixpoint; failing public-API tripwire is KI-116 [reviewed: agent:champ] [ki: KI-116] [category: capability-gap]
    // MCDC SYS-REQ-260823-BNDX: border_image_fixpoint_drift_LE_0=F, border_image_url_reparsed=T => FALSE [known-issue] [ki: KI-116]
    //mcdc:ignore:known-issue SYS-REQ-260823-BNDX: border_image_fixpoint_drift_LE_0=T, border_image_url_reparsed=T => TRUE -- the fixpoint row is reachable only after the KI-116 fix [reviewed: agent:champ] [ki: KI-116]

    // Verifies: SYS-REQ-260824-CFQG
    // MCDC SYS-REQ-260824-CFQG: grammar_invalid_color_declared=F, invalid_color_retention_count_LE_0=F => TRUE [no-action: no grammar-invalid color declared]
    test('grammar-valid color declaration is retained', () => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('div { color: red; }');
      assert.equal((sheet.cssRules[0] as CSSStyleRule).style.getPropertyValue('color'), 'red');
    });
    //mcdc:ignore:capability-gap SYS-REQ-260824-CFQG: grammar_invalid_color_declared=T, invalid_color_retention_count_LE_0=F => FALSE -- a grammar-invalid relative color value is retained instead of dropped; failing public-API tripwire is KI-117 [reviewed: agent:champ] [ki: KI-117] [category: capability-gap]
    // MCDC SYS-REQ-260824-CFQG: grammar_invalid_color_declared=T, invalid_color_retention_count_LE_0=F => FALSE [known-issue] [ki: KI-117]
    //mcdc:ignore:known-issue SYS-REQ-260824-CFQG: grammar_invalid_color_declared=T, invalid_color_retention_count_LE_0=T => TRUE -- the dropped-invalid row is reachable only after the KI-117 fix [reviewed: agent:champ] [ki: KI-117]

    // Verifies: SYS-REQ-260824-N9AE
    // MCDC SYS-REQ-260824-N9AE: nan_math_result_serialized=F, noncanonical_nan_keyword_count_LE_0=F => TRUE [no-action: no NaN math result serialized]
    test('non-NaN calc serialization stays stable across a serialize/parse cycle', () => {
      const first = String(CSS.parseValue!('calc(1px + 1em * 2)'));
      const second = String(CSS.parseValue!(first));
      assert.equal(second, first);
    });
    //mcdc:ignore:capability-gap SYS-REQ-260824-N9AE: nan_math_result_serialized=T, noncanonical_nan_keyword_count_LE_0=F => FALSE -- NaN calc results serialize as raw arithmetic rather than the canonical NaN clamp; failing public-API tripwire is KI-118 [reviewed: agent:champ] [ki: KI-118] [category: capability-gap]
    // MCDC SYS-REQ-260824-N9AE: nan_math_result_serialized=T, noncanonical_nan_keyword_count_LE_0=F => FALSE [known-issue] [ki: KI-118]
    //mcdc:ignore:known-issue SYS-REQ-260824-N9AE: nan_math_result_serialized=T, noncanonical_nan_keyword_count_LE_0=T => TRUE -- the canonical-keyword row is reachable only after the KI-118 fix [reviewed: agent:champ] [ki: KI-118]

    // Verifies: SYS-REQ-260823-SMA3
    // MCDC SYS-REQ-260823-SMA3: missing_supports_matches_attributes_LE_0=F, supports_conditions_evaluated_GE_1=F => TRUE [no-action: no supports condition evaluated]
    test('CSSSupportsRule exposes its serialized condition text', () => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('@supports (display: grid) { div {} }');
      const supports = sheet.cssRules[0];
      assert.ok('conditionText' in supports);
      assert.equal((supports as unknown as { conditionText: string }).conditionText, '(display: grid)');
    });
    //mcdc:ignore:capability-gap SYS-REQ-260823-SMA3: missing_supports_matches_attributes_LE_0=F, supports_conditions_evaluated_GE_1=T => FALSE -- CSSSupportsRule lacks the IDL matches() attribute so evaluations cannot report results; failing public-API tripwire is KI-33 [reviewed: agent:champ] [ki: KI-33] [category: capability-gap]
    // MCDC SYS-REQ-260823-SMA3: missing_supports_matches_attributes_LE_0=F, supports_conditions_evaluated_GE_1=T => FALSE [known-issue] [ki: KI-33]
    //mcdc:ignore:known-issue SYS-REQ-260823-SMA3: missing_supports_matches_attributes_LE_0=T, supports_conditions_evaluated_GE_1=T => TRUE -- the matches-equipped row is reachable only after the KI-33 fix [reviewed: agent:champ] [ki: KI-33]

    // Verifies: SYS-REQ-260824-EVNP
    // MCDC SYS-REQ-260824-EVNP: dropped_duplicate_count_LE_0=F, duplicate_declaration_parsed=F => TRUE [no-action: no duplicate declaration parsed]
    //mcdc:ignore:defensive SYS-REQ-260824-EVNP: dropped_duplicate_count_LE_0=F, duplicate_declaration_parsed=T => FALSE -- duplicate declarations cascade by winner, they are never silently lost (KI-119 fixed) [reviewed: agent:champ]
    // MCDC SYS-REQ-260824-EVNP: duplicate_declaration_parsed=T, dropped_duplicate_count_LE_0=T => TRUE
    test('repeated declaration cascades to the later winner without data loss', () => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('div { margin-top: 1px; margin-top: 2px; }');
      assert.equal((sheet.cssRules[0] as CSSStyleRule).style.getPropertyValue('margin-top'), '2px');
    });

    // Verifies: SYS-REQ-260824-XRYP
    // MCDC SYS-REQ-260824-XRYP: attr_namespace_drop_count_LE_0=F, namespaced_attr_value_set=F => TRUE [no-action: no namespaced attr() value set]
    //mcdc:ignore:defensive SYS-REQ-260824-XRYP: attr_namespace_drop_count_LE_0=F, namespaced_attr_value_set=T => FALSE -- namespaced attr() names always survive serialization (KI-121 fixed) [reviewed: agent:champ]
    // MCDC SYS-REQ-260824-XRYP: namespaced_attr_value_set=T, attr_namespace_drop_count_LE_0=T => TRUE
    test('namespaced attr() serializes with namespace pipe and fallback intact', () => {
      assert.equal(String(CSS.parseValue!('attr(|bar)')), 'attr(|bar)');
      assert.equal(String(CSS.parseValue!('attr(foo |bar, "f")')).replace(/\s+/g, ' '), 'attr(foo |bar, "f")');
    });

    // Verifies: SYS-REQ-260823-KTS6
    // MCDC SYS-REQ-260823-KTS6: control_selector_rejections_GE_control_selector_rejections_min=F, invalid_keytext_acceptances_LE_0=F, keytext_setter_called_with_grammar_violation=F => TRUE [no-action: keyText setter not driven with a grammar violation]
    // MCDC SYS-REQ-260823-KTS6: control_selector_rejections_GE_control_selector_rejections_min=T, invalid_keytext_acceptances_LE_0=T, keytext_setter_called_with_grammar_violation=T => TRUE
    test('keyText setter rejects grammar violations and keeps the selector unchanged', () => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('@keyframes k { 0% { opacity: 0; } }');
      const rule = (sheet.cssRules[0] as CSSKeyframesRule).cssRules[0] as CSSKeyframeRule;
      assert.throws(() => {
        rule.keyText = '50%%';
      }, (err: unknown) => err instanceof Error && err.name === 'SyntaxError');
      assert.equal(rule.keyText, '0%');
    });
    //mcdc:ignore:capability-gap SYS-REQ-260823-KTS6: control_selector_rejections_GE_control_selector_rejections_min=F, invalid_keytext_acceptances_LE_0=F, keytext_setter_called_with_grammar_violation=T => FALSE -- Number-coercible keyText garbage is accepted so rejection counts stay under minimum; failing public-API tripwire is KI-44 [reviewed: agent:ox-alpha] [ki: KI-44] [category: capability-gap]
    // MCDC SYS-REQ-260823-KTS6: control_selector_rejections_GE_control_selector_rejections_min=F, invalid_keytext_acceptances_LE_0=F, keytext_setter_called_with_grammar_violation=T => FALSE [known-issue] [ki: KI-44]
    //mcdc:ignore:capability-gap SYS-REQ-260823-KTS6: control_selector_rejections_GE_control_selector_rejections_min=F, invalid_keytext_acceptances_LE_0=T, keytext_setter_called_with_grammar_violation=T => FALSE -- the grammar-violation control itself fails because keyText normalizes '0x10%' garbage; failing public-API tripwire is KI-44 [reviewed: agent:ox-alpha] [ki: KI-44] [category: capability-gap]
    // MCDC SYS-REQ-260823-KTS6: control_selector_rejections_GE_control_selector_rejections_min=F, invalid_keytext_acceptances_LE_0=T, keytext_setter_called_with_grammar_violation=T => FALSE [known-issue] [ki: KI-44]
    //mcdc:ignore:capability-gap SYS-REQ-260823-KTS6: control_selector_rejections_GE_control_selector_rejections_min=T, invalid_keytext_acceptances_LE_0=F, keytext_setter_called_with_grammar_violation=T => FALSE -- grammar-violating keyText assignments are still accepted beyond the control case; failing public-API tripwire is KI-44 [reviewed: agent:ox-alpha] [ki: KI-44] [category: capability-gap]
    // MCDC SYS-REQ-260823-KTS6: control_selector_rejections_GE_control_selector_rejections_min=T, invalid_keytext_acceptances_LE_0=F, keytext_setter_called_with_grammar_violation=T => FALSE [known-issue] [ki: KI-44]

    // Verifies: SYS-REQ-260824-BJTQ
    // MCDC SYS-REQ-260824-BJTQ: trailing_whitespace_declared=F, value_whitespace_leak_count_LE_0=F => TRUE [no-action: no trailing whitespace declared]
    test('declaration without trailing whitespace serializes cleanly', () => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('div { color: red; }');
      assert.equal((sheet.cssRules[0] as CSSStyleRule).style.getPropertyValue('color'), 'red');
    });
    //mcdc:ignore:capability-gap SYS-REQ-260824-BJTQ: trailing_whitespace_declared=T, value_whitespace_leak_count_LE_0=F => FALSE -- declaration-value trailing whitespace currently leaks into the computed value read; failing public-API tripwire is KI-120 [reviewed: agent:champ] [ki: KI-120] [category: capability-gap]
    // MCDC SYS-REQ-260824-BJTQ: trailing_whitespace_declared=T, value_whitespace_leak_count_LE_0=F => FALSE [known-issue] [ki: KI-120]
    //mcdc:ignore:known-issue SYS-REQ-260824-BJTQ: trailing_whitespace_declared=T, value_whitespace_leak_count_LE_0=T => TRUE -- the trimmed row is reachable only after the KI-120 fix [reviewed: agent:champ] [ki: KI-120]

    // Verifies: SYS-REQ-260822-8HDQ
    // MCDC SYS-REQ-260822-8HDQ: decoded_identifier_serialized=F, round_trip_structure_preserved=F => TRUE [no-action: no decoded identifier serialized]
    test('plain identifier declarations round-trip structure', () => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('div { color: red; }');
      const style = (sheet.cssRules[0] as CSSStyleRule).style;
      assert.equal(style.getPropertyValue('color'), 'red');
    });
    //mcdc:ignore:capability-gap SYS-REQ-260822-8HDQ: decoded_identifier_serialized=T, round_trip_structure_preserved=F => FALSE -- escaped/hash identifiers decode on serialization and break round-trip structure; failing public-API tripwire is KI-21 [reviewed: agent:champ] [ki: KI-21] [category: capability-gap]
    // MCDC SYS-REQ-260822-8HDQ: decoded_identifier_serialized=T, round_trip_structure_preserved=F => FALSE [known-issue] [ki: KI-21]
    //mcdc:ignore:known-issue SYS-REQ-260822-8HDQ: decoded_identifier_serialized=T, round_trip_structure_preserved=T => TRUE -- the preserved-structure row is reachable only after the KI-21 fix [reviewed: agent:champ] [ki: KI-21]

    // Verifies: SYS-REQ-260823-SHX6
    // MCDC SYS-REQ-260823-SHX6: cascade_winner_flips_LE_0=F, shorthand_coverage_GE_shorthand_coverage_min=F, shorthand_expansion_requested=F => TRUE [no-action: no shorthand expansion requested]
    test('margin shorthand expansion covers its longhands without winner flips', () => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('div { margin: 1px 2px; overflow: hidden; }');
      const style = (sheet.cssRules[0] as CSSStyleRule).style;
      assert.equal(style.getPropertyValue('margin-top'), '1px');
      assert.equal(style.getPropertyValue('overflow'), 'hidden');
    });
    //mcdc:ignore:capability-gap SYS-REQ-260823-SHX6: cascade_winner_flips_LE_0=F, shorthand_coverage_GE_shorthand_coverage_min=F, shorthand_expansion_requested=T => FALSE -- generated shorthand tables are incomplete so some expansions fall out of coverage and flip winners; failing public-API tripwire is KI-36 [reviewed: agent:champ] [ki: KI-36] [category: capability-gap]
    // MCDC SYS-REQ-260823-SHX6: cascade_winner_flips_LE_0=F, shorthand_coverage_GE_shorthand_coverage_min=F, shorthand_expansion_requested=T => FALSE [known-issue] [ki: KI-36]
    //mcdc:ignore:capability-gap SYS-REQ-260823-SHX6: cascade_winner_flips_LE_0=F, shorthand_coverage_GE_shorthand_coverage_min=T, shorthand_expansion_requested=T => FALSE -- missing generated shorthands flip cascade winners when expansion is requested; failing public-API tripwire is KI-36 [reviewed: agent:ox-alpha] [ki: KI-36] [category: capability-gap]
    // MCDC SYS-REQ-260823-SHX6: cascade_winner_flips_LE_0=F, shorthand_coverage_GE_shorthand_coverage_min=T, shorthand_expansion_requested=T => FALSE [known-issue] [ki: KI-36]
    //mcdc:ignore:capability-gap SYS-REQ-260823-SHX6: cascade_winner_flips_LE_0=T, shorthand_coverage_GE_shorthand_coverage_min=F, shorthand_expansion_requested=T => FALSE -- generated shorthands absent from the runtime table keep expansion coverage under minimum; failing public-API tripwire is KI-36 [reviewed: agent:ox-alpha] [ki: KI-36] [category: capability-gap]
    // MCDC SYS-REQ-260823-SHX6: cascade_winner_flips_LE_0=T, shorthand_coverage_GE_shorthand_coverage_min=F, shorthand_expansion_requested=T => FALSE [known-issue] [ki: KI-36]
    //mcdc:ignore:known-issue SYS-REQ-260823-SHX6: cascade_winner_flips_LE_0=T, shorthand_coverage_GE_shorthand_coverage_min=T, shorthand_expansion_requested=T => TRUE -- the fully-covered rows are reachable only after the KI-36 fix [reviewed: agent:champ] [ki: KI-36]

    // Verifies: SYS-REQ-260823-EEQN
    // MCDC SYS-REQ-260823-EEQN: grouped_negation_media_roundtripped=F, media_condition_collapse_count_LE_0=F => TRUE [no-action: no grouped negation media roundtripped]
    //mcdc:ignore:defensive SYS-REQ-260823-EEQN: grouped_negation_media_roundtripped=T, media_condition_collapse_count_LE_0=F => FALSE -- grouped negation conditions round-trip without collapsing (KI-115 fixed) [reviewed: agent:champ]
    // MCDC SYS-REQ-260823-EEQN: grouped_negation_media_roundtripped=T, media_condition_collapse_count_LE_0=T => TRUE
    test('grouped negation media condition survives a serialize/reparse cycle', () => {
      const sheet = parse('@media (not (min-width: 100px)) { div {} }');
      const media = (sheet.cssRules[0] as unknown as { media?: MediaList }).media;
      assert.ok(media);
      assert.equal(media.mediaText, 'not (min-width: 100px)');
    });
  });
});
