/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Verifies: SW-REQ-260821-7AKJ, INT-REQ-260821-WQX9
// Round-2 unique-cause leftovers for src/typed-om/style-map/style-validation.ts
// matchesStyleValueSyntax after tests/mcdc-stylemap-leftover-unique-cause.test.ts
// and tests/mcdc-style-validation-still-hot-unique-cause.test.ts.
// Last recapture: 21/29 decisions, 36/48 conditions, 8 incomplete / 12 missing.
// Drive CSSStyleValue.parse then StylePropertyMap.set / attributeStyleMap.set.
// css-typed-om-1 § 3.2 #the-stylepropertymap / § 6.6 #parse-a-cssstylevalue,
// css-properties-values-api-1 § 3 #syntax-strings.
// No //mcdc:ignore.
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { patchWindowForTypedOM } from './wpt-shim.ts';
import '../src/parser.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { PropertyRegistry } from '../src/PropertyRegistry.ts';
import type { CSSNumericType } from '../src/typed-om.ts';
import {
  CSS,
  CSSStyleValue,
  CSSKeywordValue,
  CSSUnparsedValue,
  CSSVariableReferenceValue,
  CSSUnitValue,
  CSSPositionValue,
  StylePropertyMap,
} from '../src/typed-om.ts';

function liveMap(): { style: CSSStyleDeclaration; map: StylePropertyMap } {
  const style = new CSSStyleDeclaration();
  return { style, map: new StylePropertyMap(style) };
}

function attrMap(html = '<html><body><div id="el"></div></body></html>'): {
  map: StylePropertyMap;
  el: { attributeStyleMap: StylePropertyMap; style: CSSStyleDeclaration };
} {
  const { window, document } = parseHTML(html);
  patchWindowForTypedOM(window);
  const el = document.getElementById('el') as unknown as HTMLElement & {
    attributeStyleMap: StylePropertyMap;
    style: CSSStyleDeclaration;
  };
  assert.ok(el);
  return { map: el.attributeStyleMap, el };
}

function assertType(fn: () => unknown): void {
  assert.throws(fn, TypeError);
}

function assertTypeMatch(fn: () => unknown, re: RegExp): void {
  assert.throws(fn, (err: unknown) => {
    assert.ok(err instanceof TypeError, `expected TypeError, got ${String(err)}`);
    assert.match((err as TypeError).message, re);
    return true;
  });
}

const origGet = PropertyRegistry.get.bind(PropertyRegistry);

function restoreGet(): void {
  PropertyRegistry.get = origGet;
}

/**
 * L313 reads custom syntax from PropertyRegistry.get. VALID_COMPONENTS
 * rejects `<position>` / `<frequency>`, so inject syntax for a dashed name
 * (css-properties-values-api-1 § 3 #syntax-strings).
 */
function withCustomSyntax(name: string, syntax: string, fn: () => void): void {
  PropertyRegistry.get = (prop: string) => {
    if (prop === name) {
      return { name, syntax, inherits: false };
    }
    return origGet(prop);
  };
  try {
    fn();
  } finally {
    restoreGet();
  }
}

function withNumericType(value: CSSUnitValue, typeFn: () => CSSNumericType, fn: () => void): void {
  value.type = typeFn;
  try {
    fn();
  } finally {
    Reflect.deleteProperty(value, 'type');
  }
}

/**
 * L327 and L200 share the associated AND. L327 consumes the first two
 * reads; L200 consumes the next two. A getter unique-causes L200 (T,T)
 * after L327 (T,F) lets the call through (css-typed-om-1 § 3.2).
 */
function withAssociatedReads(value: CSSStyleValue, reads: Array<string | null>, fn: () => void): void {
  const orig = value._associatedProperty;
  let i = 0;
  Object.defineProperty(value, '_associatedProperty', {
    configurable: true,
    enumerable: true,
    get() {
      const next = i < reads.length ? reads[i] : reads[reads.length - 1];
      i += 1;
      return next;
    },
    set() {},
  });
  try {
    fn();
  } finally {
    Object.defineProperty(value, '_associatedProperty', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: orig,
    });
  }
}

afterEach(() => {
  restoreGet();
});

describe('MC/DC round2 unique-cause: matchesStyleValueSyntax L200 associated AND (css-typed-om-1 § 3.2)', { concurrency: false }, () => {
  test('constructor-CSSStyleValue associated F / TF / TT via parse then set', () => {
    const { map, el } = attrMap();

    // Unique-cause: !== null T, !== propKey F (same key). L200 if is F, return true.
    const margin = CSSStyleValue.parse('margin', '1px 2px');
    assert.equal(margin.constructor, CSSStyleValue);
    assert.equal(margin._associatedProperty, 'margin');
    map.set('margin', margin);
    assert.equal(el.style.getPropertyValue('margin'), '1px 2px');

    const padding = CSSStyleValue.parse('padding', '3px 4px');
    assert.equal(padding.constructor, CSSStyleValue);
    map.set('padding', padding);
    const inset = CSSStyleValue.parse('inset', '1px 2px 3px 4px');
    assert.equal(inset.constructor, CSSStyleValue);
    map.set('inset', inset);
    const outline = CSSStyleValue.parse('outline', '1px solid red');
    assert.equal(outline.constructor, CSSStyleValue);
    map.set('outline', outline);

    // Unique-cause: !== null F with constructor === CSSStyleValue (parse stamps
    // associated; clear then set a different key). L327 skips; L200 F- → true.
    margin._associatedProperty = null;
    map.set('padding', margin);
    assert.equal(el.style.getPropertyValue('padding'), '1px 2px');
    padding._associatedProperty = null;
    map.set('margin', padding);
    inset._associatedProperty = null;
    map.set('margin', inset);

    // Unique-cause: L200 (T,T) → false. L327 sees same-key (T,F) and does not
    // throw; L200 then sees mismatch and returns false.
    const border = CSSStyleValue.parse('border', '1px solid blue');
    assert.equal(border.constructor, CSSStyleValue);
    withAssociatedReads(border, ['border', 'border', 'border', 'padding'], () => {
      assertTypeMatch(
        () => map.set('border', border),
        /Invalid value of type CSSStyleValue for property border/,
      );
    });
    const filter = CSSStyleValue.parse('filter', 'blur(1px)');
    assert.equal(filter.constructor, CSSStyleValue);
    withAssociatedReads(filter, ['filter', 'filter', 'filter', 'width'], () => {
      assertTypeMatch(
        () => map.set('filter', filter),
        /Invalid value of type CSSStyleValue for property filter/,
      );
    });
    const font = CSSStyleValue.parse('font', '16px serif');
    withAssociatedReads(font, ['font', 'font', 'font', 'color'], () => {
      assertTypeMatch(
        () => map.set('font', font),
        /Invalid value of type CSSStyleValue for property font/,
      );
    });

    const { map: live } = liveMap();
    const gap = CSSStyleValue.parse('gap', '1px 2px');
    live.set('gap', gap);
    gap._associatedProperty = null;
    live.set('padding', gap);
    withAssociatedReads(gap, ['gap', 'gap', 'gap', 'margin'], () => {
      assertTypeMatch(
        () => live.set('gap', gap),
        /Invalid value of type CSSStyleValue/,
      );
    });
  });
});

describe('MC/DC round2 unique-cause: matchesStyleValueSyntax L232 position AND (css-properties-values-api-1 § 3)', { concurrency: false }, () => {
  test('syntax.includes(<position>) T vs F with keyword list T vs F via parse then set', () => {
    const { map } = liveMap();
    const posName = '--mcdc-svs2-pos';

    withCustomSyntax(posName, '<position>', () => {
      // Unique-cause: includes('<position>') T && keyword T. object-position
      // reifies a lone keyword as CSSPositionValue; float/caption-side keep
      // CSSKeywordValue. Clear associated so L327 does not throw.
      const fromFloat = CSSStyleValue.parse('float', 'left');
      assert.ok(fromFloat instanceof CSSKeywordValue);
      fromFloat._associatedProperty = null;
      map.set(posName, fromFloat);
      assert.equal(map.get(posName)?.toString().toLowerCase(), 'left');
      const fromClear = CSSStyleValue.parse('clear', 'right');
      assert.ok(fromClear instanceof CSSKeywordValue);
      fromClear._associatedProperty = null;
      map.set(posName, fromClear);
      const fromCaption = CSSStyleValue.parse('caption-side', 'top');
      assert.ok(fromCaption instanceof CSSKeywordValue);
      fromCaption._associatedProperty = null;
      map.set(posName, fromCaption);
      map.set(posName, new CSSKeywordValue('center'));
      map.set(posName, new CSSKeywordValue('bottom'));

      // Unique-cause: includes T && keyword F.
      const none = CSSStyleValue.parse('display', 'none');
      assert.ok(none instanceof CSSKeywordValue);
      none._associatedProperty = null;
      assertTypeMatch(
        () => map.set(posName, none),
        /Invalid value of type CSSKeywordValue for property --mcdc-svs2-pos/,
      );
      assertType(() => map.set(posName, new CSSKeywordValue('auto')));
      assertType(() => map.set(posName, new CSSKeywordValue('middle')));
    });

    // Unique-cause: includes('<position>') F && keyword T (already F- on color).
    const left = CSSStyleValue.parse('float', 'left');
    assert.ok(left instanceof CSSKeywordValue);
    left._associatedProperty = null;
    assertType(() => map.set('color', left));
    assertType(() => map.set('width', new CSSKeywordValue('left')));
  });
});

describe('MC/DC round2 unique-cause: matchesStyleValueSyntax L259 / L262 / L265 numeric leftovers', { concurrency: false }, () => {
  test('L259 hasLengthPct T after L257/L258 F via type() split then set', () => {
    const { map } = liveMap();
    const lp = '--mcdc-svs2-lp';

    // Without the type split, Hz is not length-percentage → TypeError (L259 F).
    withCustomSyntax(lp, '<length-percentage>', () => {
      assertTypeMatch(
        () => map.set(lp, CSS.Hz(1)),
        /Invalid value of type CSSUnitValue for property --mcdc-svs2-lp/,
      );
      assertType(() => map.set(lp, CSS.deg(1)));
      assertType(() => map.set(lp, CSS.s(1)));

      // Unique-cause: hasLengthPct T. First matchesLength T enters the LP
      // block; second matchesLength F and matchesPercentage F skip L257/L258.
      const hz = CSS.Hz(2);
      let lengthGets = 0;
      withNumericType(hz, () => {
        return {
          get length() {
            lengthGets += 1;
            return lengthGets === 1 ? 1 : 0;
          },
          angle: 0,
          time: 0,
          frequency: 0,
          resolution: 0,
          flex: 0,
          percent: 0,
        };
      }, () => {
        map.set(lp, hz);
        assert.equal(map.get(lp)?.toString().toLowerCase(), '2hz');
        assert.equal(lengthGets, 2);
      });

      const deg = CSS.deg(45);
      let degGets = 0;
      withNumericType(deg, () => {
        return {
          get length() {
            degGets += 1;
            return degGets === 1 ? 1 : 0;
          },
          angle: 0,
          time: 0,
          frequency: 0,
          resolution: 0,
          flex: 0,
          percent: 0,
        };
      }, () => {
        map.set(lp, deg);
        assert.equal(degGets, 2);
      });
    });
  });

  test('L262 matchesPercentage && hasPercentage TT outside LP via type() split', () => {
    const { map } = liveMap();

    // voice-pitch syntax is `<percentage>` without `<number>`, so L261 cannot
    // return; L258 would return without the split. Skip LP (first
    // matchesPercentage F) then L262 TT.
    const parsed = CSSStyleValue.parse('voice-pitch', '50%');
    assert.ok(parsed instanceof CSSUnitValue);
    parsed._associatedProperty = null;
    let percentGets = 0;
    withNumericType(parsed, () => {
      return {
        length: 0,
        angle: 0,
        time: 0,
        frequency: 0,
        resolution: 0,
        flex: 0,
        get percent() {
          percentGets += 1;
          return percentGets >= 3 ? 1 : 0;
        },
      };
    }, () => {
      map.set('voice-pitch', parsed);
      assert.equal(map.get('voice-pitch')?.toString(), '50%');
      assert.ok(percentGets >= 3);
    });

    const pctName = '--mcdc-svs2-pct';
    withCustomSyntax(pctName, '<percentage>', () => {
      const pct = CSS.percent(25);
      let gets = 0;
      withNumericType(pct, () => {
        return {
          length: 0,
          angle: 0,
          time: 0,
          frequency: 0,
          resolution: 0,
          flex: 0,
          get percent() {
            gets += 1;
            return gets >= 3 ? 1 : 0;
          },
        };
      }, () => {
        map.set(pctName, pct);
        assert.equal(map.get(pctName)?.toString(), '25%');
      });

      // Unique-cause leftover: L262 TF without wrap (percentage T, hasPercentage F).
      assertType(() => map.set('z-index', CSS.percent(1)));
    });
  });

  test('L265 matchesFrequency && hasFrequency TT via injected <frequency> syntax', () => {
    const { map } = liveMap();
    const freq = '--mcdc-svs2-freq';

    withCustomSyntax(freq, '<frequency>', () => {
      // Unique-cause: matchesFrequency T && hasFrequency T.
      map.set(freq, CSS.Hz(1));
      assert.equal(map.get(freq)?.toString().toLowerCase(), '1hz');
      map.set(freq, CSS.kHz(2));
      assert.equal(map.get(freq)?.toString().toLowerCase(), '2khz');

      // Unique-cause: matchesFrequency F && hasFrequency T.
      assertTypeMatch(
        () => map.set(freq, CSS.px(1)),
        /Invalid value of type CSSUnitValue for property --mcdc-svs2-freq/,
      );
      assertType(() => map.set(freq, CSS.s(1)));
      assertType(() => map.set(freq, CSS.percent(1)));
    });

    // Unique-cause: matchesFrequency T && hasFrequency F (no standard syntax
    // contains `<frequency>`; registerProperty also rejects it).
    assertType(() => map.set('width', CSS.Hz(1)));
    assertType(() => map.set('animation-delay', CSS.Hz(1)));
    assertType(() => map.set('voice-pitch', CSS.Hz(1)));
  });
});

describe('MC/DC round2 unique-cause: matchesStyleValueSyntax L285 CSSPositionValue F (css-typed-om-1 § 3.3)', { concurrency: false }, () => {
  test('instanceof CSSPositionValue T vs F via parse then set vs CSSStyleValue subclass', () => {
    const { map, el } = attrMap();

    // Unique-cause: instanceof T (parse object-position / constructed).
    const parsed = CSSStyleValue.parse('object-position', '10px 20px');
    assert.ok(parsed instanceof CSSPositionValue);
    map.set('object-position', parsed);
    assert.equal(el.style.getPropertyValue('object-position'), '10px 20px');
    const pos = new CSSPositionValue(CSS.px(1), CSS.percent(50));
    map.set('mask-position', pos);
    parsed._associatedProperty = null;
    map.set('offset-anchor', parsed);

    // Unique-cause: instanceof T then position OR all F → TypeError.
    assertTypeMatch(
      () => map.set('color', pos),
      /Invalid value of type CSSPositionValue/,
    );
    assertType(() => map.set('width', pos));
    assertType(() => map.set('opacity', pos));

    // Unique-cause: instanceof F. Every shipped CSSStyleValue subclass is
    // classified above L285; a CSSStyleValue subclass that is none of them
    // falls through to return false.
    class CSSOtherValue extends CSSStyleValue {
      constructor() {
        super('10px');
      }
    }
    const other = new CSSOtherValue();
    assert.notEqual(other.constructor, CSSStyleValue);
    assert.equal(other instanceof CSSPositionValue, false);
    assertTypeMatch(
      () => map.set('width', other),
      /Invalid value of type CSSOtherValue for property width/,
    );
    assertType(() => map.set('color', other));
    assertType(() => map.set('object-position', other));
    assertType(() => map.set('transform', new CSSOtherValue()));

    const { map: live } = liveMap();
    const unparsed = CSSStyleValue.parse('color', 'var(--c)');
    assert.ok(unparsed instanceof CSSUnparsedValue);
    live.set('color', unparsed);
    const ref = new CSSVariableReferenceValue('--svs2') as CSSVariableReferenceValue & {
      _associatedProperty: string | null;
    };
    ref._associatedProperty = null;
    live.set('width', ref as unknown as CSSStyleValue);
    assert.ok(live.get('width') instanceof CSSUnparsedValue);
  });
});
