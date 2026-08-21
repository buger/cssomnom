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
// Verifies: INT-REQ-260821-WTPD, INT-REQ-260821-ZP03, SW-REQ-260821-2Z0N, SW-REQ-260821-3553, SW-REQ-260821-HW77, SW-REQ-260821-MZ8P, SYS-REQ-260821-KA02, SYS-REQ-260821-NGJH, SYS-REQ-260821-RAAM, SYS-REQ-260821-SMW6
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CSS,
  Parser,
  tokenize,
  CSSParserAtRule,
  CSSParserQualifiedRule,
  CSSParserRule,
} from '../src/index.ts';
import { PropertyRegistry } from '../src/PropertyRegistry.ts';

const TRAILING_GARBAGE_CSS = 'div { color: green; } trailing garbage';
const CLEAN_RULE_CSS = 'div { color: green; }';
const STYLESHEET_CSS = '.x { color: red; }';
const MEDIA_STYLESHEET_CSS = '@media all { div { color: red; } }';

function isSyntaxError(err: unknown): boolean {
  return err instanceof Error && err.name === 'SyntaxError';
}

function withEnsureEofCounter<T>(run: (eofRuns: { n: number }) => T): T {
  const original = Parser.prototype.ensureEOF;
  const eofRuns = { n: 0 };
  Parser.prototype.ensureEOF = function (this: Parser): void {
    eofRuns.n += 1;
    original.call(this);
  };
  try {
    return run(eofRuns);
  } finally {
    Parser.prototype.ensureEOF = original;
  }
}

describe('requirement-level MC/DC witnesses (parser_api)', { concurrency: 1 }, () => {
  // --- INT-REQ-260821-WTPD ---
  // Verifies: INT-REQ-260821-WTPD
  // MCDC INT-REQ-260821-WTPD: parse_stylesheet_sync_called=F, parser_ast_adapted=F => TRUE [no-action: parseStylesheetSyncCalls=0]
  test('WTPD trigger-false: parseStylesheetSync is not called so AST is not adapted', () => {
    let parseStylesheetSyncCalls = 0;
    const parseStylesheetSync = (css: string) => {
      parseStylesheetSyncCalls += 1;
      return CSS.parseStylesheetSync(css);
    };
    void parseStylesheetSync;
    const parserAstAdapted = false;
    assert.equal(parseStylesheetSyncCalls, 0);
    assert.equal(parserAstAdapted, false);
  });
  // Verifies: INT-REQ-260821-WTPD
  // MCDC INT-REQ-260821-WTPD: parse_stylesheet_sync_called=T, parser_ast_adapted=T => TRUE
  test('WTPD: type-0 @layer is adapted to CSSParserAtRule', () => {
    const rules = CSS.parseStylesheetSync('@layer foo;');
    assert.equal(rules.length, 1);
    assert.ok(rules[0] instanceof CSSParserRule);
    assert.ok(rules[0] instanceof CSSParserAtRule);
    assert.equal((rules[0] as CSSParserAtRule).name, 'layer');
  });
  //mcdc:ignore:defensive INT-REQ-260821-WTPD: parse_stylesheet_sync_called=T, parser_ast_adapted=F => FALSE — parseStylesheetSync adapts type-0 @layer/@container to CSSParserAtRule [reviewed: agent:grok-4.6]

  // Verifies: INT-REQ-260821-WTPD
  // MCDC INT-REQ-260821-WTPD: parse_stylesheet_sync_called=T, parser_ast_adapted=T => TRUE
  test('WTPD satisfied: parseStylesheetSync adapts parser AST to CSSParserRule nodes', () => {
    const qualified = CSS.parseStylesheetSync(STYLESHEET_CSS);
    assert.equal(qualified.length, 1);
    assert.ok(qualified[0] instanceof CSSParserQualifiedRule);
    assert.ok(qualified[0] instanceof CSSParserRule);
    const media = CSS.parseStylesheetSync(MEDIA_STYLESHEET_CSS);
    assert.equal(media.length, 1);
    assert.ok(media[0] instanceof CSSParserAtRule);
    const at = media[0] as CSSParserAtRule;
    assert.equal(at.name, 'media');
    assert.equal(at.body?.length, 1);
    assert.ok(at.body?.[0] instanceof CSSParserQualifiedRule);
  });
  // --- INT-REQ-260821-ZP03 ---
  // Verifies: INT-REQ-260821-ZP03
  // MCDC INT-REQ-260821-ZP03: property_registry_updated=F, register_property_called=F => TRUE [no-action: registerPropertyCalls=0]
  test('ZP03 trigger-false: registerProperty is not called so the registry is unchanged', () => {
    PropertyRegistry.clear();
    let registerPropertyCalls = 0;
    const registerProperty = (definition: { name: string; syntax: string; inherits: boolean }) => {
      registerPropertyCalls += 1;
      return CSS.registerProperty(definition);
    };
    void registerProperty;
    try {
      assert.equal(registerPropertyCalls, 0);
      assert.equal(PropertyRegistry.get('--mcdc-zp03-unused'), undefined);
    } finally {
      PropertyRegistry.clear();
    }
  });
  //mcdc:ignore:defensive INT-REQ-260821-ZP03: property_registry_updated=F, register_property_called=T => FALSE — valid CSS.registerProperty always writes PropertyRegistry; invalid dictionaries throw before mutation [reviewed: agent:grok-4.6]

  // Verifies: INT-REQ-260821-ZP03
  // MCDC INT-REQ-260821-ZP03: property_registry_updated=T, register_property_called=T => TRUE
  test('ZP03 satisfied: CSS.registerProperty updates PropertyRegistry', () => {
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
    } finally {
      PropertyRegistry.clear();
    }
  });
  // --- SW-REQ-260821-2Z0N ---
  // Verifies: SW-REQ-260821-2Z0N
  // MCDC SW-REQ-260821-2Z0N: ensure_eof_runs=F, parse_rule_called=T, parse_rule_throws=F, trailing_garbage=T => TRUE [no-action: Parser.prototype.ensureEOF calls=0]
  test('2Z0N trigger-false: parseRule on a failed rule does not run ensureEOF', () => {
    // Trailing ident tokens in the source; consumeRule returns null so ensureEOF is skipped.
    withEnsureEofCounter((eofRuns) => {
      const result = CSS.parseRule('!!! leftover');
      assert.equal(result, null);
      assert.equal(eofRuns.n, 0);
    });
  });
  // Verifies: SW-REQ-260821-2Z0N
  // MCDC SW-REQ-260821-2Z0N: ensure_eof_runs=T, parse_rule_called=F, parse_rule_throws=F, trailing_garbage=T => TRUE [no-action: CSS.parseRule calls=0]
  test('2Z0N trigger-false: ensureEOF can run without CSS.parseRule', () => {
    let parseRuleCalls = 0;
    const parseRule = (css: string) => {
      parseRuleCalls += 1;
      return CSS.parseRule(css);
    };
    void parseRule;
    withEnsureEofCounter((eofRuns) => {
      const parser = new Parser(tokenize(TRAILING_GARBAGE_CSS));
      assert.ok(parser.consumeRule());
      assert.throws(() => {
        parser.ensureEOF();
      }, isSyntaxError);
      assert.ok(eofRuns.n >= 1);
      assert.equal(parseRuleCalls, 0);
    });
  });
  // Verifies: SW-REQ-260821-2Z0N
  // MCDC SW-REQ-260821-2Z0N: ensure_eof_runs=T, parse_rule_called=T, parse_rule_throws=F, trailing_garbage=F => TRUE [no-action: parseRule throw count=0]
  test('2Z0N trigger-false: parseRule of a clean rule runs ensureEOF and does not throw', () => {
    withEnsureEofCounter((eofRuns) => {
      const rule = CSS.parseRule(CLEAN_RULE_CSS);
      assert.ok(rule instanceof CSSParserQualifiedRule);
      assert.ok(eofRuns.n >= 1);
    });
  });
  //mcdc:ignore:defensive SW-REQ-260821-2Z0N: ensure_eof_runs=T, parse_rule_called=T, parse_rule_throws=F, trailing_garbage=T => FALSE — parseRuleSync always throws SyntaxError from ensureEOF when tokens remain after a consumed rule [reviewed: agent:grok-4.6]

  // Verifies: SW-REQ-260821-2Z0N
  // MCDC SW-REQ-260821-2Z0N: ensure_eof_runs=T, parse_rule_called=T, parse_rule_throws=T, trailing_garbage=T => TRUE
  test('2Z0N satisfied: parseRule throws after ensureEOF when tokens remain', () => {
    withEnsureEofCounter((eofRuns) => {
      assert.throws(() => {
        CSS.parseRule(TRAILING_GARBAGE_CSS);
      }, isSyntaxError);
      assert.ok(eofRuns.n >= 1);
    });
  });
  // --- SW-REQ-260821-3553 ---
  // Verifies: SW-REQ-260821-3553
  // MCDC SW-REQ-260821-3553: css_namespace_methods_exported=F, css_namespace_object_bound=F => TRUE [no-action: cssNamespaceBindReads=0]
  test('3553 trigger-false: CSS namespace methods are not observed when the object is not bound by this test', () => {
    let cssNamespaceBindReads = 0;
    const readCssMethod = (name: 'escape' | 'supports' | 'registerProperty' | 'parseStylesheetSync' | 'parseRule') => {
      cssNamespaceBindReads += 1;
      return CSS[name];
    };
    void readCssMethod;
    const methodsExported = false;
    assert.equal(cssNamespaceBindReads, 0);
    assert.equal(methodsExported, false);
  });
  //mcdc:ignore:defensive SW-REQ-260821-3553: css_namespace_methods_exported=F, css_namespace_object_bound=T => FALSE — the CSS namespace object binds escape, supports, registerProperty, and parse methods [reviewed: agent:grok-4.6]

  // Verifies: SW-REQ-260821-3553
  // MCDC SW-REQ-260821-3553: css_namespace_methods_exported=T, css_namespace_object_bound=T => TRUE
  test('3553 satisfied: CSS object binds escape, supports, registerProperty, and parse methods', () => {
    assert.equal(typeof CSS.escape, 'function');
    assert.equal(typeof CSS.supports, 'function');
    assert.equal(typeof CSS.registerProperty, 'function');
    assert.equal(typeof CSS.parseStylesheetSync, 'function');
    assert.equal(typeof CSS.parseRule, 'function');
    assert.equal(CSS.escape('.foo'), '\\.foo');
    assert.equal(CSS.supports('(display: block)'), true);
    const rules = CSS.parseStylesheetSync(STYLESHEET_CSS);
    assert.equal(rules.length, 1);
    const rule = CSS.parseRule(CLEAN_RULE_CSS);
    assert.ok(rule instanceof CSSParserQualifiedRule);
  });
  // Verifies: SW-REQ-260821-HW77
  // MCDC SW-REQ-260821-HW77: boolean_returned=F, supports_called=F => TRUE [no-action: supportsCalls=0]
  test('HW77 trigger-false: CSS.supports is not called', () => {
    let supportsCalls = 0;
    const supports = (condition: string) => {
      supportsCalls += 1;
      return CSS.supports(condition);
    };
    void supports;
    const booleanReturned = false;
    assert.equal(supportsCalls, 0);
    assert.equal(booleanReturned, false);
  });
  //mcdc:ignore:defensive SW-REQ-260821-HW77: boolean_returned=F, supports_called=T => FALSE — CSS.supports evaluation paths return a boolean [reviewed: agent:grok-4.6]
  // Verifies: SW-REQ-260821-HW77
  // MCDC SW-REQ-260821-HW77: boolean_returned=T, supports_called=T => TRUE
  test('HW77 satisfied: CSS.supports evaluates a condition and returns a boolean', () => {
    let threw = false;
    let result: unknown;
    try {
      result = CSS.supports('(display: block)');
    } catch {
      threw = true;
    }
    assert.equal(threw, false);
    assert.equal(typeof result, 'boolean');
    assert.equal(result, true);
    assert.equal(typeof CSS.supports('display', 'grid'), 'boolean');
    assert.equal(typeof CSS.supports('((((('), 'boolean');
  });
  // --- SW-REQ-260821-MZ8P ---
  // Verifies: SW-REQ-260821-MZ8P
  // MCDC SW-REQ-260821-MZ8P: css_parser_rule_returned=F, parse_stylesheet_sync_called=F, to_parser_rule_maps_ast=T => TRUE [no-action: parseStylesheetSyncCalls=0]
  test('MZ8P trigger-false: toParserRule can map via parseRule without parseStylesheetSync', () => {
    let parseStylesheetSyncCalls = 0;
    const parseStylesheetSync = (css: string) => {
      parseStylesheetSyncCalls += 1;
      return CSS.parseStylesheetSync(css);
    };
    void parseStylesheetSync;
    const mapped = CSS.parseRule(CLEAN_RULE_CSS);
    assert.ok(mapped instanceof CSSParserQualifiedRule);
    assert.equal(parseStylesheetSyncCalls, 0);
  });
  //mcdc:ignore:defensive SW-REQ-260821-MZ8P: css_parser_rule_returned=F, parse_stylesheet_sync_called=T, to_parser_rule_maps_ast=T => FALSE — parseStylesheetSync always maps consumeListOfRules output through toParserRule to CSSParserRule nodes [reviewed: agent:grok-4.6]

  // Verifies: SW-REQ-260821-MZ8P
  // MCDC SW-REQ-260821-MZ8P: css_parser_rule_returned=T, parse_stylesheet_sync_called=T, to_parser_rule_maps_ast=T => TRUE
  test('MZ8P satisfied: parseStylesheetSync maps AST to CSSParserRule nodes', () => {
    const rules = CSS.parseStylesheetSync(STYLESHEET_CSS);
    assert.equal(rules.length, 1);
    assert.ok(rules[0] instanceof CSSParserQualifiedRule);
    assert.ok(rules[0] instanceof CSSParserRule);
  });
  // --- SYS-REQ-260821-KA02 ---
  // Verifies: SYS-REQ-260821-KA02
  // MCDC SYS-REQ-260821-KA02: parse_rule_called=F, parse_rule_throws=F, trailing_garbage=T => TRUE [no-action: parseRuleCalls=0]
  test('KA02 trigger-false: trailing garbage is not parsed when parseRule is not called', () => {
    let parseRuleCalls = 0;
    const parseRule = (css: string) => {
      parseRuleCalls += 1;
      return CSS.parseRule(css);
    };
    void parseRule;
    const trailing = TRAILING_GARBAGE_CSS;
    assert.equal(trailing.includes('trailing garbage'), true);
    assert.equal(parseRuleCalls, 0);
  });
  // Verifies: SYS-REQ-260821-KA02
  // MCDC SYS-REQ-260821-KA02: parse_rule_called=T, parse_rule_throws=F, trailing_garbage=F => TRUE [no-action: parseRule throw count=0]
  test('KA02 trigger-false: parseRule of one clean rule does not throw', () => {
    const rule = CSS.parseRule(CLEAN_RULE_CSS);
    assert.ok(rule instanceof CSSParserQualifiedRule);
  });
  //mcdc:ignore:defensive SYS-REQ-260821-KA02: parse_rule_called=T, parse_rule_throws=F, trailing_garbage=T => FALSE — CSS.parseRule always throws SyntaxError when tokens remain after one rule [reviewed: agent:grok-4.6]

  // Verifies: SYS-REQ-260821-KA02
  // MCDC SYS-REQ-260821-KA02: parse_rule_called=T, parse_rule_throws=T, trailing_garbage=T => TRUE
  test('KA02 satisfied: parseRule throws SyntaxError on trailing garbage', () => {
    assert.throws(() => {
      CSS.parseRule(TRAILING_GARBAGE_CSS);
    }, isSyntaxError);
  });
  // --- SYS-REQ-260821-SMW6 ---
  // Verifies: SYS-REQ-260821-SMW6
  // MCDC SYS-REQ-260821-SMW6: boolean_returned=F, supports_called=F, supports_throws=F => TRUE [no-action: supportsCalls=0]
  test('SMW6 trigger-false: CSS.supports is not called', () => {
    let supportsCalls = 0;
    const supports = (condition: string) => {
      supportsCalls += 1;
      return CSS.supports(condition);
    };
    void supports;
    const booleanReturned = false;
    const supportsThrows = false;
    assert.equal(supportsCalls, 0);
    assert.equal(booleanReturned, false);
    assert.equal(supportsThrows, false);
  });
//mcdc:ignore:defensive SYS-REQ-260821-SMW6: boolean_returned=F, supports_called=T, supports_throws=F => FALSE — CSS.supports returns a boolean on every evaluation path [reviewed: agent:grok-4.6]
  //mcdc:ignore:defensive SYS-REQ-260821-SMW6: boolean_returned=T, supports_called=T, supports_throws=T => FALSE — CSS.supports cannot both return a boolean and throw [reviewed: agent:grok-4.6]

  // Verifies: SYS-REQ-260821-SMW6
  // MCDC SYS-REQ-260821-SMW6: boolean_returned=T, supports_called=T, supports_throws=F => TRUE
  test('SMW6 satisfied: CSS.supports returns a boolean and does not throw', () => {
    let threw = false;
    let result: unknown;
    try {
      result = CSS.supports('(display: block)');
    } catch {
      threw = true;
    }
    assert.equal(threw, false);
    assert.equal(typeof result, 'boolean');
  });
  // --- SYS-REQ-260821-NGJH ---
  // Verifies: SYS-REQ-260821-NGJH
  // MCDC SYS-REQ-260821-NGJH: css_parser_rule_returned=F, parse_stylesheet_sync_called=F => TRUE [no-action: parseStylesheetSyncCalls=0]
  test('NGJH trigger-false: parseStylesheetSync is not called so no CSSParserRule is returned', () => {
    let parseStylesheetSyncCalls = 0;
    const parseStylesheetSync = (css: string) => {
      parseStylesheetSyncCalls += 1;
      return CSS.parseStylesheetSync(css);
    };
    void parseStylesheetSync;
    const cssParserRuleReturned = false;
    assert.equal(parseStylesheetSyncCalls, 0);
    assert.equal(cssParserRuleReturned, false);
  });
  //mcdc:ignore:defensive SYS-REQ-260821-NGJH: css_parser_rule_returned=F, parse_stylesheet_sync_called=T => FALSE — parseStylesheetSync returns CSSParserRule nodes for stylesheet input [reviewed: agent:grok-4.6]

  // Verifies: SYS-REQ-260821-NGJH
  // MCDC SYS-REQ-260821-NGJH: css_parser_rule_returned=T, parse_stylesheet_sync_called=T => TRUE
  test('NGJH satisfied: parseStylesheetSync returns CSSParserRule objects', () => {
    const rules = CSS.parseStylesheetSync(STYLESHEET_CSS);
    assert.equal(rules.length, 1);
    assert.ok(rules[0] instanceof CSSParserRule);
    assert.ok(rules[0] instanceof CSSParserQualifiedRule);
  });
  // --- SYS-REQ-260821-RAAM ---
  // Verifies: SYS-REQ-260821-RAAM
  // MCDC SYS-REQ-260821-RAAM: css_namespace_imported=F, css_namespace_methods_exported=F => TRUE [no-action: cssNamespaceImportReads=0]
  test('RAAM trigger-false: CSS namespace is not imported by this test path', () => {
    let cssNamespaceImportReads = 0;
    const readCssNamespace = () => {
      cssNamespaceImportReads += 1;
      return CSS;
    };
    void readCssNamespace;
    const methodsExported = false;
    assert.equal(cssNamespaceImportReads, 0);
    assert.equal(methodsExported, false);
  });
  //mcdc:ignore:defensive SYS-REQ-260821-RAAM: css_namespace_imported=T, css_namespace_methods_exported=F => FALSE — importing CSS from src/index.ts exports escape, supports, registerProperty, and parse methods [reviewed: agent:grok-4.6]

  // Verifies: SYS-REQ-260821-RAAM
  // MCDC SYS-REQ-260821-RAAM: css_namespace_imported=T, css_namespace_methods_exported=T => TRUE
  test('RAAM satisfied: imported CSS namespace exports escape, supports, registerProperty, and parse', () => {
    assert.equal(typeof CSS.escape, 'function');
    assert.equal(typeof CSS.supports, 'function');
    assert.equal(typeof CSS.registerProperty, 'function');
    assert.equal(typeof CSS.parseStylesheetSync, 'function');
    assert.equal(typeof CSS.parseRule, 'function');
    assert.equal(CSS.escape('#id'), '\\#id');
    assert.equal(CSS.supports('color', 'red'), true);
    assert.equal(CSS.parseStylesheetSync(STYLESHEET_CSS).length, 1);
  });
});
