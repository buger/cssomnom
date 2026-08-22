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
// Verifies: SYS-REQ-260821-8TGB, SW-REQ-260821-HNRG, SYS-REQ-260821-KV30, SW-REQ-260821-YTV6
// Still-hot unique-cause for src/shorthands.ts leftovers that
// tests/mcdc-hotspot-shorthands.test.ts, tests/mcdc-hotspot-shorthands-more.test.ts,
// tests/mcdc-hotspot-contract-background.test.ts, and
// tests/mcdc-hotspot-expand-leftover.test.ts do not isolate.
// Drive CSSStyleDeclaration.setProperty / getPropertyValue / cssText (cssom-1
// § 6.7.1 #set-a-css-declaration / § 6.7.2 #serialize-a-css-declaration-block)
// and SHORTHANDS.expand/contract for missing-longhand / synthetic-token pairs.
// css-backgrounds-3 #the-background / #the-background-repeat / #the-border-shorthands
// / #the-border-image, css-ui-4 #outline, css-flexbox-1 #flex-property,
// css-lists-3 #list-style-property, css-overflow-3 #propdef-overflow /
// #propdef-line-clamp, css-logical-1 #logical-shorthand-keyword,
// css-fonts-4 #propdef-font / #propdef-font-variant, css-cascade-5 #all-shorthand.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { serialize } from '../src/serializer.ts';
import {
  SHORTHANDS,
  ALL_SHORTHAND_LONGHANDS,
  BORDER_ALL_LONGHANDS,
  FONT_LONGHANDS,
  isInitialBorderImage,
} from '../src/shorthands.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import type { ComponentValue, CSSFunction, FunctionToken, NumberToken } from '../src/types.ts';

function comps(css: string): ComponentValue[] {
  return ParseHooks.parseComponentValues(tokenize(css));
}

function ser(expanded: Record<string, ComponentValue[]> | null, name: string): string {
  assert.ok(expanded, `expected expansion containing ${name}`);
  const tokens = expanded[name];
  assert.ok(tokens, `missing longhand ${name}`);
  return serialize(tokens).trim();
}

function style(): CSSStyleDeclaration {
  return new CSSStyleDeclaration();
}

function setLonghands(pairs: Record<string, string>): CSSStyleDeclaration {
  const decl = style();
  for (const [name, value] of Object.entries(pairs)) {
    decl.setProperty(name, value);
  }
  return decl;
}

function fnParsed(name: string): CSSFunction {
  return { type: 'function', name, value: [] };
}

function fnToken(value: string): FunctionToken {
  return { type: 'function', value };
}

function numberTok(value: number): NumberToken {
  return { type: 'number', value, numberType: 'integer', sign: null };
}

function ident(value: string): ComponentValue {
  return { type: 'ident', value };
}

function delim(value: string): ComponentValue {
  return { type: 'delim', value };
}

function dim(value: number, unit: string): ComponentValue {
  return { type: 'dimension', value, unit, numberType: 'integer', sign: null };
}

function allLonghands(value: string | ComponentValue[]): Record<string, ComponentValue[]> {
  const tokens = typeof value === 'string' ? comps(value) : value;
  const rec: Record<string, ComponentValue[]> = {};
  for (const lh of ALL_SHORTHAND_LONGHANDS) rec[lh] = tokens;
  return rec;
}

function borderLonghands(
  width: string,
  borderStyle: string,
  color: string,
  extras: Record<string, string> = {},
): Record<string, ComponentValue[]> {
  const rec: Record<string, ComponentValue[]> = {};
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    rec[`border-${side}-width`] = comps(extras[`${side}-width`] ?? width);
    rec[`border-${side}-style`] = comps(extras[`${side}-style`] ?? borderStyle);
    rec[`border-${side}-color`] = comps(extras[`${side}-color`] ?? color);
  }
  rec['border-image-source'] = comps(extras.source ?? 'none');
  rec['border-image-slice'] = comps(extras.slice ?? '100%');
  rec['border-image-width'] = comps(extras.imageWidth ?? '1');
  rec['border-image-outset'] = comps(extras.outset ?? '0');
  rec['border-image-repeat'] = comps(extras.repeat ?? 'stretch');
  return rec;
}

describe('MC/DC still-hot: contractFlex unique-cause (css-flexbox-1 #flex-property)', () => {
  test('missing grow XOR shrink XOR basis each independently returns null', () => {
    // Unique-cause g F (existing more.test only omitted shrink).
    assert.equal(SHORTHANDS['flex'].contract({
      'flex-shrink': comps('1'),
      'flex-basis': comps('auto'),
    }), null);
    // Unique-cause b F.
    assert.equal(SHORTHANDS['flex'].contract({
      'flex-grow': comps('1'),
      'flex-shrink': comps('1'),
    }), null);
    assert.equal(SHORTHANDS['flex'].contract({
      'flex-grow': comps('1'),
      'flex-shrink': comps('1'),
      'flex-basis': comps('auto'),
    }), 'auto');
  });

  test('var() unique-cause of grow XOR shrink XOR basis, match vs mismatch', () => {
    const growOnly = setLonghands({
      'flex-grow': 'var(--g)',
      'flex-shrink': '1',
      'flex-basis': 'auto',
    });
    assert.equal(growOnly.getPropertyValue('flex'), '');

    const shrinkOnly = setLonghands({
      'flex-grow': '1',
      'flex-shrink': 'var(--s)',
      'flex-basis': 'auto',
    });
    assert.equal(shrinkOnly.getPropertyValue('flex'), '');

    const basisOnly = setLonghands({
      'flex-grow': '1',
      'flex-shrink': '1',
      'flex-basis': 'var(--b)',
    });
    assert.equal(basisOnly.getPropertyValue('flex'), '');

    const matched = setLonghands({
      'flex-grow': 'var(--x)',
      'flex-shrink': 'var(--x)',
      'flex-basis': 'var(--x)',
    });
    assert.equal(matched.getPropertyValue('flex'), 'var(--x)');

    // Unique-cause sg === ss T, sg === sb F.
    assert.equal(SHORTHANDS['flex'].contract({
      'flex-grow': comps('var(--x)'),
      'flex-shrink': comps('var(--x)'),
      'flex-basis': comps('var(--y)'),
    }), null);
  });

  test('0% and 0 basis unique-cause vs 0px, and 0 1 auto third operand F', () => {
    // ss==="1" canonicalizes 0%/0/0px to "N 1 0px"; unique-cause of sb==="0%"
    // and sb==="0" needs ss!=="1" so the third operand is returned as-is.
    const pctBasis = setLonghands({
      'flex-grow': '2',
      'flex-shrink': '2',
      'flex-basis': '0%',
    });
    assert.equal(pctBasis.getPropertyValue('flex'), '2 2 0%');

    // setProperty('flex-basis','0') stores 0px; unique-cause sb==="0" via contract().
    assert.equal(SHORTHANDS['flex'].contract({
      'flex-grow': comps('2'),
      'flex-shrink': comps('2'),
      'flex-basis': comps('0'),
    }), '2 2 0');

    const zeroPxShrink1 = setLonghands({
      'flex-grow': '2',
      'flex-shrink': '1',
      'flex-basis': '0%',
    });
    assert.equal(zeroPxShrink1.getPropertyValue('flex'), '2 1 0px');

    // Unique-cause sg==="0" T, ss==="1" T, sb auto F (existing TTT is 'initial').
    const notAuto = setLonghands({
      'flex-grow': '0',
      'flex-shrink': '1',
      'flex-basis': '10px',
    });
    assert.equal(notAuto.getPropertyValue('flex'), '0 1 10px');

    const cssWide = setLonghands({
      'flex-grow': 'inherit',
      'flex-shrink': 'inherit',
      'flex-basis': 'inherit',
    });
    assert.equal(cssWide.getPropertyValue('flex'), 'inherit');
  });
});

describe('MC/DC still-hot: normalizePositionTokens leftover (css-backgrounds-3 #the-background)', () => {
  test('2-value ident unique-cause of center/horiz/vert orderings', () => {
    const decl = style();

    decl.setProperty('background', 'center top');
    // Unique-cause v0==="center" && isVert(v1) T: keep order.
    assert.equal(decl.getPropertyValue('background-position'), 'center top');

    decl.setProperty('background', 'center bottom');
    assert.equal(decl.getPropertyValue('background-position'), 'center bottom');

    decl.setProperty('background', 'left center');
    // Unique-cause isHoriz(v0) && v1==="center" T: keep order.
    assert.equal(decl.getPropertyValue('background-position'), 'left center');

    decl.setProperty('background', 'right center');
    assert.equal(decl.getPropertyValue('background-position'), 'right center');

    decl.setProperty('background', 'top center');
    // Unique-cause isVert(v0) && v1==="center" T: swap to horiz then vert.
    assert.equal(decl.getPropertyValue('background-position'), 'center top');

    decl.setProperty('background', 'bottom center');
    assert.equal(decl.getPropertyValue('background-position'), 'center bottom');

    decl.setProperty('background', 'center center');
    // Unique-cause v0==="center" && isVert(v1) F (center is not vert).
    assert.equal(decl.getPropertyValue('background-position'), 'center center');

    decl.setProperty('background', 'left right');
    // Unique-cause isVert(v0) F so the swap-if is false; tokens stay.
    assert.equal(decl.getPropertyValue('background-position'), 'left right');

    decl.setProperty('background', 'top bottom');
    // Unique-cause isHoriz(v1) F.
    assert.equal(decl.getPropertyValue('background-position'), 'top bottom');
  });

  test('1-value 0, 2-value mixed ident+length, 3-value and 4-value pass-through', () => {
    const decl = style();

    decl.setProperty('background', '0');
    // Unique-cause isPositionOrSizeValue number && value===0 T; 1-value non-ident adds 50%.
    const zeroPos = decl.getPropertyValue('background-position');
    assert.equal(zeroPos.includes('0'), true);
    assert.equal(zeroPos.includes('50%'), true);

    decl.setProperty('background', '1');
    // Unique-cause number T, value===0 F: not a position token → expand null (no-op).
    assert.equal(decl.getPropertyValue('background-position'), zeroPos);

    decl.setProperty('background', 'left 10px');
    assert.equal(decl.getPropertyValue('background-position'), 'left 10px');

    decl.setProperty('background', 'left 10px top');
    assert.equal(decl.getPropertyValue('background-position'), 'left 10px top');

    decl.setProperty('background', 'left 10px top 20px');
    assert.equal(decl.getPropertyValue('background-position'), 'left 10px top 20px');
  });

  test('slash size unique-cause of trailing slash, 0, and name-vs-value functions', () => {
    const decl = style();
    decl.setProperty('background-color', 'red');

    // Unique-cause extractSizeTokens slashIdx+1 >= length T.
    decl.setProperty('background', 'center /');
    assert.equal(decl.getPropertyValue('background-color'), 'red');

    decl.setProperty('background', 'left / 0');
    // Unique-cause isSizeVal number && value===0 T.
    assert.equal(decl.getPropertyValue('background-size').includes('0'), true);

    decl.setProperty('background', 'left / 0 10px');
    assert.equal(decl.getPropertyValue('background-size').includes('10px'), true);

    decl.setProperty('background', 'left / 10px 0');
    assert.equal(decl.getPropertyValue('background-size').includes('0'), true);

    decl.setProperty('background', 'left / rgb(1, 2, 3)');
    // Unique-cause function name T, math-fn includes F.
    assert.equal(decl.getPropertyValue('background-size').includes('0'), true);

    const calcTok = SHORTHANDS['background'].expand([
      ident('left'), delim('/'), fnToken('calc'),
    ]);
    // Unique-cause getFunctionName / isSizeVal: "name" in token F, value string T.
    assert.equal(ser(calcTok, 'background-size').includes('calc'), true);

    const namedCalc = SHORTHANDS['background'].expand([
      ident('left'), delim('/'), fnParsed('min'),
    ]);
    assert.equal(ser(namedCalc, 'background-size').includes('min'), true);

    const emptyName = SHORTHANDS['background'].expand([
      ident('left'), delim('/'), { type: 'function', name: '', value: [] },
    ]);
    // Unique-cause isSizeVal name F.
    assert.equal(emptyName, null);

    const valueNotString = SHORTHANDS['background'].expand([
      ident('left'), delim('/'), { type: 'function', value: 1 } as unknown as ComponentValue,
    ]);
    assert.equal(valueNotString, null);
  });
});

describe('MC/DC still-hot: contractBorder unique-cause of each side operand (css-backgrounds-3 #the-border-shorthands)', () => {
  test('width mismatch unique-cause of w0!==w2 and w0!==w3', () => {
    const topRightNeBottom = setLonghands({
      'border-top-width': '1px',
      'border-right-width': '1px',
      'border-bottom-width': '2px',
      'border-left-width': '1px',
      'border-top-style': 'solid',
      'border-right-style': 'solid',
      'border-bottom-style': 'solid',
      'border-left-style': 'solid',
      'border-top-color': 'red',
      'border-right-color': 'red',
      'border-bottom-color': 'red',
      'border-left-color': 'red',
      'border-image-source': 'none',
      'border-image-slice': '100%',
      'border-image-width': '1',
      'border-image-outset': '0',
      'border-image-repeat': 'stretch',
    });
    // Unique-cause w0!==w1 F, w0!==w2 T.
    assert.equal(topRightNeBottom.getPropertyValue('border'), '');

    const leftOnly = setLonghands({
      'border-top-width': '1px',
      'border-right-width': '1px',
      'border-bottom-width': '1px',
      'border-left-width': '2px',
      'border-top-style': 'solid',
      'border-right-style': 'solid',
      'border-bottom-style': 'solid',
      'border-left-style': 'solid',
      'border-top-color': 'red',
      'border-right-color': 'red',
      'border-bottom-color': 'red',
      'border-left-color': 'red',
      'border-image-source': 'none',
      'border-image-slice': '100%',
      'border-image-width': '1',
      'border-image-outset': '0',
      'border-image-repeat': 'stretch',
    });
    // Unique-cause w0!==w1 F, w0!==w2 F, w0!==w3 T.
    assert.equal(leftOnly.getPropertyValue('border'), '');
  });

  test('style and color mismatch unique-cause of !==s2/s3 and !==c2/c3', () => {
    assert.equal(SHORTHANDS['border'].contract(borderLonghands('1px', 'solid', 'red', {
      'bottom-style': 'dashed',
    })), null);
    assert.equal(SHORTHANDS['border'].contract(borderLonghands('1px', 'solid', 'red', {
      'left-style': 'dashed',
    })), null);
    assert.equal(SHORTHANDS['border'].contract(borderLonghands('1px', 'solid', 'red', {
      'bottom-color': 'blue',
    })), null);
    assert.equal(SHORTHANDS['border'].contract(borderLonghands('1px', 'solid', 'red', {
      'left-color': 'blue',
    })), null);

    const allInherit: Record<string, ComponentValue[]> = {};
    for (const lh of BORDER_ALL_LONGHANDS) allInherit[lh] = comps('inherit');
    assert.equal(SHORTHANDS['border'].contract(allInherit), 'inherit');

    const mixedWide = { ...allInherit, 'border-top-width': comps('initial') };
    assert.equal(SHORTHANDS['border'].contract(mixedWide), null);
  });
});

describe('MC/DC still-hot: contractListStyle unique-cause (css-lists-3 #list-style-property)', () => {
  test('missing type XOR image, initial-type with pos/image F, css-wide st===si F', () => {
    assert.equal(SHORTHANDS['list-style'].contract({
      'list-style-position': comps('inside'),
      'list-style-image': comps('none'),
    }), null);
    assert.equal(SHORTHANDS['list-style'].contract({
      'list-style-type': comps('disc'),
      'list-style-position': comps('inside'),
    }), null);

    const insideOnly = setLonghands({
      'list-style-type': 'disc',
      'list-style-position': 'inside',
      'list-style-image': 'none',
    });
    // Unique-cause isInitialType T, isInitialPos F, isInitialImg T.
    assert.equal(insideOnly.getPropertyValue('list-style'), 'inside');

    const imageOnly = setLonghands({
      'list-style-type': 'disc',
      'list-style-position': 'outside',
      'list-style-image': 'url(a.png)',
    });
    // Unique-cause isInitialType T, isInitialPos T, isInitialImg F.
    assert.equal(imageOnly.getPropertyValue('list-style').includes('url('), true);

    const typeOnly = setLonghands({
      'list-style-type': 'square',
      'list-style-position': 'outside',
      'list-style-image': 'none',
    });
    assert.equal(typeOnly.getPropertyValue('list-style'), 'square');

    assert.equal(SHORTHANDS['list-style'].contract({
      'list-style-type': comps('inherit'),
      'list-style-position': comps('inherit'),
      'list-style-image': comps('inherit'),
    }), 'inherit');
    // Unique-cause st===sp T, st===si F.
    assert.equal(SHORTHANDS['list-style'].contract({
      'list-style-type': comps('inherit'),
      'list-style-position': comps('inherit'),
      'list-style-image': comps('initial'),
    }), null);
  });

  test('expandListStyle leftover: url then none, hasPos T second keyword, four tokens', () => {
    const urlThenNone = SHORTHANDS['list-style'].expand(comps('url(a.png) none'));
    // Unique-cause v==="none" with hasImg T, hasType F.
    assert.equal(ser(urlThenNone, 'list-style-type'), 'none');
    assert.equal(ser(urlThenNone, 'list-style-image').includes('url('), true);

    const posThenTypeFromPos = SHORTHANDS['list-style'].expand(comps('inside outside'));
    // Unique-cause includes(inside/outside) T && hasPos T → type path.
    assert.equal(ser(posThenTypeFromPos, 'list-style-position'), 'inside');
    assert.equal(ser(posThenTypeFromPos, 'list-style-type'), 'outside');

    const secondPosReject = SHORTHANDS['list-style'].expand(comps('inside disc outside'));
    assert.equal(secondPosReject, null);

    const imageSet = SHORTHANDS['list-style'].expand(comps('image-set(url(a.png) 1x)'));
    assert.equal(ser(imageSet, 'list-style-image').includes('image-set'), true);

    const noneNone = SHORTHANDS['list-style'].expand(comps('none none'));
    assert.equal(ser(noneNone, 'list-style-type'), 'none');
    assert.equal(ser(noneNone, 'list-style-image'), 'none');
  });
});

describe('MC/DC still-hot: contractOutline / expandOutline leftover (css-ui-4 #outline)', () => {
  test('missing color XOR width, color/style/width-only, css-wide sc===sw F', () => {
    assert.equal(SHORTHANDS['outline'].contract({
      'outline-style': comps('solid'),
      'outline-width': comps('2px'),
    }), null);
    assert.equal(SHORTHANDS['outline'].contract({
      'outline-color': comps('red'),
      'outline-style': comps('solid'),
    }), null);

    assert.equal(SHORTHANDS['outline'].contract({
      'outline-color': comps('red'),
      'outline-style': comps('none'),
      'outline-width': comps('medium'),
    }), 'red');
    assert.equal(SHORTHANDS['outline'].contract({
      'outline-color': comps('currentcolor'),
      'outline-style': comps('solid'),
      'outline-width': comps('medium'),
    }), 'solid');
    assert.equal(SHORTHANDS['outline'].contract({
      'outline-color': comps('currentcolor'),
      'outline-style': comps('none'),
      'outline-width': comps('2px'),
    }), '2px');

    assert.equal(SHORTHANDS['outline'].contract({
      'outline-color': comps('inherit'),
      'outline-style': comps('inherit'),
      'outline-width': comps('inherit'),
    }), 'inherit');
    // Unique-cause sc===ss T, sc===sw F.
    assert.equal(SHORTHANDS['outline'].contract({
      'outline-color': comps('inherit'),
      'outline-style': comps('inherit'),
      'outline-width': comps('initial'),
    }), null);
  });

  test('expandOutline percentage/number/function/string/url and length>3', () => {
    const pctWidth = style();
    pctWidth.setProperty('outline', '50%');
    assert.equal(pctWidth.getPropertyValue('outline-width'), '50%');

    const zero = style();
    zero.setProperty('outline', '0');
    assert.equal(zero.getPropertyValue('outline-width'), '0');

    const fn = style();
    fn.setProperty('outline', 'rgb(1, 2, 3)');
    assert.equal(fn.getPropertyValue('outline-color').includes('rgb'), true);

    const str = SHORTHANDS['outline'].expand(comps('"red"'));
    // Unique-cause else-arm color (string, not hash/function).
    assert.equal(ser(str, 'outline-color').includes('red'), true);

    const url = SHORTHANDS['outline'].expand([{ type: 'url', value: 'a.png' }]);
    assert.equal(ser(url, 'outline-color').includes('a.png'), true);

    assert.equal(SHORTHANDS['outline'].expand(comps('1px solid red extra')), null);

    const autoHash = style();
    autoHash.setProperty('outline', 'thin auto #f00');
    assert.equal(autoHash.getPropertyValue('outline-width'), 'thin');
    assert.equal(autoHash.getPropertyValue('outline-style'), 'auto');
  });
});

describe('MC/DC still-hot: expandBorderImage / contractBorderImage / isInitialBorderImage', () => {
  test('function includes T vs F, length!==1 none, image-set/conic/radial', () => {
    const grad = style();
    grad.setProperty('border-image', 'linear-gradient(red, blue)');
    assert.equal(grad.getPropertyValue('border-image-source').includes('linear-gradient'), true);

    const radial = style();
    radial.setProperty('border-image', 'radial-gradient(red, blue)');
    assert.equal(radial.getPropertyValue('border-image-source').includes('radial-gradient'), true);

    const conic = style();
    conic.setProperty('border-image', 'conic-gradient(red, blue)');
    assert.equal(conic.getPropertyValue('border-image-source').includes('conic-gradient'), true);

    const imageSet = style();
    imageSet.setProperty('border-image', 'image-set(url(a.png) 1x)');
    assert.equal(imageSet.getPropertyValue('border-image-source').includes('image-set'), true);

    const rgb = style();
    rgb.setProperty('border-image-source', 'url(keep.png)');
    rgb.setProperty('border-image', 'rgb(1, 2, 3)');
    // Unique-cause function T, includes F: source stays initial none (not keep.png, expand succeeds).
    assert.equal(rgb.getPropertyValue('border-image-source'), 'none');

    const noneExtra = SHORTHANDS['border-image'].expand(comps('none stretch'));
    // Unique-cause filtered.length === 1 F so v==="none" early-return is skipped.
    assert.equal(ser(noneExtra, 'border-image-source'), 'none');

    const identNotNone = SHORTHANDS['border-image'].expand(comps('stretch'));
    assert.equal(ser(identNotNone, 'border-image-source'), 'none');
  });

  test('contractBorderImage unique-cause of each is*Init F and missing longhands', () => {
    const init = {
      'border-image-source': comps('url(a.png)'),
      'border-image-slice': comps('100%'),
      'border-image-width': comps('1'),
      'border-image-outset': comps('0'),
      'border-image-repeat': comps('stretch'),
    };
    assert.equal(SHORTHANDS['border-image'].contract(init)?.includes('url('), true);

    assert.equal(SHORTHANDS['border-image'].contract({
      ...init, 'border-image-slice': comps('10%'),
    }), null);
    assert.equal(SHORTHANDS['border-image'].contract({
      ...init, 'border-image-width': comps('2'),
    }), null);
    assert.equal(SHORTHANDS['border-image'].contract({
      ...init, 'border-image-outset': comps('1'),
    }), null);
    assert.equal(SHORTHANDS['border-image'].contract({
      ...init, 'border-image-repeat': comps('repeat'),
    }), null);

    assert.equal(SHORTHANDS['border-image'].contract({
      'border-image-source': comps('url(a.png)'),
      'border-image-slice': comps('100% 100% 100% 100%'),
      'border-image-width': comps('1 1 1 1'),
      'border-image-outset': comps('0px'),
      'border-image-repeat': comps('stretch stretch'),
    })?.includes('url('), true);

    assert.equal(SHORTHANDS['border-image'].contract({
      'border-image-source': comps('none'),
      'border-image-slice': comps('100%'),
      'border-image-width': comps('1'),
      'border-image-outset': comps('0s'),
      'border-image-repeat': comps('stretch'),
    }), 'none');

    assert.equal(SHORTHANDS['border-image'].contract({
      'border-image-slice': comps('100%'),
      'border-image-width': comps('1'),
      'border-image-outset': comps('0'),
      'border-image-repeat': comps('stretch'),
    }), null);

    const varMatch = {
      'border-image-source': comps('var(--x)'),
      'border-image-slice': comps('var(--x)'),
      'border-image-width': comps('var(--x)'),
      'border-image-outset': comps('var(--x)'),
      'border-image-repeat': comps('var(--x)'),
    };
    assert.equal(SHORTHANDS['border-image'].contract(varMatch), 'var(--x)');
  });

  test('isInitialBorderImage unique-cause of missing src/width/outset/repeat', () => {
    const sliceOnly = { 'border-image-slice': comps('100%') };
    assert.equal(isInitialBorderImage(sliceOnly), false);

    assert.equal(isInitialBorderImage({
      'border-image-source': comps('none'),
      'border-image-slice': comps('100%'),
      'border-image-outset': comps('0'),
      'border-image-repeat': comps('stretch'),
    }), false);
    assert.equal(isInitialBorderImage({
      'border-image-source': comps('none'),
      'border-image-slice': comps('100%'),
      'border-image-width': comps('1'),
      'border-image-repeat': comps('stretch'),
    }), false);
    assert.equal(isInitialBorderImage({
      'border-image-source': comps('none'),
      'border-image-slice': comps('100%'),
      'border-image-width': comps('1'),
      'border-image-outset': comps('0'),
    }), false);
    assert.equal(isInitialBorderImage({
      'border-image-slice': comps('100%'),
      'border-image-width': comps('1'),
      'border-image-outset': comps('0'),
      'border-image-repeat': comps('stretch'),
    }), false);
  });
});

describe('MC/DC still-hot: formatBorderSideValue / expandBorderSide leftover', () => {
  test('css-wide unique-cause of width XOR style XOR color and wLower===cLower F', () => {
    assert.equal(SHORTHANDS['border-top'].contract({
      'border-top-width': comps('inherit'),
      'border-top-style': comps('inherit'),
      'border-top-color': comps('initial'),
    }), null);
    assert.equal(SHORTHANDS['border-top'].contract({
      'border-top-width': comps('2px'),
      'border-top-style': comps('inherit'),
      'border-top-color': comps('red'),
    }), null);
    assert.equal(SHORTHANDS['border-top'].contract({
      'border-top-width': comps('2px'),
      'border-top-style': comps('solid'),
      'border-top-color': comps('inherit'),
    }), null);
    assert.equal(SHORTHANDS['border-top'].contract({
      'border-top-width': comps('inherit'),
      'border-top-style': comps('solid'),
      'border-top-color': comps('inherit'),
    }), null);

    assert.equal(SHORTHANDS['border-top'].contract({
      'border-top-style': comps('solid'),
      'border-top-color': comps('red'),
    }), null);
    assert.equal(SHORTHANDS['border-top'].contract({
      'border-top-width': comps('2px'),
      'border-top-color': comps('red'),
    }), null);
    assert.equal(SHORTHANDS['border-top'].contract({
      'border-top-width': comps('2px'),
      'border-top-style': comps('solid'),
    }), null);
  });

  test('expandBorderSide percentage/number/string unique-cause', () => {
    const pctWidth = style();
    pctWidth.setProperty('border-top', '50%');
    assert.equal(pctWidth.getPropertyValue('border-top-width'), '50%');

    const zero = style();
    zero.setProperty('border-left', '0');
    assert.equal(zero.getPropertyValue('border-left-width'), '0');

    const str = SHORTHANDS['border-bottom'].expand(comps('"red"'));
    assert.equal(ser(str, 'border-bottom-color').includes('red'), true);

    const rgb = style();
    rgb.setProperty('border-right', 'rgb(1, 2, 3)');
    assert.equal(rgb.getPropertyValue('border-right-color').includes('rgb'), true);
  });
});

describe('MC/DC still-hot: border-block / border-inline expand empty and contract start/end', () => {
  test('expand comment-only is null; contract unique-cause of start XOR end XOR inequality', () => {
    assert.equal(SHORTHANDS['border-block'].expand(comps('')), null);
    assert.equal(SHORTHANDS['border-block'].expand(comps('/* c */')), null);
    assert.equal(SHORTHANDS['border-inline'].expand(comps('')), null);
    assert.equal(SHORTHANDS['border-inline'].expand(comps('/* c */')), null);

    assert.equal(SHORTHANDS['border-block'].contract({
      'border-block-start': comps('1px solid red'),
      'border-block-end': comps('1px solid red'),
    }), '1px solid red');
    assert.equal(SHORTHANDS['border-block'].contract({
      'border-block-start': comps('1px solid red'),
      'border-block-end': comps('2px solid red'),
    }), null);
    assert.equal(SHORTHANDS['border-block'].contract({
      'border-block-start': comps('1px solid red'),
    }), null);
    assert.equal(SHORTHANDS['border-block'].contract({
      'border-block-end': comps('1px solid red'),
    }), null);

    // Unique-cause sVal F / eVal F: fall through to contractBorderSide.
    assert.equal(SHORTHANDS['border-block'].contract({
      'border-block-start-width': comps('1px'),
      'border-block-start-style': comps('solid'),
      'border-block-start-color': comps('red'),
      'border-block-end-width': comps('1px'),
      'border-block-end-style': comps('solid'),
      'border-block-end-color': comps('red'),
    }), '1px solid red');

    assert.equal(SHORTHANDS['border-inline'].contract({
      'border-inline-start': comps('1px solid blue'),
      'border-inline-end': comps('1px solid blue'),
    }), '1px solid blue');
    assert.equal(SHORTHANDS['border-inline'].contract({
      'border-inline-start': comps('1px solid blue'),
    }), null);
    assert.equal(SHORTHANDS['border-inline'].contract({
      'border-inline-end': comps('1px solid blue'),
    }), null);
    assert.equal(SHORTHANDS['border-inline'].contract({
      'border-inline-start-width': comps('2px'),
      'border-inline-start-style': comps('dashed'),
      'border-inline-start-color': comps('green'),
      'border-inline-end-width': comps('2px'),
      'border-inline-end-style': comps('dashed'),
      'border-inline-end-color': comps('green'),
    }), '2px dashed green');
  });
});

describe('MC/DC still-hot: contractBox leftover equality operands (css-box-3 #propdef-margin)', () => {
  test('physical st===sr T then st===sb F / st===sl F', () => {
    const three = setLonghands({
      'margin-top': '1px',
      'margin-right': '1px',
      'margin-bottom': '2px',
      'margin-left': '1px',
    });
    assert.equal(three.getPropertyValue('margin'), '1px 1px 2px');

    const four = setLonghands({
      'margin-top': '1px',
      'margin-right': '1px',
      'margin-bottom': '1px',
      'margin-left': '2px',
    });
    assert.equal(four.getPropertyValue('margin'), '1px 1px 1px 2px');
  });

  test('logical missing lbe/lis/lie unique-cause and css-wide equality F', () => {
    assert.equal(SHORTHANDS['margin'].contract({
      'margin-block-start': comps('1px'),
    }), null);
    assert.equal(SHORTHANDS['margin'].contract({
      'margin-block-start': comps('1px'),
      'margin-block-end': comps('1px'),
    }), null);
    assert.equal(SHORTHANDS['margin'].contract({
      'margin-block-start': comps('1px'),
      'margin-block-end': comps('1px'),
      'margin-inline-start': comps('1px'),
    }), null);

    assert.equal(SHORTHANDS['padding'].contract({
      'padding-block-start': comps('inherit'),
      'padding-inline-start': comps('inherit'),
      'padding-block-end': comps('inherit'),
      'padding-inline-end': comps('inherit'),
    }), 'inherit');
    // Unique-cause sbs===sbe T, sbs===sis F.
    assert.equal(SHORTHANDS['padding'].contract({
      'padding-block-start': comps('inherit'),
      'padding-inline-start': comps('initial'),
      'padding-block-end': comps('inherit'),
      'padding-inline-end': comps('inherit'),
    }), null);
    // Unique-cause sbs===sbe T, sbs===sis T, sbs===sie F.
    assert.equal(SHORTHANDS['padding'].contract({
      'padding-block-start': comps('inherit'),
      'padding-inline-start': comps('inherit'),
      'padding-block-end': comps('inherit'),
      'padding-inline-end': comps('initial'),
    }), null);
  });
});

describe('MC/DC still-hot: contractOverflow leftover (css-overflow-3 #propdef-overflow)', () => {
  test('missing x unique-cause, css-wide sy-only, var sy-only', () => {
    assert.equal(SHORTHANDS['overflow'].contract({
      'overflow-y': comps('hidden'),
    }), null);

    assert.equal(SHORTHANDS['overflow'].contract({
      'overflow-x': comps('hidden'),
      'overflow-y': comps('inherit'),
    }), null);

    const syVar = setLonghands({
      'overflow-x': 'hidden',
      'overflow-y': 'var(--a)',
    });
    assert.equal(syVar.getPropertyValue('overflow'), '');

    const bothVar = setLonghands({
      'overflow-x': 'var(--a)',
      'overflow-y': 'var(--a)',
    });
    assert.equal(bothVar.getPropertyValue('overflow'), 'var(--a)');
  });
});

describe('MC/DC still-hot: getFunctionName / isColorToken / isImageToken name vs value', () => {
  test('parsed CSSFunction name T vs FunctionToken value T vs neither', () => {
    const namedColor = SHORTHANDS['background'].expand([fnParsed('rgb')]);
    assert.equal(ser(namedColor, 'background-color').toLowerCase().includes('rgb'), true);

    const tokenColor = SHORTHANDS['background'].expand([fnToken('hsl')]);
    assert.equal(ser(tokenColor, 'background-color').toLowerCase().includes('hsl'), true);

    const namedImage = SHORTHANDS['background'].expand([fnParsed('linear-gradient')]);
    assert.equal(ser(namedImage, 'background-image').includes('linear-gradient'), true);

    const tokenImage = SHORTHANDS['background'].expand([fnToken('radial-gradient')]);
    assert.equal(ser(tokenImage, 'background-image').includes('radial-gradient'), true);

    const empty = SHORTHANDS['background'].expand([
      { type: 'function' } as unknown as ComponentValue,
    ]);
    assert.equal(empty, null);

    const nameNotString = SHORTHANDS['background'].expand([
      { type: 'function', name: 1, value: [] } as unknown as ComponentValue,
    ]);
    assert.equal(nameNotString, null);

    const identBg = SHORTHANDS['background'].expand([ident('canvas')]);
    assert.equal(ser(identBg, 'background-color'), 'canvas');

    const system = SHORTHANDS['background'].expand([ident('marktext')]);
    assert.equal(ser(system, 'background-color'), 'marktext');
  });
});

describe('MC/DC still-hot: expandFont leftover delim not slash and non-number weight', () => {
  test('delim after size unique-cause of value==="/" F', () => {
    const plus = style();
    plus.setProperty('font', '16px + serif');
    // Unique-cause i<length T, type===delim T, value==="/" F → family includes +.
    assert.equal(plus.getPropertyValue('font-size'), '16px');
    assert.equal(plus.getPropertyValue('font-family').includes('serif'), true);

    const star = style();
    star.setProperty('font', '16px * serif');
    assert.equal(star.getPropertyValue('font-family').includes('serif'), true);
  });

  test('synthetic number whose value is not a number is not a weight', () => {
    const fake = SHORTHANDS['font'].expand([
      { type: 'number', value: '700' as unknown as number, numberType: 'integer', sign: null },
      dim(16, 'px'),
      ident('serif'),
    ]);
    assert.equal(fake, null);

    const real = SHORTHANDS['font'].expand([
      numberTok(700),
      dim(16, 'px'),
      ident('serif'),
    ]);
    assert.equal(ser(real, 'font-weight'), '700');
    assert.equal(ser(real, 'font-size'), '16px');
  });
});

describe('MC/DC still-hot: expandFontVariant none-in-loop and FunctionToken value', () => {
  test('none as a non-first token unique-causes the loop val==="none" T', () => {
    const mixed = style();
    mixed.setProperty('font-variant', 'small-caps none');
    assert.equal(mixed.getPropertyValue('font-variant-caps'), 'small-caps');
    assert.equal(mixed.getPropertyValue('font-variant-ligatures'), 'none');

    const tokenFn = SHORTHANDS['font-variant'].expand([fnToken('stylistic')]);
    assert.equal(ser(tokenFn, 'font-variant-alternates').includes('stylistic'), true);

    const badFn = SHORTHANDS['font-variant'].expand([fnToken('rgb')]);
    assert.equal(badFn, null);

    const remaining = style();
    remaining.setProperty('font-variant', 'no-contextual all-small-caps styleset(foo) oldstyle-nums traditional super unicode');
    assert.equal(remaining.getPropertyValue('font-variant-ligatures'), 'no-contextual');
    assert.equal(remaining.getPropertyValue('font-variant-caps'), 'all-small-caps');
    assert.equal(remaining.getPropertyValue('font-variant-alternates').includes('styleset'), true);
    assert.equal(remaining.getPropertyValue('font-variant-numeric'), 'oldstyle-nums');
    assert.equal(remaining.getPropertyValue('font-variant-east-asian'), 'traditional');
    assert.equal(remaining.getPropertyValue('font-variant-position'), 'super');
    assert.equal(remaining.getPropertyValue('font-variant-emoji'), 'unicode');
  });
});

describe('MC/DC still-hot: expandLineClamp / expandBorderRadius leftover arity', () => {
  test('line-clamp length!==1 unique-cause vs none/css-wide', () => {
    const extra = SHORTHANDS['line-clamp'].expand(comps('none extra'));
    // Unique-cause filtered.length === 1 F: not the none/css-wide early return.
    const extraLines = ser(extra, 'max-lines');
    assert.equal(extraLines.includes('none'), true);
    assert.equal(extraLines.includes('extra'), true);
    assert.notEqual(extraLines.toLowerCase(), 'none');

    const two = SHORTHANDS['line-clamp'].expand(comps('3 none'));
    const twoLines = ser(two, 'max-lines');
    assert.equal(twoLines.includes('3'), true);
    assert.equal(twoLines.includes('none'), true);

    const decl = style();
    decl.setProperty('line-clamp', 'none');
    assert.equal(decl.getPropertyValue('max-lines'), 'none');
  });

  test('border-radius h>4 / v>4 unique-cause with slash, ident not logical', () => {
    assert.equal(SHORTHANDS['border-radius'].expand(comps('1px 2px 3px 4px 5px / 1px')), null);
    assert.equal(SHORTHANDS['border-radius'].expand(comps('1px / 1px 2px 3px 4px 5px')), null);

    const inherit = SHORTHANDS['border-radius'].expand(comps('inherit'));
    // Unique-cause ident T, value==="logical" F.
    assert.equal(ser(inherit, 'border-top-left-radius'), 'inherit');

    const fourSlashFour = style();
    fourSlashFour.setProperty('border-radius', '1px 2px 3px 4px / 5px 6px 7px 8px');
    assert.equal(fourSlashFour.getPropertyValue('border-top-left-radius').includes('1px'), true);
    assert.equal(fourSlashFour.getPropertyValue('border-top-left-radius').includes('5px'), true);
    assert.equal(fourSlashFour.getPropertyValue('border-bottom-left-radius').includes('4px'), true);
    assert.equal(fourSlashFour.getPropertyValue('border-bottom-left-radius').includes('8px'), true);
  });
});

describe('MC/DC still-hot: expandAll / contractAll leftover (css-cascade-5 #all-shorthand)', () => {
  test('expandAll !value, var among tokens, FunctionToken var, non-var function', () => {
    assert.equal(SHORTHANDS['all'].expand(null as unknown as ComponentValue[]), null);
    assert.equal(SHORTHANDS['all'].expand([]), null);

    const tokenVar = SHORTHANDS['all'].expand([fnToken('var')]);
    assert.ok(tokenVar);
    assert.equal(ser(tokenVar, 'color').toLowerCase().includes('var'), true);

    const namedVar = SHORTHANDS['all'].expand([fnParsed('var')]);
    assert.ok(namedVar);

    const rgb = SHORTHANDS['all'].expand([fnParsed('rgb')]);
    assert.equal(rgb, null);

    const mixed = SHORTHANDS['all'].expand(comps('red var(--x)'));
    assert.ok(mixed);
    assert.equal(ser(mixed, 'color').includes('var('), true);
  });

  test('contractAll empty tokens, missing longhand, css-wide vs var vs neither', () => {
    assert.equal(SHORTHANDS['all'].contract(allLonghands('inherit')), 'inherit');
    assert.equal(SHORTHANDS['all'].contract(allLonghands('var(--x)')), 'var(--x)');
    assert.equal(SHORTHANDS['all'].contract(allLonghands('red')), null);

    const emptyFirst = allLonghands('inherit');
    emptyFirst[ALL_SHORTHAND_LONGHANDS[0]] = [];
    assert.equal(SHORTHANDS['all'].contract(emptyFirst), null);

    const missing = allLonghands('inherit');
    delete missing[ALL_SHORTHAND_LONGHANDS[0]];
    assert.equal(SHORTHANDS['all'].contract(missing), null);

    const mismatch = allLonghands('inherit');
    mismatch[ALL_SHORTHAND_LONGHANDS[1]] = comps('initial');
    assert.equal(SHORTHANDS['all'].contract(mismatch), null);
  });
});

describe('MC/DC still-hot: contractFont leftover missing extra variants and empty size/family', () => {
  test('missing extra variant longhands still contract; empty size/family do not', () => {
    const primary: Record<string, ComponentValue[]> = {
      'font-style': comps('italic'),
      'font-variant-caps': comps('normal'),
      'font-weight': comps('700'),
      'font-stretch': comps('normal'),
      'font-size': comps('16px'),
      'line-height': comps('normal'),
      'font-family': comps('serif'),
    };
    // Unique-cause values[extra] F (not present, not "normal").
    assert.equal(SHORTHANDS['font'].contract(primary)?.includes('italic'), true);

    const emptySize = { ...primary, 'font-size': [] };
    assert.equal(SHORTHANDS['font'].contract(emptySize), null);

    const emptyFamily = { ...primary, 'font-family': [] };
    assert.equal(SHORTHANDS['font'].contract(emptyFamily), null);

    const extrasNormal: Record<string, ComponentValue[]> = { ...primary };
    for (const lh of FONT_LONGHANDS) {
      if (!(lh in extrasNormal)) extrasNormal[lh] = comps('normal');
    }
    extrasNormal['font-variant-ligatures'] = comps('normal');
    assert.equal(SHORTHANDS['font'].contract(extrasNormal)?.includes('16px'), true);
  });
});

describe('MC/DC still-hot: mapBoxKeywords 3-keyword leftover and two-clip', () => {
  test('three origins reject; two clips plus origin unique-cause origins.length===1 T', () => {
    assert.equal(SHORTHANDS['background'].expand(comps('padding-box content-box border-box')), null);
    const twoClipOrigin = SHORTHANDS['background'].expand(comps('text border-area content-box'));
    assert.ok(twoClipOrigin);
    assert.equal(ser(twoClipOrigin, 'background-origin'), 'content-box');
    assert.equal(ser(twoClipOrigin, 'background-clip').includes('text'), true);
    assert.equal(ser(twoClipOrigin, 'background-clip').includes('border-area'), true);
  });
});

describe('MC/DC still-hot: contractBorderRadius leftover 3-value and 4-value sides', () => {
  test('tl===tr F then tl===br F; tl===br T and tr===bl F', () => {
    const three = setLonghands({
      'border-top-left-radius': '1px',
      'border-top-right-radius': '2px',
      'border-bottom-right-radius': '3px',
      'border-bottom-left-radius': '2px',
    });
    assert.equal(three.getPropertyValue('border-radius'), '1px 2px 3px');

    const four = setLonghands({
      'border-top-left-radius': '1px',
      'border-top-right-radius': '2px',
      'border-bottom-right-radius': '1px',
      'border-bottom-left-radius': '3px',
    });
    // Unique-cause tl===br T, tr===bl F → 4-value.
    assert.equal(four.getPropertyValue('border-radius'), '1px 2px 1px 3px');
  });
});
