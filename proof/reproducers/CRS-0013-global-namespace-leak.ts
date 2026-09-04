/**
 * Reproducer for CRS-0013/C07 (requirement SW-REQ-260821-1E5K session packet
 * src/browser-entry.ts installGlobalClasses).
 *
 * The comment at src/browser-entry.ts L162 says "List of all classes we want
 * to export globally", but the object is a namespace spread of every module
 * export (`{...TypedOM, ...CSSOM, ...}`). Object.entries then installs every
 * enumerable module binding on window with no `typeof === 'function'` or
 * interface-name filter. src/typed-om/index.ts exports the module helper
 * `createCSSStyleValue`, which has no WebIDL counterpart, so the browser
 * bundle leaks an internal factory onto the global object.
 *
 * Asserts the intended contract, so this command FAILS while the hole exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

class FakeElement {}
class FakeHTMLElement extends FakeElement {}
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

// CRS-0013/C07: module helpers have no WebIDL global.
test('CRS-0013/C07: createCSSStyleValue is not installed on window', () => {
  assert.equal(
    g.createCSSStyleValue,
    undefined,
    'src/typed-om/index.ts exports this module helper; only Typed OM / CSSOM interfaces belong on window',
  );
});

// control: the real interface objects are installed.
test('control: CSSUnitValue and CSSMediaRule are installed on window', () => {
  assert.equal(typeof g.CSSUnitValue, 'function');
  assert.equal(typeof g.CSSMediaRule, 'function');
});
