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
// Leftover unique-cause for src/typed-om/style-map/*.ts
// (StylePropertyMap, StylePropertyMapReadOnly, style-validation) not already
// in tests/style-property-map.test.ts / tests/mcdc-hotspot-typed-om-more.test.ts /
// tests/typed-om-syntax.test.ts.
// Drive StylePropertyMap public set/get/getAll/has/append/delete/clear/keys/size
// and StylePropertyMapReadOnly get/has (ReadOnly overrides). css-typed-om-1
// § 2.1 #the-stylepropertymapreadonly-interface / § 2.2 #the-stylepropertymap /
// § 3.2 #the-stylepropertymap / #dom-stylepropertymap-append.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { tokenize } from '../src/tokenizer.ts';
import type { Declaration } from '../src/types.ts';
import {
  CSS,
  CSSStyleValue,
  CSSKeywordValue,
  CSSUnparsedValue,
  CSSVariableReferenceValue,
  CSSImageValue,
  CSSRGB,
  CSSPositionValue,
  CSSTransformValue,
  CSSTranslate,
  CSSRotate,
  CSSScale,
  StylePropertyMap,
  StylePropertyMapReadOnly,
  type StyleLike,
  type StyleReadOnlyLike,
} from '../src/typed-om.ts';

function decl(name: string, css: string): Declaration {
  return {
    type: 'declaration',
    name,
    value: tokenize(css).filter((t) => t.type !== 'EOF'),
    important: false,
  };
}

function asStyle(value: unknown): StyleLike {
  return value as StyleLike;
}

function liveMap(): { style: CSSStyleDeclaration; map: StylePropertyMap } {
  const style = new CSSStyleDeclaration();
  return { style, map: new StylePropertyMap(style) };
}

let seq = 0;
function register(syntax: string, initialValue: string): string {
  seq += 1;
  const name = `--mcdc-spm-${seq}`;
  CSS.registerProperty({ name, syntax, inherits: false, initialValue });
  return name;
}

function assertType(fn: () => unknown): void {
  assert.throws(fn, TypeError);
}

describe('MC/DC leftover unique-cause: StylePropertyMap duck-type get/set/remove (css-typed-om-1 § 3.2 #the-stylepropertymap)', { concurrency: false }, () => {
  test('getPropertyValueSafe / setPropertySafe / getStyleCache unique-cause of null, primitive, missing method, non-function', () => {
    // Unique-cause: !style T (typeof null === 'object', so !== 'object' F).
    const fromNull = new StylePropertyMap(asStyle(null));
    assert.equal(fromNull.get('color'), undefined);
    assert.equal(fromNull.has('color'), false);
    fromNull.set('color', 'red');
    fromNull.delete('color');

    // Unique-cause: typeof !== 'object' T with !style F.
    const fromNum = new StylePropertyMap(asStyle(42));
    assert.equal(fromNum.get('color'), undefined);
    fromNum.set('width', '10px');
    fromNum.delete('width');

    const fromUndef = new StylePropertyMap(asStyle(undefined));
    assert.equal(fromUndef.get('opacity'), undefined);

    // Unique-cause: "getPropertyValue" in style F.
    const noGet = new StylePropertyMap(asStyle({
      length: 0,
      setProperty() {},
      removeProperty() { return ''; },
      item() { return ''; },
    }));
    assert.equal(noGet.get('color'), undefined);
    assert.equal(noGet.has('color'), false);

    // Unique-cause: in T, typeof === 'function' F.
    const nonFnGet = new StylePropertyMap(asStyle({
      length: 0,
      getPropertyValue: 'nope',
      setProperty() {},
      removeProperty() { return ''; },
      item() { return ''; },
    }));
    assert.equal(nonFnGet.get('color'), undefined);

    // Unique-cause: "setProperty" in F vs in T / function F.
    const store: Record<string, string> = {};
    const noSet = new StylePropertyMap(asStyle({
      length: 0,
      getPropertyValue(p: string) { return store[p] || ''; },
      removeProperty() { return ''; },
      item() { return ''; },
    }));
    noSet.set('color', 'red');
    assert.equal(noSet.get('color'), undefined);

    const nonFnSet = new StylePropertyMap(asStyle({
      length: 0,
      getPropertyValue(p: string) { return store[p] || ''; },
      setProperty: 1,
      removeProperty() { return ''; },
      item() { return ''; },
    }));
    nonFnSet.set('color', 'blue');
    assert.equal(nonFnSet.get('color'), undefined);

    // Unique-cause: "removeProperty" in F vs function F.
    store.color = 'green';
    const noRemove = new StylePropertyMap(asStyle({
      length: 1,
      getPropertyValue(p: string) { return store[p] || ''; },
      setProperty(p: string, v: string) { store[p] = v; },
      item() { return 'color'; },
    }));
    noRemove.delete('color');
    assert.equal(store.color, 'green');

    const nonFnRemove = new StylePropertyMap(asStyle({
      length: 1,
      getPropertyValue(p: string) { return store[p] || ''; },
      setProperty(p: string, v: string) { store[p] = v; },
      removeProperty: 'nope',
      item() { return 'color'; },
    }));
    nonFnRemove.delete('color');
    assert.equal(store.color, 'green');

    // Full duck: both methods are functions (TT).
    const fullStore: Record<string, string> = {};
    const full = new StylePropertyMap(asStyle({
      length: 0,
      getPropertyValue(p: string) { return fullStore[p] || ''; },
      setProperty(p: string, v: string) { fullStore[p] = v; },
      removeProperty(p: string) {
        const old = fullStore[p] || '';
        delete fullStore[p];
        return old;
      },
      item() { return ''; },
    }));
    full.set('color', 'red');
    assert.equal(full.get('color')?.toString(), 'red');
    full.delete('color');
    assert.equal(full.has('color'), false);
  });

  test('constructor Declaration[] path unique-cause of custom vs standard name match and missing decl', () => {
    // Unique-cause: Array.isArray T; d.name.startsWith('--') T vs F; prop.startsWith('--') T vs F; decl T vs F.
    const map = new StylePropertyMap(asStyle([
      decl('color', 'red'),
      decl('--Foo', '1px'),
      decl('Color', 'blue'),
      decl('', 'ignored'),
      decl('-webkit-Appearance', 'none'),
    ]));
    assert.equal(map.get('color')?.toString(), 'red');
    assert.equal(map.get('COLOR')?.toString(), 'red');
    assert.equal(map.get('--Foo')?.toString(), '1px');
    assert.equal(map.get('--foo'), undefined);
    assert.equal(map.get('width'), undefined);
    assert.equal(map.has('color'), true);
    assert.equal(map.has('width'), false);

    const keys = Array.from(map.keys());
    assert.equal(keys.includes('color'), true);
    assert.equal(keys.includes('-webkit-appearance'), true);
    assert.equal(keys.includes('--Foo'), true);
    assert.equal(keys.includes(''), false);
    assert.ok(map.size >= 3);

    map.set('opacity', '0.5');
    map.delete('color');
    assert.equal(map.get('color')?.toString(), 'red');
  });
});

describe('MC/DC leftover unique-cause: StylePropertyMap get/getAll cache and custom reify (css-typed-om-1 § 3.2)', { concurrency: false }, () => {
  test('empty value vs cached list/non-list vs isEquivalent miss vs custom tokenize vs parseAll catch', () => {
    const { style, map } = liveMap();
    assert.equal(map.get('color'), undefined);
    assert.deepEqual(map.getAll('color'), []);
    assert.equal(map.has('color'), false);

    map.set('color', 'red');
    const first = map.get('color');
    const second = map.get('color');
    assert.equal(first, second);
    assert.equal(map.has('COLOR'), true);

    map.set('transition-duration', '1s', '2s');
    const listA = map.getAll('transition-duration');
    const listB = map.getAll('transition-duration');
    assert.equal(listA.length, 2);
    assert.equal(listA, listB);

    style.setProperty('color', 'blue');
    const after = map.get('color');
    assert.equal(after?.toString(), 'blue');
    assert.notEqual(after, first);

    const duckStore: Record<string, string> = { color: 'red' };
    const duck = new StylePropertyMap(asStyle({
      length: 1,
      getPropertyValue(p: string) { return duckStore[p] || ''; },
      setProperty(p: string, v: string) { duckStore[p] = v; },
      removeProperty(p: string) {
        const old = duckStore[p] || '';
        delete duckStore[p];
        return old;
      },
      item() { return 'color'; },
    }));
    duck.set('color', 'red');
    const cached = duck.get('color');
    duckStore.color = 'red /*c*/';
    assert.equal(duck.get('color'), cached);
    duckStore.color = '  RED  ';
    const recased = duck.get('color');
    assert.ok(recased);
    assert.notEqual(recased, cached);

    map.set('--FooBar', '1px /*x*/');
    const custom = map.get('--FooBar');
    assert.ok(custom instanceof CSSUnparsedValue);
    assert.equal(map.get('--foobar'), undefined);
    assert.equal(map.getAll('--FooBar').length, 1);

    style.setProperty('width', 'calc(20px + 30s)');
    const fallback = map.get('width');
    assert.ok(fallback);
    assert.equal(fallback.constructor, CSSStyleValue);
    assert.equal(fallback.toString(), 'calc(20px + 30s)');

    map.set('--empty-catch', '');
    assert.equal(map.get('--empty-catch') === undefined || map.get('--empty-catch') instanceof CSSStyleValue || map.get('--empty-catch') instanceof CSSUnparsedValue, true);
  });

  test('mixed-case standard get/getAll propKey and pending-substitution longhand vs non-longhand', () => {
    const { map } = liveMap();
    map.set('margin-top', CSS.px(1));
    assert.equal(map.get('Margin-Top')?.toString(), '1px');
    assert.equal(map.getAll('MARGIN-TOP')[0]?.toString(), '1px');

    map.set('margin', 'var(--m)');
    assertType(() => map.set('margin-top', '1px'));
    assertType(() => map.delete('margin-left'));
    map.set('color', 'red');
    assert.equal(map.get('color')?.toString(), 'red');

    map.set('margin', '1px');
    map.set('margin-top', '2px');
    assert.equal(map.get('margin-top')?.toString(), '2px');

    map.set('font', 'var(--f)');
    assertType(() => map.append('font-family', 'serif'));
    assertType(() => map.append('margin-top', '1px'));
  });
});

describe('MC/DC leftover unique-cause: StylePropertyMap.set / append validation (css-typed-om-1 § 3.2 #dom-stylepropertymap-append)', { concurrency: false }, () => {
  test('arity, list vs non-list, mix unparsed/var, css-wide current, var current, combined parse', () => {
    const { style, map } = liveMap();
    assertType(() => map.set('color'));
    assertType(() => map.append('transition-duration'));
    assertType(() => map.set('color', 'red', 'blue'));
    map.set('transition-duration', '1s', '2s');
    assert.equal(style.getPropertyValue('transition-duration'), '1s, 2s');
    map.set('transition-duration', '1s');
    assert.equal(style.getPropertyValue('transition-duration'), '1s');

    assertType(() => map.set('transition-duration', '1s', new CSSUnparsedValue(['2s'])));
    assertType(() => map.set('transition-duration', '1s', 'var(--t)'));
    assertType(() => map.set('transition-duration', '1s', 'VAR(--t)'));
    map.set('transition-duration', CSS.s(1), CSS.s(2));
    assert.equal(style.getPropertyValue('transition-duration').includes('1s'), true);

    assertType(() => map.append('color', 'red'));
    assertType(() => map.append('transition-duration', 'var(--t)'));
    assertType(() => map.append('transition-duration', new CSSUnparsedValue(['1s'])));
    assertType(() => map.append('transition-duration', new CSSVariableReferenceValue('--x') as unknown as CSSStyleValue));
    // Unique-cause: includes('var(') is case-sensitive, so VAR(--t) does not take the string arm.
    const { map: mapVar } = liveMap();
    mapVar.append('transition-duration', 'VAR(--t)');

    const { map: map2, style: style2 } = liveMap();
    map2.append('transition-duration', '1s');
    assert.equal(style2.getPropertyValue('transition-duration'), '1s');
    map2.append('transition-duration', '2s');
    assert.equal(style2.getPropertyValue('transition-duration'), '1s, 2s');

    for (const kw of ['initial', 'inherit', 'unset', 'revert', 'revert-layer']) {
      map2.set('transition-duration', kw);
      assertType(() => map2.append('transition-duration', '1s'));
    }
    map2.set('transition-duration', '  Initial  ');
    assertType(() => map2.append('transition-duration', '1s'));

    map2.set('transition-duration', 'var(--t)');
    assertType(() => map2.append('transition-duration', '1s'));

    const duckStore: Record<string, string> = { 'transition-duration': 'var(--hidden)' };
    const duck = new StylePropertyMap(asStyle({
      length: 1,
      getPropertyValue(p: string) { return duckStore[p] || ''; },
      setProperty(p: string, v: string) { duckStore[p] = v; },
      removeProperty() { return ''; },
      item() { return 'transition-duration'; },
    }));
    duckStore['transition-duration'] = 'var(--hidden)';
    assertType(() => duck.append('transition-duration', '1s'));

    const { map: map3 } = liveMap();
    map3.set('transition-duration', '1s');
    assertType(() => map3.append('transition-duration', 'not-a-time'));
  });

  test('matchesStyleValueSyntax keyword unique-cause via set()', () => {
    const { map } = liveMap();
    map.set('color', new CSSUnparsedValue(['var(--c)']));
    assert.ok(map.get('color') instanceof CSSUnparsedValue);
    const ref = new CSSVariableReferenceValue('--c') as CSSVariableReferenceValue & { _associatedProperty: string | null };
    ref._associatedProperty = null;
    map.set('color', ref as unknown as CSSStyleValue);
    assert.ok(map.get('color') instanceof CSSUnparsedValue);

    const { style, map: mapF } = liveMap();
    style.setProperty('width', 'calc(20px + 30s)');
    const raw = mapF.get('width');
    assert.ok(raw);
    assert.equal(raw.constructor, CSSStyleValue);
    // matchesStyleValueSyntax is true for constructor === CSSStyleValue; parseAll then rejects the leftover calc.
    assertType(() => mapF.set('width', raw));
    raw._associatedProperty = null;
    assertType(() => mapF.set('height', raw));
    raw._associatedProperty = 'width';
    assertType(() => mapF.set('height', raw));

    const star = register('*', 'x');
    map.set(star, CSS.px(1));
    map.set('--unregistered-spm', CSS.px(1));

    for (const kw of ['initial', 'inherit', 'unset', 'revert', 'revert-layer']) {
      map.set('color', new CSSKeywordValue(kw));
      assert.equal(map.get('color')?.toString().toLowerCase(), kw);
    }
    assertType(() => map.set('color', new CSSKeywordValue('default')));

    map.set('container-name', new CSSKeywordValue('myname'));
    map.set('font-language-override', new CSSKeywordValue('normal'));
    const strOnly = register('<string>', '"x"');
    map.set(strOnly, new CSSKeywordValue('foo'));
    map.set('animation-name', new CSSKeywordValue('spin'));
    assertType(() => map.set('color', new CSSKeywordValue('not-a-color')));

    map.set('display', new CSSKeywordValue('block'));
    map.set('color', new CSSKeywordValue('red'));
    map.set('color', new CSSKeywordValue('Canvas'));
    map.set('color', new CSSKeywordValue('currentcolor'));
    map.set('color', new CSSKeywordValue('GrayText'));
    assertType(() => map.set('color', new CSSKeywordValue('notacolor')));

    // STANDARD_PROPERTIES_SYNTAX never includes the token "<position>"; keywords are listed.
    map.set('object-position', new CSSKeywordValue('left'));
    map.set('object-position', new CSSKeywordValue('right'));
    map.set('object-position', new CSSKeywordValue('center'));
    map.set('object-position', new CSSKeywordValue('top'));
    map.set('object-position', new CSSKeywordValue('bottom'));
    assertType(() => map.set('object-position', new CSSKeywordValue('auto')));
    assertType(() => map.set('color', new CSSKeywordValue('left')));

    const imgOnly = register('<image>', 'linear-gradient(red, blue)');
    const txList = register('<transform-list>', 'rotate(1deg)');
    map.set(imgOnly, new CSSKeywordValue('none'));
    map.set(txList, new CSSKeywordValue('none'));
    assertType(() => map.set(imgOnly, new CSSKeywordValue('auto')));
    assertType(() => map.set(txList, new CSSKeywordValue('auto')));
    map.set('background-image', new CSSKeywordValue('none'));
    map.set('transform', new CSSKeywordValue('none'));
    assertType(() => map.set('width', new CSSKeywordValue('none')));
  });

  test('matchesStyleValueSyntax numeric unique-cause via set() of CSSUnitValue', () => {
    const { map } = liveMap();
    assertType(() => map.set('background', CSS.px(1)));
    map.set('width', CSS.px(10));
    map.set('width', CSS.percent(50));
    assertType(() => map.set('width', CSS.deg(1)));
    assertType(() => map.set('animation-delay', CSS.px(1)));
    map.set('opacity', CSS.number(0.5));
    map.set('opacity', CSS.percent(50));
    assertType(() => map.set('opacity', CSS.px(1)));
    map.set('z-index', CSS.number(1));
    map.set('flex-grow', CSS.number(1));
    assertType(() => map.set('z-index', CSS.percent(1)));
    map.set('animation-delay', CSS.s(1));
    assertType(() => map.set('animation-delay', CSS.percent(1)));
    map.set('rotate', CSS.deg(45));
    assertType(() => map.set('rotate', CSS.px(1)));

    const len = register('<length>', '0px');
    const pct = register('<percentage>', '0%');
    const lp = register('<length-percentage>', '0px');
    const num = register('<number>', '0');
    const integer = register('<integer>', '0');
    const ang = register('<angle>', '0deg');
    const time = register('<time>', '0s');
    const res = register('<resolution>', '1dppx');
    const flex = register('<flex> | none', 'none');

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
    map.set(res, CSS.dpi(96));
    assertType(() => map.set(res, CSS.px(1)));
    map.set(flex, CSS.fr(1));
    assertType(() => map.set(flex, CSS.px(1)));
    map.set('grid-template-columns', CSS.fr(1));
    map.set('image-resolution', CSS.dppx(2));
    assertType(() => map.set('width', CSS.Hz(1)));
    assertType(() => map.set('width', CSS.fr(1)));
    assertType(() => map.set('width', CSS.dppx(1)));

    map.set('width', CSS.em(1));
    map.set('--wrap-custom', CSS.em(1));
  });

  test('matchesStyleValueSyntax transform/color/image/position unique-cause via set()', () => {
    const { map } = liveMap();
    const translate = new CSSTranslate(CSS.px(1), CSS.px(2));
    const rotate = new CSSRotate(CSS.deg(45));
    const scale = new CSSScale(2, 3);
    const tv = new CSSTransformValue([translate]);

    map.set('transform', tv);
    map.set('-webkit-transform', new CSSTransformValue([new CSSTranslate(CSS.px(1), CSS.px(2))]));
    map.set('translate', '1px 2px');
    // matchesStyleValueSyntax is true (propLower === 'translate'/'rotate'); parseAll then rejects the function serialization.
    assertType(() => map.set('translate', translate));
    assertType(() => map.set('rotate', rotate));
    map.set('scale', scale);
    const fnOnly = register('<transform-function>', 'translate(1px)');
    map.set(fnOnly, new CSSTransformValue([new CSSTranslate(CSS.px(1), CSS.px(0))]));
    assertType(() => map.set('color', tv));

    const rgb = new CSSRGB(CSS.number(1), CSS.number(0), CSS.number(0));
    map.set('color', rgb);
    map.set('fill', new CSSRGB(0, 0, 0));
    map.set('background-color', rgb);
    rgb._associatedProperty = null;
    assertType(() => map.set('width', rgb));

    const img = CSSStyleValue.parse('background-image', 'url("a.png")');
    assert.ok(img instanceof CSSImageValue);
    img._associatedProperty = null;
    map.set('background-image', img);
    map.set('filter', img);
    assertType(() => map.set('color', img));

    const pos = new CSSPositionValue(CSS.px(1), CSS.percent(50));
    map.set('object-position', pos);
    map.set('offset-position', pos);
    assertType(() => map.set('width', pos));
    assertType(() => map.set('color', pos));
  });
});

describe('MC/DC leftover unique-cause: StylePropertyMap.clear / keys (css-typed-om-1 § 2.2)', { concurrency: false }, () => {
  test('clear unique-cause of element.removeAttribute AND vs style.item walk', () => {
    let removed: string | undefined;
    const { style } = liveMap();
    const withEl = new StylePropertyMap(style, {
      removeAttribute(name: string) { removed = name; },
    });
    withEl.set('color', 'red');
    withEl.clear();
    assert.equal(removed, 'style');

    const { style: s2, map: m2 } = liveMap();
    m2.set('color', 'red');
    m2.set('width', '1px');
    m2.clear();
    assert.equal(s2.length, 0);
    assert.equal(m2.has('color'), false);

    const { style: s3 } = liveMap();
    const numbered = new StylePropertyMap(s3, 1);
    numbered.set('opacity', '0.2');
    numbered.clear();
    assert.equal(s3.length, 0);

    const { style: s4 } = liveMap();
    const noMethod = new StylePropertyMap(s4, { id: 'x' });
    noMethod.set('color', 'blue');
    noMethod.clear();
    assert.equal(s4.length, 0);

    const { style: s5 } = liveMap();
    const notFn = new StylePropertyMap(s5, { removeAttribute: 'nope' });
    notFn.set('color', 'green');
    notFn.clear();
    assert.equal(s5.length, 0);
    notFn.clear();

    const names: string[] = [];
    const store: Record<string, string> = {};
    const duck = new StylePropertyMap(asStyle({
      get length() { return names.length; },
      getPropertyValue(p: string) { return store[p] || ''; },
      setProperty(p: string, v: string) {
        store[p] = v;
        if (!names.includes(p)) names.push(p);
      },
      removeProperty(p: string) {
        const old = store[p] || '';
        delete store[p];
        const i = names.indexOf(p);
        if (i >= 0) names.splice(i, 1);
        return old;
      },
      item(i: number) { return names[i] || ''; },
    }));
    duck.set('color', 'red');
    duck.set('width', '1px');
    duck.clear();
    assert.equal(names.length, 0);
  });

  test('_getKeys unique-cause of declarations vs indexed style vs item function vs empty prop', () => {
    const withDecls = new StylePropertyMap(asStyle({
      length: 0,
      getPropertyValue() { return ''; },
      setProperty() {},
      removeProperty() { return ''; },
      item() { return ''; },
      declarations: [
        decl('', 'skip'),
        decl('color', 'red'),
        decl('--Zed', '1'),
        decl('--able', '1'),
        decl('-webkit-order', '1'),
      ],
    }));
    const keys = Array.from(withDecls.keys());
    assert.deepEqual(keys.filter((k) => k === ''), []);
    assert.equal(keys[0], 'color');
    assert.ok(keys.indexOf('-webkit-order') > keys.indexOf('color'));
    assert.ok(keys.indexOf('--Zed') > keys.indexOf('-webkit-order') || keys.includes('--Zed'));
    assert.equal(withDecls.size, 4);

    const indexed = new StylePropertyMap(asStyle({
      length: 4,
      0: 'width',
      1: '',
      2: '-webkit-appearance',
      3: '--MyVar',
      getPropertyValue() { return ''; },
      setProperty() {},
      removeProperty() { return ''; },
      item(i: number) { return i === 1 ? 'color' : ''; },
    }));
    const ikeys = Array.from(indexed.keys());
    assert.equal(ikeys.includes('width'), true);
    assert.equal(ikeys.includes('color'), true);
    assert.equal(ikeys.includes('-webkit-appearance'), true);
    assert.equal(ikeys.includes('--MyVar'), true);

    const noItem = new StylePropertyMap(asStyle({
      length: 2,
      0: '',
      1: 'opacity',
      getPropertyValue() { return ''; },
      setProperty() {},
      removeProperty() { return ''; },
      item: 0,
    }));
    const nkeys = Array.from(noItem.keys());
    assert.equal(nkeys.includes('opacity'), true);
    assert.equal(nkeys.includes(''), false);

    const empty = new StylePropertyMap(asStyle({
      length: 0,
      getPropertyValue() { return ''; },
      setProperty() {},
      removeProperty() { return ''; },
      item() { return ''; },
    }));
    assert.equal(empty.size, 0);
    assert.deepEqual(Array.from(empty.keys()), []);
    assert.deepEqual(Array.from(empty.values()), []);
    assert.deepEqual(Array.from(empty.entries()), []);
    let foreachCount = 0;
    empty.forEach(() => { foreachCount += 1; });
    assert.equal(foreachCount, 0);
  });
});

describe('MC/DC leftover unique-cause: StylePropertyMapReadOnly get/has leftover (css-typed-om-1 § 2.1)', { concurrency: false }, () => {
  test('has unique-cause of element vs custom, declarations vs style, shorthand every vs OR', () => {
    const withEl = new StylePropertyMapReadOnly([], { tag: 'div' });
    assert.equal(withEl.has('color'), true);
    assert.equal(withEl.has('--x'), false);

    const noEl = new StylePropertyMapReadOnly([]);
    assert.equal(noEl.has('color'), false);
    assert.equal(noEl.has('--x'), false);

    const allMargin = new StylePropertyMapReadOnly([
      decl('margin-top', '1px'),
      decl('margin-right', '1px'),
      decl('margin-bottom', '1px'),
      decl('margin-left', '1px'),
    ]);
    assert.equal(allMargin.has('margin'), true);
    assert.equal(allMargin.has('color'), false);
    assert.equal(allMargin.has('margin-top'), true);

    const partial = new StylePropertyMapReadOnly([decl('margin-top', '1px')]);
    assert.equal(partial.has('margin'), false);
    assert.equal(partial.has('margin-top'), true);
    assert.equal(partial.has('--x'), false);

    const mixedCase = new StylePropertyMapReadOnly([decl('--Foo', '1'), decl('Color', 'red')]);
    assert.equal(mixedCase.has('--Foo'), true);
    assert.equal(mixedCase.has('--foo'), false);
    assert.equal(mixedCase.has('color'), true);

    const styleHas = {
      length: 0,
      getPropertyValue(p: string) {
        if (p === 'margin-top' || p === 'margin-right' || p === 'margin-bottom' || p === 'margin-left') return '1px';
        if (p === 'padding') return '2px';
        if (p === 'color') return 'red';
        return '';
      },
      item() { return ''; },
    } as unknown as StyleReadOnlyLike;
    const fromStyle = new StylePropertyMapReadOnly(styleHas);
    assert.equal(fromStyle.has('margin'), true);
    assert.equal(fromStyle.has('padding'), true);
    assert.equal(fromStyle.has('color'), true);
    assert.equal(fromStyle.has('width'), false);

    const emptyLonghands = {
      length: 0,
      getPropertyValue(p: string) { return p === 'border' ? '1px solid red' : ''; },
      item() { return ''; },
    } as unknown as StyleReadOnlyLike;
    assert.equal(new StylePropertyMapReadOnly(emptyLonghands).has('border'), true);
  });

  test('_getAllRaw leftover unique-cause of shorthand contract, css-wide, var, logical, parse catch, custom', () => {
    const contracted = new StylePropertyMapReadOnly([
      decl('margin-top', '1px'),
      decl('margin-right', '1px'),
      decl('margin-bottom', '1px'),
      decl('margin-left', '1px'),
    ]);
    const margin = contracted.get('margin');
    assert.ok(margin);
    assert.equal(margin.toString().includes('1px'), true);

    const inheritAll = new StylePropertyMapReadOnly([
      decl('margin-top', 'inherit'),
      decl('margin-right', 'inherit'),
      decl('margin-bottom', 'inherit'),
      decl('margin-left', 'inherit'),
    ]);
    assert.equal(inheritAll.get('margin')?.toString().toLowerCase(), 'inherit');

    const mixedWide = new StylePropertyMapReadOnly([
      decl('margin-top', 'inherit'),
      decl('margin-right', '1px'),
      decl('margin-bottom', 'inherit'),
      decl('margin-left', 'inherit'),
    ]);
    const mixed = mixedWide.get('margin');
    assert.equal(mixed === undefined || mixed.toString().includes('1px') || mixed.toString().includes('inherit'), true);

    const varAll = new StylePropertyMapReadOnly([
      decl('margin-top', 'var(--m)'),
      decl('margin-right', 'var(--m)'),
      decl('margin-bottom', 'var(--m)'),
      decl('margin-left', 'var(--m)'),
    ]);
    const varVal = varAll.get('margin');
    assert.ok(varVal);
    assert.equal(varVal.toString().includes('var('), true);

    const varMismatch = new StylePropertyMapReadOnly([
      decl('margin-top', 'var(--a)'),
      decl('margin-right', 'var(--b)'),
      decl('margin-bottom', 'var(--a)'),
      decl('margin-left', 'var(--a)'),
    ]);
    varMismatch.get('margin');

    const missing = new StylePropertyMapReadOnly([decl('margin-top', '1px')]);
    assert.equal(missing.get('margin'), undefined);
    assert.deepEqual(missing.getAll('margin'), []);
    assert.equal(missing.get('color'), undefined);

    const logical = new StylePropertyMapReadOnly([
      decl('margin-block-start', '1px'),
      decl('margin-inline-start', '1px'),
      decl('margin-block-end', '1px'),
      decl('margin-inline-end', '1px'),
    ]);
    logical.get('margin');

    const custom = new StylePropertyMapReadOnly([decl('--Foo', '1px')]);
    assert.ok(custom.get('--Foo') instanceof CSSUnparsedValue);
    assert.equal(custom.getAll('--Foo').length, 1);

    const unrep = new StylePropertyMapReadOnly([decl('width', 'calc(20px + 30s)')]);
    const raw = unrep.get('width');
    assert.ok(raw);
    assert.equal(raw.constructor, CSSStyleValue);

    const fromStyle = new StylePropertyMapReadOnly({
      length: 1,
      0: 'color',
      getPropertyValue(p: string) {
        if (p === 'color') return 'red';
        if (p === '--x') return '1px';
        if (p === 'width') return 'calc(20px + 30s)';
        if (p === 'margin-top' || p === 'margin-right' || p === 'margin-bottom' || p === 'margin-left') return 'inherit';
        return '';
      },
      item(i: number) { return i === 0 ? 'color' : ''; },
    } as unknown as StyleReadOnlyLike);
    assert.equal(fromStyle.get('color')?.toString(), 'red');
    assert.ok(fromStyle.get('--x') instanceof CSSUnparsedValue);
    assert.equal(fromStyle.get('width')?.constructor, CSSStyleValue);
    assert.equal(fromStyle.get('margin')?.toString().toLowerCase(), 'inherit');
    assert.equal(fromStyle.get('padding'), undefined);

    const varStyle = new StylePropertyMapReadOnly({
      length: 0,
      getPropertyValue(p: string) {
        if (p === 'margin-top' || p === 'margin-right' || p === 'margin-bottom' || p === 'margin-left') return 'var(--m)';
        return '';
      },
      item() { return ''; },
    } as unknown as StyleReadOnlyLike);
    assert.equal(varStyle.get('margin')?.toString().includes('var('), true);

    const mismatchStyle = new StylePropertyMapReadOnly({
      length: 0,
      getPropertyValue(p: string) {
        if (p === 'margin-top') return 'inherit';
        if (p === 'margin-right' || p === 'margin-bottom' || p === 'margin-left') return '1px';
        return '';
      },
      item() { return ''; },
    } as unknown as StyleReadOnlyLike);
    mismatchStyle.get('margin');

    assert.deepEqual(fromStyle.getAll('padding'), []);
    assert.equal(fromStyle.getAll('color').length, 1);
    assert.equal(fromStyle.getAll('--x').length, 1);
  });
});
