/**
 * Reproducer for CRS-0068/C06 and CRS-0068/C24 (src/parser-api.ts toParserRule).
 * CSSNestedDeclarations has CSSRule.type 0 and a cssText that is a plain
 * declaration list, so it falls into the "modern at-rules use type 0" arm,
 * fails every instanceof check, returns null from atRulePartsFromCssText
 * (no at-keyword), and lands on the CSSParserRawRule fallback where
 * serialize() is called on the CSSOM object itself. serialize() returns ''
 * for it, so `div { color: red; span { color: blue } color: green }` loses
 * the trailing `color: green` entirely and serializes it as an empty raw
 * rule. css-nesting-1 #nested-declarations-rules and the css-syntax-3
 * #serialization round-trip requirement forbid the loss; INT-REQ-260821-WTPD
 * guarantees parser_ast_adapted for Parser output.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStylesheetSync, CSSParserDeclaration } from '../../src/parser-api.ts';

test('CRS-0068/C06: trailing nested declarations survive the adapter', () => {
  const rules = parseStylesheetSync('div { color: red; span { color: blue } color: green }');
  const qualified = rules[0] as unknown as { body: unknown[] };
  assert.ok(qualified, 'the style rule must parse');
  const decls = qualified.body.filter(
    (r): r is CSSParserDeclaration => r instanceof CSSParserDeclaration,
  ) as unknown as { name: string }[];
  const names = decls.map(d => d.name);
  assert.ok(names.includes('color'), `expected a top-level color declaration, got [${names.join(',')}]`);
});

test('CRS-0068/C06: the nested declaration is not an empty raw rule', () => {
  const rules = parseStylesheetSync('div { color: red; span { color: blue } color: green }');
  const body = (rules[0] as unknown as { body: { toString(): string; constructor: { name: string } }[] }).body;
  const empties = body.filter(r => r.constructor.name === 'CSSParserRawRule' && r.toString() === '');
  assert.equal(empties.length, 0, 'no adapter output may be an empty CSSParserRawRule');
});

test('control: leading declarations of the same rule still adapt', () => {
  const rules = parseStylesheetSync('div { color: red; span { color: blue } }');
  assert.equal(String(rules[0]).includes('& span'), true, 'the nested style rule is adapted');
});
