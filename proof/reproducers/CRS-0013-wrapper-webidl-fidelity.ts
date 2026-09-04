/**
 * Reproducer for CRS-0013/C01, C02, C03, C19 (requirement SW-REQ-260821-1E5K
 * session packet src/browser-entry.ts wrapConstructor).
 *
 * css-typed-om-1 + WebIDL 3.10 interface-object rules that wrapConstructor
 * breaks on the browser global surface:
 *  - interface object `length` equals the number of REQUIRED constructor
 *    arguments (WebIDL 3.10.1). CSSUnitValue(double, CSSOMString) => 2,
 *    CSSKeywordValue(CSSOMString) => 1, CSSMathClamp(min, val, max) => 3,
 *    CSSSkew(ax, ay) => 2, CSSSkewX/CSSSkewY/CSSPerspective(1),
 *    CSSUnparsedValue(sequence) => 1, CSSTransformValue(sequence) => 1,
 *    CSSMathNegate/CSSMathInvert(1). expectedLengths omits all of them and
 *    `|| 0` silently defaults the arity to 0 (C01/C02).
 *  - interfaces WITHOUT an IDL constructor must throw "Illegal constructor"
 *    TypeError. CSSStyleValue, CSSNumericValue, CSSMathValue, CSSImageValue,
 *    CSSColorValue, CSSTransformComponent, StylePropertyMap(ReadOnly) all
 *    construct successfully here (C19).
 *  - static operations live on the interface object that declares them and
 *    are INHERITED through the interface-object [[Prototype]] chain, never
 *    copied as own properties. copyStaticMethods defineProperty's the
 *    ancestor parse/parseAll onto every child Wrapper (C03).
 *
 * Node harness: browser-entry.ts only patches globals when `window` exists,
 * so the reproducer installs a minimal DOM first, then imports the entry.
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

// WebIDL 3.10.1: interface object length == number of required arguments.
// CRS-0013/C01 + C02: expectedLengths omits these classes, `|| 0` zeroes them.
test('CRS-0013/C01: wrapper length matches WebIDL required-argument count', () => {
  const expected: Record<string, number> = {
    CSSUnitValue: 2,
    CSSKeywordValue: 1,
    CSSUnparsedValue: 1,
    CSSMathClamp: 3,
    CSSMathNegate: 1,
    CSSMathInvert: 1,
    CSSTransformValue: 1,
    CSSSkew: 2,
    CSSSkewX: 1,
    CSSSkewY: 1,
    CSSPerspective: 1,
  };
  for (const [name, len] of Object.entries(expected)) {
    const ctor = g[name] as { length: number };
    assert.ok(ctor, `${name} is installed on window`);
    assert.equal(ctor.length, len, `${name}.length must be ${len} per WebIDL 3.10.1`);
  }
  // CSSMathSum takes a variadic list: 0 required arguments is correct there.
  assert.equal((g.CSSMathSum as { length: number }).length, 0);
});

// CRS-0013/C19: no-constructor interfaces must refuse construction.
test('CRS-0013/C19: abstract interfaces throw Illegal constructor', () => {
  const nonConstructable = [
    'CSSStyleValue', 'CSSNumericValue', 'CSSMathValue', 'CSSImageValue',
    'CSSColorValue', 'CSSTransformComponent', 'StylePropertyMapReadOnly', 'StylePropertyMap',
  ];
  for (const name of nonConstructable) {
    const ctor = g[name] as new () => unknown;
    assert.ok(typeof ctor === 'function', `${name} is installed`);
    assert.throws(() => new ctor(), TypeError, `new ${name}() must throw Illegal constructor`);
  }
});

// CRS-0013/C03: ancestor static operations are inherited, not own properties.
test('CRS-0013/C03: parse/parseAll are inherited, not own props of CSSUnitValue', () => {
  const unitValue = g.CSSUnitValue as { parse?: unknown };
  const styleValue = g.CSSStyleValue as { parse?: unknown };
  assert.equal(typeof styleValue.parse, 'function', 'CSSStyleValue.parse exists on the root');
  assert.equal(
    Object.prototype.hasOwnProperty.call(unitValue, 'parse'),
    false,
    'native WebIDL keeps statics on the declaring interface object only',
  );
  assert.equal(typeof unitValue.parse, 'function', '...while still resolving through the prototype chain');
});

// control: the wrapper still forwards construction correctly.
test('control: wrapping keeps construction and instanceof working', () => {
  const UnitValue = g.CSSUnitValue as new (v: number, u: string) => { value: number; unit: string };
  const v = new UnitValue(1, 'px');
  assert.equal(v.value, 1);
  assert.equal(v.unit, 'px');
  assert.ok(v instanceof UnitValue);
});
