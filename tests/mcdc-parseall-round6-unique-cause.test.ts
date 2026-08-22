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
// Verifies: SYS-REQ-260821-HGFK, SYS-REQ-260821-Y6R3, SW-REQ-260821-7AKJ, SW-REQ-260821-E5D5, INT-REQ-260821-9SGA
// Round-6 unique-cause leftovers for src/typed-om/values/style-value-parser.ts
// _parseAll after tests/mcdc-hotspot-parse-all.test.ts,
// tests/mcdc-hotspot-parse-all-more.test.ts, tests/mcdc-parseall-unique-cause.test.ts,
// tests/mcdc-parseall-still-hot-unique-cause.test.ts,
// tests/mcdc-parseall-remaining-unique-cause.test.ts, and
// tests/mcdc-parseall-round5-unique-cause.test.ts.
// Last recapture: 44/57 decisions, 18 missing conditions / 13 incomplete.
// Drive CSSStyleValue.parse / parseAll only. No //mcdc:ignore.
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSSStyleValue,
  CSSKeywordValue,
  CSSUnparsedValue,
  CSSUnitValue,
  CSSPositionValue,
} from '../src/typed-om.ts';
import { CSSURLImageValue } from '../src/typed-om/values/CSSImageValue.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { tokenize } from '../src/tokenizer.ts';
import type { ComponentValue } from '../src/types.ts';

function parseAll(property: string, css: string): CSSStyleValue[] {
  return CSSStyleValue.parseAll(property, css);
}

const origParseComponentValues = ParseHooks.parseComponentValues;

function restoreHooks(): void {
  ParseHooks.parseComponentValues = origParseComponentValues;
}

/**
 * L259 gates on componentValues.some(comma); L324 gates on trimmed.some(comma).
 * `filter` still yields a fresh array, so L324 can unique-cause T,T while L259
 * stays F (css-syntax-3 § 5.4.8 #parse-a-list-of-component-values).
 */
function withCommaBlindSome(fn: () => void): void {
  ParseHooks.parseComponentValues = (tokens) => {
    const values = origParseComponentValues(tokens);
    const copy = values.slice();
    const nativeSome = Array.prototype.some;
    Object.defineProperty(copy, 'some', {
      configurable: true,
      value(
        predicate: (value: ComponentValue, index: number, array: ComponentValue[]) => unknown,
      ) {
        return nativeSome.call(
          this,
          (t: ComponentValue, i: number, a: ComponentValue[]) =>
            t.type !== 'comma' && Boolean(predicate(t, i, a)),
        );
      },
    });
    return copy;
  };
  try {
    fn();
  } finally {
    restoreHooks();
  }
}

/**
 * L172 checks trimmed.length; L404 checks componentValues.length. An empty
 * list whose filter() still returns the real tokens unique-causes L404 F.
 */
function withEmptyComponentValues(css: string, fn: () => void): void {
  ParseHooks.parseComponentValues = () => {
    const trimmed = origParseComponentValues(tokenize(css)).filter(
      (v) => v.type !== 'whitespace' && v.type !== 'comment',
    );
    const empty: ComponentValue[] = [];
    Object.defineProperty(empty, 'filter', {
      configurable: true,
      value: () => trimmed.slice(),
    });
    return empty;
  };
  try {
    fn();
  } finally {
    restoreHooks();
  }
}

describe('MC/DC round6 unique-cause: CSSStyleValue.parseAll / _parseAll', { concurrency: false }, () => {
  afterEach(() => {
    restoreHooks();
  });

  // css-typed-om-1 § 6.6 #parse-a-cssstylevalue / css-syntax-3 § 5.4.8
  test('L324 list+comma T,T and L327 comma T/F via componentValues.some vs trimmed.some', () => {
    // Unique-cause: isListProperty T && trimmed.some(comma) T. Public parseAll
    // returns at L259 for the same input; comma-blind some() keeps L259 F.
    withCommaBlindSome(() => {
      const times = parseAll('transition-duration', '1s, 2s');
      assert.equal(times.length, 2);
      assert.ok(times[0] instanceof CSSUnitValue);
      assert.ok(times[1] instanceof CSSUnitValue);
      assert.equal((times[0] as CSSUnitValue).value, 1);
      assert.equal((times[1] as CSSUnitValue).value, 2);
      const first = CSSStyleValue.parse('transition-duration', '1s, 2s');
      assert.ok(first instanceof CSSUnitValue);

      const three = parseAll('transition-delay', '1s, 2s, 3s');
      assert.equal(three.length, 3);
      const names = parseAll('animation-name', 'spin, fade');
      assert.equal(names.length, 2);
      assert.ok(names.every((v) => v instanceof CSSKeywordValue));
      const images = parseAll('background-image', 'url(a.png), none');
      assert.equal(images.length, 2);
      assert.ok(images[0] instanceof CSSURLImageValue);
      assert.ok(images[1] instanceof CSSKeywordValue);
    });

    // Unique-cause: isListProperty T && some(comma) F (no stub; L259 also F).
    const one = parseAll('transition-duration', '1s');
    assert.equal(one.length, 1);
    assert.ok(one[0] instanceof CSSUnitValue);

    // Unique-cause: isListProperty F (comma skipped). Non-list comma fails L340.
    assert.throws(() => parseAll('width', '10px, 20px'), TypeError);
    assert.ok(parseAll('width', '10px')[0] instanceof CSSUnitValue);
  });

  // css-typed-om-1 § 6.6 #parse-a-cssstylevalue
  test('L335 matchesSyntax unique-cause: valid vs invalid list item vs empty segment', () => {
    withCommaBlindSome(() => {
      // Unique-cause: segTrimmed.length > 0 T && !matchesSyntax F (valid items).
      const ok = parseAll('transition-duration', '1s, 2s');
      assert.equal(ok.length, 2);

      // Unique-cause: length > 0 T && !matchesSyntax T → TypeError.
      // Public parseAll (L259) reifies `1s, red` without this check.
      assert.throws(() => parseAll('transition-duration', '1s, red'), TypeError);
      assert.throws(() => parseAll('transition-duration', 'red, 1s'), TypeError);
      assert.throws(() => parseAll('animation-name', 'spin, 1s'), TypeError);
      assert.throws(() => parseAll('animation-duration', '1s, red'), TypeError);
      assert.throws(() => parseAll('background-image', 'url(a.png), not-an-image'), TypeError);

      // Unique-cause: length > 0 F (empty comma segment). Doubled comma has no
      // whitespace-only leftover for L386 createValueFromTokens.
      const doubled = parseAll('transition-duration', '1s,,2s');
      assert.equal(doubled.length, 2);
      assert.ok(doubled[0] instanceof CSSUnitValue);
      assert.ok(doubled[1] instanceof CSSUnitValue);
      const leading = parseAll('transition-duration', ',1s');
      assert.equal(leading.length, 1);
      const trailing = parseAll('transition-duration', '1s,');
      assert.equal(trailing.length, 1);

      // All-comma: L335 never throws; L386 pushes nothing → results.length === 0.
      assert.throws(() => parseAll('transition-duration', ','), TypeError);
      assert.throws(() => parseAll('animation-name', ',,'), TypeError);
    });
  });

  // css-typed-om-1 § 6.6 #parse-a-cssstylevalue
  test('L404 componentValues.length > 0 F vs T after L379 var F', () => {
    // Unique-cause: L404 T (normal single function that is not var()).
    const calc = parseAll('width', 'calc(1px + 1px)');
    assert.equal(calc.length, 1);
    assert.ok(calc[0].toString().includes('px'));
    const min = parseAll('width', 'min(1px, 2px)');
    assert.ok(min[0].toString().includes('min('));

    // Unique-cause: L379 fn.name === 'var' F on functions that still reach L368
    // (not the COLOR path, not shouldFallback).
    const clip = parseAll('clip-path', 'url(clip.svg#c)');
    assert.ok(clip[0] instanceof CSSURLImageValue);
    const counter = parseAll('content', 'counter(section)');
    assert.equal(counter[0].constructor, CSSStyleValue);
    const attr = parseAll('content', 'attr(data-x)');
    assert.equal(attr[0].constructor, CSSStyleValue);
    const webkitUrl = parseAll('-webkit-box-align', 'url(x)');
    assert.ok(webkitUrl[0] instanceof CSSURLImageValue);
    assert.ok(CSSStyleValue.parse('clip-path', 'url(c.svg#x)') instanceof CSSURLImageValue);

    // Unique-cause: L404 F. Empty componentValues with filter() returning the
    // calc function passes L172 then skips the L404 push → parseAllStyleValues
    // throws on results.length === 0.
    withEmptyComponentValues('calc(1px + 1px)', () => {
      assert.throws(() => parseAll('width', 'calc(1px + 1px)'), TypeError);
      assert.throws(() => CSSStyleValue.parse('width', 'calc(1px + 1px)'), TypeError);
    });
    const again = parseAll('width', 'calc(1px + 1px)');
    assert.equal(again.length, 1);
  });

  test('L276 css-wide includes F; L302/L312/L322 !hasVarFunction T; var returns at L193', () => {
    // Unique-cause: L276 includes F (css-wide T already returned at L180).
    const display = parseAll('display', 'block');
    assert.ok(display[0] instanceof CSSKeywordValue);
    const inherit = parseAll('display', 'inherit');
    assert.ok(inherit[0] instanceof CSSKeywordValue);
    assert.throws(() => parseAll('display', 'revert-rule'), TypeError);

    // Unique-cause: shorthand / SHORTHANDS_DATA / syntax && !hasVarFunction T.
    const margin = parseAll('margin', '1px 2px');
    assert.equal(margin[0].constructor, CSSStyleValue);
    const gap = parseAll('gap', '10px 20px');
    assert.equal(gap[0].constructor, CSSStyleValue);
    assert.ok(parseAll('opacity', '0.5')[0] instanceof CSSUnitValue);
    assert.ok(parseAll('-webkit-box-pack', 'start')[0] instanceof CSSKeywordValue);

    // !hasVarFunction F is unreachable here: hasVarFunction returns at L193.
    assert.ok(parseAll('margin', 'var(--m)')[0] instanceof CSSUnparsedValue);
    assert.ok(parseAll('gap', 'var(--g)')[0] instanceof CSSUnparsedValue);
    assert.ok(parseAll('opacity', 'var(--o)')[0] instanceof CSSUnparsedValue);
  });

  // css-typed-om-1 § 3.3 #positionvalue-objects / § 3.6 #colorvalue-objects
  test('L373 position-keyword AND F-side; L351 transparent masked by NAMED_COLORS', () => {
    // Unique-cause: isPositionProperty F (isPositionKeyword skipped by
    // `!(A && B)` when A is F). isPositionProperty T returns at L204.
    const flt = parseAll('float', 'left');
    assert.ok(flt[0] instanceof CSSKeywordValue);
    assert.equal((flt[0] as CSSKeywordValue).value, 'left');
    const display = parseAll('display', 'block');
    assert.ok(display[0] instanceof CSSKeywordValue);
    const pos = parseAll('object-position', 'left');
    assert.ok(pos[0] instanceof CSSPositionValue);

    // Unique-cause: kw === 'transparent' cannot flip independently of
    // `kw in NAMED_COLORS` (transparent is a key; did not delete).
    const transparent = parseAll('color', 'transparent');
    assert.ok(transparent[0] instanceof CSSKeywordValue);
    assert.equal((transparent[0] as CSSKeywordValue).value.toLowerCase(), 'transparent');
    assert.ok(parseAll('color', 'red')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('color', 'currentcolor')[0] instanceof CSSKeywordValue);
  });

  test('L159 property-name OR F-side; T is parseAllStyleValues L141 first', () => {
    // Unique-cause: === '--' F, startsWith('--') F.
    assert.throws(() => parseAll('-', 'auto'), TypeError);
    const color = parseAll('color', 'red');
    assert.ok(color[0] instanceof CSSKeywordValue);
    // Unique-cause: startsWith('--') T && length < 3 F. `'--'` T never reaches
    // _parseAll (parseAllStyleValues throws the same check first).
    const custom = parseAll('--mcdc-parseall6', 'hello');
    assert.ok(custom[0] instanceof CSSUnparsedValue);
    assert.throws(() => parseAll('--', 'auto'), TypeError);
  });
});
