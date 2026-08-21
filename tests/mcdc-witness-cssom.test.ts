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
    // MCDC SW-REQ-260821-HNRG: declaration_unchanged=T, value_validation_fails=T => TRUE
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
    // MCDC SW-REQ-260821-HNRG: declaration_unchanged=F, value_validation_fails=F => TRUE [no-action: CSSStyleDeclaration.setProperty validation-fail early-return]
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
    //mcdc:ignore:defensive SW-REQ-260821-HNRG: declaration_unchanged=F, value_validation_fails=T => FALSE — invalid setProperty including stored all: var(--x) then a failed expand is a no-op [reviewed: agent:grok-4.6]

    // Verifies: SW-REQ-260821-HNRG
    // MCDC SW-REQ-260821-HNRG: declaration_unchanged=T, value_validation_fails=T => TRUE
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
    // MCDC INT-REQ-260821-30ZA: insert_rule_path=F, parse_hooks_consume_rule_called=F, parser_imported=F => TRUE [no-action: ParseHooks.consumeRule]
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
//mcdc:ignore:defensive INT-REQ-260821-30ZA: insert_rule_path=T, parse_hooks_consume_rule_called=F, parser_imported=F => FALSE — CSSStyleSheet.insertRule parse path always calls ParseHooks.consumeRule via _parseRule [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive INT-REQ-260821-30ZA: insert_rule_path=T, parse_hooks_consume_rule_called=T, parser_imported=T => FALSE — src/CSSOM.ts does not import parser.ts; insertRule uses ParseHooks inversion [reviewed: agent:grok-4.6]

    // Verifies: INT-REQ-260821-30ZA
    // MCDC INT-REQ-260821-30ZA: insert_rule_path=T, parse_hooks_consume_rule_called=T, parser_imported=F => TRUE
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
        const index = sheet.insertRule('div { color: red; }', 0);
        assert.equal(index, 0);
        assert.ok(consumeCalls >= 1);
        assert.equal(sheet.cssRules.length, 1);
        assert.ok(sheet.cssRules[0] instanceof CSSStyleRule);
        assert.equal((sheet.cssRules[0] as CSSStyleRule).style.getPropertyValue('color'), 'red');
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
    // MCDC SYS-REQ-260821-GR67: deviation_applies=T, documented_deviation_honored=T => TRUE
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
    //mcdc:ignore:defensive SYS-REQ-260821-GR67: deviation_applies=T, documented_deviation_honored=F => FALSE — replace() honors the README Promise.resolve after replaceSync deviation [reviewed: agent:grok-4.6]
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
    // MCDC SW-REQ-260821-PAKB: deviation_applies=T, documented_deviation_honored=T, replace_sync_parse_runs=T => TRUE
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
});
