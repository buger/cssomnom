/**
 * Reproducer for CRS-0041/C05 (src/parser.ts consumeAtRuleFromStream).
 * ParserOptions.atRules types unknown at-rules as 'declaration' or 'rule'.
 * The token path (consumeAtRule, src/parser.ts:397-406) honors the map, so a
 * top-level `@foo { a: 1 }` with atRules {foo:'declaration'} parses its block
 * as declarations. The stream path (consumeAtRuleFromStream, reached for every
 * at-rule inside a group-rule body or declaration block) never reads
 * this.atRuleTypes, so the same `@foo` nested inside `@media` becomes a plain
 * CSSAtRule (type 0) with its block parsed as rules. Same Parser instance,
 * same option, two behaviors.
 * Asserts the consistent contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Parser } from '../../src/parser.ts';
import { tokenize } from '../../src/tokenizer.ts';

type Rawish = { type?: string; name?: string; childRules?: { type?: string; name?: string }[] };

test('CRS-0041/C05: a nested custom at-rule keeps its declaration typing', () => {
  const sheet = new Parser(tokenize('@media all { @foo { a: 1 } }'), { atRules: { foo: 'declaration' } }).parseStyleSheet();
  const media = sheet.cssRules[0] as unknown as { cssRules: unknown[] };
  const nested = media?.cssRules?.[0] as unknown as Rawish;
  assert.ok(nested, 'the nested @foo must parse');
  assert.equal(nested.type, 'at-rule',
    `the declaration-typed @foo must not degrade to a type-0 CSSAtRule; got ${JSON.stringify({ type: nested.type, name: nested.name })}`);
  assert.ok(Array.isArray(nested.childRules) && nested.childRules.some(r => r?.type === 'declaration' && r.name === 'a'),
    'the block must parse as declarations like the top-level path');
});

test('control: the top-level token path honors the custom type', () => {
  const sheet = new Parser(tokenize('@foo { a: 1 }'), { atRules: { foo: 'declaration' } }).parseStyleSheet();
  const top = sheet.cssRules[0] as unknown as Rawish;
  assert.equal(top.type, 'at-rule');
  assert.ok(top.childRules?.some(r => r?.type === 'declaration' && r.name === 'a'));
});
