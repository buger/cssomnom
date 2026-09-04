/**
 * Reproducer for CRS-0013/C10 + C11 (requirement SW-REQ-260821-1E5K session
 * packet src/browser-entry.ts installUnitFactories).
 *
 * css-typed-om-1 #numeric-factory-value-functions declares every CSS unit
 * factory as `CSSUnitValue <unit>(double value)`. WebIDL 3.2.4 double
 * conversion and 3.6.1 argument-count rules therefore require:
 *   - CSS.px('10')  -> ToNumber first, so the stored value is the number 10.
 *   - CSS.px('foo') -> ToNumber gives NaN, and `double` rejects NaN with a
 *     TypeError.
 *   - CSS.px()      -> "1 argument required" TypeError.
 * installUnitFactories forwards the raw argument into CSSUnitValue
 * (src/browser-entry.ts L198), so a string survives unconverted and a missing
 * argument constructs a value of `undefined`.
 *
 * Asserts the intended contract, so this command FAILS while the holes exist.
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

type UnitValue = { value: number; unit: string; toString(): string };
const CSS = g.CSS as Record<string, (v?: unknown) => UnitValue>;

// CRS-0013/C11: WebIDL double conversion must run before construction.
test('CRS-0013/C11: CSS.px("10") converts the argument to a number', () => {
  const v = CSS.px('10');
  assert.equal(typeof v.value, 'number', 'WebIDL double: ToNumber runs at the IDL boundary');
  assert.equal(v.value, 10);
  assert.equal(String(v), '10px');
});

// CRS-0013/C11: `double` rejects NaN.
test('CRS-0013/C11: CSS.px("foo") throws TypeError per WebIDL double', () => {
  assert.throws(() => CSS.px('foo'), TypeError);
});

// CRS-0013/C10: the required argument is enforced at the factory.
test('CRS-0013/C10: CSS.px() throws for a missing required argument', () => {
  assert.throws(() => CSS.px(), TypeError, 'WebIDL: 1 argument required, but only 0 present');
});

// control: numeric input already round-trips.
test('control: CSS.px(1) still returns 1px', () => {
  const v = CSS.px(1);
  assert.equal(v.value, 1);
  assert.equal(v.unit, 'px');
  assert.equal(String(v), '1px');
});
