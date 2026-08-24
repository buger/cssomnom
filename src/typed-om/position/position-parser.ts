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
// Implements: SYS-REQ-260821-HGFK, SYS-REQ-260821-Y6R3, SW-REQ-260821-7AKJ, SW-REQ-260821-E5D5

import type { ComponentValue, IdentToken } from '../../types.ts';
import type { CSSStyleValue } from '../values/CSSStyleValue.ts';
import { CSSNumericValue } from '../numeric/CSSNumericValue.ts';
import { CSSKeywordValue } from '../values/CSSKeywordValue.ts';
import { CSSPositionValue } from './CSSPositionValue.ts';
import { CSSMathSum, CSSMathNegate } from '../numeric/math/CSSMathOperations.ts';
import { simplify } from '../../math-parser.ts';
import { createUnitValue } from '../utils/formatting.ts';
import { isToken } from '../utils/validation.ts';
import { isLengthPercentage, matchesLength } from '../utils/type-guards.ts';
import { createCSSStyleValue } from '../values/style-value-factory.ts';

// Spec: CSS Typed OM Level 1 § 3.3 #positionvalue-objects
// Spec: CSS Values and Units Level 4 § 10.1 #position-type
// reqproof:proptest:skip keyword-to-percent mapping table witnessed by MC/DC tests/mcdc-tryparseposition-round3-unique-cause.test.ts
export function toPositionCoord(val: CSSStyleValue | CSSNumericValue | CSSKeywordValue | null): CSSNumericValue | null {
  if (!val) return null;
  if (val instanceof CSSKeywordValue) {
    const k = val.value.toLowerCase();
    if (k === 'left' || k === 'top') return createUnitValue(0, 'percent');
    if (k === 'center') return createUnitValue(50, 'percent');
    if (k === 'right' || k === 'bottom') return createUnitValue(100, 'percent');
    return null;
  }
  if (val instanceof CSSNumericValue && isLengthPercentage(val.type())) {
    return val;
  }
  return null;
}

// css-backgrounds-3 #background-position / css-values-4 § 10.1 #position:
// 3-/4-value offsets are <length-percentage>. Keywords are edges, not offsets.
function parseOffsetCoord(c: ComponentValue, property: string): CSSNumericValue | null {
  if (isToken(c) && c.type === 'ident') return null;
  return toPositionCoord(createCSSStyleValue(c, property));
}

function isIdentKeyword(c: ComponentValue, keywords: string[]): c is IdentToken {
  return isToken(c) && c.type === 'ident' && keywords.includes(c.value.toLowerCase());
}

export function tryParsePosition(trimmed: ComponentValue[], property?: string): CSSPositionValue | null {
  const components = trimmed.filter(t => t.type !== 'whitespace' && t.type !== 'comment');
  if (components.length === 0) return null;

  // css-typed-om-1 § 3.3 #positionvalue-objects: CSSPositionValue reifies 2D <position>.
  // css-transforms-1 § 5 #transform-origin-property: 3-value form is x y <length> (z),
  // not the 3-/4-value <position> offset syntax. Do not drop z.
  if (property && property.toLowerCase() === 'transform-origin' && components.length >= 3) {
    return null;
  }

  // 1-value syntax: [ left | center | right | top | bottom | <length-percentage> ]
  if (components.length === 1) {
    const c0 = components[0];
    if (isToken(c0) && c0.type === 'ident') {
      const k = c0.value.toLowerCase();
      if (k === 'left') {
        return new CSSPositionValue(createUnitValue(0, 'percent'), createUnitValue(50, 'percent'));
      }
      if (k === 'right') {
        return new CSSPositionValue(createUnitValue(100, 'percent'), createUnitValue(50, 'percent'));
      }
      if (k === 'top') {
        return new CSSPositionValue(createUnitValue(50, 'percent'), createUnitValue(0, 'percent'));
      }
      if (k === 'bottom') {
        return new CSSPositionValue(createUnitValue(50, 'percent'), createUnitValue(100, 'percent'));
      }
      if (k === 'center') {
        return new CSSPositionValue(createUnitValue(50, 'percent'), createUnitValue(50, 'percent'));
      }
    }
    const sv = createCSSStyleValue(c0, property || 'left');
    const coord = toPositionCoord(sv);
    if (coord) {
      return new CSSPositionValue(coord, createUnitValue(50, 'percent'));
    }
  }

  // 2-value syntax:
  if (components.length === 2) {
    const c0 = components[0];
    const c1 = components[1];

    // Option B: Vertical keyword followed by Horizontal keyword (e.g. "top right")
    if (isToken(c0) && c0.type === 'ident' && ['top', 'bottom'].includes(c0.value.toLowerCase()) &&
        isToken(c1) && c1.type === 'ident' && ['left', 'right', 'center'].includes(c1.value.toLowerCase())) {
      const yCoord = toPositionCoord(new CSSKeywordValue(c0.value));
      const xCoord = toPositionCoord(new CSSKeywordValue(c1.value));
      if (xCoord && yCoord) {
        return new CSSPositionValue(xCoord, yCoord);
      }
    }

    // css-values-4 § 10.1 #position / css-transforms-1 § 5 #transform-origin-property:
    // [ left | center | right ] && [ top | center | bottom ] — `center` is in both
    // groups, so `center left` / `center right` are valid (vertical center, then x).
    if (isToken(c0) && c0.type === 'ident' && c0.value.toLowerCase() === 'center' &&
        isToken(c1) && c1.type === 'ident' && ['left', 'right'].includes(c1.value.toLowerCase())) {
      const yCoord = toPositionCoord(new CSSKeywordValue(c0.value));
      const xCoord = toPositionCoord(new CSSKeywordValue(c1.value));
      if (xCoord && yCoord) {
        return new CSSPositionValue(xCoord, yCoord);
      }
    }

    // Option A: Horizontal component followed by Vertical component
    // Disallow vertical keyword followed by length or length followed by horizontal keyword
    if (isToken(c0) && c0.type === 'ident' && ['top', 'bottom'].includes(c0.value.toLowerCase())) {
      return null;
    }
    if (isToken(c1) && c1.type === 'ident' && ['left', 'right'].includes(c1.value.toLowerCase())) {
      return null;
    }

    const sv1 = createCSSStyleValue(c0, property || 'left');
    const sv2 = createCSSStyleValue(c1, property || 'top');
    const coord1 = toPositionCoord(sv1);
    const coord2 = toPositionCoord(sv2);
    if (coord1 && coord2) {
      return new CSSPositionValue(coord1, coord2);
    }
  }

  // 3-value syntax (css-backgrounds-3 #background-position, not generic <position>):
  // [ center | [ left | right ] <length-percentage>? ] &&
  // [ center | [ top | bottom ] <length-percentage>? ]
  if (components.length === 3) {
    const c0 = components[0];
    const c1 = components[1];
    const c2 = components[2];

    // Case 1: [ left | right ] <length-percentage> [ top | bottom | center ]
    if (isIdentKeyword(c0, ['left', 'right']) && isIdentKeyword(c2, ['top', 'bottom', 'center'])) {
      const off = parseOffsetCoord(c1, property || 'left');
      const vert = toPositionCoord(new CSSKeywordValue(c2.value));
      if (off && vert) {
        const xCoord = c0.value.toLowerCase() === 'right'
          ? simplify(new CSSMathSum(createUnitValue(100, 'percent'), new CSSMathNegate(off)))
          : off;
        return new CSSPositionValue(xCoord, vert);
      }
    }

    // Case 2: [ left | right | center ] [ top | bottom ] <length-percentage>
    if (isIdentKeyword(c0, ['left', 'right', 'center']) && isIdentKeyword(c1, ['top', 'bottom'])) {
      const horiz = toPositionCoord(new CSSKeywordValue(c0.value));
      const off = parseOffsetCoord(c2, property || 'top');
      if (horiz && off) {
        const yCoord = c1.value.toLowerCase() === 'bottom'
          ? simplify(new CSSMathSum(createUnitValue(100, 'percent'), new CSSMathNegate(off)))
          : off;
        return new CSSPositionValue(horiz, yCoord);
      }
    }

    // Case 3: [ top | bottom ] <length-percentage> [ left | right | center ]
    if (isIdentKeyword(c0, ['top', 'bottom']) && isIdentKeyword(c2, ['left', 'right', 'center'])) {
      const off = parseOffsetCoord(c1, property || 'top');
      const horiz = toPositionCoord(new CSSKeywordValue(c2.value));
      if (off && horiz) {
        const yCoord = c0.value.toLowerCase() === 'bottom'
          ? simplify(new CSSMathSum(createUnitValue(100, 'percent'), new CSSMathNegate(off)))
          : off;
        return new CSSPositionValue(horiz, yCoord);
      }
    }

    // Case 4: [ top | bottom | center ] [ left | right ] <length-percentage>
    if (isIdentKeyword(c0, ['top', 'bottom', 'center']) && isIdentKeyword(c1, ['left', 'right'])) {
      const yCoord = toPositionCoord(new CSSKeywordValue(c0.value));
      const off = parseOffsetCoord(c2, property || 'left');
      if (yCoord && off) {
        const xCoord = c1.value.toLowerCase() === 'right'
          ? simplify(new CSSMathSum(createUnitValue(100, 'percent'), new CSSMathNegate(off)))
          : off;
        return new CSSPositionValue(xCoord, yCoord);
      }
    }
  }

  // 4-value syntax:
  if (components.length === 4) {
    const c0 = components[0];
    const c1 = components[1];
    const c2 = components[2];
    const c3 = components[3];

    // Case A: [ left | right ] <offset1> [ top | bottom ] <offset2>
    if (isIdentKeyword(c0, ['left', 'right']) && isIdentKeyword(c2, ['top', 'bottom'])) {
      const off1 = parseOffsetCoord(c1, property || 'left');
      const off2 = parseOffsetCoord(c3, property || 'top');
      if (off1 && off2) {
        const xCoord = c0.value.toLowerCase() === 'right'
          ? simplify(new CSSMathSum(createUnitValue(100, 'percent'), new CSSMathNegate(off1)))
          : off1;
        const yCoord = c2.value.toLowerCase() === 'bottom'
          ? simplify(new CSSMathSum(createUnitValue(100, 'percent'), new CSSMathNegate(off2)))
          : off2;
        return new CSSPositionValue(xCoord, yCoord);
      }
    }

    // Case B: [ top | bottom ] <offset1> [ left | right ] <offset2>
    if (isIdentKeyword(c0, ['top', 'bottom']) && isIdentKeyword(c2, ['left', 'right'])) {
      const off1 = parseOffsetCoord(c1, property || 'top');
      const off2 = parseOffsetCoord(c3, property || 'left');
      if (off1 && off2) {
        const yCoord = c0.value.toLowerCase() === 'bottom'
          ? simplify(new CSSMathSum(createUnitValue(100, 'percent'), new CSSMathNegate(off1)))
          : off1;
        const xCoord = c2.value.toLowerCase() === 'right'
          ? simplify(new CSSMathSum(createUnitValue(100, 'percent'), new CSSMathNegate(off2)))
          : off2;
        return new CSSPositionValue(xCoord, yCoord);
      }
    }
  }

  return null;
}

function nonWs(tokens: ComponentValue[]): ComponentValue[] {
  return tokens.filter(t => t.type !== 'whitespace' && t.type !== 'comment');
}

function isHorizontalOrigin(c: ComponentValue): boolean {
  if (isToken(c) && c.type === 'ident') {
    const k = c.value.toLowerCase();
    return k === 'left' || k === 'center' || k === 'right';
  }
  return toPositionCoord(createCSSStyleValue(c, 'left')) !== null;
}

function isVerticalOrigin(c: ComponentValue): boolean {
  if (isToken(c) && c.type === 'ident') {
    const k = c.value.toLowerCase();
    return k === 'top' || k === 'center' || k === 'bottom';
  }
  return toPositionCoord(createCSSStyleValue(c, 'top')) !== null;
}

function isLengthCoord(c: ComponentValue): boolean {
  if (isToken(c) && c.type === 'ident') return false;
  const sv = createCSSStyleValue(c, 'width');
  return sv instanceof CSSNumericValue && matchesLength(sv.type());
}

function splitCommaList(tokens: ComponentValue[]): ComponentValue[][] {
  const segments: ComponentValue[][] = [[]];
  for (const t of tokens) {
    if (t.type === 'comma') {
      segments.push([]);
    } else {
      segments[segments.length - 1].push(t);
    }
  }
  return segments;
}

function isSingleValueTransformOrigin(c: ComponentValue): boolean {
  // [ left | center | right | top | bottom | <length-percentage> ]
  return isIdentKeyword(c, ['left', 'center', 'right', 'top', 'bottom']) || isHorizontalOrigin(c);
}

function identKeyword(c: ComponentValue): string | null {
  return isToken(c) && c.type === 'ident' ? c.value.toLowerCase() : null;
}

function isKeywordAndPair(a: ComponentValue, b: ComponentValue): boolean {
  // css-values-4 § 2.2 #comb-all: && requires both, in either order.
  // css-transforms-1 § 5 #transform-origin-property / css-values-4 § 10.1 #position:
  // [ [ center | left | right ] && [ center | top | bottom ] ]
  // `center` is in both groups, so `center left` and `center right` assign center to y.
  const ka = identKeyword(a);
  const kb = identKeyword(b);
  if (!ka || !kb) return false;
  const horiz = (k: string) => k === 'center' || k === 'left' || k === 'right';
  const vert = (k: string) => k === 'center' || k === 'top' || k === 'bottom';
  return (horiz(ka) && vert(kb)) || (vert(ka) && horiz(kb));
}

function isTwoValueTransformOrigin(a: ComponentValue, b: ComponentValue): boolean {
  // [ [ center | left | right ] && [ center | top | bottom ] ]
  if (isKeywordAndPair(a, b)) return true;
  // [ left | center | right | <length-percentage> ] [ top | center | bottom | <length-percentage> ]
  if (isHorizontalOrigin(a) && isVerticalOrigin(b)) return true;
  return false;
}

function isValidCssPosition(tokens: ComponentValue[]): boolean {
  // css-values-4 § 10.1 #position: grammar gate distinct from CSSPositionValue reification.
  // <position> is 1-value | 2-value | 4-value. 3-value is not generic <position>
  // (csswg-drafts#2140; WPT perspective-origin-invalid.html `left 4px top`).
  // background-position alone still accepts 3-value (css-backgrounds-3).
  const components = nonWs(tokens);
  if (components.length === 3) return false;
  if (components.length === 2 && isKeywordAndPair(components[0], components[1])) return true;
  return tryParsePosition(tokens) !== null;
}

function isValidTransformOrigin(tokens: ComponentValue[]): boolean {
  // css-transforms-1 § 5 #transform-origin-property (grammar, not CSSPositionValue reification):
  // [ left | center | right | top | bottom | <length-percentage> ]
  // | [ left | center | right | <length-percentage> ] [ top | center | bottom | <length-percentage> ] <length>?
  // | [ [ center | left | right ] && [ center | top | bottom ] ] <length>?
  const components = nonWs(tokens);
  if (components.length === 1) {
    return isSingleValueTransformOrigin(components[0]);
  }
  if (components.length === 2) {
    return isTwoValueTransformOrigin(components[0], components[1]);
  }
  if (components.length === 3) {
    return isTwoValueTransformOrigin(components[0], components[1]) && isLengthCoord(components[2]);
  }
  return false;
}

/**
 * Property-grammar check for POSITION_PROPERTIES.
 * Distinct from tryParsePosition (CSSPositionValue reification).
 * css-typed-om-1 § 6.6 #parse-a-cssstylevalue / § 3.3 #positionvalue-objects
 */
export function matchesPositionPropertyGrammar(property: string, tokens: ComponentValue[]): boolean {
  const prop = property.toLowerCase();
  const components = nonWs(tokens);
  if (components.length === 0) return false;

  if (prop === 'offset-position') {
    if (components.length === 1 && isIdentKeyword(components[0], ['auto', 'normal'])) return true;
    return isValidCssPosition(tokens);
  }
  if (prop === 'offset-anchor') {
    if (components.length === 1 && isIdentKeyword(components[0], ['auto'])) return true;
    return isValidCssPosition(tokens);
  }
  if (prop === 'transform-origin') {
    return isValidTransformOrigin(tokens);
  }
  if (prop === 'perspective-origin') {
    // css-transforms-2 #perspective-origin-property: Value is <position>.
    // css-values-4 § 10.1 #position: 4-value yes; 3-value no (csswg-drafts#2140).
    // Distinct from transform-origin, which has no 4-value and optional <length> z.
    return isValidCssPosition(tokens);
  }
  if (prop === 'background-position' || prop === 'mask-position' || prop === '-webkit-mask-position') {
    return splitCommaList(tokens).every(seg => {
      const s = nonWs(seg);
      if (s.length === 0) return false;
      // css-backgrounds-3 #background-position: 3-value <bg-position> is valid.
      // css-values-4 #position: 3-value is disallowed for generic <position>.
      if (prop === 'background-position' && s.length === 3) {
        return tryParsePosition(s) !== null;
      }
      return isValidCssPosition(s);
    });
  }
  return isValidCssPosition(tokens);
}
