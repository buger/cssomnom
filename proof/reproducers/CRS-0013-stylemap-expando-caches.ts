/**
 * Reproducer for CRS-0013/C15, C16, C26 (requirement SW-REQ-260821-1E5K
 * session packet src/browser-entry.ts patchStyleMaps).
 *
 * css-typed-om-1 declares:
 *  - ElementCSSInlineStyle carries [SameObject] readonly attribute
 *    StylePropertyMap attributeStyleMap. [SameObject] is an internal slot, so
 *    the map must never appear as an own enumerable property of the host and
 *    must keep one identity across accesses (C15).
 *  - No interface exposes `styleMap` on Element/HTMLElement. Only
 *    CSSStyleRule.styleMap and ElementCSSInlineStyle.attributeStyleMap exist
 *    (C16). Installing both over the same inline style also yields two
 *    distinct map objects.
 *  - CSSStyleRule.styleMap is likewise [SameObject] (C18).
 *  - WebIDL attribute getters run the brand check on the receiver, so a bare
 *    Object.create(HTMLElement.prototype) must throw TypeError (C26).
 *
 * patchStyleMaps caches in enumerable `_attributeStyleMap` / `_styleMap`
 * expandos (src/browser-entry.ts L220-235, L256-259) and brands receivers
 * with `instanceof` only.
 *
 * Asserts the intended contract, so this command FAILS while the holes exist.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

class FakeElement {}
class FakeHTMLElement extends FakeElement {
  style: unknown;
  constructor() {
    super();
    // a real inline-style object so the map construction is meaningful
    this.style = { length: 0, declarations: [], getPropertyValue: () => '', item: () => '' };
  }
}
class FakeSVGElement extends FakeElement {}
class FakeCSSStyleRule {}
const g = globalThis as unknown as Record<string, unknown>;
g.window = g;
g.Element = FakeElement;
g.HTMLElement = FakeHTMLElement;
g.SVGElement = FakeSVGElement;
g.CSSStyleRule = FakeCSSStyleRule;
(g as unknown as { getComputedStyle: () => unknown }).getComputedStyle = () => ({ declarations: [] });

await import('../../src/browser-entry.ts');
await import('../../src/parser.ts');
const { parse } = await import('../../src/parser.ts');

// CRS-0013/C15: the [SameObject] map is not an own enumerable expando.
test('CRS-0013/C15: attributeStyleMap does not leak an enumerable expando', () => {
  const el = new FakeHTMLElement();
  const map = (el as unknown as { attributeStyleMap: unknown }).attributeStyleMap;
  assert.ok(map, 'map constructed');
  const keys = Object.keys(el);
  assert.ok(!keys.includes('_attributeStyleMap'), `expando leaked into Object.keys: ${keys.join(',')}`);
  assert.equal((el as unknown as { attributeStyleMap: unknown }).attributeStyleMap, map, '[SameObject] identity holds');
});

// CRS-0013/C16: no Element.styleMap in css-typed-om-1.
test('CRS-0013/C16: HTMLElement has no styleMap accessor', () => {
  const el = new FakeHTMLElement();
  const bag = el as unknown as Record<string, unknown>;
  void bag.attributeStyleMap; // touch the documented accessor first
  assert.equal(bag.styleMap, undefined, 'css-typed-om-1 exposes only attributeStyleMap on elements');
});

// control (CRS-0013/C18 was dismissed here): the CSSOM CSSStyleRule owns a
// `styleMap` field built in its constructor, which shadows the prototype
// getter, so no `_styleMap` expando ever materializes on rules.
test('control: CSSStyleRule.styleMap is its own field, not an expando', () => {
  const sheet = parse('a { color: red }');
  const rule = sheet.cssRules[0] as unknown as Record<string, unknown>;
  const first = rule.styleMap;
  assert.ok(first, 'rule styleMap constructed');
  assert.equal(rule.styleMap, first, 'identity holds across accesses');
  assert.ok(!Object.keys(rule).includes('_styleMap'));
});

// CRS-0013/C26: a brandless object must be rejected, not half-wired.
test('CRS-0013/C26: Object.create(HTMLElement.prototype) is not an ElementCSSInlineStyle', () => {
  const fake = Object.create(g.HTMLElement) as unknown as { attributeStyleMap: unknown };
  assert.throws(() => fake.attributeStyleMap, TypeError, 'WebIDL brand check must throw');
});

// control: real elements still get a working map.
test('control: a real HTMLElement still exposes attributeStyleMap', () => {
  const el = new FakeHTMLElement();
  const map = (el as unknown as { attributeStyleMap: unknown }).attributeStyleMap;
  assert.ok(map);
});
