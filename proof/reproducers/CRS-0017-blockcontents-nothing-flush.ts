/**
 * Reproducer for CRS-0017/C01 + CRS-0017/C08 (requirement SW-REQ-260821-39E0,
 * src/parser.ts consumeBlockContents). css-syntax-3 § 5.5 #consume-block-contents
 * "anything else" arm restores the mark and consumes a qualified rule with the
 * semicolon stop token, then switches on the result: "nothing" -> do nothing,
 * invalid rule error -> flush decls, rule -> flush decls and append the rule.
 * consumeNestedQualifiedRuleFromStream returns null both when the stop token
 * ends the prelude (spec "nothing") and when createStyleRule rejects the
 * selector (spec invalid rule error), and the else arm at L1070-1072 flushes on
 * both. '.a { .b {} color: red; div; background: blue; }' therefore emits TWO
 * CSSNestedDeclarations where the spec keeps ONE consecutive run.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

function nestedDeclRules(css: string): { ctor: string; text: string }[] {
  const sheet = parse(css);
  const outer = sheet.cssRules[0];
  return Array.from(outer.cssRules).map(r => ({ ctor: r.constructor.name, text: r.cssText }));
}

test('CRS-0017/C01: a stop-token prelude does not flush the declaration run', () => {
  const kids = nestedDeclRules('.a { .b {} color: red; div; background: blue; }');
  const nested = kids.filter(k => k.ctor === 'CSSNestedDeclarations');
  assert.equal(nested.length, 1,
    `spec "nothing" keeps color and background one consecutive run, got ${nested.length}: ${JSON.stringify(nested)}`);
  assert.equal(nested[0].text, 'color: red; background: blue;');
});

test('CRS-0017/C01: the nested style rule still precedes the run', () => {
  const kids = nestedDeclRules('.a { .b {} color: red; div; background: blue; }');
  assert.equal(kids[0].ctor, 'CSSStyleRule');
  assert.equal(kids[0].text, '& .b { }');
});

test('CRS-0017/C08: an invalid-selector block keeps the flush (control direction)', () => {
  // '123 { }' consumes a block and fails the selector: spec invalid rule error -> flush.
  const kids = nestedDeclRules('.a { .b {} color: red; 123 { } background: blue; }');
  const nested = kids.filter(k => k.ctor === 'CSSNestedDeclarations');
  assert.equal(nested.length, 2, 'the invalid-rule-error leg must still flush between runs');
  assert.equal(nested[0].text, 'color: red;');
  assert.equal(nested[1].text, 'background: blue;');
});

test('control: WPT mixed declarations stay correct', () => {
  const kids = nestedDeclRules('.a { --a:1; & { --c:1; } --d:1; --e:1; }');
  assert.deepEqual(kids.map(k => k.ctor), ['CSSStyleRule', 'CSSNestedDeclarations']);
  assert.equal(kids[1].text, '--d: 1; --e: 1;');
});
