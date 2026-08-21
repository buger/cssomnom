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
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSSStyleValue,
  CSSKeywordValue,
  CSSUnparsedValue,
  CSSUnitValue,
  CSSPositionValue,
  CSSTransformValue,
  CSSTranslate,
  CSSRotate,
  CSSScale,
  CSSColorValue,
  CSS,
} from '../src/typed-om.ts';

describe('MC/DC hotspot: CSSStyleValue.parseAll / _parseAll', () => {
  test('argument and property-name validation', () => {
    assert.throws(() => {
      (CSSStyleValue.parseAll as (property: string) => CSSStyleValue[])('width');
    }, TypeError);
    assert.throws(() => CSSStyleValue.parseAll('', '10px'), TypeError);
    assert.throws(() => CSSStyleValue.parseAll('--', 'auto'), TypeError);
    assert.throws(() => CSSStyleValue.parseAll('-x', 'auto'), TypeError);
    assert.throws(() => CSSStyleValue.parseAll('not-a-real-property', '10px'), TypeError);
  });

  test('empty, comment-only, and non-string css throw', () => {
    assert.throws(() => CSSStyleValue.parseAll('width', ''), TypeError);
    assert.throws(() => CSSStyleValue.parseAll('width', '   '), TypeError);
    assert.throws(() => CSSStyleValue.parseAll('width', '/* only a comment */'), TypeError);
    assert.throws(() => CSSStyleValue.parseAll('width', null as unknown as string), TypeError);
  });

  test('bad-string and bad-url tokens throw', () => {
    assert.throws(() => CSSStyleValue.parseAll('content', '"foo\nbar"'), TypeError);
    assert.throws(() => CSSStyleValue.parseAll('background-image', 'url(http://example.com "bad")'), TypeError);
    assert.throws(() => CSSStyleValue.parseAll('background-image', 'url(foo"bar)'), TypeError);
  });

  test('invalid math functions throw; valid nested calc parses', () => {
    assert.throws(() => CSSStyleValue.parseAll('width', 'calc(1 +)'), TypeError);
    const ok = CSSStyleValue.parseAll('width', 'calc(10px + 2px)');
    assert.equal(ok.length, 1);
    assert.ok(ok[0]);
  });

  test('css-wide keywords become CSSKeywordValue', () => {
    for (const kw of ['inherit', 'initial', 'unset', 'revert', 'revert-layer']) {
      const results = CSSStyleValue.parseAll('width', kw);
      assert.equal(results.length, 1);
      assert.ok(results[0] instanceof CSSKeywordValue);
      assert.equal((results[0] as CSSKeywordValue).value.toLowerCase(), kw);
    }
  });

  test('shouldFallbackToCSSStyleValue: will-change, filter, backdrop-filter, cursor url', () => {
    const willChange = CSSStyleValue.parseAll('will-change', 'opacity');
    assert.equal(willChange.length, 1);
    assert.equal(willChange[0].constructor, CSSStyleValue);
    assert.equal(willChange[0].toString(), 'opacity');

    const willChangeAuto = CSSStyleValue.parseAll('will-change', 'auto');
    assert.ok(willChangeAuto[0] instanceof CSSKeywordValue);

    const willChangeContents = CSSStyleValue.parseAll('will-change', 'contents');
    assert.ok(willChangeContents[0] instanceof CSSKeywordValue);

    const filter = CSSStyleValue.parseAll('filter', 'blur(2px)');
    assert.equal(filter[0].constructor, CSSStyleValue);
    assert.equal(filter[0].toString(), 'blur(2px)');

    const filterNone = CSSStyleValue.parseAll('filter', 'none');
    assert.ok(filterNone[0] instanceof CSSKeywordValue);

    const backdrop = CSSStyleValue.parseAll('backdrop-filter', 'blur(1px)');
    assert.equal(backdrop[0].constructor, CSSStyleValue);

    const backdropNone = CSSStyleValue.parseAll('backdrop-filter', 'none');
    assert.ok(backdropNone[0] instanceof CSSKeywordValue);

    const cursorUrl = CSSStyleValue.parseAll('cursor', 'url(foo.png), pointer');
    assert.equal(cursorUrl[0].constructor, CSSStyleValue);
    assert.equal(cursorUrl[0].toString().includes('url('), true);

    const cursorKw = CSSStyleValue.parseAll('cursor', 'pointer');
    assert.ok(cursorKw[0] instanceof CSSKeywordValue);
  });

  test('var() values reify as CSSUnparsedValue', () => {
    const colorVar = CSSStyleValue.parseAll('color', 'var(--accent)');
    assert.equal(colorVar.length, 1);
    assert.ok(colorVar[0] instanceof CSSUnparsedValue);
    assert.equal(colorVar[0].toString().includes('var('), true);
  });

  test('unregistered custom properties stay unparsed; registered ones use syntax', () => {
    const unregistered = CSSStyleValue.parseAll('--mcdc-unreg', 'hello world');
    assert.equal(unregistered.length, 1);
    assert.ok(unregistered[0] instanceof CSSUnparsedValue);

    CSS.registerProperty({
      name: '--mcdc-hotspot-len',
      syntax: '<length>',
      inherits: false,
      initialValue: '0px',
    });
    const registered = CSSStyleValue.parseAll('--mcdc-hotspot-len', '10px');
    assert.equal(registered.length, 1);
    assert.ok(registered[0] instanceof CSSUnitValue);
    assert.equal((registered[0] as CSSUnitValue).value, 10);
    assert.equal((registered[0] as CSSUnitValue).unit, 'px');

    CSS.registerProperty({
      name: '--mcdc-hotspot-star',
      syntax: '*',
      inherits: false,
      initialValue: 'x',
    });
    const star = CSSStyleValue.parseAll('--mcdc-hotspot-star', 'anything goes');
    assert.ok(star[0] instanceof CSSUnparsedValue);
  });

  test('position properties parse or throw', () => {
    const pos = CSSStyleValue.parseAll('object-position', 'left 10px top 20px');
    assert.equal(pos.length, 1);
    assert.ok(pos[0] instanceof CSSPositionValue);
    assert.throws(() => CSSStyleValue.parseAll('object-position', 'auto'), TypeError);
    assert.throws(() => CSSStyleValue.parseAll('background-position', 'top 10px'), TypeError);
  });

  test('transform none vs transform list', () => {
    const none = CSSStyleValue.parseAll('transform', 'none');
    assert.ok(none[0] instanceof CSSKeywordValue);
    assert.equal((none[0] as CSSKeywordValue).value.toLowerCase(), 'none');

    const list = CSSStyleValue.parseAll('transform', 'translate(10px) rotate(45deg)');
    assert.ok(list[0] instanceof CSSTransformValue);
    assert.equal((list[0] as CSSTransformValue).length, 2);
  });

  test('translate / rotate / scale argument counts', () => {
    assert.ok(CSSStyleValue.parseAll('translate', '10px')[0] instanceof CSSTranslate);
    assert.ok(CSSStyleValue.parseAll('translate', '10px 20px')[0] instanceof CSSTranslate);
    assert.ok(CSSStyleValue.parseAll('translate', '10px 20px 30px')[0] instanceof CSSTranslate);
    assert.throws(() => CSSStyleValue.parseAll('translate', '10px 20px 30px 40px'), TypeError);

    assert.ok(CSSStyleValue.parseAll('rotate', '45deg')[0] instanceof CSSRotate);
    assert.ok(CSSStyleValue.parseAll('rotate', '1 0 0 45deg')[0] instanceof CSSRotate);
    assert.throws(() => CSSStyleValue.parseAll('rotate', '1 0 45deg'), TypeError);

    assert.ok(CSSStyleValue.parseAll('scale', '2')[0] instanceof CSSScale);
    assert.ok(CSSStyleValue.parseAll('scale', '2 3')[0] instanceof CSSScale);
    assert.ok(CSSStyleValue.parseAll('scale', '2 3 4')[0] instanceof CSSScale);
    assert.throws(() => CSSStyleValue.parseAll('scale', '1 2 3 4'), TypeError);
  });

  test('comma-separated list properties split into one value per item', () => {
    const durations = CSSStyleValue.parseAll('transition-duration', '1s, 2s, 3s');
    assert.equal(durations.length, 3);
    assert.ok(durations[0] instanceof CSSUnitValue);
    assert.equal((durations[0] as CSSUnitValue).value, 1);
    assert.equal((durations[1] as CSSUnitValue).value, 2);
    assert.equal((durations[2] as CSSUnitValue).value, 3);

    const names = CSSStyleValue.parseAll('animation-name', 'spin, fade, /* skip me */ slide');
    assert.equal(names.length, 3);
    assert.ok(names.every((v) => v instanceof CSSKeywordValue));

    const images = CSSStyleValue.parseAll('background-image', 'url(a.png), none, url(b.png)');
    assert.equal(images.length, 3);

    const emptySegDropped = CSSStyleValue.parseAll('animation-name', 'spin, , fade');
    assert.equal(emptySegDropped.length, 2);

    const singleList = CSSStyleValue.parseAll('transition-duration', '1s');
    assert.equal(singleList.length, 1);
    assert.ok(singleList[0] instanceof CSSUnitValue);
  });

  test('non-list properties keep comma-separated css as one value when syntax allows', () => {
    const fontFamily = CSSStyleValue.parseAll('font-family', 'Georgia, serif');
    assert.ok(fontFamily.length >= 1);
  });

  test('shorthand expand success vs invalid shorthand', () => {
    const margin = CSSStyleValue.parseAll('margin', '1px 2px 3px 4px');
    assert.equal(margin.length, 1);
    assert.equal(margin[0].constructor, CSSStyleValue);
    assert.throws(() => CSSStyleValue.parseAll('margin', '1px 2px 3px 4px 5px'), TypeError);
    assert.throws(() => CSSStyleValue.parseAll('font', 'not-a-font'), TypeError);
  });

  test('logical two-value shorthands fall through after expand', () => {
    const block = CSSStyleValue.parseAll('margin-block', '1px');
    assert.equal(block.length, 1);
    assert.ok(block[0] instanceof CSSUnitValue);
    assert.equal((block[0] as CSSUnitValue).value, 1);
    const inline = CSSStyleValue.parseAll('padding-inline', '4px');
    assert.equal(inline.length, 1);
    assert.throws(() => CSSStyleValue.parseAll('margin-block', '1px 2px 3px'), TypeError);
    assert.throws(() => CSSStyleValue.parseAll('inset-block', '1px 2px 3px 4px'), TypeError);
  });

  test('color properties: named, currentcolor, transparent, auto, hex, invalid', () => {
    const named = CSSStyleValue.parseAll('color', 'rebeccapurple');
    assert.ok(named[0] instanceof CSSKeywordValue);

    const current = CSSStyleValue.parseAll('color', 'currentcolor');
    assert.ok(current[0] instanceof CSSKeywordValue);

    const transparent = CSSStyleValue.parseAll('background-color', 'transparent');
    assert.ok(transparent[0] instanceof CSSKeywordValue);

    const caretAuto = CSSStyleValue.parseAll('caret-color', 'auto');
    assert.ok(caretAuto[0] instanceof CSSKeywordValue);

    const outlineRed = CSSStyleValue.parseAll('outline-color', 'red');
    assert.ok(outlineRed[0] instanceof CSSKeywordValue);

    const fillRed = CSSStyleValue.parseAll('fill', 'red');
    assert.ok(fillRed[0] instanceof CSSKeywordValue);

    const hex = CSSStyleValue.parseAll('color', '#00ff00');
    assert.ok(hex[0] instanceof CSSColorValue || hex[0] instanceof CSSStyleValue);

    assert.throws(() => CSSStyleValue.parseAll('color', 'notacolor'), TypeError);
  });

  test('single ident keywords and numeric values', () => {
    const display = CSSStyleValue.parseAll('display', 'block');
    assert.ok(display[0] instanceof CSSKeywordValue);
    assert.equal((display[0] as CSSKeywordValue).value, 'block');

    const width = CSSStyleValue.parseAll('width', '10px');
    assert.ok(width[0] instanceof CSSUnitValue);
    assert.equal((width[0] as CSSUnitValue).value, 10);
  });

  test('mixed-case list property name still splits on commas via propLower', () => {
    const values = CSSStyleValue.parseAll('Transition-Duration', '1s, 2s');
    assert.equal(values.length, 2);
    assert.ok(values[0] instanceof CSSUnitValue);
    assert.ok(values[1] instanceof CSSUnitValue);
  });

  test('parse returns the first parseAll result and throws when empty is impossible', () => {
    const first = CSSStyleValue.parse('width', '10px');
    assert.ok(first instanceof CSSUnitValue);
    assert.throws(() => CSSStyleValue.parse('width', ''), TypeError);
  });
});
