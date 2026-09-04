/**
 * Reproducer for CRS-0050/C37 (src/parser.ts Parser.consumeAtRule).
 * When ParserOptions.atRules types a custom at-rule as 'declaration' (or
 * 'rule'), consumeAtRule assigns raw Declaration[]/Rule[] onto the ASTAtRule
 * childRules field and returns the plain AST object cast as a Rule
 * (src/parser.ts:398-405). parseStyleSheet then hands that raw object to
 * CSSStyleSheet.createInternal, so cssRules[0] is a plain object whose
 * cssText serializes as '[object Object]' instead of a CSSRule.
 *
 * Asserts the correct behavior so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Parser } from '../../src/parser.ts';
import { tokenize } from '../../src/tokenizer.ts';

test('CRS-0050/C37: a custom-typed at-rule in parseStyleSheet is a real CSSRule', () => {
  const parser = new Parser(tokenize('@foo { x: 1 }'), { atRules: { foo: 'declaration' } });
  const sheet = parser.parseStyleSheet();
  const rule = Array.from(sheet.cssRules)[0] as { cssText: string; constructor: { name: string } };
  assert.ok(rule, 'the rule must exist');
  assert.notEqual(rule.constructor.name, 'Object', 'a raw ASTAtRule object must not leak into CSSStyleSheet.cssRules');
  assert.ok(rule.cssText.startsWith('@foo'), `cssText must serialize the at-rule, got ${JSON.stringify(rule.cssText)}`);
});

test('control: without typing the same at-rule parses as a CSSAtRule', () => {
  const parser = new Parser(tokenize('@foo { x: 1 }'));
  const sheet = parser.parseStyleSheet();
  const rule = Array.from(sheet.cssRules)[0] as { cssText: string };
  assert.ok(rule.cssText.startsWith('@foo'));
});
