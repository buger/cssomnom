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

/**
 * EXPECTED-RED WITNESS SUITE — Typed-OM Readiness Package (frozen subsystems).
 *
 * RUNNING THIS FILE DIRECTLY FAILS AT HEAD AND THAT IS CORRECT:
 *   `node --test tests/ts-readiness.witness.ts` exits 1 at HEAD because every
 *   [ts-r*] test is a witness asserting spec-correct behavior for subsystems
 *   whose implementation surface is frozen (docs/proof-escape-ki-122-123.md
 *   appendix A.1, vectors V-TYPED-OM-COMPUTED-UNITS / V-RELATIVE-COLOR-ENGINE).
 *   The two [control-*] tests assert currently-WORKING adjacent behavior so
 *   the suite proves harness sanity rather than blanket failure.
 *
 * Each witness carries a header comment:
 *   // EXPECTED-FAIL until <unlock condition>; spec anchor <quote>
 * and asserts the POST-FIX contract from docs/ts-unlock-design.md (Option A):
 *   computedStyleMap(source: Record<string,string>, context?: {
 *     fontSize?: CSSUnitValue; containerWidth?: CSSUnitValue;
 *   }): StylePropertyMapReadOnly  — exported from src/index.ts, resolving
 *   relative units/keywords against the explicit context, else the fixed-root
 *   approximation defaults fontSize=16px, containerWidth=1280px.
 *
 * Lane binding: proof.yaml declares expected-fail lanes ts-readiness-{1..10}-tripwire,
 * each running this file with --test-name-pattern "ts-r{N}\b". A lane flips by
 * REMOVING its `expected: fail` (and reason) once the witness passes. If a
 * witness unexpectedly PASSES at HEAD, reclassify it as a regression pin:
 * keep the test, drop its lane, record the pin here.
 *
 * NAMING: the `.witness.ts` suffix (not ".test.ts") keeps this expected-red
 * suite OUT of the product glob over all dot-test-dot-ts files under tests/
 * that the default `tests_pass` node lane runs — a confirmed-red tripwire
 * must never count toward product-suite red, mirroring why the ki-10x
 * reproducers live under proof/reproducers/ instead of tests/.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as cssomnom from '../src/index.ts';
import { CSSUnitValue, CSSKeywordValue, StylePropertyMapReadOnly } from '../src/index.ts';

// Post-fix contract shape (Option A). At HEAD `computedStyleMap` is absent:
// it is wired only in src/browser-entry.ts:201-203 (Element.prototype patch)
// and never exported from src/index.ts.
type ComputedStyleContext = { fontSize?: CSSUnitValue; containerWidth?: CSSUnitValue };
type ComputedStyleMapFn = (
    source: Record<string, string>,
    context?: ComputedStyleContext
) => StylePropertyMapReadOnly;

const mod = cssomnom as unknown as Record<string, unknown>;
const computedStyleMap = mod['computedStyleMap'] as ComputedStyleMapFn | undefined;

const px = (n: number): CSSUnitValue => cssomnom.CSS.px(n);
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase();
function cssTextOf(v: unknown): string {
    const withCssText = v as { cssText?: unknown };
    return typeof withCssText?.cssText === 'string' ? withCssText.cssText : String(v);
}
function approx(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
}

describe('ts-readiness witnesses: frozen Typed-OM computed surface', () => {
    describe('subsystem A — computedStyleMap public surface (browser shim unlock path)', () => {
        // EXPECTED-FAIL until computedStyleMap is exported from src/index.ts
        // (surface unlock, docs/proof-escape-ki-122-123.md appendix A.1);
        // spec anchor css-typed-om #element-computedstylemap: "[SameObject]
        // StylePropertyMapReadOnly computedStyleMap();" accessed "by calling
        // the {{Element/computedStyleMap()}} method".
        test('[ts-r1] computedStyleMap is exported from src/index.ts', () => {
            assert.equal(
                typeof computedStyleMap,
                'function',
                'WITNESS PRECONDITION UNMET: computedStyleMap is not exported from src/index.ts ' +
                    '(wired only in src/browser-entry.ts; freeze per appendix A.1)'
            );
        });

        // EXPECTED-FAIL until the same unlock; spec anchor css-typed-om
        // § "Computed style property maps": computedStyleMap() "returns a
        // StylePropertyMapReadOnly object" exposing Typed OM values of the
        // element's computed declarations.
        test('[ts-r2] exported entry returns a StylePropertyMapReadOnly map exposing get()', () => {
            assert.equal(typeof computedStyleMap, 'function', 'computedStyleMap not exported (appendix A.1 freeze)');
            const map = computedStyleMap!({ 'margin-top': '-3.14em' }, { fontSize: px(16) });
            assert.ok(map instanceof StylePropertyMapReadOnly, 'returned map must be a StylePropertyMapReadOnly');
            assert.equal(typeof map.get, 'function', 'map.get(property) must be available');
            const value = map.get('margin-top');
            assert.ok(value !== undefined, 'declared property must be visible through get()');
            assert.ok(value instanceof CSSUnitValue, 'computed length must reify as a CSSUnitValue');
        });
    });

    describe('subsystem B — computed unit resolution (67-row mass, V-TYPED-OM-COMPUTED-UNITS leg 1)', () => {
        // EXPECTED-FAIL until the computed-value surface unlocks; spec anchor
        // css-values-4 § 6.1 (#em): em is "Equal to the computed value of the
        // 'font-size' property of the element on which it is used."
        test('[ts-r3] em computes to px against declared font-size context and fixed-root default', () => {
            assert.equal(typeof computedStyleMap, 'function', 'computedStyleMap not exported (appendix A.1 freeze)');
            const scoped = computedStyleMap!({ 'margin-top': '-3.14em' }, { fontSize: px(16) }).get('margin-top');
            assert.ok(scoped instanceof CSSUnitValue, `expected CSSUnitValue, got ${scoped?.constructor.name}`);
            assert.equal((scoped as CSSUnitValue).unit, 'px', 'em must compute to px');
            assert.ok(approx((scoped as CSSUnitValue).value, -50.24), '-3.14em @ 16px must compute to -50.24px');

            const defaulted = computedStyleMap!({ 'margin-top': '-3.14em' }).get('margin-top') as CSSUnitValue;
            assert.ok(approx(defaulted.value, -50.24), 'without context, fixed-root default font-size 16px applies');
            assert.equal(defaulted.unit, 'px');
        });

        // EXPECTED-FAIL until the computed-value surface unlocks; spec anchor
        // css-values-4 § 6.2 (#percentages): percentages are resolved against
        // a reference measure (for width, the containing block width).
        test('[ts-r4] percentage computes to px against declared container width', () => {
            assert.equal(typeof computedStyleMap, 'function', 'computedStyleMap not exported (appendix A.1 freeze)');
            const value = computedStyleMap!({ width: '50%' }, { containerWidth: px(1280) }).get('width');
            assert.ok(value instanceof CSSUnitValue, `expected CSSUnitValue, got ${value?.constructor.name}`);
            assert.equal((value as CSSUnitValue).unit, 'px', '% length must compute to px');
            assert.ok(approx((value as CSSUnitValue).value, 640), '50% @ 1280px container must compute to 640px');
        });

        // EXPECTED-FAIL until the computed-value surface unlocks; spec anchor
        // css-fonts-4 § 5.1 (#font-weight-absolute-values): "normal — Same as
        // 400." and "bold — Same as 700."
        test('[ts-r5] font-weight keywords canonicalize to numeric 400/700 on compute', () => {
            assert.equal(typeof computedStyleMap, 'function', 'computedStyleMap not exported (appendix A.1 freeze)');
            const normal = computedStyleMap!({ 'font-weight': 'normal' }).get('font-weight') as CSSUnitValue;
            assert.ok(normal instanceof CSSUnitValue, 'font-weight keyword must compute to a CSSUnitValue number');
            assert.equal(normal.unit, 'number');
            assert.equal(normal.value, 400);

            const bold = computedStyleMap!({ 'font-weight': 'bold' }).get('font-weight') as CSSUnitValue;
            assert.equal(bold.unit, 'number');
            assert.equal(bold.value, 700);
        });

        // EXPECTED-FAIL until the computed-value surface unlocks; contract per
        // readiness package decision (docs/ts-unlock-design.md): normal
        // letter-spacing computes to the zero length (css-text-3 #letter-spacing
        // treats normal as zero spacing; its getComputedStyle legacy exception
        // is a resolved-value rule, not a computed-value one).
        test('[ts-r6] letter-spacing: normal computes to 0px', () => {
            assert.equal(typeof computedStyleMap, 'function', 'computedStyleMap not exported (appendix A.1 freeze)');
            const value = computedStyleMap!({ 'letter-spacing': 'normal' }).get('letter-spacing');
            assert.ok(value instanceof CSSUnitValue, `expected CSSUnitValue, got ${value?.constructor.name}`);
            assert.equal((value as CSSUnitValue).unit, 'px');
            assert.equal((value as CSSUnitValue).value, 0);
        });

        // EXPECTED-FAIL until the computed-value surface unlocks; spec anchor
        // css-color-4 #opacity propdef: "Computed value: specified number,
        // clamped to the range [0,1]".
        test('[ts-r7] opacity clamps into [0,1] on compute', () => {
            assert.equal(typeof computedStyleMap, 'function', 'computedStyleMap not exported (appendix A.1 freeze)');
            const high = computedStyleMap!({ opacity: '1.5' }).get('opacity') as CSSUnitValue;
            assert.ok(high instanceof CSSUnitValue, 'opacity must reify as a CSSUnitValue');
            assert.equal(high.unit, 'number');
            assert.equal(high.value, 1, '1.5 clamps down to 1');

            const low = computedStyleMap!({ opacity: '-0.25' }).get('opacity') as CSSUnitValue;
            assert.equal(low.value, 0, '-0.25 clamps up to 0');

            const inRange = computedStyleMap!({ opacity: '0.5' }).get('opacity') as CSSUnitValue;
            assert.ok(approx(inRange.value, 0.5), 'in-range values pass through unclamped');
        });
    });

    describe('subsystem C — step easing canonicalization (V-TYPED-OM-COMPUTED-UNITS leg 2)', () => {
        // EXPECTED-FAIL until the computed-value surface unlocks; spec anchor
        // css-easing-2 § 7.3 (#step-easing-functions): step-start "Computes to
        // steps(1, start)", step-end "Computes to steps(1, end)", and
        // #steps-serialization: they serialize as "steps(1, start)" and
        // "steps(1)" respectively.
        test('[ts-r8] step-start/step-end canonicalize to steps() on computed get', () => {
            assert.equal(typeof computedStyleMap, 'function', 'computedStyleMap not exported (appendix A.1 freeze)');
            const stepStart = norm(cssTextOf(computedStyleMap!({ 'animation-timing-function': 'step-start' }).get('animation-timing-function')));
            assert.equal(stepStart, 'steps(1, start)', 'css-easing-2 #steps-serialization: step-start serializes as steps(1, start)');

            const stepEnd = norm(cssTextOf(computedStyleMap!({ 'animation-timing-function': 'step-end' }).get('animation-timing-function')));
            assert.equal(stepEnd, 'steps(1)', 'css-easing-2 #steps-serialization: step-end serializes as steps(1)');
        });
    });

    describe('subsystem D — relative color computation engine (V-RELATIVE-COLOR-ENGINE)', () => {
        // EXPECTED-FAIL until the relative-color engine lands behind an
        // unlocked computed surface (KI-117 remediation direction); spec
        // anchor css-color-5 #relative-colors: "An origin color can be
        // specified with a from <color> value", whose components are carried
        // into the relative form's channel keywords.
        test('[ts-r9] rgb(from rebeccapurple r g b) computes the origin channels', () => {
            assert.equal(typeof computedStyleMap, 'function', 'computedStyleMap not exported (appendix A.1 freeze)');
            let value: unknown;
            assert.doesNotThrow(() => {
                value = computedStyleMap!({ color: 'rgb(from rebeccapurple r g b)' }).get('color');
            }, 'WITNESS PRECONDITION UNMET: rgb(from ...) rejected before computation (KI-117 freeze)');
            const serialized = norm(cssTextOf(value));
            assert.match(
                serialized,
                /^rgba?\(102(?:\.0+)?,\s*51(?:\.0+)?,\s*153(?:\.0+)?(?:[,\s/]+1(?:\.0+)?)?\)$/,
                `rgb(from rebeccapurple r g b) must compute channels 102, 51, 153 — got "${serialized}"`
            );
        });

        // EXPECTED-FAIL until the relative-color engine lands; spec anchors
        // css-color-5 #relative-colors + #relative-syntax: channel keywords
        // extract the origin color's components (converted into the relative
        // function's color space); calc() may adjust individual channels while
        // untouched keywords preserve hue/chroma.
        test('[ts-r10] lch(from red calc(l*0.5) c h) halves lightness, preserves chroma and hue', () => {
            assert.equal(typeof computedStyleMap, 'function', 'computedStyleMap not exported (appendix A.1 freeze)');
            let origin: unknown;
            let adjusted: unknown;
            assert.doesNotThrow(() => {
                origin = computedStyleMap!({ color: 'lch(from red l c h)' }).get('color');
                adjusted = computedStyleMap!({ color: 'lch(from red calc(l * 0.5) c h)' }).get('color');
            }, 'WITNESS PRECONDITION UNMET: lch(from ...) rejected before computation (KI-117 freeze)');

            const o = origin as { l: number; c: number; h: number };
            const a = adjusted as { l: number; c: number; h: number };
            assert.ok(approx(a.l * 2, o.l, 1e-6), `lightness must halve: ${a.l}*2 vs ${o.l}`);
            assert.ok(approx(a.c, o.c, 1e-6), `chroma keyword must be preserved: ${a.c} vs ${o.c}`);
            assert.ok(approx(a.h, o.h, 1e-6), `hue keyword must be preserved: ${a.h} vs ${o.h}`);
        });
    });

    describe('controls — currently-WORKING adjacent behavior (harness sanity, NOT lanes)', () => {
        // CONTROL (passes at HEAD). Pins that the Typed OM parse path used by
        // every witness above is exercised through a live harness. If this
        // control ever fails, witness failures are meaningless.
        test('[control-a] CSSUnitValue.parse round-trips absolute lengths today', () => {
            const parsed = CSSUnitValue.parse('10px') as CSSUnitValue;
            assert.ok(parsed instanceof CSSUnitValue);
            assert.equal(parsed.value, 10);
            assert.equal(parsed.unit, 'px');
            assert.equal(px(12).value, 12);
            assert.equal(px(12).unit, 'px');
        });

        // CONTROL (passes at HEAD). The keyword VALUE class works today; note
        // honestly: the CSS.keywordValue namespace FACTORY is not shipped at
        // HEAD (CSS exposes px/em/number factories only), which is itself part
        // of the frozen-surface gap — the control pins the working constructor
        // path instead of a failing factory.
        test('[control-b] CSSKeywordValue constructor path works today', () => {
            const keyword = new CSSKeywordValue('inherit');
            assert.equal(keyword.value, 'inherit');
            assert.equal(typeof cssomnom.CSS.px, 'function', 'CSS.px factory is present at HEAD');
            assert.equal(typeof (cssomnom.CSS as unknown as Record<string, unknown>)['keywordValue'], 'undefined',
                'documented HEAD gap: CSS.keywordValue namespace factory is not shipped yet');
        });
    });
});
