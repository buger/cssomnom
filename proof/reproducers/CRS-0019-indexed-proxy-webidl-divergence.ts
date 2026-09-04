/**
 * Reproducer for CRS-0019/C09, C10, C11, C20 (src/utils.ts
 * createIndexedProxy, src/CSSStyleDeclaration.ts createStyleProxy,
 * src/CSSOM.ts CSSKeyframesRule proxy). WebIDL legacy platform objects with
 * indexed getters only resolve canonical numeric index strings ("0", "1", ...)
 * and expose those indices as own enumerable properties. The proxies accept
 * Number(prop)-truthy keys like "", " ", "0x0" and lack has/ownKeys traps, so
 * "" resolves a rule, "0x0" resolves rule 0, `0 in list` is false, and
 * Object.keys(list) exposes internals instead of indices.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { MediaList } from '../../src/CSSOM.ts';

test('CRS-0019/C09: non-canonical numeric keys do not hit the indexed getter', () => {
  const sheet = parse('.a{color:red}') as unknown as { cssRules: Record<string, unknown> };
  const rules = sheet.cssRules;
  assert.equal(rules.length, 1, 'control: one rule parsed');
  assert.equal(rules[''], undefined, 'WebIDL: "" is not a canonical numeric index');
  assert.equal(rules[' '], undefined, 'WebIDL: " " is not a canonical numeric index');
  assert.equal(rules['0x0'], undefined, 'WebIDL: "0x0" is not a canonical numeric index');
});

test('CRS-0019/C09: MediaList keys behave the same way', () => {
  const media = new MediaList('screen, print') as unknown as Record<string, unknown>;
  assert.equal(media.length, 2, 'control: two media queries');
  assert.equal(media[''], undefined, 'WebIDL: mediaList[""] must be undefined');
});

test('CRS-0019/C10: indices are own enumerable properties', () => {
  const sheet = parse('.a{color:red}') as unknown as { cssRules: unknown };
  const rules = sheet.cssRules as object;
  assert.ok(0 in rules, 'WebIDL: 0 in cssRules must be true');
  assert.ok(
    Object.keys(rules).includes('0'),
    'WebIDL: Object.keys(cssRules) exposes index "0", not internals'
  );
});

test('CRS-0019/C11: style proxy rejects "" as an index', () => {
  const sheet = parse('.a{color:red}') as unknown as {
    cssRules: { style: Record<string, unknown> }[];
  };
  const style = sheet.cssRules[0].style;
  assert.equal(style[''], undefined, 'WebIDL: style[""] must be undefined, not the first property name');
  assert.ok(!('' in style), 'WebIDL: "" in style must be false');
});

test('CRS-0019/C20: keyframes proxy rejects non-canonical indices', () => {
  const sheet = parse('@keyframes k { 0% { opacity: 0 } }') as unknown as {
    cssRules: Record<string, unknown>[];
  };
  const kf = sheet.cssRules[0];
  assert.equal(kf[''], undefined, 'WebIDL: kf[""] must be undefined');
  assert.equal(kf['0.0'], undefined, 'WebIDL: kf["0.0"] must be undefined');
});

test('control: canonical numeric index still resolves', () => {
  const sheet = parse('.a{color:red}') as unknown as { cssRules: { type: number }[] };
  assert.equal(sheet.cssRules[0].type, 1, 'CSSStyleRule type 1 via index "0"');
  assert.equal(sheet.cssRules['0'].type, 1, 'string "0" resolves the same rule');
});
