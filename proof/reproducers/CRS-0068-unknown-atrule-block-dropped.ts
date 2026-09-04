/**
 * Reproducer for CRS-0068/C09 (src/parser.ts consumeAtRule + src/parser-api.ts
 * cssomAtRuleFromFields). For an unrecognized at-rule with a block the parser
 * returns `new CSSAtRule(name, prelude, block)` with childRules left unset
 * (parser.ts token-stream fallback). cssomAtRuleFromFields then computes the
 * body as `cssRules ?? []` and never walks the block, so the whole block
 * content is dropped and parseStylesheetSync('@foo { bar: baz; }')
 * serializes as '@foo{}'. css-syntax-3 #consume-an-at-rule retains unknown
 * at-rules in full, and the #serialization round-trip requirement (~3706-3713)
 * plus INT-REQ-260821-WTPD (parser_ast_adapted) forbid the loss.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStylesheetSync } from '../../src/parser-api.ts';

test('CRS-0068/C09: unknown at-rule body keeps the block declarations', () => {
  const rules = parseStylesheetSync('@foo { bar: baz; }');
  const at = rules[0] as unknown as { name: string; body: { length: number } | null };
  assert.ok(at, 'the unknown at-rule must be retained');
  assert.equal(at.name, 'foo');
  assert.ok(at.body && at.body.length >= 1, `expected >= 1 body node, got ${at.body?.length ?? 0}`);
  assert.match(String(rules[0]), /bar/, 'serialization must keep the block declaration');
});

test('CRS-0068/C09: unknown at-rule with nested qualified rules keeps them', () => {
  const rules = parseStylesheetSync('@foo { a { color: red } }');
  const at = rules[0] as unknown as { body: { length: number } | null };
  assert.ok(at.body && at.body.length >= 1, 'the nested qualified rule must survive the adapter');
});

test('control: a declaration-list at-rule type still adapts via options.atRules', () => {
  const rules = parseStylesheetSync('@foo { bar: baz; }', { atRules: { foo: 'declaration' } });
  const text = String(rules[0]);
  assert.match(text, /bar/, 'the declaration-typed custom at-rule keeps its declarations');
});
