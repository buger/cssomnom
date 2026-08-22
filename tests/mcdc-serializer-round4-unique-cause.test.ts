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
// Verifies: SYS-REQ-260821-KV30, SW-REQ-260821-YTV6
// Round-4 leftover unique-cause for src/serializer.ts unnamed
// serializeDeclarations sides.map (last recapture 10/15 D, 18/23 C,
// 5 incomplete; next seam L1038 longhands) after
// tests/mcdc-hotspot-serializer-more.test.ts,
// tests/mcdc-branch-tokenizer-serializer.test.ts,
// tests/mcdc-serializer-unique-cause.test.ts, and
// tests/mcdc-serializer-still-hot-unique-cause.test.ts.
// Hottest remaining pairable seams: L1035 processed.has(existing) T
// with existing T, and L1041 reconstructed-side checkIntervening T
// (still-hot reconstructed generic-from-top, so sidePrefix was
// border-right/left/bottom with no other propertyToGroup name).
// Drive serialize / cssText / serializeDeclarations.
// cssom-1 § 6.7.2 #serialize-a-css-declaration-block /
// css-backgrounds-3 #the-border-shorthands /
// css-syntax-3 § 8 #serialization.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { parse } from '../src/parser.ts';
import { serialize, serializeDeclarations } from '../src/serializer.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { CSSStyleRule } from '../src/CSSOM.ts';
import type { ComponentValue, Declaration, Token } from '../src/types.ts';

function ident(value: string): Token {
  return { type: 'ident', value };
}
function dim(value: number, unit: string): Token {
  return { type: 'dimension', value, unit, numberType: 'number', sign: null };
}
function ws(value = ' '): Token {
  return { type: 'whitespace', value };
}
function comment(value = '/*x*/'): Token {
  return { type: 'comment', value };
}
function comps(css: string): ComponentValue[] {
  return ParseHooks.parseComponentValues(tokenize(css));
}
function decl(name: string, css: string, important = false): Declaration {
  return { type: 'declaration', name, value: comps(css), important };
}
function hasDecl(cssText: string, name: string): boolean {
  return cssText.split(';').some((part) => part.trim().startsWith(`${name}:`));
}
function parsedCssText(css: string): string {
  const sheet = parse(css);
  const rule = [...sheet.cssRules].find((r) => r instanceof CSSStyleRule) as CSSStyleRule | undefined;
  assert.ok(rule, `expected a style rule in ${JSON.stringify(css)}`);
  return rule.style.cssText;
}

const topLonghands = [
  decl('border-top-width', '1px'),
  decl('border-top-style', 'solid'),
  decl('border-top-color', 'red'),
];
const rightLonghands = [
  decl('border-right-width', '1px'),
  decl('border-right-style', 'solid'),
  decl('border-right-color', 'red'),
];
const bottomSide = decl('border-bottom', '1px solid red');
const leftSide = decl('border-left', '1px solid red');
const rightSide = decl('border-right', '1px solid red');

describe('MC/DC round4 unique-cause: L1035 processed.has(existing) T (cssom-1 #serialize-a-css-declaration-block)', { concurrency: false }, () => {
  test('side shorthand already serialized keeps sides; later longhands still combine to border:', () => {
    // Unique-cause: existing T and processed.has(existing) T — declMap holds
    // the already-emitted side shorthand, so sides.map falls through instead
    // of returning {decl}. still-hot / unique-cause used top-longhands first
    // so processed.has was F.
    const alreadyRight = serializeDeclarations([
      rightSide,
      ...topLonghands,
      bottomSide,
      leftSide,
    ]);
    assert.equal(
      alreadyRight,
      'border-right: 1px solid red; border-top: 1px solid red; border-bottom: 1px solid red; border-left: 1px solid red;',
    );
    assert.equal(hasDecl(alreadyRight, 'border'), false);

    const alreadyLeft = serializeDeclarations([
      leftSide,
      ...topLonghands,
      rightSide,
      bottomSide,
    ]);
    assert.equal(
      alreadyLeft,
      'border-left: 1px solid red; border-top: 1px solid red; border-right: 1px solid red; border-bottom: 1px solid red;',
    );
    assert.equal(hasDecl(alreadyLeft, 'border'), false);

    const alreadyBottom = serializeDeclarations([
      bottomSide,
      ...topLonghands,
      rightSide,
      leftSide,
    ]);
    assert.equal(
      alreadyBottom,
      'border-bottom: 1px solid red; border-top: 1px solid red; border-right: 1px solid red; border-left: 1px solid red;',
    );
    assert.equal(hasDecl(alreadyBottom, 'border'), false);

    // Contrast: processed.has F (existing side not yet visited) → border:.
    const laterRight = serializeDeclarations([
      ...topLonghands,
      rightSide,
      bottomSide,
      leftSide,
    ]);
    assert.equal(laterRight, 'border: 1px solid red;');
  });

  test('already-processed unequal side does not steal border: even when other three match', () => {
    // Unique-cause: processed.has T with existing.value !== generic.value
    // (still-hot mixedSides used unprocessed existing so L1035 took the
    // {decl} return, never the processed.has T fallthrough).
    const unequal = serializeDeclarations([
      decl('border-right', '2px dashed blue'),
      ...topLonghands,
      bottomSide,
      leftSide,
    ]);
    assert.equal(
      unequal,
      'border-right: 2px dashed blue; border-top: 1px solid red; border-bottom: 1px solid red; border-left: 1px solid red;',
    );
    assert.equal(hasDecl(unequal, 'border'), false);
    assert.equal(hasDecl(unequal, 'border-right'), true);
    assert.equal(serialize(comps('2px dashed blue')).includes('dashed'), true);
  });
});

describe('MC/DC round4 unique-cause: L1041 reconstructed-side checkIntervening T (cssom-1 #serialize-a-css-declaration-block)', { concurrency: false }, () => {
  test('generic-from-right reconstructs border-top; radius intervening T vs margin prefix F', () => {
    // Unique-cause: checkIntervening T on reconstructed border-top longhands.
    // sidePrefix is border-top (generic is border-right), so
    // border-top-left-radius starts with sidePrefix + '-' and is in
    // propertyToGroup. still-hot claimed this unpairable because it only
    // reconstructed right/left/bottom from a top generic.
    const radius = serializeDeclarations([
      ...rightLonghands,
      decl('border-top-width', '1px'),
      decl('border-top-left-radius', '4px'),
      decl('border-top-style', 'solid'),
      decl('border-top-color', 'red'),
      bottomSide,
      leftSide,
    ]);
    assert.equal(
      radius,
      'border-right: 1px solid red; border-top-width: 1px; border-top-left-radius: 4px; border-top-style: solid; border-top-color: red; border-bottom: 1px solid red; border-left: 1px solid red;',
    );
    assert.equal(hasDecl(radius, 'border'), false);
    assert.equal(hasDecl(radius, 'border-top'), false);
    assert.equal(hasDecl(radius, 'border-top-left-radius'), true);

    const topRightRadius = serializeDeclarations([
      ...rightLonghands,
      decl('border-top-width', '1px'),
      decl('border-top-right-radius', '8px'),
      decl('border-top-style', 'solid'),
      decl('border-top-color', 'red'),
      bottomSide,
      leftSide,
    ]);
    assert.equal(hasDecl(topRightRadius, 'border'), false);
    assert.equal(hasDecl(topRightRadius, 'border-top-right-radius'), true);
    assert.equal(hasDecl(topRightRadius, 'border-right'), true);

    // Contrast: no intervening → reconstructed top matches → border:.
    const noIntervening = serializeDeclarations([
      ...rightLonghands,
      ...topLonghands,
      bottomSide,
      leftSide,
    ]);
    assert.equal(noIntervening, 'border: 1px solid red;');

    // Unique-cause: interveningGroup T but startsWith(sidePrefix + '-') F
    // (margin-top is in propertyToGroup / group margin).
    const marginBetween = serializeDeclarations([
      ...rightLonghands,
      decl('border-top-width', '1px'),
      decl('margin-top', '1px'),
      decl('border-top-style', 'solid'),
      decl('border-top-color', 'red'),
      bottomSide,
      leftSide,
    ]);
    assert.equal(marginBetween, 'border: 1px solid red; margin-top: 1px;');
  });

  test('reconstructed border-bottom radius intervening; generic-from-left reconstructs top', () => {
    // Unique-cause: reconstructed border-bottom, sidePrefix border-bottom,
    // border-bottom-left-radius starts with that prefix.
    const bottomRadius = serializeDeclarations([
      ...rightLonghands,
      decl('border-bottom-width', '1px'),
      decl('border-bottom-left-radius', '4px'),
      decl('border-bottom-style', 'solid'),
      decl('border-bottom-color', 'red'),
      decl('border-top', '1px solid red'),
      leftSide,
    ]);
    assert.equal(
      bottomRadius,
      'border-right: 1px solid red; border-bottom-width: 1px; border-bottom-left-radius: 4px; border-bottom-style: solid; border-bottom-color: red; border-top: 1px solid red; border-left: 1px solid red;',
    );
    assert.equal(hasDecl(bottomRadius, 'border'), false);
    assert.equal(hasDecl(bottomRadius, 'border-bottom'), false);

    const fromLeft = serializeDeclarations([
      decl('border-left-width', '1px'),
      decl('border-left-style', 'solid'),
      decl('border-left-color', 'red'),
      decl('border-top-width', '1px'),
      decl('border-top-left-radius', '3px'),
      decl('border-top-style', 'solid'),
      decl('border-top-color', 'red'),
      rightSide,
      bottomSide,
    ]);
    assert.equal(
      fromLeft,
      'border-left: 1px solid red; border-top-width: 1px; border-top-left-radius: 3px; border-top-style: solid; border-top-color: red; border-right: 1px solid red; border-bottom: 1px solid red;',
    );
    assert.equal(hasDecl(fromLeft, 'border'), false);
    assert.equal(hasDecl(fromLeft, 'border-top-left-radius'), true);
  });
});

describe('MC/DC round4 unique-cause: reconstructed every / serialize leftover (cssom-1 #serialize-a-css-declaration-block)', { concurrency: false }, () => {
  test('reconstructed value mismatch, important mismatch, and equal !important', () => {
    // Unique-cause: reconstructed r.value === generic.value F (2px vs 1px).
    const mismatch = serializeDeclarations([
      ...rightLonghands,
      decl('border-top-width', '2px'),
      decl('border-top-style', 'solid'),
      decl('border-top-color', 'red'),
      bottomSide,
      leftSide,
    ]);
    assert.equal(
      mismatch,
      'border-right: 1px solid red; border-top: 2px solid red; border-bottom: 1px solid red; border-left: 1px solid red;',
    );
    assert.equal(hasDecl(mismatch, 'border'), false);

    // Unique-cause: reconstructed lh.important === generic.important F
    // (L1040 every). still-hot used existing-side important mismatch.
    const importantMismatch = serializeDeclarations([
      ...rightLonghands,
      decl('border-top-width', '1px', true),
      decl('border-top-style', 'solid', true),
      decl('border-top-color', 'red', true),
      bottomSide,
      leftSide,
    ]);
    assert.equal(
      importantMismatch,
      'border-right: 1px solid red; border-top: 1px solid red !important; border-bottom: 1px solid red; border-left: 1px solid red;',
    );
    assert.equal(hasDecl(importantMismatch, 'border'), false);

    // Unique-cause: generic.important T on reconstructed equal sides → border:.
    const allImportant = serializeDeclarations([
      decl('border-right-width', '1px', true),
      decl('border-right-style', 'solid', true),
      decl('border-right-color', 'red', true),
      decl('border-top-width', '1px', true),
      decl('border-top-style', 'solid', true),
      decl('border-top-color', 'red', true),
      decl('border-bottom', '1px solid red', true),
      decl('border-left', '1px solid red', true),
    ]);
    assert.equal(allImportant, 'border: 1px solid red !important;');
  });

  test('empty / whitespace / comment reconstructed width unique-cause of serialize + filter', () => {
    // Unique-cause: serialize(lh.value).trim() === '' so vals.filter drops it.
    const emptyWidth: Declaration = {
      type: 'declaration',
      name: 'border-top-width',
      value: [],
      important: false,
    };
    const empty = serializeDeclarations([
      ...rightLonghands,
      emptyWidth,
      decl('border-top-style', 'solid'),
      decl('border-top-color', 'red'),
      bottomSide,
      leftSide,
    ]);
    assert.equal(hasDecl(empty, 'border'), false);
    assert.equal(hasDecl(empty, 'border-right'), true);
    assert.equal(empty.includes('border-top:'), true);
    assert.equal(serialize([]), '');
    assert.equal(serialize(emptyWidth.value).trim(), '');

    const wsWidth: Declaration = {
      type: 'declaration',
      name: 'border-top-width',
      value: [ws()],
      important: false,
    };
    const wsOnly = serializeDeclarations([
      ...rightLonghands,
      wsWidth,
      decl('border-top-style', 'solid'),
      decl('border-top-color', 'red'),
      bottomSide,
      leftSide,
    ]);
    assert.equal(hasDecl(wsOnly, 'border'), false);
    assert.equal(serialize([ws()]).trim(), '');

    // Unique-cause: comment serializes to a non-empty string (filter F).
    const commentWidth: Declaration = {
      type: 'declaration',
      name: 'border-top-width',
      value: [comment('/*x*/')],
      important: false,
    };
    const commented = serializeDeclarations([
      ...rightLonghands,
      commentWidth,
      decl('border-top-style', 'solid'),
      decl('border-top-color', 'red'),
      bottomSide,
      leftSide,
    ]);
    assert.equal(commented.includes('/*x*/'), true);
    assert.equal(hasDecl(commented, 'border'), false);
    assert.equal(serialize([comment('/*x*/')]), '/*x*/');
    assert.equal(serialize([dim(1, 'px')]), '1px');
    assert.equal(serialize([ident('solid')]), 'solid');
  });
});

describe('MC/DC round4 unique-cause: cssText expansion vs constructed side shorthands', { concurrency: false }, () => {
  test('setProperty / parse expand sides to longhands; cssText uses border-width not sides.map', () => {
    // Public cssText path expands border-right/top/bottom/left into the 12
    // longhands, so tryCombineBoxShorthand emits border-width/style/color
    // and never reaches the unnamed sides.map (L1032). Contrast with the
    // constructed Declaration names above.
    const style = new CSSStyleDeclaration();
    style.setProperty('border-right', '1px solid red');
    style.setProperty('border-top-width', '1px');
    style.setProperty('border-top-style', 'solid');
    style.setProperty('border-top-color', 'red');
    style.setProperty('border-bottom', '1px solid red');
    style.setProperty('border-left', '1px solid red');
    assert.equal(style.cssText, 'border-width: 1px; border-style: solid; border-color: red;');

    const topFirst = new CSSStyleDeclaration();
    topFirst.setProperty('border-top-width', '1px');
    topFirst.setProperty('border-top-style', 'solid');
    topFirst.setProperty('border-top-color', 'red');
    topFirst.setProperty('border-right', '1px solid red');
    topFirst.setProperty('border-bottom', '1px solid red');
    topFirst.setProperty('border-left', '1px solid red');
    assert.equal(topFirst.cssText, 'border-width: 1px; border-style: solid; border-color: red;');

    assert.equal(
      parsedCssText('div { border-right: 1px solid red; border-top: 1px solid red; border-bottom: 1px solid red; border-left: 1px solid red }'),
      'border-width: 1px; border-style: solid; border-color: red;',
    );

    const intervening = new CSSStyleDeclaration();
    intervening.setProperty('border-right-width', '1px');
    intervening.setProperty('border-right-style', 'solid');
    intervening.setProperty('border-right-color', 'red');
    intervening.setProperty('border-top-width', '1px');
    intervening.setProperty('border-top-left-radius', '4px');
    intervening.setProperty('border-top-style', 'solid');
    intervening.setProperty('border-top-color', 'red');
    intervening.setProperty('border-bottom', '1px solid red');
    intervening.setProperty('border-left', '1px solid red');
    assert.equal(
      intervening.cssText,
      'border-width: 1px; border-style: solid; border-color: red; border-top-left-radius: 4px;',
    );
    assert.equal(
      parsedCssText(
        'div { border-right: 1px solid red; border-top-width: 1px; border-top-left-radius: 4px; border-top-style: solid; border-top-color: red; border-bottom: 1px solid red; border-left: 1px solid red }',
      ),
      'border-width: 1px; border-style: solid; border-color: red; border-top-left-radius: 4px;',
    );
  });
});
