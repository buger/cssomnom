/**
 * Reproducer for CRS-0007/C27 (requirement INT-REQ-260821-N2VE, src/parser.ts
 * Parser.consumeAtRule). css-syntax-3 #consume-at-rule '}' arm: "If nested is
 * true: if rule is valid in the current context, return it; otherwise return
 * nothing" — the '}' token itself stays for the parent block. css-cascade-5
 * #layer-empty allows @layer statements "everywhere @layer block at-rules
 * are allowed", and css-nesting-1 lists @layer among the nested group rules,
 * so a nested '@layer foo' closed by '}' is valid and must be returned.
 * consumeAtRule instead returns null unconditionally on nested '}',
 * discarding the rule (and disagreeing with consumeAtRuleFromStream, which
 * completes it).
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Parser } from '../../src/parser.ts';
import { tokenize } from '../../src/tokenizer.ts';

test('CRS-0007/C27: nested consumeAtRule returns a valid statement at-rule on }', () => {
  const parser = new Parser(tokenize('@layer foo }'));
  const rule = parser.consumeRule(true);
  assert.ok(rule, 'nested @layer statement closed by } is valid in context and must be returned');
  assert.equal((rule as { name: string }).name, 'layer');
  assert.equal(parser.tokens.peek().type, '}', 'the } token stays for the parent block');
});

test('control: a block-requiring at-rule without its block is still dropped when nested', () => {
  const parser = new Parser(tokenize('@media screen }'));
  assert.equal(parser.consumeRule(true), null, '@media without a block is not valid in context');
});

test('control: top-level @layer foo } keeps the } in the prelude', () => {
  const parser = new Parser(tokenize('@layer foo }'));
  const rule = parser.consumeRule(false);
  assert.ok(rule);
});
