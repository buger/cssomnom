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
// Round-5 unique-cause leftovers for src/shorthands.ts after
// tests/mcdc-hotspot-shorthands.test.ts, tests/mcdc-hotspot-shorthands-more.test.ts,
// tests/mcdc-hotspot-shorthands-still-hot.test.ts, tests/mcdc-hotspot-contract-background.test.ts,
// tests/mcdc-hotspot-expand-leftover.test.ts, and
// tests/mcdc-shorthands-leftover-unique-cause.test.ts (last recapture 39/49
// package decisions). Drive CSSStyleDeclaration.setProperty / getPropertyValue /
// cssText / removeProperty and stylesheet parse (parse / parseStyleSheet /
// CSSStyleSheet.replaceSync). SHORTHANDS.expand/contract only for
// missing-longhand / synthetic-token pairs the tokenizer cannot produce.
// cssom-1 § 6.7.1 #set-a-css-declaration / § 6.7.2 #serialize-a-css-declaration-block
// / css-backgrounds-3 #the-background / #the-border-shorthands
// / css-box-3 #propdef-margin / #propdef-padding
// / css-logical-1 #logical-shorthand-keyword / css-flexbox-1 #flex-property
// / css-overflow-3 #propdef-line-clamp / css-lists-3 #list-style-property
// / css-fonts-4 #propdef-font / #propdef-font-variant
// / css-cascade-5 #all-shorthand.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { parse, parseStyleSheet } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { serialize } from '../src/serializer.ts';
import { SHORTHANDS, ALL_SHORTHAND_LONGHANDS } from '../src/shorthands.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { CSSStyleRule, CSSStyleSheet } from '../src/CSSOM.ts';
import type { ComponentValue, FunctionToken, SimpleToken } from '../src/types.ts';

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

function parsedStyle(css: string): CSSStyleDeclaration {
  const sheet = parse(css);
  const rule = sheet.cssRules[0];
  assert.ok(rule instanceof CSSStyleRule, `expected CSSStyleRule for ${JSON.stringify(css)}`);
  return rule.style;
}

function replacedStyle(css: string): CSSStyleDeclaration {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  const rule = sheet.cssRules[0];
  assert.ok(rule instanceof CSSStyleRule, `expected CSSStyleRule for replaceSync ${JSON.stringify(css)}`);
  return rule.style;
}

function ident(value: string): ComponentValue {
  return { type: 'ident', value };
}

function delim(value: string): ComponentValue {
  return { type: 'delim', value };
}

function ws(): SimpleToken {
  return { type: 'whitespace', value: ' ' };
}

function fnToken(value: string): FunctionToken {
  return { type: 'function', value };
}

function fnValueNotString(value: number): ComponentValue {
  return { type: 'function', value } as unknown as ComponentValue;
}

function fnNameless(): ComponentValue {
  return { type: 'function' } as ComponentValue;
}

function bgLonghands(overrides: Record<string, ComponentValue[]>): Record<string, ComponentValue[]> {
  return {
    'background-image': comps('none'),
    'background-position': comps('0% 0%'),
    'background-size': comps('auto'),
    'background-repeat': comps('repeat'),
    'background-attachment': comps('scroll'),
    'background-origin': comps('padding-box'),
    'background-clip': comps('border-box'),
    'background-color': comps('transparent'),
    ...overrides,
  };
}

describe('MC/DC round5: contractTwoValue CSS-wide s1===s2 (css-logical-1 #logical-shorthand-keyword)', () => {
  test('L716 inherit===inherit T vs inherit/unset F (leftover covered non-wide L718)', () => {
    // Unique-cause: CSS-wide gate T, s1===s2 T.
    const same = setLonghands({
      'margin-block-start': 'inherit',
      'margin-block-end': 'inherit',
    });
    assert.equal(same.getPropertyValue('margin-block'), 'inherit');
    assert.equal(same.cssText, 'margin-block: inherit;');

    // Unique-cause: CSS-wide gate T, s1===s2 F.
    const mixed = setLonghands({
      'margin-block-start': 'inherit',
      'margin-block-end': 'unset',
    });
    assert.equal(mixed.getPropertyValue('margin-block'), '');

    const padSame = parsedStyle('.x { padding-inline-start: unset; padding-inline-end: unset; }');
    assert.equal(padSame.getPropertyValue('padding-inline'), 'unset');

    const padMixed = replacedStyle('.x { padding-inline-start: revert; padding-inline-end: initial; }');
    assert.equal(padMixed.getPropertyValue('padding-inline'), '');
  });
});

describe('MC/DC round5: contractBox CSS-wide st===sb / st===sl (css-box-3 #propdef-margin)', () => {
  test('L662 unique-cause of st===sb F and st===sl F vs all inherit', () => {
    // Unique-cause: st===sr T, st===sb T, st===sl T (CSS-wide 1-value).
    const all = setLonghands({
      'margin-top': 'inherit',
      'margin-right': 'inherit',
      'margin-bottom': 'inherit',
      'margin-left': 'inherit',
    });
    assert.equal(all.getPropertyValue('margin'), 'inherit');

    // Unique-cause: st===sr T, st===sb F (still-hot unique-caused the non-wide L666 pair).
    const sbDiff = setLonghands({
      'margin-top': 'inherit',
      'margin-right': 'inherit',
      'margin-bottom': 'unset',
      'margin-left': 'inherit',
    });
    assert.equal(sbDiff.getPropertyValue('margin'), '');
    assert.equal(sbDiff.getPropertyValue('margin-bottom'), 'unset');

    // Unique-cause: st===sr T, st===sb T, st===sl F.
    const slDiff = setLonghands({
      'margin-top': 'inherit',
      'margin-right': 'inherit',
      'margin-bottom': 'inherit',
      'margin-left': 'unset',
    });
    assert.equal(slDiff.getPropertyValue('margin'), '');
    slDiff.removeProperty('margin-left');
    assert.equal(slDiff.getPropertyValue('margin'), '');
  });
});

describe('MC/DC round5: contractBox logical sbs===sbe / sbs===sie (css-logical-1 #logical-shorthand-keyword)', () => {
  test('L684 CSS-wide sbs===sbe F; L689 non-wide sbs===sie F with sbe T sis T', () => {
    // Unique-cause: CSS-wide some() T, sbs===sbe F (still-hot unique-caused sis F and sie F).
    const sbeDiff = setLonghands({
      'padding-block-start': 'inherit',
      'padding-inline-start': 'inherit',
      'padding-block-end': 'initial',
      'padding-inline-end': 'inherit',
    });
    assert.equal(sbeDiff.getPropertyValue('padding'), '');
    assert.equal(SHORTHANDS['padding'].contract({
      'padding-block-start': comps('inherit'),
      'padding-inline-start': comps('inherit'),
      'padding-block-end': comps('initial'),
      'padding-inline-end': comps('inherit'),
    }), null);

    assert.equal(SHORTHANDS['padding'].contract({
      'padding-block-start': comps('inherit'),
      'padding-inline-start': comps('inherit'),
      'padding-block-end': comps('inherit'),
      'padding-inline-end': comps('inherit'),
    }), 'inherit');
    const allWide = setLonghands({
      'padding-block-start': 'inherit',
      'padding-inline-start': 'inherit',
      'padding-block-end': 'inherit',
      'padding-inline-end': 'inherit',
    });
    // getPropertyValue serializes the logical 1-value as "logical inherit"
    // (non-wide L689 path); CSS-wide 1-value TTT is the contract() row above.
    assert.equal(allWide.getPropertyValue('padding'), 'logical inherit');

    // Unique-cause: non-wide sbs===sbe T, sbs===sis T, sbs===sie F → 4-value logical.
    const sieDiff = setLonghands({
      'margin-block-start': '1px',
      'margin-inline-start': '1px',
      'margin-block-end': '1px',
      'margin-inline-end': '2px',
    });
    assert.equal(sieDiff.getPropertyValue('margin'), 'logical 1px 1px 1px 2px');

    const sieParsed = parsedStyle(
      '.x { margin-block-start: 1px; margin-inline-start: 1px; margin-block-end: 1px; margin-inline-end: 2px; }',
    );
    assert.equal(sieParsed.getPropertyValue('margin'), 'logical 1px 1px 1px 2px');
  });
});

describe('MC/DC round5: contractBackground v1===no-repeat and empty color (css-backgrounds-3 #the-background)', () => {
  test('L525 v0 T v1 F (repeat space) vs repeat-x; L566 colVal===""', () => {
    // Unique-cause: v0==="repeat" T, v1==="no-repeat" F (not initial "repeat"/"repeat repeat").
    const space = setLonghands({
      'background-image': 'none',
      'background-position': '0% 0%',
      'background-size': 'auto',
      'background-repeat': 'repeat space',
      'background-attachment': 'scroll',
      'background-origin': 'padding-box',
      'background-clip': 'border-box',
      'background-color': 'transparent',
    });
    assert.equal(space.getPropertyValue('background'), 'repeat space');
    assert.equal(space.cssText, 'background: repeat space;');

    // Unique-cause: v0 T, v1 T → repeat-x.
    const repeatX = setLonghands({
      'background-image': 'none',
      'background-position': '0% 0%',
      'background-size': 'auto',
      'background-repeat': 'repeat no-repeat',
      'background-attachment': 'scroll',
      'background-origin': 'padding-box',
      'background-clip': 'border-box',
      'background-color': 'transparent',
    });
    assert.equal(repeatX.getPropertyValue('background'), 'repeat-x');

    // Unique-cause: colVal !== "" F with !=="transparent" T (empty serializes to "").
    // getPropertyValue skips contract when color is missing; inject whitespace.
    assert.equal(SHORTHANDS['background'].contract(bgLonghands({
      'background-color': [ws()],
    })), 'none');
    const red = setLonghands({
      'background-image': 'none',
      'background-position': '0% 0%',
      'background-size': 'auto',
      'background-repeat': 'repeat',
      'background-attachment': 'scroll',
      'background-origin': 'padding-box',
      'background-clip': 'border-box',
      'background-color': 'red',
    });
    assert.equal(red.getPropertyValue('background'), 'red');
  });
});

describe('MC/DC round5: contractBorder s0!==s1 (css-backgrounds-3 #the-border-shorthands)', () => {
  test('L944 unique-cause of first style conjunct T (right-style dashed)', () => {
    const even = style();
    even.setProperty('border', '1px solid red');
    assert.equal(even.getPropertyValue('border-top-style'), 'solid');
    assert.equal(even.getPropertyValue('border').includes('solid'), true);

    // Unique-cause: s0!==s1 T (still-hot unique-caused !==s2 / !==s3).
    even.setProperty('border-right-style', 'dashed');
    assert.equal(even.getPropertyValue('border'), '');
    assert.equal(even.getPropertyValue('border-right-style'), 'dashed');
    assert.equal(even.getPropertyValue('border-top-style'), 'solid');

    const fromSheet = parseStyleSheet('.x { border: 1px solid red; border-right-style: dashed; }');
    assert.ok(fromSheet[0] instanceof CSSStyleRule);
    assert.equal(fromSheet[0].style.getPropertyValue('border'), '');
  });
});

describe('MC/DC round5: contractFlex ss==="1" and CSS-wide sg===sb (css-flexbox-1 #flex-property)', () => {
  test('L1691 sg T ss F (1 0 auto) / ss T auto F (1 1 10px); L1677 inherit inherit unset', () => {
    // Unique-cause: sg==="1" T, ss==="1" F, basis auto (AND false → not the "auto" keyword).
    const shrink0 = setLonghands({
      'flex-grow': '1',
      'flex-shrink': '0',
      'flex-basis': 'auto',
    });
    assert.equal(shrink0.getPropertyValue('flex'), '1 0 auto');
    assert.equal(shrink0.cssText, 'flex: 1 0 auto;');

    // Unique-cause: sg T, ss T, sb auto F.
    const basisPx = setLonghands({
      'flex-grow': '1',
      'flex-shrink': '1',
      'flex-basis': '10px',
    });
    assert.equal(basisPx.getPropertyValue('flex'), '1 1 10px');

    const keywordAuto = setLonghands({
      'flex-grow': '1',
      'flex-shrink': '1',
      'flex-basis': 'auto',
    });
    assert.equal(keywordAuto.getPropertyValue('flex'), 'auto');

    // Unique-cause: CSS-wide sg===ss T, sg===sb F (more.test unique-caused sg===ss F).
    const wide = setLonghands({
      'flex-grow': 'inherit',
      'flex-shrink': 'inherit',
      'flex-basis': 'unset',
    });
    assert.equal(wide.getPropertyValue('flex'), '');
    assert.equal(SHORTHANDS['flex'].contract({
      'flex-grow': comps('inherit'),
      'flex-shrink': comps('inherit'),
      'flex-basis': comps('unset'),
    }), null);
  });
});

describe('MC/DC round5: expandLineClamp v===none F and expandListStyle image OR (css-overflow-3 / css-lists-3)', () => {
  test('L1744 ident auto vs none; L1544 includes F / hasImg T', () => {
    // Unique-cause: length===1 ident T, css-wide F, v==="none" F.
    const auto = style();
    auto.setProperty('line-clamp', 'auto');
    assert.equal(auto.getPropertyValue('max-lines'), 'auto');
    assert.equal(auto.getPropertyValue('line-clamp'), 'auto');

    const none = replacedStyle('.x { line-clamp: none; }');
    assert.equal(none.getPropertyValue('max-lines'), 'none');
    assert.equal(none.getPropertyValue('line-clamp'), 'none');

    const num = parsedStyle('.x { line-clamp: 3; }');
    assert.equal(num.getPropertyValue('max-lines'), '3');

    // Unique-cause: type===url F, type===function T, includes F (rgb is not an image fn).
    const keep = style();
    keep.setProperty('list-style', 'square inside');
    keep.setProperty('list-style', 'rgb(0, 0, 0)');
    assert.equal(keep.getPropertyValue('list-style-type'), 'square', 'non-image function is a no-op');
    assert.equal(SHORTHANDS['list-style'].expand(comps('rgb(0, 0, 0)')), null);

    // Unique-cause: type===function T, includes T, hasImg F (first image).
    const grad = style();
    grad.setProperty('list-style', 'linear-gradient(red, blue)');
    assert.equal(grad.getPropertyValue('list-style-image').includes('linear-gradient'), true);

    // Unique-cause: type===url T, hasImg T (second image).
    keep.setProperty('list-style', 'url(a.png) url(b.png)');
    assert.equal(keep.getPropertyValue('list-style-type'), 'square');
    assert.equal(SHORTHANDS['list-style'].expand(comps('url(a.png) url(b.png)')), null);

    // Unique-cause: function T includes T, hasImg T.
    assert.equal(SHORTHANDS['list-style'].expand(comps('linear-gradient(red, blue) url(a.png)')), null);
  });
});

describe('MC/DC round5: duck-type leftovers (getFunctionName / isCSSWide / font-variant / size/position)', () => {
  test('typeof value==="string" F; nameless function; FunctionToken calc; number 1 size', () => {
    // Unique-cause: getFunctionName "value" in T, typeof === "string" F (leftover had value missing / string).
    assert.equal(SHORTHANDS['font'].expand([fnValueNotString(1), ident('serif')]), null);
    const tokenMin = SHORTHANDS['font'].expand([fnToken('min'), ident('serif')]);
    assert.equal(ser(tokenMin, 'font-size').includes('min'), true);

    // Unique-cause: isCSSWideKeywordOrVar L1900 "value" in T, typeof === "string" F.
    assert.equal(SHORTHANDS['all'].expand([fnValueNotString(1)]), null);
    assert.ok(SHORTHANDS['all'].expand([fnToken('var')]));

    // Unique-cause: expandFontVariant L1223 "value" in token F (name also missing).
    assert.equal(SHORTHANDS['font-variant'].expand([fnNameless()]), null);
    const stylistic = style();
    stylistic.setProperty('font-variant', 'stylistic(foo)');
    assert.equal(stylistic.getPropertyValue('font-variant-alternates').includes('stylistic'), true);

    // Unique-cause: isPositionOrSizeValue "value" in token T (FunctionToken, no name).
    const calcPos = SHORTHANDS['background'].expand([fnToken('calc')]);
    assert.equal(ser(calcPos, 'background-position').includes('calc'), true);

    // Unique-cause: isSizeVal type===number T, value===0 F (`left / 1` is not a size).
    const keepColor = style();
    keepColor.setProperty('background-color', 'red');
    keepColor.setProperty('background', 'left / 1');
    assert.equal(keepColor.getPropertyValue('background-color'), 'red');
    keepColor.setProperty('background', 'left / 0');
    assert.equal(keepColor.getPropertyValue('background-size').includes('0'), true);

    // Unique-cause: isSizeVal "value" in t F after slash (nameless function).
    assert.equal(SHORTHANDS['background'].expand([ident('left'), delim('/'), fnNameless()]), null);

    // Unique-cause: isValidLengthOrPercentage "name" in F (FunctionToken calc) vs nameless.
    const tokenCalc = SHORTHANDS['margin'].expand([fnToken('calc')]);
    assert.equal(ser(tokenCalc, 'margin-top').includes('calc'), true);
    assert.equal(SHORTHANDS['margin'].expand([fnNameless()]), null);

    const namedCalc = style();
    namedCalc.setProperty('margin', 'calc(1px + 2px)');
    assert.equal(namedCalc.getPropertyValue('margin-top').startsWith('calc('), true);
  });
});

describe('MC/DC round5: contractAll !firstVal empty serialize (css-cascade-5 #all-shorthand)', () => {
  test('L1935 whitespace-only longhands vs inherit', () => {
    // Unique-cause: loop fills firstVal with serialize(ws).trim() === "" → !firstVal T.
    // Empty arrays return earlier at valTokens.length === 0 (still-hot).
    const empty: Record<string, ComponentValue[]> = {};
    for (const lh of ALL_SHORTHAND_LONGHANDS) empty[lh] = [ws()];
    assert.equal(SHORTHANDS['all'].contract(empty), null);

    const inherit = style();
    inherit.setProperty('all', 'inherit');
    assert.equal(inherit.getPropertyValue('color'), 'inherit');
    assert.equal(SHORTHANDS['all'].contract(
      Object.fromEntries(ALL_SHORTHAND_LONGHANDS.map((lh) => [lh, comps('inherit')])),
    ), 'inherit');

    const publicVar = parsedStyle('.x { all: var(--x); }');
    assert.equal(publicVar.getPropertyValue('color'), 'var(--x)');
  });
});
