/**
 * Reproducer for CRS-0017/C02 + CRS-0017/C06 (requirement SW-REQ-260821-39E0,
 * src/parser.ts). css-nesting-1 § 3.3 #conditionals parses the body of a nested
 * group rule as <block-contents>, and css-syntax-3 § 5.5 #consume-block-contents
 * consumes the at-keyword arm's at-rule with nested=true, so declarations inside
 * a grouping at-rule nested (transitively) inside a style rule must survive as
 * CSSNestedDeclarations.
 *
 * - C02: handleScopeRule hardcodes consumeBlockContents(values, true, false)
 *   (L444) and forwards isNestedStyleRule=false into consumeAtRuleFromStream
 *   (L1005), so a grouping at-rule INSIDE @scope parses its body as a rule list
 *   and drops the declarations outright.
 * - C06: the public parseBlockContents entry (L241) hardcodes the same
 *   (true, false) pair, so grouping at-rule bodies reached through it drop
 *   declarations the same way.
 * Direct nesting (.a { @media ... }) and direct @scope bodies stay correct;
 * only the through-@scope and parseBlockContents paths lose the declarations.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, Parser } from '../../src/parser.ts';
import { tokenize } from '../../src/tokenizer.ts';

function kidSummary(rules: Iterable<{ constructor: { name: string }; cssText: string }>): string[] {
  return Array.from(rules).map(r => `${r.constructor.name}:${r.cssText}`);
}

test('CRS-0017/C02: declarations survive inside @media nested in @scope', () => {
  const sheet = parse('.a { @scope (.foo) { @media (width > 0px) { color: red; .b {} background: blue; } } }');
  const scope = sheet.cssRules[0].cssRules[0];
  const media = scope.cssRules[0];
  const kids = kidSummary(media.cssRules as unknown as Iterable<{ constructor: { name: string }; cssText: string }>);
  assert.deepEqual(kids, [
    'CSSNestedDeclarations:color: red;',
    'CSSStyleRule:& .b { }',
    'CSSNestedDeclarations:background: blue;',
  ], 'nested group rule bodies are block-contents per css-nesting-1 3.3');
});

test('CRS-0017/C06: parseBlockContents keeps declarations in grouping at-rule bodies', () => {
  const p = new Parser(tokenize('@media (width > 0px) { color: red; .b {} background: blue; }'));
  const rules = p.parseBlockContents();
  assert.equal(rules.length, 1, 'the media rule must parse');
  const kids = kidSummary((rules[0] as unknown as { cssRules: Iterable<{ constructor: { name: string }; cssText: string }> }).cssRules);
  assert.deepEqual(kids, [
    'CSSNestedDeclarations:color: red;',
    'CSSStyleRule:& .b { }',
    'CSSNestedDeclarations:background: blue;',
  ], '5.4.5 parse-block-contents routes at-rule bodies through the nested arm');
});

test('control: direct nesting keeps the declarations (WPT nested group rule)', () => {
  const sheet = parse('.a { @media (width > 100px) { --x:1; --y:1; .b { } --z:1; } --w:1; }');
  const media = sheet.cssRules[0].cssRules[0];
  const kids = kidSummary(media.cssRules as unknown as Iterable<{ constructor: { name: string }; cssText: string }>);
  assert.deepEqual(kids, [
    'CSSNestedDeclarations:--x: 1; --y: 1;',
    'CSSStyleRule:& .b { }',
    'CSSNestedDeclarations:--z: 1;',
  ]);
});

test('control: a direct @scope body keeps its declarations (WPT nested @scope rule)', () => {
  const sheet = parse('.a { @scope (.foo) { --x:1; --y:1; .b { } --z:1; } --w:1; }');
  const scope = sheet.cssRules[0].cssRules[0];
  const kids = kidSummary(scope.cssRules as unknown as Iterable<{ constructor: { name: string }; cssText: string }>);
  assert.deepEqual(kids, [
    'CSSNestedDeclarations:--x: 1; --y: 1;',
    'CSSStyleRule:.b { }',
    'CSSNestedDeclarations:--z: 1;',
  ]);
});
