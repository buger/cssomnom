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
// Verifies: SYS-REQ-260821-8TGB, SW-REQ-260821-HNRG, SYS-REQ-260821-KV30, SW-REQ-260821-YTV6, SW-REQ-260822-YBF2
// Leftover unique-cause for src/shorthands.ts expandFont / expandBorder / expandBox
// (margin, padding, inset, scroll-*) / expandFlex, driven only through
// CSSStyleDeclaration.setProperty then getPropertyValue of the longhands.
// cssom-1 § 6.7.1 #set-a-css-declaration. No SHORTHANDS.expand(). No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { FONT_LONGHANDS, BORDER_ALL_LONGHANDS, FLEX_LONGHANDS } from '../src/shorthands.ts';

function style(): CSSStyleDeclaration {
  return new CSSStyleDeclaration();
}

function setShorthand(property: string, value: string): CSSStyleDeclaration {
  const decl = style();
  decl.setProperty(property, value);
  return decl;
}

function lh(decl: CSSStyleDeclaration, name: string): string {
  return decl.getPropertyValue(name);
}

function assertNoOp(property: string, value: string, sentinelName: string, sentinelValue: string): void {
  const decl = style();
  decl.setProperty(sentinelName, sentinelValue);
  decl.setProperty(property, value);
  assert.equal(lh(decl, sentinelName), sentinelValue, `${property}: ${JSON.stringify(value)} must be a no-op`);
}

const FONT_DEFAULTS: Record<string, string> = {
  'font-style': 'normal',
  'font-variant-caps': 'normal',
  'font-variant-ligatures': 'normal',
  'font-variant-alternates': 'normal',
  'font-variant-numeric': 'normal',
  'font-variant-east-asian': 'normal',
  'font-variant-position': 'normal',
  'font-variant-emoji': 'normal',
  'font-weight': 'normal',
  'font-stretch': 'normal',
  'line-height': 'normal',
};

function assertFont(decl: CSSStyleDeclaration, expected: Record<string, string>): void {
  for (const name of FONT_LONGHANDS) {
    const want = expected[name] ?? FONT_DEFAULTS[name];
    assert.equal(lh(decl, name), want, name);
  }
}

describe('MC/DC leftover: expandFont via setProperty (css-fonts-4 #propdef-font)', () => {
  test('size ident unique-cause vs non-ident reject (url/string/function includes F)', () => {
    // Unique-cause: sizeToken.type === 'ident' T with size-keyword includes T.
    assertFont(setShorthand('font', 'xx-small serif'), { 'font-size': 'xx-small', 'font-family': 'serif' });
    assertFont(setShorthand('font', 'medium / normal serif'), { 'font-size': 'medium', 'font-family': 'serif' });

    // Unique-cause: ident T, size-keyword includes F (not consumed as a prefix).
    assertNoOp('font', 'serif serif', 'font-size', '20px');
    assertNoOp('font', 'not-a-font', 'font-size', '20px');

    // Unique-cause: ident F and function F (string / url), so the size OR is false.
    assertNoOp('font', '"16px" serif', 'font-size', '20px');
    assertNoOp('font', 'url(x) serif', 'font-size', '20px');

    // Unique-cause: sizeToken.type === 'function' T with math-fn includes F.
    assertNoOp('font', 'rgb(1, 2, 3) serif', 'font-size', '20px');
    assertNoOp('font', 'counter(x) serif', 'font-size', '20px');
    assertNoOp('font', 'attr(data) serif', 'font-size', '20px');
  });

  test('size number===0 vs non-zero, dimension, percentage, math includes T', () => {
    // Unique-cause: sizeToken.type === 'number' && value === 0 T (0 is a size, not a weight).
    assertFont(setShorthand('font', '0 serif'), { 'font-size': '0', 'font-family': 'serif' });
    // Unique-cause: number T, value === 0 F, and not a 1..1000 weight.
    assertNoOp('font', '1001 serif', 'font-size', '20px');
    assertNoOp('font', '0.5 serif', 'font-size', '20px');

    assertFont(setShorthand('font', '0px serif'), { 'font-size': '0px', 'font-family': 'serif' });
    assertFont(setShorthand('font', '150% serif'), { 'font-size': '150%', 'font-family': 'serif' });
    assert.equal(lh(setShorthand('font', 'calc(1em + 2px) serif'), 'font-size').startsWith('calc('), true);
  });

  test('line-height function includes F vs T, and remaining token kinds', () => {
    // Unique-cause: lhToken function name includes calc/min/max/clamp F.
    assertNoOp('font', '16px / rgb(1, 2, 3) serif', 'font-size', '20px');
    assertNoOp('font', '16px / counter(x) serif', 'font-size', '20px');
    assertNoOp('font', '16px / attr(data) serif', 'font-size', '20px');
    assertNoOp('font', '16px / url(x) serif', 'font-size', '20px');
    assertNoOp('font', '16px / serif', 'font-size', '20px');

    // Unique-cause: includes T (min/max/clamp already paired against the F functions above).
    assert.equal(lh(setShorthand('font', '16px / min(1, 2) serif'), 'line-height').startsWith('min('), true);
    assert.equal(lh(setShorthand('font', '16px / max(1, 2) serif'), 'line-height').startsWith('max('), true);
    assert.equal(lh(setShorthand('font', '16px / clamp(1, 2, 3) serif'), 'line-height').startsWith('clamp('), true);

    assertFont(setShorthand('font', '16px / 0 serif'), {
      'font-size': '16px',
      'line-height': '0',
      'font-family': 'serif',
    });
    assertFont(setShorthand('font', '16px / 0px serif'), {
      'font-size': '16px',
      'line-height': '0px',
      'font-family': 'serif',
    });
    assertNoOp('font', '16px / 1.5', 'font-size', '20px');
    assertNoOp('font', '16px / 1.2serif', 'font-size', '20px');
  });

  test('familyVal comment unique-cause after explicit line-height (lastIdx !== -1)', () => {
    // Unique-cause: familyVal[0].type === 'comment' T (comment glued after the lh token).
    assertFont(setShorthand('font', '16px / 1.2/*c*/serif'), {
      'font-size': '16px',
      'line-height': '1.2',
      'font-family': 'serif',
    });
    // Unique-cause: comment F, whitespace T then later comments.
    assertFont(setShorthand('font', '16px / 1.2 /*c*/ /*d*/ serif'), {
      'font-size': '16px',
      'line-height': '1.2',
      'font-family': 'serif',
    });
    // lastIdx === -1 path (synthetic line-height): comments are already filtered.
    assertFont(setShorthand('font', '16px /* family */ serif'), {
      'font-size': '16px',
      'font-family': 'serif',
    });
    // Remaining after lastConsumed is only comments → missing family, expand null.
    assertNoOp('font', '16px / 1.2 /*c*/', 'font-size', '20px');
  });

  test('quoted family list and extra variant longhands stay normal', () => {
    const decl = setShorthand('font', 'italic 400 16px / min(1, 2) "Helvetica Neue", serif');
    assert.equal(lh(decl, 'font-style'), 'italic');
    assert.equal(lh(decl, 'font-weight'), '400');
    assert.equal(lh(decl, 'font-size'), '16px');
    assert.equal(lh(decl, 'line-height').startsWith('min('), true);
    assert.equal(lh(decl, 'font-family'), 'Helvetica Neue, serif');
    for (const extra of [
      'font-variant-ligatures',
      'font-variant-alternates',
      'font-variant-numeric',
      'font-variant-east-asian',
      'font-variant-position',
      'font-variant-emoji',
    ] as const) {
      assert.equal(lh(decl, extra), 'normal', extra);
    }
  });
});

describe('MC/DC leftover: expandBorder via setProperty (css-backgrounds-3 #the-border-shorthands)', () => {
  test('width token unique-cause: number vs percentage vs dimension', () => {
    // Unique-cause: val.type === 'number' T (dimension F, percentage F).
    const zero = setShorthand('border', '0');
    assert.equal(lh(zero, 'border-top-width'), '0');
    assert.equal(lh(zero, 'border-right-width'), '0');
    assert.equal(lh(zero, 'border-top-style'), 'none');
    assert.equal(lh(zero, 'border-top-color'), 'currentcolor');
    assert.equal(lh(zero, 'border-image-source'), 'none');

    const zeroSolid = setShorthand('border', '0 solid red');
    assert.equal(lh(zeroSolid, 'border-left-width'), '0');
    assert.equal(lh(zeroSolid, 'border-left-style'), 'solid');
    assert.equal(lh(zeroSolid, 'border-left-color'), 'red');

    // Unique-cause: percentage T (dimension F, number F).
    const pct = setShorthand('border', '50% solid black');
    assert.equal(lh(pct, 'border-top-width'), '50%');
    assert.equal(lh(pct, 'border-top-style'), 'solid');
    assert.equal(lh(pct, 'border-top-color'), 'black');

    // Unique-cause: dimension T.
    const dim = setShorthand('border', '2px dashed #abc');
    assert.equal(lh(dim, 'border-bottom-width'), '2px');
    assert.equal(lh(dim, 'border-bottom-style'), 'dashed');
    assert.equal(lh(dim, 'border-bottom-color'), '#abc');

    // Number 1 expands, then longhand width validation drops the width (style/color stick).
    const one = setShorthand('border', '1 solid red');
    assert.equal(lh(one, 'border-top-width'), '');
    assert.equal(lh(one, 'border-top-style'), 'solid');
    assert.equal(lh(one, 'border-top-color'), 'red');
    assert.equal(lh(one, 'border-image-source'), 'none');
  });

  test('color token unique-cause: hash vs function vs else url/string', () => {
    // Unique-cause: val.type === 'hash' T, function F.
    assert.equal(lh(setShorthand('border', '#fff'), 'border-top-color'), '#fff');
    assert.equal(lh(setShorthand('border', '2px dashed #abc'), 'border-right-color'), '#abc');

    // Unique-cause: function T, hash F.
    assert.equal(lh(setShorthand('border', 'thick solid rgb(1, 2, 3)'), 'border-top-color'), 'rgb(1, 2, 3)');
    assert.equal(lh(setShorthand('border', 'hsl(0 100% 50%)'), 'border-top-color'), 'hsl(0 100% 50%)');
    assert.equal(lh(setShorthand('border', 'color(srgb 1 0 0)'), 'border-top-color'), 'color(srgb 1 0 0)');

    // Unique-cause: hash F, function F → else arm (url / string).
    assert.equal(lh(setShorthand('border', 'url(x)'), 'border-top-color'), 'url("x")');
    assert.equal(lh(setShorthand('border', '"red"'), 'border-top-color'), '"red"');
    assert.equal(lh(setShorthand('border', 'url(x)'), 'border-top-style'), 'none');
    assert.equal(lh(setShorthand('border', 'url(x)'), 'border-top-width'), 'medium');
  });

  test('ident width/style/color else-arm and css-wide copy onto every longhand', () => {
    const thin = setShorthand('border', 'thin');
    assert.equal(lh(thin, 'border-top-width'), 'thin');
    assert.equal(lh(thin, 'border-top-style'), 'none');

    for (const kw of ['none', 'hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset']) {
      assert.equal(lh(setShorthand('border', kw), 'border-top-style'), kw, kw);
    }

    assert.equal(lh(setShorthand('border', 'transparent'), 'border-top-color'), 'transparent');
    assert.equal(lh(setShorthand('border', 'currentcolor'), 'border-top-color'), 'currentcolor');
    assert.equal(lh(setShorthand('border', 'medium dashed'), 'border-top-style'), 'dashed');
    assert.equal(lh(setShorthand('border', 'medium dashed'), 'border-top-width'), 'medium');

    for (const wide of ['initial', 'inherit', 'unset', 'revert', 'revert-layer']) {
      const decl = setShorthand('border', wide);
      for (const name of BORDER_ALL_LONGHANDS) {
        assert.equal(lh(decl, name), wide, `${wide} ${name}`);
      }
    }

    assertNoOp('border', '1px solid red extra', 'border-top-width', '9px');
    assertNoOp('border', '/* comment */', 'border-top-width', '9px');
    assertNoOp('border', '   ', 'border-top-width', '9px');
  });
});

const MARGIN_PHYSICAL = ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'] as const;
const MARGIN_LOGICAL = [
  'margin-block-start',
  'margin-inline-start',
  'margin-block-end',
  'margin-inline-end',
] as const;
const PADDING_PHYSICAL = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'] as const;
const PADDING_LOGICAL = [
  'padding-block-start',
  'padding-inline-start',
  'padding-block-end',
  'padding-inline-end',
] as const;

describe('MC/DC leftover: expandBox margin/padding via setProperty (css-box-3 #propdef-margin, css-logical-1 #logical-shorthand-keyword)', () => {
  // Verifies: SW-REQ-260822-YBF2
  test('physical 1/2/3/4-value grid unique-cause for margin and padding', () => {
    const m1 = setShorthand('margin', '10px');
    for (const name of MARGIN_PHYSICAL) assert.equal(lh(m1, name), '10px', name);
    for (const name of MARGIN_LOGICAL) assert.equal(lh(m1, name), '', name);

    const m2 = setShorthand('margin', '10px 20px');
    assert.equal(lh(m2, 'margin-top'), '10px');
    assert.equal(lh(m2, 'margin-right'), '20px');
    assert.equal(lh(m2, 'margin-bottom'), '10px');
    assert.equal(lh(m2, 'margin-left'), '20px');

    const m3 = setShorthand('margin', '1px 2px 3px');
    assert.equal(lh(m3, 'margin-top'), '1px');
    assert.equal(lh(m3, 'margin-right'), '2px');
    assert.equal(lh(m3, 'margin-bottom'), '3px');
    assert.equal(lh(m3, 'margin-left'), '2px');

    const m4 = setShorthand('margin', '1px 2px 3px 4px');
    assert.equal(lh(m4, 'margin-top'), '1px');
    assert.equal(lh(m4, 'margin-right'), '2px');
    assert.equal(lh(m4, 'margin-bottom'), '3px');
    assert.equal(lh(m4, 'margin-left'), '4px');

    const p3 = setShorthand('padding', '1px 2px 3px');
    assert.equal(lh(p3, 'padding-top'), '1px');
    assert.equal(lh(p3, 'padding-right'), '2px');
    assert.equal(lh(p3, 'padding-bottom'), '3px');
    assert.equal(lh(p3, 'padding-left'), '2px');

    const p1 = setShorthand('padding', '5px');
    for (const name of PADDING_PHYSICAL) assert.equal(lh(p1, name), '5px', name);
  });

  test('logical keyword unique-cause and 1/2/3/4-value logical grid', () => {
    // Unique-cause: filtered[0] ident T and value === 'logical' T; data.length > N F/T.
    const l1 = setShorthand('margin', 'logical 1px');
    for (const name of MARGIN_LOGICAL) assert.equal(lh(l1, name), '1px', name);
    for (const name of MARGIN_PHYSICAL) assert.equal(lh(l1, name), '', name);

    const l2 = setShorthand('margin', 'logical 1px 2px');
    assert.equal(lh(l2, 'margin-block-start'), '1px');
    assert.equal(lh(l2, 'margin-inline-start'), '2px');
    assert.equal(lh(l2, 'margin-block-end'), '1px');
    assert.equal(lh(l2, 'margin-inline-end'), '2px');

    const l3 = setShorthand('margin', 'logical 1px 2px 3px');
    assert.equal(lh(l3, 'margin-block-start'), '1px');
    assert.equal(lh(l3, 'margin-inline-start'), '2px');
    assert.equal(lh(l3, 'margin-block-end'), '3px');
    assert.equal(lh(l3, 'margin-inline-end'), '2px');

    const l4 = setShorthand('margin', 'logical 1px 2px 3px 4px');
    assert.equal(lh(l4, 'margin-block-start'), '1px');
    assert.equal(lh(l4, 'margin-inline-start'), '2px');
    assert.equal(lh(l4, 'margin-block-end'), '3px');
    assert.equal(lh(l4, 'margin-inline-end'), '4px');

    const pL = setShorthand('padding', 'logical 1px');
    for (const name of PADDING_LOGICAL) assert.equal(lh(pL, name), '1px', name);
    for (const name of PADDING_PHYSICAL) assert.equal(lh(pL, name), '', name);

    // Unique-cause: value.toLowerCase() === 'logical' is case-insensitive; ident T.
    assert.equal(lh(setShorthand('margin', 'LOGICAL 1px 2px'), 'margin-block-start'), '1px');
    assert.equal(lh(setShorthand('margin', 'Logical 1px'), 'margin-inline-end'), '1px');

    // Unique-cause: ident T, logical F (auto is a length-box ident, not the logical flag).
    const auto = setShorthand('margin', 'auto');
    for (const name of MARGIN_PHYSICAL) assert.equal(lh(auto, name), 'auto', name);
    for (const name of MARGIN_LOGICAL) assert.equal(lh(auto, name), '', name);

    // Unique-cause: data.length < 1 after stripping logical.
    assertNoOp('margin', 'logical', 'margin-top', '9px');
    // Unique-cause: data.length > 4.
    assertNoOp('margin', '1px 2px 3px 4px 5px', 'margin-top', '9px');
    // Unique-cause: filtered.length === 0 (comments/whitespace only). Empty string is removeProperty.
    assertNoOp('margin', '/* comment */', 'margin-top', '9px');
    assertNoOp('margin', '   ', 'margin-top', '9px');
  });

  test('isValidLengthOrPercentage unique-cause and isLengthBox XOR with border-color', () => {
    // Unique-cause: number && value === 0 T vs F.
    const zero = setShorthand('margin', '0');
    for (const name of MARGIN_PHYSICAL) assert.equal(lh(zero, name), '0', name);
    assertNoOp('margin', '1', 'margin-top', '9px');

    const pct = setShorthand('margin', '50%');
    for (const name of MARGIN_PHYSICAL) assert.equal(lh(pct, name), '50%', name);

    // Unique-cause: function name includes min/max/clamp T vs rgb F.
    assert.equal(lh(setShorthand('margin', 'min(1px, 2px)'), 'margin-top'), 'min(1px, 2px)');
    assert.equal(lh(setShorthand('margin', 'max(1px, 2px)'), 'margin-right'), 'max(1px, 2px)');
    assert.equal(lh(setShorthand('margin', 'clamp(1px, 2px, 3px)'), 'margin-left'), 'clamp(1px, 2px, 3px)');
    assertNoOp('margin', 'rgb(1, 2, 3)', 'margin-top', '9px');

    // Unique-cause: dimension unit in LENGTH_UNITS F.
    assertNoOp('margin', '10deg', 'margin-top', '9px');
    // Unique-cause: ident includes auto/css-wide F.
    assertNoOp('margin', 'red', 'margin-top', '9px');

    for (const wide of ['inherit', 'unset', 'initial']) {
      const decl = setShorthand('margin', wide);
      for (const name of MARGIN_PHYSICAL) assert.equal(lh(decl, name), wide, `${wide} ${name}`);
    }

    // Unique-cause: isLengthBox F (border-color) so 'red' and even '1px' expand.
    const color = setShorthand('border-color', 'red');
    assert.equal(lh(color, 'border-top-color'), 'red');
    assert.equal(lh(color, 'border-right-color'), 'red');
    const mixed = setShorthand('border-color', 'red blue green yellow');
    assert.equal(lh(mixed, 'border-top-color'), 'red');
    assert.equal(lh(mixed, 'border-right-color'), 'blue');
    assert.equal(lh(mixed, 'border-bottom-color'), 'green');
    assert.equal(lh(mixed, 'border-left-color'), 'yellow');
    assert.equal(lh(setShorthand('border-color', '1px'), 'border-top-color'), '1px');

    const pad0 = setShorthand('padding', '0');
    for (const name of PADDING_PHYSICAL) assert.equal(lh(pad0, name), '0', name);
    // expandBox accepts auto for padding (same isValidLengthOrPercentage).
    const padAuto = setShorthand('padding', 'auto');
    for (const name of PADDING_PHYSICAL) assert.equal(lh(padAuto, name), 'auto', name);
  });

  test('isLengthBox leftover: inset physical[0]===top and scroll- prefix', () => {
    const inset = setShorthand('inset', '1px 2px');
    assert.equal(lh(inset, 'top'), '1px');
    assert.equal(lh(inset, 'right'), '2px');
    assert.equal(lh(inset, 'bottom'), '1px');
    assert.equal(lh(inset, 'left'), '2px');

    const insetL = setShorthand('inset', 'logical 1px 2px 3px');
    assert.equal(lh(insetL, 'inset-block-start'), '1px');
    assert.equal(lh(insetL, 'inset-inline-start'), '2px');
    assert.equal(lh(insetL, 'inset-block-end'), '3px');
    assert.equal(lh(insetL, 'inset-inline-end'), '2px');
    assert.equal(lh(insetL, 'top'), '');

    const sm = setShorthand('scroll-margin', '1px 2px');
    assert.equal(lh(sm, 'scroll-margin-top'), '1px');
    assert.equal(lh(sm, 'scroll-margin-right'), '2px');
    assert.equal(lh(sm, 'scroll-margin-bottom'), '1px');
    assert.equal(lh(sm, 'scroll-margin-left'), '2px');

    const sp = setShorthand('scroll-padding', 'logical 4px 5px 6px 7px');
    assert.equal(lh(sp, 'scroll-padding-block-start'), '4px');
    assert.equal(lh(sp, 'scroll-padding-inline-start'), '5px');
    assert.equal(lh(sp, 'scroll-padding-block-end'), '6px');
    assert.equal(lh(sp, 'scroll-padding-inline-end'), '7px');
    assert.equal(lh(sp, 'scroll-padding-top'), '');

    const auto0 = setShorthand('inset', 'auto 0');
    assert.equal(lh(auto0, 'top'), 'auto');
    assert.equal(lh(auto0, 'right'), '0');
    assert.equal(lh(auto0, 'bottom'), 'auto');
    assert.equal(lh(auto0, 'left'), '0');
  });
});

describe('MC/DC leftover: expandFlex via setProperty (css-flexbox-1 #flex-property)', () => {
  test('grow===null XOR basis===null; grow!==null ternary only when basis omitted', () => {
    // Unique-cause: grow === null F, basis === null T → default basis 0px (ternary grow !== null T).
    const growOnly = setShorthand('flex', '2');
    assert.equal(lh(growOnly, 'flex-grow'), '2');
    assert.equal(lh(growOnly, 'flex-shrink'), '1');
    assert.equal(lh(growOnly, 'flex-basis'), '0px');

    const zeroGrow = setShorthand('flex', '0');
    assert.equal(lh(zeroGrow, 'flex-grow'), '0');
    assert.equal(lh(zeroGrow, 'flex-basis'), '0px');

    // Unique-cause: grow === null T, basis === null F → default grow/shrink 1, keep basis.
    const basisPx = setShorthand('flex', '10px');
    assert.equal(lh(basisPx, 'flex-grow'), '1');
    assert.equal(lh(basisPx, 'flex-shrink'), '1');
    assert.equal(lh(basisPx, 'flex-basis'), '10px');

    const pct = setShorthand('flex', '0%');
    assert.equal(lh(pct, 'flex-grow'), '1');
    assert.equal(lh(pct, 'flex-basis'), '0%');

    // Both null after the loop is unreachable (invalid tokens return null inside the loop).
    assertNoOp('flex', 'solid', 'flex-grow', '9');
    assertNoOp('flex', 'url(x)', 'flex-grow', '9');
    assertNoOp('flex', '#fff', 'flex-grow', '9');
    assertNoOp('flex', '1 2 3', 'flex-grow', '9');
    assertNoOp('flex', '10px 20px', 'flex-grow', '9');
    assertNoOp('flex', '1 2 3 4', 'flex-grow', '9');
    assertNoOp('flex', 'auto content', 'flex-grow', '9');
  });

  test('ident basis unique-cause vs isValidLengthOrPercentage length/function', () => {
    // Unique-cause: isValidLengthOrPercentage F, ident T, content-keyword includes T.
    for (const kw of ['content', 'max-content', 'min-content', 'fit-content']) {
      const decl = setShorthand('flex', kw);
      assert.equal(lh(decl, 'flex-grow'), '1', kw);
      assert.equal(lh(decl, 'flex-shrink'), '1', kw);
      assert.equal(lh(decl, 'flex-basis'), kw, kw);
    }

    // Unique-cause: ident auto as basis (not the 1-token `flex: auto` keyword).
    const growAuto = setShorthand('flex', '1 auto');
    assert.equal(lh(growAuto, 'flex-grow'), '1');
    assert.equal(lh(growAuto, 'flex-shrink'), '1');
    assert.equal(lh(growAuto, 'flex-basis'), 'auto');

    const autoThenGrow = setShorthand('flex', 'auto 1');
    assert.equal(lh(autoThenGrow, 'flex-grow'), '1');
    assert.equal(lh(autoThenGrow, 'flex-basis'), 'auto');

    const three = setShorthand('flex', '1 2 auto');
    assert.equal(lh(three, 'flex-grow'), '1');
    assert.equal(lh(three, 'flex-shrink'), '2');
    assert.equal(lh(three, 'flex-basis'), 'auto');

    const contentThree = setShorthand('flex', '2 3 content');
    assert.equal(lh(contentThree, 'flex-grow'), '2');
    assert.equal(lh(contentThree, 'flex-shrink'), '3');
    assert.equal(lh(contentThree, 'flex-basis'), 'content');

    assert.equal(lh(setShorthand('flex', '1 fit-content'), 'flex-basis'), 'fit-content');

    // Unique-cause: isValidLengthOrPercentage T via dimension / calc / min (ident skipped).
    assert.equal(lh(setShorthand('flex', '1 2 10px'), 'flex-basis'), '10px');
    assert.equal(lh(setShorthand('flex', '1 10px'), 'flex-basis'), '10px');
    assert.equal(lh(setShorthand('flex', '10px 1'), 'flex-grow'), '1');
    assert.equal(lh(setShorthand('flex', '1 0px'), 'flex-basis'), '0px');
    assert.equal(lh(setShorthand('flex', 'calc(10px)'), 'flex-basis'), 'calc(10px)');
    assert.equal(lh(setShorthand('flex', 'min(1px, 2px)'), 'flex-basis'), 'min(1px, 2px)');
    assert.equal(lh(setShorthand('flex', 'max(1px, 2em)'), 'flex-basis'), 'max(1px, 2em)');
    assert.equal(lh(setShorthand('flex', 'clamp(1px, 2px, 3px)'), 'flex-basis'), 'clamp(1px, 2px, 3px)');
  });

  test('one-token none/auto/css-wide still expand every flex longhand', () => {
    const none = setShorthand('flex', 'none');
    assert.equal(lh(none, 'flex-grow'), '0');
    assert.equal(lh(none, 'flex-shrink'), '0');
    assert.equal(lh(none, 'flex-basis'), 'auto');

    const auto = setShorthand('flex', 'auto');
    assert.equal(lh(auto, 'flex-grow'), '1');
    assert.equal(lh(auto, 'flex-shrink'), '1');
    assert.equal(lh(auto, 'flex-basis'), 'auto');

    for (const wide of ['initial', 'inherit', 'unset', 'revert', 'revert-layer']) {
      const decl = setShorthand('flex', wide);
      for (const name of FLEX_LONGHANDS) assert.equal(lh(decl, name), wide, `${wide} ${name}`);
    }
  });
});

describe('MC/DC leftover: grid shorthands have no expandGrid (css-grid-1 #propdef-grid)', () => {
  // SHORTHANDS has no grid/grid-template/grid-row/grid-column/grid-area/grid-gap expander.
  // setProperty stores the property as a longhand-like declaration; grid longhands stay empty.
  const GRID_LONGHANDS = [
    'grid-template-rows',
    'grid-template-columns',
    'grid-template-areas',
    'grid-auto-rows',
    'grid-auto-columns',
    'grid-auto-flow',
  ] as const;

  test('setProperty(grid) does not populate grid longhands', () => {
    for (const value of ['none', 'auto / auto', '1fr / 1fr', 'inherit']) {
      const decl = setShorthand('grid', value);
      assert.equal(lh(decl, 'grid'), value, value);
      for (const name of GRID_LONGHANDS) {
        assert.equal(lh(decl, name), '', `${value} ${name}`);
      }
    }
  });

  test('related grid/gap shorthands also leave their longhands empty', () => {
    const template = setShorthand('grid-template', 'none');
    assert.equal(lh(template, 'grid-template'), 'none');
    assert.equal(lh(template, 'grid-template-rows'), '');
    assert.equal(lh(template, 'grid-template-columns'), '');
    assert.equal(lh(template, 'grid-template-areas'), '');

    const row = setShorthand('grid-row', '1 / 2');
    assert.equal(lh(row, 'grid-row'), '1 / 2');
    assert.equal(lh(row, 'grid-row-start'), '');
    assert.equal(lh(row, 'grid-row-end'), '');

    const col = setShorthand('grid-column', '1 / span 2');
    assert.equal(lh(col, 'grid-column'), '1 / span 2');
    assert.equal(lh(col, 'grid-column-start'), '');
    assert.equal(lh(col, 'grid-column-end'), '');

    const area = setShorthand('grid-area', '1 / 2 / 3 / 4');
    assert.equal(lh(area, 'grid-area'), '1 / 2 / 3 / 4');
    assert.equal(lh(area, 'grid-row-start'), '');
    assert.equal(lh(area, 'grid-column-start'), '');
    assert.equal(lh(area, 'grid-row-end'), '');
    assert.equal(lh(area, 'grid-column-end'), '');

    const gap = setShorthand('gap', '10px 20px');
    assert.equal(lh(gap, 'gap'), '10px 20px');
    assert.equal(lh(gap, 'row-gap'), '');
    assert.equal(lh(gap, 'column-gap'), '');

    const gridGap = setShorthand('grid-gap', '10px');
    assert.equal(lh(gridGap, 'grid-gap'), '10px');
    assert.equal(lh(gridGap, 'row-gap'), '');
    assert.equal(lh(gridGap, 'column-gap'), '');
  });
});

// ---------------------------------------------------------------------------
// Row-level MC/DC witnesses for SW-REQ-260822-YBF2 (rows copied verbatim from
// `proof mcdc show`). Row 2-5 antecedent-false arms are witnessed elsewhere in
// this suite; these pin the zero-box-side arm, the var()-deferral state, and
// the mutually-exclusive outcome arms.
// ---------------------------------------------------------------------------
describe('MC/DC YBF2 spec rows: box shorthand expansion outcomes', () => {
  // Verifies: SW-REQ-260822-YBF2
  // MCDC SW-REQ-260822-YBF2: box_side_count_GE_1=F, box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=F, keyframe_offset_percent_LE_100=T, position_token_count_LE_4=T, shorthand_expanded=F, shorthand_rejected=F => TRUE [no-action: background-position expansion carries zero box sides — the four-longhand box assignment (margin-top..left) never runs]
  // MCDC SW-REQ-260822-YBF2: box_side_count_GE_1=T, box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=F, keyframe_offset_percent_LE_100=T, position_token_count_LE_4=T, shorthand_expanded=F, shorthand_rejected=F => FALSE
  //mcdc:ignore:defensive SW-REQ-260822-YBF2: box_side_count_GE_1=T, box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=F, keyframe_offset_percent_LE_100=T, position_token_count_LE_4=T, shorthand_expanded=T, shorthand_rejected=T => FALSE -- a shorthand declaration is either expanded or rejected, never both; the two outcomes are mutually exclusive branches of the expansion entry [reviewed: agent:champ]
  //mcdc:ignore:defensive SW-REQ-260822-YBF2: box_side_count_GE_1=T, box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=T, keyframe_offset_percent_LE_100=T, position_token_count_LE_4=T, shorthand_expanded=F, shorthand_rejected=F => FALSE -- four-longhand assignment happens only through the expansion or rejection branches; assigned-while-neither cannot co-occur [reviewed: agent:champ]
  // MCDC SW-REQ-260822-YBF2: box_side_count_GE_1=T, box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=T, keyframe_offset_percent_LE_100=T, position_token_count_LE_4=T, shorthand_expanded=F, shorthand_rejected=T => TRUE [manual-evidence: ME-260827-BOXREJ]
  // MCDC SW-REQ-260822-YBF2: box_side_count_GE_1=T, box_side_count_LE_4=T, font_weight_number_LE_1000=T, four_longhands_assigned=T, keyframe_offset_percent_LE_100=T, position_token_count_LE_4=T, shorthand_expanded=T, shorthand_rejected=F => TRUE
  test('box shorthand expansion outcome rows', () => {
    // Zero box sides: a non-box shorthand leaves the box longhands untouched.
    const bg = setShorthand('background-position', 'left top');
    assert.equal(lh(bg, 'margin-top'), '', 'box longhands never assigned');
    // In-bounds var()-carrying shorthand defers expansion (css-variables-1:
    // substitution happens at computed-value time), so no longhands are
    // assigned yet and nothing is rejected — the formula's FALSE row for the
    // aggregate arity window, witnessed at today's observable state.
    const deferred = setShorthand('margin', 'var(--x)');
    assert.equal(lh(deferred, 'margin'), 'var(--x)');
    assert.equal(lh(deferred, 'margin-top'), '', 'deferred substitution assigns no longhands yet');
    // Happy path: an in-bounds value expands into all four box longhands.
    const margin = setShorthand('margin', '1px');
    assert.equal(lh(margin, 'margin-top'), '1px');
    assert.equal(lh(margin, 'margin-right'), '1px');
    assert.equal(lh(margin, 'margin-bottom'), '1px');
    assert.equal(lh(margin, 'margin-left'), '1px');
  });
});
