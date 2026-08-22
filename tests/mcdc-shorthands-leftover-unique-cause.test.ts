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
// Leftover unique-cause for src/shorthands.ts after
// tests/mcdc-hotspot-shorthands.test.ts, tests/mcdc-hotspot-shorthands-more.test.ts,
// and tests/mcdc-hotspot-shorthands-still-hot.test.ts. Drive
// CSSStyleDeclaration.setProperty / getPropertyValue / cssText / removeProperty
// and stylesheet parse (parseStyleSheet / CSSStyleSheet.replaceSync) so expand
// and contract run on the real CSSOM path. SHORTHANDS.expand/contract only for
// missing-longhand / synthetic-token pairs the tokenizer cannot produce
// (same injection as the existing shorthand MC/DC tests).
// cssom-1 § 6.7.1 #set-a-css-declaration / § 6.7.2 #serialize-a-css-declaration-block
// / css-backgrounds-3 #the-border-shorthands / #the-background
// / css-fonts-4 #propdef-font / #propdef-font-variant
// / css-flexbox-1 #flex-property / css-ui-4 #outline
// / css-lists-3 #list-style-property / css-cascade-5 #all-shorthand
// / css-logical-1 #logical-shorthand-keyword.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { parse, parseStyleSheet } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { serialize } from '../src/serializer.ts';
import {
  SHORTHANDS,
  FONT_VARIANT_LONGHANDS,
  LIST_STYLE_LONGHANDS,
} from '../src/shorthands.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { CSSStyleRule, CSSStyleSheet } from '../src/CSSOM.ts';
import type {
  CommentToken,
  ComponentValue,
  CSSFunction,
  DelimToken,
  DimensionToken,
  FunctionToken,
  IdentToken,
  NumberToken,
  SimpleToken,
} from '../src/types.ts';

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

function ident(value: string): IdentToken {
  return { type: 'ident', value };
}

function delim(value: string): DelimToken {
  return { type: 'delim', value };
}

function dim(value: number, unit: string): DimensionToken {
  return { type: 'dimension', value, unit, numberType: 'integer', sign: null };
}

function numberTok(value: number): NumberToken {
  return { type: 'number', value, numberType: 'number', sign: null };
}

function ws(): SimpleToken {
  return { type: 'whitespace', value: ' ' };
}

function comment(value: string): CommentToken {
  return { type: 'comment', value };
}

function fnParsed(name: string): CSSFunction {
  return { type: 'function', name, value: [] };
}

function fnToken(value: string): FunctionToken {
  return { type: 'function', value };
}

describe('MC/DC leftover: expandBorderSide filtered.length === 0 vs > 3 (css-backgrounds-3 #the-border-shorthands)', () => {
  test('empty border-top: / comment-only vs 4-token extra vs 1–3 (F,F)', () => {
    // Unique-cause: filtered.length === 0 T, length > 3 F. Empty declaration
    // cannot go through setProperty('') (that is removeProperty); parse /
    // replaceSync / cssText still call expandBorderSide.
    const emptyParsed = parsedStyle('.x { border-top: ; }');
    assert.equal(emptyParsed.getPropertyValue('border-top-width'), '');
    assert.equal(emptyParsed.getPropertyValue('border-top-style'), '');
    assert.equal(emptyParsed.cssText.includes('border-top'), true);

    const emptyReplaced = replacedStyle('.x { border-top: ; }');
    assert.equal(emptyReplaced.getPropertyValue('border-top-width'), '');
    emptyReplaced.removeProperty('border-top');
    assert.equal(emptyReplaced.cssText, '');

    const emptyCssText = style();
    emptyCssText.cssText = 'border-top: ;';
    assert.equal(emptyCssText.getPropertyValue('border-top-style'), '');

    // Comment-only: tokenizer yields no ident, expand null, setProperty is a no-op.
    const commentOnly = style();
    commentOnly.setProperty('border-top-width', '9px');
    commentOnly.setProperty('border-top', '/* comment */');
    assert.equal(commentOnly.getPropertyValue('border-top-width'), '9px');
    assert.equal(SHORTHANDS['border-top'].expand(comps('/* comment */')), null);
    assert.equal(SHORTHANDS['border-top'].expand(comps('')), null);

    // Unique-cause: filtered.length === 0 F, length > 3 T.
    const extra = style();
    extra.setProperty('border-top-width', '9px');
    extra.setProperty('border-top', '1px solid red extra');
    assert.equal(extra.getPropertyValue('border-top-width'), '9px', '4-token border-top is a no-op');
    const extraParsed = parsedStyle('.x { border-left: 1px solid red extra; }');
    assert.equal(extraParsed.getPropertyValue('border-left-width'), '');
    assert.equal(extraParsed.getPropertyValue('border-left').includes('extra'), true);

    // Unique-cause: both F (length 1, 2, 3).
    const one = style();
    one.setProperty('border-top', 'solid');
    assert.equal(one.getPropertyValue('border-top-style'), 'solid');
    assert.equal(one.getPropertyValue('border-top-width'), 'medium');
    assert.equal(one.getPropertyValue('border-top-color'), 'currentcolor');

    const two = style();
    two.setProperty('border-right', '1px dashed');
    assert.equal(two.getPropertyValue('border-right-width'), '1px');
    assert.equal(two.getPropertyValue('border-right-style'), 'dashed');

    const three = parsedStyle('.x { border-bottom: 1px solid red; }');
    assert.equal(three.getPropertyValue('border-bottom-width'), '1px');
    assert.equal(three.getPropertyValue('border-bottom-style'), 'solid');
    assert.equal(three.getPropertyValue('border-bottom-color'), 'red');

    const fromSheet = parseStyleSheet('.x { border-top: solid; }');
    assert.ok(fromSheet[0] instanceof CSSStyleRule);
    assert.equal(fromSheet[0].style.getPropertyValue('border-top-style'), 'solid');
  });
});

describe('MC/DC leftover: expandFont familyVal while and lineHeightVal (css-fonts-4 #propdef-font)', () => {
  test('comment T whitespace F vs whitespace T vs neither; lastConsumed present', () => {
    // Tokenizer never emits type==='comment' (comments become whitespace /
    // originalText). Inject comment tokens the same way still-hot injects
    // FunctionToken so the while OR is unique-caused.
    const size = dim(16, 'px');
    const slash = delim('/');
    const lh = numberTok(1.2);
    const fam = ident('serif');

    const commentFirst = SHORTHANDS['font'].expand([size, slash, lh, comment('c'), fam]);
    assert.equal(ser(commentFirst, 'font-size'), '16px');
    assert.equal(ser(commentFirst, 'line-height'), '1.2');
    assert.equal(ser(commentFirst, 'font-family'), 'serif');

    const wsFirst = SHORTHANDS['font'].expand([size, slash, lh, ws(), fam]);
    assert.equal(ser(wsFirst, 'font-family'), 'serif');

    const neither = SHORTHANDS['font'].expand([size, slash, lh, fam]);
    assert.equal(ser(neither, 'font-family'), 'serif');

    const wsThenComment = SHORTHANDS['font'].expand([
      size, slash, lh, ws(), comment('c'), fam,
    ]);
    assert.equal(ser(wsThenComment, 'font-family'), 'serif');

    // Public path: explicit line-height so lastConsumed is the lh token
    // (lineHeightVal.length > 0 T) vs omitted slash (synthetic normal, still T).
    const withLh = style();
    withLh.setProperty('font', '16px / 1.2 serif');
    assert.equal(withLh.getPropertyValue('line-height'), '1.2');
    assert.equal(withLh.getPropertyValue('font-family'), 'serif');

    const noLh = style();
    noLh.setProperty('font', '16px serif');
    assert.equal(noLh.getPropertyValue('line-height'), 'normal');
    assert.equal(noLh.getPropertyValue('font-family'), 'serif');

    // Remaining after lh is only comments → filtered is empty, L1400 returns
    // null before the while (familyVal.length > 0 F is not reachable there).
    const noFamily = style();
    noFamily.setProperty('font-size', '20px');
    noFamily.setProperty('font', '16px / 1.2 /*c*/');
    assert.equal(noFamily.getPropertyValue('font-size'), '20px');
  });
});

describe('MC/DC leftover: expandFlex grow===null && basis===null (css-flexbox-1 #flex-property)', () => {
  test('one null vs both present; both-null is an earlier return', () => {
    // Unique-cause grow === null F, basis === null T.
    const growOnly = style();
    growOnly.setProperty('flex', '3');
    assert.equal(growOnly.getPropertyValue('flex-grow'), '3');
    assert.equal(growOnly.getPropertyValue('flex-basis'), '0px');

    // Unique-cause grow === null T, basis === null F.
    const basisOnly = style();
    basisOnly.setProperty('flex', '20%');
    assert.equal(basisOnly.getPropertyValue('flex-grow'), '1');
    assert.equal(basisOnly.getPropertyValue('flex-basis'), '20%');

    // Unique-cause both F (AND false).
    const both = style();
    both.setProperty('flex', '3 20%');
    assert.equal(both.getPropertyValue('flex-grow'), '3');
    assert.equal(both.getPropertyValue('flex-basis'), '20%');

    // Both-null after the loop: empty/comment hits filtered.length === 0;
    // junk ident returns inside the loop. Neither reaches L1652.
    const emptyFlex = parsedStyle('.x { flex: ; }');
    assert.equal(emptyFlex.getPropertyValue('flex-grow'), '');
    const junk = style();
    junk.setProperty('flex-grow', '9');
    junk.setProperty('flex', 'solid');
    assert.equal(junk.getPropertyValue('flex-grow'), '9');
  });
});

describe('MC/DC leftover: contractSide tl===tr && tl===br && tl===bl (css-backgrounds-3 #border-radius)', () => {
  test('unique-cause of each equality in the 1-value collapse', () => {
    // All T → 1-value.
    const all = setLonghands({
      'border-top-left-radius': '1px',
      'border-top-right-radius': '1px',
      'border-bottom-right-radius': '1px',
      'border-bottom-left-radius': '1px',
    });
    assert.equal(all.getPropertyValue('border-radius'), '1px');

    // Unique-cause tl===tr F.
    const trDiff = setLonghands({
      'border-top-left-radius': '1px',
      'border-top-right-radius': '2px',
      'border-bottom-right-radius': '1px',
      'border-bottom-left-radius': '2px',
    });
    assert.equal(trDiff.getPropertyValue('border-radius'), '1px 2px');

    // Unique-cause tl===tr T, tl===br F.
    const brDiff = style();
    brDiff.setProperty('border-radius', '1px 1px 2px 1px');
    assert.equal(brDiff.getPropertyValue('border-radius'), '1px 1px 2px');

    // Unique-cause tl===tr T, tl===br T, tl===bl F.
    const blDiff = replacedStyle('.x { border-radius: 1px 1px 1px 2px; }');
    assert.equal(blDiff.getPropertyValue('border-radius'), '1px 1px 1px 2px');
  });
});

describe('MC/DC leftover: getFunctionName duck-types (name vs value vs neither)', () => {
  test('type===function call-site T vs F; name string; name-not-string value string; value in F', () => {
    // Call-site type==='function' T with CSSFunction name string T.
    const named = style();
    named.setProperty('font', 'calc(1em + 2px) serif');
    assert.equal(named.getPropertyValue('font-size').startsWith('calc('), true);

    // Call-site type==='function' F: dimension size never enters getFunctionName.
    const dimSize = style();
    dimSize.setProperty('font', '16px serif');
    assert.equal(dimSize.getPropertyValue('font-size'), '16px');

    // FunctionToken: "name" in token F, value string T.
    const tokenCalc = SHORTHANDS['font'].expand([fnToken('min'), ident('serif')]);
    assert.equal(ser(tokenCalc, 'font-size').includes('min'), true);

    // Unique-cause: "name" in T, typeof name === 'string' F, value string T.
    // serialize() cannot print name:1; assert the longhand token instead.
    const nameNotString = SHORTHANDS['font'].expand([
      { type: 'function', name: 1, value: 'clamp' } as unknown as ComponentValue,
      ident('serif'),
    ]);
    assert.ok(nameNotString);
    const sizeTok = nameNotString['font-size'][0] as { type: string; value?: unknown };
    assert.equal(sizeTok.type, 'function');
    assert.equal(sizeTok.value, 'clamp');

    // Unique-cause: name not string, "value" in token F → getFunctionName ''.
    const valueMissing = SHORTHANDS['font'].expand([
      { type: 'function', name: 1 } as unknown as ComponentValue,
      ident('serif'),
    ]);
    assert.equal(valueMissing, null);

    // Unique-cause: "name" in F, "value" in F.
    const neither = SHORTHANDS['font'].expand([
      { type: 'function' } as unknown as ComponentValue,
      ident('serif'),
    ]);
    assert.equal(neither, null);

    // name string T on line-height math fn.
    const lhNamed = style();
    lhNamed.setProperty('font', '16px / max(1, 2) serif');
    assert.equal(lhNamed.getPropertyValue('line-height').startsWith('max('), true);
  });
});

describe('MC/DC leftover: isCSSWideKeywordOrVar duck-types (css-cascade-5 #all-shorthand)', () => {
  test('single-token L1900 and some() L1908 name/value ducks vs ident', () => {
    // length===1 CSSFunction name string T, var T.
    const namedVar = SHORTHANDS['all'].expand([fnParsed('var')]);
    assert.ok(namedVar);

    // length===1 FunctionToken: "name" in F, value string T.
    const tokenVar = SHORTHANDS['all'].expand([fnToken('var')]);
    assert.ok(tokenVar);

    // Unique-cause: name not string, value string 'var'.
    const duckVar = SHORTHANDS['all'].expand([
      { type: 'function', name: 1, value: 'var' } as unknown as ComponentValue,
    ]);
    assert.ok(duckVar);

    // Unique-cause: name not string, "value" in F.
    assert.equal(SHORTHANDS['all'].expand([
      { type: 'function', name: 1 } as unknown as ComponentValue,
    ]), null);

    // Unique-cause: "name" in F, "value" in F.
    assert.equal(SHORTHANDS['all'].expand([
      { type: 'function' } as unknown as ComponentValue,
    ]), null);

    // length===1 ident css-wide T vs non-keyword F.
    const inheritDecl = style();
    inheritDecl.setProperty('color', 'blue');
    inheritDecl.setProperty('all', 'inherit');
    assert.equal(inheritDecl.getPropertyValue('color'), 'inherit');
    inheritDecl.setProperty('all', 'red');
    assert.equal(inheritDecl.getPropertyValue('color'), 'inherit');

    // L1908 some(): type!==function F unique-cause (ident) then var T.
    const mixed = SHORTHANDS['all'].expand([ident('red'), fnParsed('var')]);
    assert.ok(mixed);
    const mixedDuck = SHORTHANDS['all'].expand([
      ident('red'),
      { type: 'function', name: 1, value: 'var' } as unknown as ComponentValue,
    ]);
    assert.ok(mixedDuck);
    assert.equal(SHORTHANDS['all'].expand([ident('red'), ident('blue')]), null);
    assert.equal(SHORTHANDS['all'].expand([
      ident('red'),
      { type: 'function' } as unknown as ComponentValue,
    ]), null);

    const publicVar = style();
    publicVar.setProperty('all', 'var(--x)');
    assert.equal(publicVar.getPropertyValue('color'), 'var(--x)');
  });
});

describe('MC/DC leftover: contractBox t && r && b && l unique-cause of b, l', () => {
  test('t T r T then b F / l F vs all present', () => {
    // getPropertyValue skips contract when a physical longhand is missing;
    // unique-cause of the AND uses SHORTHANDS.contract like still-hot.
    assert.equal(SHORTHANDS['margin'].contract({
      'margin-top': comps('1px'),
      'margin-right': comps('1px'),
      'margin-left': comps('1px'),
    }), null, 'b F with t T r T l T');

    assert.equal(SHORTHANDS['padding'].contract({
      'padding-top': comps('1px'),
      'padding-right': comps('1px'),
      'padding-bottom': comps('1px'),
    }), null, 'l F with t T r T b T');

    const all = setLonghands({
      'margin-top': '1px',
      'margin-right': '1px',
      'margin-bottom': '1px',
      'margin-left': '1px',
    });
    assert.equal(all.getPropertyValue('margin'), '1px');

    const missingLeft = setLonghands({
      'margin-top': '1px',
      'margin-right': '1px',
      'margin-bottom': '1px',
    });
    assert.equal(missingLeft.getPropertyValue('margin'), '');
  });
});

describe('MC/DC leftover: normalizePositionTokens v==="center" F (css-backgrounds-3 #the-background)', () => {
  test('1-value ident center T vs auto/cover/contain F', () => {
    const decl = style();
    decl.setProperty('background', 'center');
    assert.equal(decl.getPropertyValue('background-position'), 'center center');

    decl.setProperty('background', 'auto');
    // Unique-cause: ident T, not left/right/top/bottom, v==="center" F.
    assert.equal(decl.getPropertyValue('background-position'), 'auto');

    decl.setProperty('background', 'cover');
    assert.equal(decl.getPropertyValue('background-position'), 'cover');

    decl.setProperty('background', 'contain');
    assert.equal(decl.getPropertyValue('background-position'), 'contain');

    decl.setProperty('background', 'left');
    assert.equal(decl.getPropertyValue('background-position').includes('left'), true);
    assert.equal(decl.getPropertyValue('background-position').includes('center'), true);
  });
});

describe('MC/DC leftover: expandBackground numLayers===0 vs empty layer', () => {
  test('empty / comment-only background expand null (layerClean empty, not numLayers 0)', () => {
    const empty = parsedStyle('.x { background: ; }');
    assert.equal(empty.getPropertyValue('background-image'), '');
    assert.equal(empty.cssText.includes('background'), true);

    const commentBg = style();
    commentBg.setProperty('background-color', 'red');
    commentBg.setProperty('background', '/* c */');
    assert.equal(commentBg.getPropertyValue('background-color'), 'red');

    assert.equal(SHORTHANDS['background'].expand([]), null);
    assert.equal(SHORTHANDS['background'].expand(comps('/* c */')), null);

    const ok = replacedStyle('.x { background: red; }');
    assert.equal(ok.getPropertyValue('background-color'), 'red');
  });
});

describe('MC/DC leftover: contractTwoValue s1===s2 T (non-css-wide)', () => {
  test('margin-block / padding-inline collapse vs two values', () => {
    const same = setLonghands({
      'margin-block-start': '10px',
      'margin-block-end': '10px',
    });
    assert.equal(same.getPropertyValue('margin-block'), '10px');

    const diff = setLonghands({
      'margin-block-start': '10px',
      'margin-block-end': '20px',
    });
    assert.equal(diff.getPropertyValue('margin-block'), '10px 20px');

    const padSame = parsedStyle('.x { padding-inline: 4px; }');
    assert.equal(padSame.getPropertyValue('padding-inline'), '4px');
    padSame.setProperty('padding-inline-end', '8px');
    assert.equal(padSame.getPropertyValue('padding-inline'), '4px 8px');
  });
});

describe('MC/DC leftover: all-initial longhands contract to the spec default', () => {
  test('border-top / outline / list-style all-initial (parts.length===0 is dead after the early return)', () => {
    const border = setLonghands({
      'border-top-width': 'medium',
      'border-top-style': 'none',
      'border-top-color': 'currentcolor',
    });
    assert.equal(border.getPropertyValue('border-top'), 'none');
    assert.equal(border.cssText, 'border-top: none;');

    const outline = setLonghands({
      'outline-color': 'currentcolor',
      'outline-style': 'none',
      'outline-width': 'medium',
    });
    assert.equal(outline.getPropertyValue('outline'), 'none');
    assert.equal(outline.cssText, 'outline: none;');

    const list: Record<string, string> = {};
    for (const lh of LIST_STYLE_LONGHANDS) {
      list[lh] = lh === 'list-style-type' ? 'disc' : lh === 'list-style-position' ? 'outside' : 'none';
    }
    const listDecl = setLonghands(list);
    assert.equal(listDecl.getPropertyValue('list-style'), 'disc');
    assert.equal(listDecl.cssText, 'list-style: disc;');

    const nonInitial = setLonghands({
      'border-top-width': 'medium',
      'border-top-style': 'solid',
      'border-top-color': 'currentcolor',
    });
    assert.equal(nonInitial.getPropertyValue('border-top'), 'solid');
  });

  test('font-variant all-normal (nonNormal.length===0 is dead after every===normal)', () => {
    const pairs: Record<string, string> = {};
    for (const lh of FONT_VARIANT_LONGHANDS) pairs[lh] = 'normal';
    const allNormal = setLonghands(pairs);
    assert.equal(allNormal.getPropertyValue('font-variant'), 'normal');
    assert.equal(allNormal.cssText, 'font-variant: normal;');

    allNormal.setProperty('font-variant-caps', 'small-caps');
    assert.equal(allNormal.getPropertyValue('font-variant'), 'small-caps');
  });
});
