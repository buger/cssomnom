/**
 * Reproducer for CRS-0068/C05 (src/parser-api.ts cssomAtRuleFromFields).
 * Descriptor-bearing at-rules (@font-face, @counter-style, @page, @property)
 * carry their content in .style, not in a cssRules list. cssomAtRuleFromFields
 * has no arm for those classes: the cssText fallback sets hasBody from the
 * `{` block and then uses `cssRules ?? []` for the body, so every descriptor
 * is dropped and the rule serializes as `@font-face{}`.
 * css-syntax-3 #serialization round-trip requirement (~3706-3713) and
 * INT-REQ-260821-WTPD (parser_ast_adapted) require the adapted rule to keep
 * the declaration content. The CSSOM layer still holds the descriptors, so
 * only the Parser API adapter loses them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStylesheetSync } from '../../src/parser-api.ts';
import { parse } from '../../src/parser.ts';

test('CRS-0068/C05: @font-face body keeps its descriptors', () => {
  const rules = parseStylesheetSync('@font-face { src: url(x.png); font-weight: bold; }');
  const at = rules[0] as unknown as { name: string; body: { length: number } };
  assert.ok(at, 'the @font-face rule must parse');
  assert.equal(at.name, 'font-face');
  assert.ok(at.body && at.body.length >= 2, `expected >= 2 descriptor nodes, got ${at.body?.length ?? 0}`);
  assert.match(String(rules[0]), /src/, 'serialization must keep the src descriptor');
});

test('CRS-0068/C05: @counter-style body keeps its descriptors', () => {
  const rules = parseStylesheetSync('@counter-style thumbs { system: cyclic; symbols: "a" "b"; }');
  const text = String(rules[0]);
  assert.match(text, /system/, 'serialization must keep the system descriptor');
});

test('CRS-0068/C05: @property body keeps its descriptors', () => {
  const rules = parseStylesheetSync('@property --p05 { syntax: "*"; inherits: false; }');
  const text = String(rules[0]);
  assert.match(text, /inherits/, 'serialization must keep the inherits descriptor');
});

test('control: the CSSOM layer still holds the @font-face descriptors', () => {
  const sheet = parse('@font-face { src: url(x.png); font-weight: bold; }') as unknown as {
    cssRules: { style: { length: number } }[];
  };
  assert.ok(sheet.cssRules.length > 0, 'the @font-face rule must parse');
  assert.ok(sheet.cssRules[0].style.length >= 2, 'CSSFontFaceRule.style keeps both descriptors');
});
