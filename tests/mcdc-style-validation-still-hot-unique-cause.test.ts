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
// Still-hot unique-cause leftovers for src/typed-om/style-map/style-validation.ts
// matchesStyleValueSyntax (21/29 decisions, 36/48 conditions, 8 incomplete)
// after tests/mcdc-stylemap-leftover-unique-cause.test.ts. Drive public
// CSSStyleValue.parse then StylePropertyMap.set / element.attributeStyleMap.set.
// css-typed-om-1 § 3.2 #the-stylepropertymap / § 6.6 #parse-a-cssstylevalue,
// css-properties-values-api-1 § 3 #syntax-strings.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { patchWindowForTypedOM } from './wpt-shim.ts';
import '../src/parser.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import {
  CSS,
  CSSStyleValue,
  CSSKeywordValue,
  CSSUnparsedValue,
  CSSUnitValue,
  CSSImageValue,
  CSSRGB,
  CSSPositionValue,
  CSSTransformValue,
  CSSTranslate,
  CSSRotate,
  CSSScale,
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

let seq = 0;
function register(syntax: string, initialValue: string): string {
  seq += 1;
  const name = `--mcdc-svs-${seq}`;
  CSS.registerProperty({ name, syntax, inherits: false, initialValue });
  return name;
}

function assertType(fn: () => unknown): void {
  assert.throws(fn, TypeError);
}

function assertAssociated(fn: () => unknown, from: string, to: string): void {
  assert.throws(fn, (err: unknown) => {
    assert.ok(err instanceof TypeError, `expected TypeError, got ${String(err)}`);
    assert.match(
      (err as TypeError).message,
      new RegExp(`associated with ${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, not ${to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    );
    return true;
  });
}

describe('MC/DC still-hot unique-cause: matchesStyleValueSyntax L200 associated AND (css-typed-om-1 § 3.2)', { concurrency: false }, () => {
  test('_associatedProperty !== null F vs T and !== propKey T vs F via parse then set', () => {
    const { map, el } = attrMap();

    // constructor === CSSStyleValue (shorthand / fallback). parse stamps associated.
    const margin = CSSStyleValue.parse('margin', '1px 2px');
    assert.equal(margin.constructor, CSSStyleValue);
    assert.equal(margin._associatedProperty, 'margin');
    // Unique-cause: !== null T, !== propKey F (same key, including mixed case).
    map.set('margin', margin);
    assert.equal(el.style.getPropertyValue('margin'), '1px 2px');
    map.set('MARGIN', margin);
    assert.equal(map.get('margin')?.toString(), '1px 2px');
    // Unique-cause: !== null T, !== propKey T — validateValuesForProperty throws
    // before matchesStyleValueSyntax, so L200 (T,T)→false is not reached.
    assertAssociated(() => map.set('padding', margin), 'margin', 'padding');
    assertAssociated(() => map.set('width', margin), 'margin', 'width');

    const filter = CSSStyleValue.parse('filter', 'blur(1px)');
    assert.equal(filter.constructor, CSSStyleValue);
    assert.equal(filter._associatedProperty, 'filter');
    map.set('filter', filter);
    assert.equal(el.style.getPropertyValue('filter'), 'blur(1px)');
    map.set('FILTER', filter);
    assertAssociated(() => map.set('backdrop-filter', filter), 'filter', 'backdrop-filter');

    const willChange = CSSStyleValue.parse('will-change', 'scroll-position');
    assert.equal(willChange.constructor, CSSStyleValue);
    map.set('will-change', willChange);
    assertAssociated(() => map.set('color', willChange), 'will-change', 'color');

    const cursor = CSSStyleValue.parse('cursor', 'url(a.png), pointer');
    assert.equal(cursor.constructor, CSSStyleValue);
    map.set('cursor', cursor);
    assertAssociated(() => map.set('outline', cursor), 'cursor', 'outline');

    const font = CSSStyleValue.parse('font', '16px serif');
    assert.equal(font.constructor, CSSStyleValue);
    map.set('font', font);
    assertAssociated(() => map.set('font-size', font), 'font', 'font-size');

    const gap = CSSStyleValue.parse('gap', '1px 2px');
    assert.equal(gap.constructor, CSSStyleValue);
    map.set('gap', gap);
    assertAssociated(() => map.set('margin', gap), 'gap', 'margin');

    // CSSUnitValue from parse: associated T, same-key F vs other-key T (L327, not L200).
    const width = CSSStyleValue.parse('width', '10px');
    assert.ok(width instanceof CSSUnitValue);
    assert.equal(width._associatedProperty, 'width');
    map.set('width', width);
    assert.equal(el.style.getPropertyValue('width'), '10px');
    assertAssociated(() => map.set('height', width), 'width', 'height');
    const height = CSSStyleValue.parse('height', '20px');
    map.set('height', height);
    assertAssociated(() => map.set('width', height), 'height', 'width');

    // Unique-cause: !== null F (constructed, never parsed). Skips L200 (constructor !== CSSStyleValue).
    const constructed = CSS.px(12);
    assert.equal(constructed._associatedProperty, null);
    map.set('width', constructed);
    assert.equal(el.style.getPropertyValue('width'), '12px');
    map.set('min-width', CSS.px(8));
  });
});

describe('MC/DC still-hot unique-cause: matchesStyleValueSyntax keyword AND/OR via parse then set', { concurrency: false }, () => {
  test('unparsed vs keyword css-wide vs custom-ident vs string vs color vs none', () => {
    const { map } = liveMap();

    // instanceof CSSUnparsedValue T (var parse). VariableRef is not a CSSStyleValue.
    const unparsed = CSSStyleValue.parse('color', 'var(--c)');
    assert.ok(unparsed instanceof CSSUnparsedValue);
    assert.equal(unparsed._associatedProperty, 'color');
    map.set('color', unparsed);
    assert.ok(map.get('color') instanceof CSSUnparsedValue);
    map.set('width', CSSStyleValue.parse('width', 'var(--w)'));

    for (const kw of ['initial', 'inherit', 'unset', 'revert', 'revert-layer']) {
      const v = CSSStyleValue.parse('color', kw);
      assert.ok(v instanceof CSSKeywordValue);
      map.set('color', v);
      assert.equal(map.get('color')?.toString().toLowerCase(), kw);
      map.set('width', CSSStyleValue.parse('width', kw));
    }
    // 'default' is CSS-wide in matchesStyleValueSyntax then parseAll rejects.
    assertType(() => map.set('color', new CSSKeywordValue('default')));

    // custom-ident T, string F vs string T, custom-ident F.
    map.set('container-name', CSSStyleValue.parse('container-name', 'myname'));
    const strOnly = register('<string>', '"x"');
    map.set(strOnly, new CSSKeywordValue('foo'));
    map.set('animation-name', CSSStyleValue.parse('animation-name', 'spin'));
    map.set('display', CSSStyleValue.parse('display', 'block'));

    // named T / system T / currentcolor (in SYSTEM_COLORS, third OR not unique).
    map.set('color', CSSStyleValue.parse('color', 'red'));
    map.set('color', CSSStyleValue.parse('color', 'Canvas'));
    map.set('color', CSSStyleValue.parse('color', 'GrayText'));
    map.set('color', CSSStyleValue.parse('color', 'currentcolor'));
    assertType(() => map.set('color', new CSSKeywordValue('notacolor')));
    assertType(() => map.set('color', new CSSKeywordValue('left')));

    // parts.includes position keywords; syntax.includes('<position>') never T
    // (not a VALID_COMPONENTS token; no standard syntax contains it).
    map.set('object-position', new CSSKeywordValue('left'));
    map.set('object-position', new CSSKeywordValue('right'));
    map.set('object-position', new CSSKeywordValue('center'));
    map.set('object-position', new CSSKeywordValue('top'));
    map.set('object-position', new CSSKeywordValue('bottom'));
    assertType(() => map.set('object-position', new CSSKeywordValue('auto')));

    // (image || transform-list) && none: unique-cause of each OR arm and of none F.
    const imgOnly = register('<image>', 'linear-gradient(red, blue)');
    const txList = register('<transform-list>', 'rotate(1deg)');
    map.set(imgOnly, new CSSKeywordValue('none'));
    map.set(txList, new CSSKeywordValue('none'));
    assertType(() => map.set(imgOnly, new CSSKeywordValue('auto')));
    assertType(() => map.set(txList, new CSSKeywordValue('auto')));
    map.set('background-image', CSSStyleValue.parse('background-image', 'none'));
    map.set('transform', CSSStyleValue.parse('transform', 'none'));
    assertType(() => map.set('width', new CSSKeywordValue('none')));
  });
});

describe('MC/DC still-hot unique-cause: matchesStyleValueSyntax numeric AND/OR via parse then set', { concurrency: false }, () => {
  test('length/percent/number/angle/time/frequency/resolution/flex unique-cause', () => {
    const { map } = liveMap();

    // propLower === 'background' T vs F.
    assertType(() => map.set('background', CSS.px(1)));
    map.set('width', CSSStyleValue.parse('width', '10px'));
    map.set('width', CSSStyleValue.parse('width', '50%'));
    assertType(() => map.set('width', CSS.deg(1)));

    // hasPercentage via '<percentage>' (not '<length-percentage>'): voice-pitch / opacity.
    map.set('voice-pitch', CSSStyleValue.parse('voice-pitch', '50%'));
    map.set('opacity', CSSStyleValue.parse('opacity', '0.5'));
    map.set('opacity', CSSStyleValue.parse('opacity', '50%'));
    assertType(() => map.set('opacity', CSS.px(1)));
    assertType(() => map.set('z-index', CSS.percent(1)));
    map.set('z-index', CSSStyleValue.parse('z-index', '1'));

    map.set('animation-delay', CSSStyleValue.parse('animation-delay', '1s'));
    assertType(() => map.set('animation-delay', CSS.px(1)));
    map.set('rotate', CSS.deg(45));
    assertType(() => map.set('rotate', CSS.px(1)));

    // matchesFrequency T, hasFrequency F: no standard/custom syntax contains '<frequency>'.
    assertType(() => map.set('animation-delay', CSS.Hz(1)));
    assertType(() => map.set('voice-pitch', CSS.Hz(1)));
    assertType(() => map.set('width', CSS.Hz(1)));
    assert.throws(
      () => CSS.registerProperty({ name: '--mcdc-svs-freq', syntax: '<frequency>', inherits: false, initialValue: '1Hz' }),
      (err: unknown) => err instanceof DOMException || err instanceof SyntaxError || err instanceof TypeError,
    );

    const len = register('<length>', '0px');
    const pct = register('<percentage>', '0%');
    const lp = register('<length-percentage>', '0px');
    const num = register('<number>', '0');
    const integer = register('<integer>', '0');
    const ang = register('<angle>', '0deg');
    const time = register('<time>', '0s');
    const res = register('<resolution>', '1dppx');
    const flex = register('<flex> | none', 'none');
    const star = register('*', 'x');

    map.set(len, CSS.px(1));
    assertType(() => map.set(len, CSS.percent(1)));
    map.set(pct, CSS.percent(1));
    assertType(() => map.set(pct, CSS.px(1)));
    map.set(lp, CSS.px(1));
    map.set(lp, CSS.percent(1));
    map.set(num, CSS.number(1));
    assertType(() => map.set(num, CSS.px(1)));
    map.set(integer, CSS.number(1));
    assertType(() => map.set(integer, CSS.px(1)));
    map.set(ang, CSS.deg(1));
    assertType(() => map.set(ang, CSS.s(1)));
    map.set(time, CSS.s(1));
    assertType(() => map.set(time, CSS.Hz(1)));
    map.set(res, CSS.dppx(1));
    assertType(() => map.set(res, CSS.px(1)));
    map.set(flex, CSS.fr(1));
    assertType(() => map.set(flex, CSS.px(1)));
    map.set(star, CSS.px(1));
    map.set('--mcdc-svs-unreg', CSS.px(1));

    map.set('grid-template-columns', CSSStyleValue.parse('grid-template-columns', '1fr'));
    map.set('image-resolution', CSSStyleValue.parse('image-resolution', '2dppx'));
    assertType(() => map.set('width', CSS.fr(1)));
    assertType(() => map.set('width', CSS.dppx(1)));
  });
});

describe('MC/DC still-hot unique-cause: matchesStyleValueSyntax transform/color/image/position via parse then set', { concurrency: false }, () => {
  test('transform 6-way OR unique-cause of syntax vs propLower', () => {
    const { map } = liveMap();
    const parsedTx = CSSStyleValue.parse('transform', 'translate(1px, 2px)');
    assert.ok(parsedTx instanceof CSSTransformValue);
    map.set('transform', parsedTx);
    assertAssociated(() => map.set('translate', parsedTx), 'transform', 'translate');

    // syntax.includes('<transform-list>') T, propLower === 'transform' F (custom name).
    const txList = register('<transform-list>', 'rotate(0deg)');
    const constructedTx = new CSSTransformValue([new CSSTranslate(CSS.px(1), CSS.px(2))]);
    assert.equal(constructedTx._associatedProperty, null);
    map.set(txList, constructedTx);
    const fnOnly = register('<transform-function>', 'translate(0px)');
    map.set(fnOnly, new CSSTransformValue([new CSSTranslate(CSS.px(1), CSS.px(0))]));

    // propLower translate/rotate/scale T, transform-list/function F.
    // String form round-trips; component toString is a function and parseAll rejects.
    map.set('translate', '1px 2px');
    assertType(() => map.set('translate', new CSSTranslate(CSS.px(1), CSS.px(2))));
    assertType(() => map.set('rotate', new CSSRotate(CSS.deg(45))));
    map.set('rotate', '45deg');
    map.set('scale', CSSStyleValue.parse('scale', '2'));
    map.set('scale', new CSSScale(2, 3));
    map.set('-webkit-transform', new CSSTransformValue([new CSSTranslate(CSS.px(3), CSS.px(4))]));
    assertType(() => map.set('color', constructedTx));
  });

  test('color OR, image OR url, position OR unique-cause via parse then set', () => {
    const { map } = liveMap();

    const parsedRgb = CSSStyleValue.parse('color', 'rgb(0, 0, 0)');
    assert.ok(parsedRgb instanceof CSSRGB);
    map.set('color', parsedRgb);
    assertAssociated(() => map.set('background-color', parsedRgb), 'color', 'background-color');

    // syntax.includes('<color>') T, COLOR_PROPERTIES F (registered custom).
    const colorOnly = register('<color>', 'black');
    const rgb = new CSSRGB(0, 0, 0);
    assert.equal(rgb._associatedProperty, null);
    map.set(colorOnly, rgb);
    map.set('fill', rgb);
    map.set('caret-color', rgb);
    assertType(() => map.set('width', rgb));

    // syntax.includes('<image>') T, '<url>' F vs '<url>' T, '<image>' F.
    const parsedImg = CSSStyleValue.parse('background-image', 'url("a.png")');
    assert.ok(parsedImg instanceof CSSImageValue);
    map.set('background-image', parsedImg);
    assertAssociated(() => map.set('list-style-image', parsedImg), 'background-image', 'list-style-image');
    const webkitFilter = CSSStyleValue.parse('-webkit-filter', 'url("a.png")');
    assert.ok(webkitFilter instanceof CSSImageValue);
    map.set('-webkit-filter', webkitFilter);
    const urlOnly = register('<url>', 'url("a.png")');
    const imgOnly = register('<image>', 'linear-gradient(red, blue)');
    const imgNull = CSSStyleValue.parse('list-style-image', 'url("b.png")');
    assertAssociated(() => map.set(urlOnly, imgNull), 'list-style-image', urlOnly);
    imgNull._associatedProperty = null;
    map.set(urlOnly, imgNull);
    map.set(imgOnly, imgNull);
    assertType(() => map.set('color', imgNull));

    const parsedPos = CSSStyleValue.parse('object-position', '10px 20px');
    assert.ok(parsedPos instanceof CSSPositionValue);
    map.set('object-position', parsedPos);
    assertAssociated(() => map.set('offset-position', parsedPos), 'object-position', 'offset-position');
    const pos = new CSSPositionValue(CSS.px(1), CSS.percent(50));
    map.set('object-position', pos);
    map.set('mask-position', pos);
    // length-percentage T, POSITION_PROPERTIES F.
    const lp = register('<length-percentage>', '0px');
    map.set(lp, pos);
    assertType(() => map.set('color', pos));
    assertType(() => map.set('width', pos));
    assert.throws(
      () => CSS.registerProperty({ name: '--mcdc-svs-pos', syntax: '<position>', inherits: false, initialValue: '0px 0px' }),
      (err: unknown) => err instanceof DOMException || err instanceof SyntaxError || err instanceof TypeError,
    );
  });
});

describe('MC/DC still-hot unique-cause: list vs singleton and attributeStyleMap parse-then-set', { concurrency: false }, () => {
  test('list-valued parseAll then set vs non-list TypeError', () => {
    const { map, style } = liveMap();
    const list = CSSStyleValue.parseAll('transition-duration', '1s, 2s');
    assert.equal(list.length, 2);
    assert.equal(list[0]._associatedProperty, 'transition-duration');
    map.set('transition-duration', ...list);
    assert.equal(style.getPropertyValue('transition-duration'), '1s, 2s');
    map.append('transition-duration', CSSStyleValue.parse('transition-duration', '3s'));
    assert.equal(style.getPropertyValue('transition-duration').includes('3s'), true);

    const one = CSSStyleValue.parse('color', 'red');
    map.set('color', one);
    assertType(() => map.set('color', one, CSSStyleValue.parse('color', 'blue')));
    assertType(() => map.set('color', ...list));
    assertType(() => map.append('color', one));
  });

  test('attributeStyleMap set of parsed CSSStyleValue same key vs other key', () => {
    const { map, el } = attrMap('<html><body><div id="el" style="color: blue"></div></body></html>');
    assert.equal(map.get('color')?.toString(), 'blue');

    const color = CSSStyleValue.parse('color', 'red');
    map.set('color', color);
    assert.equal(el.style.getPropertyValue('color'), 'red');
    assertAssociated(() => map.set('width', color), 'color', 'width');

    const w = CSSStyleValue.parse('width', '10px');
    map.set('width', w);
    assert.equal(el.style.getPropertyValue('width'), '10px');

    const margin = CSSStyleValue.parse('margin', '4px 8px');
    assert.equal(margin.constructor, CSSStyleValue);
    map.set('margin', margin);
    assertAssociated(() => map.set('padding', margin), 'margin', 'padding');

    map.set('opacity', CSSStyleValue.parse('opacity', '0.25'));
    map.set('background-image', CSSStyleValue.parse('background-image', 'none'));
    map.set('transform', CSSStyleValue.parse('transform', 'scale(2)'));
    map.set('color', CSSStyleValue.parse('color', 'var(--accent)'));
    assert.ok(map.get('color') instanceof CSSUnparsedValue);
  });
});
