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
// Verifies: SYS-REQ-260821-8TGB, SYS-REQ-260821-YMEY, SW-REQ-260821-HNRG, SW-REQ-260821-TF5T, SW-REQ-260821-6951, SW-REQ-260821-PAKB
// Leftover unique-cause for src/CSSStyleDeclaration.ts not already in
// tests/mcdc-branch-declaration.test.ts. Drive createStyleProxy get/set/has,
// constructor addDeclarationRecursive / _addDeclaration, getPropertyValue,
// getPropertyPriority, setProperty, removeProperty, cssText.
// cssom-1 § 6.6.2 #dom-cssstyledeclaration-getpropertyvalue /
// #dom-cssstyledeclaration-getpropertypriority / § 6.7.1 #set-a-css-declaration /
// #dom-cssstyledeclaration-removeproperty / #dom-cssstyledeclaration-csstext.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { tokenize } from '../src/tokenizer.ts';
import { serialize } from '../src/serializer.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { SHORTHANDS, type ShorthandDefinition } from '../src/shorthands.ts';
import type { ComponentValue, Declaration } from '../src/types.ts';

function comps(css: string): ComponentValue[] {
  return tokenize(css).filter((t) => t.type !== 'EOF');
}

function decl(name: string, value: string, important = false, raw?: string): Declaration {
  const d: Declaration = {
    type: 'declaration',
    name,
    value: comps(value),
    important,
  };
  if (raw !== undefined) d.raw = raw;
  return d;
}

function style(): CSSStyleDeclaration {
  return new CSSStyleDeclaration();
}

const MARGIN_PHYSICAL = ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'] as const;
const MARGIN_LOGICAL = ['margin-block-start', 'margin-inline-start', 'margin-block-end', 'margin-inline-end'] as const;

class FontFaceStyle extends CSSStyleDeclaration {
  _isPropertySupported(property: string): boolean {
    return property === 'unicode-range' || super._isPropertySupported(property);
  }
}

describe('MC/DC leftover unique-cause: createStyleProxy get/set/has', () => {
  test('get leftover unique-cause of index, cssFloat, custom, and own/_ undefined', () => {
    const s = style();
    s.setProperty('color', 'red');
    s.setProperty('display', 'block');
    // !isNaN T, decl present vs missing
    assert.equal(s[0], 'color');
    assert.equal(s[1], 'display');
    assert.equal(s[2], undefined);
    // typeof prop === 'string' F
    const mark = Symbol('x');
    (s as unknown as Record<symbol, number>)[mark] = 7;
    assert.equal((s as unknown as Record<symbol, number>)[mark], 7);
    // prop in t T, typeof !== undefined T (prototype method / own field)
    assert.equal(typeof s.setProperty, 'function');
    assert.equal(s._onChange, null);
    // prop in t T, typeof undefined, startsWith('_') T vs F
    s._ghost = undefined;
    assert.equal(s._ghost, undefined);
    s.unsetOwn = undefined;
    assert.equal(s.unsetOwn, undefined);
    // prop.startsWith('--') T vs cssFloat T vs camelCase supported
    s['--foo'] = 'bar';
    assert.equal(s['--foo'], 'bar');
    s.cssFloat = 'left';
    assert.equal(s.cssFloat, 'left');
    assert.equal(s.color, 'red');
    // _isPropertySupported F
    assert.equal(s.notARealProperty, undefined);
  });

  test('set leftover unique-cause of numeric index, custom, cssFloat, and unsupported', () => {
    const s = style();
    s.setProperty('color', 'red');
    // !isNaN T → trap returns false (strict assignment throws)
    assert.equal(Reflect.set(s, '0', 'nope'), false);
    assert.equal(s[0], 'color');
    // typeof prop === 'string' F
    const mark = Symbol('set');
    assert.equal(Reflect.set(s, mark, 1), true);
    assert.equal((s as unknown as Record<symbol, number>)[mark], 1);
    // prop in t T, defined (Reflect.set on own field)
    s._onChange = () => {};
    assert.equal(typeof s._onChange, 'function');
    // startsWith('--') T
    s['--Bar'] = '1';
    assert.equal(s.getPropertyValue('--Bar'), '1');
    // cssFloat T vs camelCase
    s.cssFloat = 'right';
    assert.equal(s.getPropertyValue('float'), 'right');
    s.backgroundColor = 'blue';
    assert.equal(s.getPropertyValue('background-color'), 'blue');
    // _isPropertySupported F → expando
    s.unknownExpando = 'keep';
    assert.equal(s.unknownExpando, 'keep');
    assert.equal(s.getPropertyValue('unknown-expando'), '');
  });

  test('has leftover unique-cause of index bounds, custom, supported, and injected shorthand', () => {
    const s = style();
    s.setProperty('color', 'red');
    // typeof string T, !isNaN T: index >= 0 && index < length unique-cause
    assert.equal(0 in s, true);
    assert.equal(1 in s, false);
    assert.equal('-1' in s, false);
    // !isNaN F then prop in t T (method)
    assert.equal('setProperty' in s, true);
    // startsWith('--') T (always, even unset)
    assert.equal('--unset' in s, true);
    // _isPropertySupported T (dashed + camel)
    assert.equal('color' in s, true);
    assert.equal('marginTop' in s, true);
    assert.equal('margin' in s, true);
    // typeof string F
    assert.equal(Symbol.iterator in s, true);
    // prop in SHORTHANDS T / longhands.includes T vs neither (unsupported name)
    const fake: ShorthandDefinition = {
      longhands: ['zzz-unique-lh'],
      expand: () => null,
      contract: () => null,
    };
    SHORTHANDS['zzz-unique-sh'] = fake;
    try {
      assert.equal('zzz-unique-sh' in s, true);
      assert.equal('zzz-unique-lh' in s, true);
      assert.equal('not-a-real-prop' in s, false);
    } finally {
      delete SHORTHANDS['zzz-unique-sh'];
    }
  });
});

describe('MC/DC leftover unique-cause: constructor addDeclarationRecursive / _addDeclaration', () => {
  test('constructor leftover unique-cause of -- skip, custom case, var/env, and expand fail', () => {
    const s = new CSSStyleDeclaration([
      decl('--', 'skip'),
      decl('--Foo', 'Bar'),
      decl('COLOR', 'red'),
      decl('margin', 'var(--m)'),
      decl('padding', 'env(safe-area-inset-top)'),
      decl('width', 'not-a-width'),
      decl('display', 'block'),
    ]);
    // name === '--' T skipped
    assert.equal(s.getPropertyValue('--'), '');
    assert.equal([...s].includes('--'), false);
    // custom keeps case; non-custom lowercased
    assert.equal(s.getPropertyValue('--Foo'), 'Bar');
    assert.equal(s.getPropertyValue('color'), 'red');
    // hasVar unique-cause of var( vs env(
    assert.equal(s.getPropertyValue('margin'), 'var(--m)');
    assert.equal(s.getPropertyValue('margin-top'), '');
    assert.equal(s.getPropertyValue('padding').includes('env('), true);
    // expand fail stores the declaration as-is
    assert.equal(s.getPropertyValue('width'), 'not-a-width');
    assert.equal(s.getPropertyValue('display'), 'block');
  });

  test('_addDeclaration leftover unique-cause of important skip vs replace', () => {
    // existing.important T, d.important F → keep
    const keep = new CSSStyleDeclaration([
      decl('color', 'red', true),
      decl('color', 'blue', false),
    ]);
    assert.equal(keep.getPropertyValue('color'), 'red');
    // existing.important T, d.important T → replace
    const both = new CSSStyleDeclaration([
      decl('color', 'red', true),
      decl('color', 'blue', true),
    ]);
    assert.equal(both.getPropertyValue('color'), 'blue');
    // existing.important F, d.important T → replace
    const upgrade = new CSSStyleDeclaration([
      decl('color', 'red', false),
      decl('color', 'blue', true),
    ]);
    assert.equal(upgrade.getPropertyValue('color'), 'blue');
    // shorthand longhand important skip: keep margin-top, expand the rest
    const sh = new CSSStyleDeclaration([
      decl('margin-top', '1px', true),
      decl('margin', '2px', false),
    ]);
    assert.equal(sh.getPropertyValue('margin-top'), '1px');
    assert.equal(sh.getPropertyValue('margin-right'), '2px');
  });
});

describe('MC/DC leftover unique-cause: getPropertyValue css-wide and SHORTHANDS_DATA', () => {
  test('css-wide leftover unique-cause of keyword, missing longhand, mismatch, and mixed priority', () => {
    const allInherit = style();
    for (const lh of MARGIN_PHYSICAL) allInherit.setProperty(lh, 'inherit');
    assert.equal(allInherit.getPropertyValue('margin'), 'inherit');

    // allCssWide unique-cause of each keyword vs a non-keyword
    for (const kw of ['initial', 'unset', 'revert', 'revert-layer'] as const) {
      const t = style();
      for (const lh of MARGIN_PHYSICAL) t.setProperty(lh, kw);
      assert.equal(t.getPropertyValue('margin'), kw, kw);
    }

    // allMatch F: missing longhand
    const missing = style();
    missing.setProperty('margin-top', 'inherit');
    missing.setProperty('margin-right', 'inherit');
    missing.setProperty('margin-bottom', 'inherit');
    assert.equal(missing.getPropertyValue('margin'), '');

    // allCssWide mismatch
    const mixedKw = style();
    for (const lh of MARGIN_PHYSICAL) mixedKw.setProperty(lh, 'inherit');
    mixedKw.setProperty('margin-left', 'initial');
    assert.equal(mixedKw.getPropertyValue('margin'), '');

    // firstPrio !== prio T (allSamePriority F)
    const mixedPrio = style();
    mixedPrio.setProperty('margin-top', 'inherit', 'important');
    mixedPrio.setProperty('margin-right', 'inherit');
    mixedPrio.setProperty('margin-bottom', 'inherit');
    mixedPrio.setProperty('margin-left', 'inherit');
    assert.equal(mixedPrio.getPropertyValue('margin'), '');

    // non-css-wide breaks the css-wide loop
    const mixedVal = style();
    mixedVal.setProperty('margin-top', 'inherit');
    mixedVal.setProperty('margin-right', '1px');
    mixedVal.setProperty('margin-bottom', 'inherit');
    mixedVal.setProperty('margin-left', 'inherit');
    assert.equal(mixedVal.getPropertyValue('margin'), '');
  });

  test('SHORTHANDS_DATA fallback unique-cause when SHORTHANDS[property] is missing', () => {
    // text-decoration is in SHORTHANDS_DATA only
    const s = style();
    s.setProperty('text-decoration-line', 'inherit');
    s.setProperty('text-decoration-thickness', 'inherit');
    s.setProperty('text-decoration-style', 'inherit');
    s.setProperty('text-decoration-color', 'inherit');
    assert.equal(s.getPropertyValue('text-decoration'), 'inherit');
    // longhand (no shorthand table) skips the css-wide recombination
    assert.equal(s.getPropertyValue('color'), '');
  });
});

describe('MC/DC leftover unique-cause: getPropertyValue logical contract and conflict', () => {
  test('logical leftover unique-cause of writing-mode/direction default vs set, prefix, and includes F', () => {
    const logical = style();
    logical.setProperty('margin-block-start', '1px');
    logical.setProperty('margin-inline-start', '2px');
    logical.setProperty('margin-block-end', '3px');
    logical.setProperty('margin-inline-end', '4px');
    assert.equal(logical.getPropertyValue('margin'), 'logical 1px 2px 3px 4px');

    const wm = style();
    wm.setProperty('writing-mode', 'vertical-rl');
    wm.setProperty('direction', 'rtl');
    wm.setProperty('margin-block-start', '1px');
    wm.setProperty('margin-inline-start', '2px');
    wm.setProperty('margin-block-end', '3px');
    wm.setProperty('margin-inline-end', '4px');
    assert.equal(wm.getPropertyValue('margin'), 'logical 1px 2px 3px 4px');

    // includes(property) F: border-color is not in the logical-prefix list
    const bc = style();
    bc.setProperty('border-block-start-color', 'red');
    bc.setProperty('border-inline-start-color', 'red');
    bc.setProperty('border-block-end-color', 'red');
    bc.setProperty('border-inline-end-color', 'red');
    assert.equal(bc.getPropertyValue('border-color'), 'logical red');

    // scroll-margin / padding / inset stay in the prefix list
    const sm = style();
    sm.setProperty('scroll-margin-block-start', '1px');
    sm.setProperty('scroll-margin-inline-start', '2px');
    sm.setProperty('scroll-margin-block-end', '3px');
    sm.setProperty('scroll-margin-inline-end', '4px');
    assert.equal(sm.getPropertyValue('scroll-margin'), 'logical 1px 2px 3px 4px');

    // res && !startsWith('logical') && includes T → prefix added
    const orig = SHORTHANDS['margin'].contract;
    SHORTHANDS['margin'].contract = () => '1px';
    try {
      const prefixed = style();
      for (const lh of MARGIN_LOGICAL) prefixed.setProperty(lh, '1px');
      assert.equal(prefixed.getPropertyValue('margin'), 'logical 1px');
    } finally {
      SHORTHANDS['margin'].contract = orig;
    }

    // res F on the logical arm
    SHORTHANDS['margin'].contract = () => null;
    try {
      const none = style();
      for (const lh of MARGIN_LOGICAL) none.setProperty(lh, '1px');
      assert.equal(none.getPropertyValue('margin'), '');
    } finally {
      SHORTHANDS['margin'].contract = orig;
    }
  });

  test('physicalToLogical leftover unique-cause of val1 !== val2 vs same, and mixed important', () => {
    const conflict = style();
    for (const lh of MARGIN_PHYSICAL) conflict.setProperty(lh, '10px');
    conflict.setProperty('margin-block-start', '20px');
    assert.equal(conflict.getPropertyValue('margin'), '');

    const same = style();
    for (const lh of MARGIN_PHYSICAL) same.setProperty(lh, '10px');
    same.setProperty('margin-block-start', '10px');
    assert.equal(same.getPropertyValue('margin'), '10px');

    // consistentImportant F
    const mixed = style();
    mixed.setProperty('margin-top', '1px', 'important');
    mixed.setProperty('margin-right', '1px');
    mixed.setProperty('margin-bottom', '1px');
    mixed.setProperty('margin-left', '1px');
    assert.equal(mixed.getPropertyValue('margin'), '');

    // anySet F
    assert.equal(style().getPropertyValue('margin'), '');
  });
});

describe('MC/DC leftover unique-cause: getPropertyValue winners and special serializations', () => {
  test('invalid dashed ident, all covering, custom raw/comment/empty, font-family, flex-basis 0', () => {
    const s = style();
    s.setProperty('--ok', '1');
    assert.equal(s.getPropertyValue('--foo bar'), '');
    assert.equal(s.getPropertyValue('--ok'), '1');
    assert.equal(s.getPropertyValue('COLOR'), '');

    // winner.name === 'all' via a longhand covered by stored all
    const covered = style();
    covered.setProperty('color', 'red');
    covered.setProperty('all', 'var(--x)');
    assert.equal(covered.getPropertyValue('color'), 'var(--x)');
    assert.equal(covered.getPropertyValue('all'), 'var(--x)');
    // isCoveredByAll F: direction / unicode-bidi / custom
    covered.setProperty('direction', 'rtl');
    covered.setProperty('unicode-bidi', 'isolate');
    covered.setProperty('--keep', '1');
    assert.equal(covered.getPropertyValue('direction'), 'rtl');
    assert.equal(covered.getPropertyValue('unicode-bidi'), 'isolate');
    assert.equal(covered.getPropertyValue('--keep'), '1');

    const expanded = style();
    expanded.setProperty('all', 'inherit');
    assert.equal(expanded.getPropertyValue('all'), 'inherit');
    assert.equal(expanded.getPropertyValue('color'), 'inherit');
    assert.equal(expanded.getPropertyValue('direction'), '');

    // custom raw includes '/*' T vs F vs raw undefined
    const raw = style();
    raw.setProperty('--c', '/* hi */ red');
    assert.equal(raw.getPropertyValue('--c'), '/* hi */ red');
    raw.setProperty('--p', 'plain');
    assert.equal(raw.getPropertyValue('--p'), 'plain');
    const noRaw = new CSSStyleDeclaration([decl('--y', 'z')]);
    assert.equal(noRaw.getPropertyValue('--y'), 'z');
    // serialized === '' → ' '
    raw.setProperty('--e', ' ');
    assert.equal(raw.getPropertyValue('--e'), ' ');

    // font-family vs flex-basis 0 AND unique-cause
    const special = style();
    special.setProperty('font-family', 'Times New Roman, serif');
    assert.equal(special.getPropertyValue('font-family'), 'Times New Roman, serif');
    special.setProperty('flex-basis', '0');
    assert.equal(special.getPropertyValue('flex-basis'), '0px');
    special.setProperty('flex-basis', 'auto');
    assert.equal(special.getPropertyValue('flex-basis'), 'auto');
    special.setProperty('width', '0');
    assert.equal(special.getPropertyValue('width'), '0');
  });

  test('hasOverridingLonghand leftover unique-cause of includes, important, and idx', () => {
    // includes F only (color is not a margin longhand) → serialize the stored shorthand
    const other = style();
    other.setProperty('margin', 'var(--m)');
    other.setProperty('color', 'red');
    assert.equal(other.getPropertyValue('margin'), 'var(--m)');

    // later same-importance longhand: idx > directIdx T
    const later = style();
    later.setProperty('margin', 'var(--m)');
    later.setProperty('margin-top', '1px');
    assert.equal(later.getPropertyValue('margin'), '');
    assert.equal(later.getPropertyValue('margin-top'), '1px');

    // later important longhand: d.important T && !directDecl.important T
    const laterImp = style();
    laterImp.setProperty('margin', 'var(--m)');
    laterImp.setProperty('margin-top', '1px', 'important');
    assert.equal(laterImp.getPropertyValue('margin'), '');

    // important shorthand then non-important longhand: first if F, idx > T but importance unequal
    const impSh = style();
    impSh.setProperty('margin', 'var(--m)', 'important');
    impSh.setProperty('margin-top', '1px');
    assert.equal(impSh.getPropertyValue('margin'), 'var(--m)');

    // earlier longhand injected: idx > directIdx F, same importance → keep shorthand
    const earlier = style();
    earlier.setProperty('margin', 'var(--m)');
    earlier.declarations.unshift(decl('margin-top', '1px'));
    assert.equal(earlier.getPropertyValue('margin'), 'var(--m)');

    // earlier important longhand: d.important T regardless of idx
    const earlierImp = style();
    earlierImp.setProperty('margin', 'var(--m)');
    earlierImp.declarations.unshift(decl('margin-top', '1px', true));
    assert.equal(earlierImp.getPropertyValue('margin'), '');
  });

  test('_getWinningDeclaration leftover unique-cause of shorthand important and shIdx', () => {
    // later non-important shorthand: shIdx > exactIdx T → exact loses
    const later = style();
    later.setProperty('margin-top', '1px');
    later.declarations.push(decl('margin', 'var(--m)'));
    assert.equal(later.getPropertyValue('margin-top'), '');

    // earlier non-important shorthand: shIdx > exactIdx F → keep exact
    const earlier = style();
    earlier.setProperty('margin-top', '1px');
    earlier.declarations.unshift(decl('margin', 'var(--m)'));
    assert.equal(earlier.getPropertyValue('margin-top'), '1px');

    // shDecl.important T, exact missing-or-not-important → null
    const shImp = style();
    shImp.setProperty('margin-top', '1px');
    shImp.declarations.push(decl('margin', 'var(--m)', true));
    assert.equal(shImp.getPropertyValue('margin-top'), '');

    // both important: first if F, exact.important T skips the index check
    const both = style();
    both.setProperty('margin-top', '1px', 'important');
    both.declarations.push(decl('margin', 'var(--m)', true));
    assert.equal(both.getPropertyValue('margin-top'), '1px');

    // exact missing, shorthand not important → return exact (null)
    const none = style();
    none.declarations.push(decl('margin', 'var(--m)'));
    assert.equal(none.getPropertyValue('margin-top'), '');
  });
});

describe('MC/DC leftover unique-cause: getPropertyPriority', () => {
  test('shorthand leftover unique-cause of empty, primary/logical important, contract F, and directDecl', () => {
    assert.equal(style().getPropertyPriority('margin'), '');
    const partial = style();
    partial.setProperty('margin-top', '1px');
    assert.equal(partial.getPropertyPriority('margin'), '');
    assert.equal(partial.getPropertyValue('margin'), '');

    const primary = style();
    primary.setProperty('margin', '1px', 'important');
    assert.equal(primary.getPropertyValue('margin'), '1px');
    assert.equal(primary.getPropertyPriority('margin'), 'important');

    const logical = style();
    for (const lh of MARGIN_LOGICAL) logical.setProperty(lh, '1px', 'important');
    assert.equal(logical.getPropertyValue('margin'), 'logical 1px');
    assert.equal(logical.getPropertyPriority('margin'), 'important');

    // physical path: getPropertyValue non-empty via stored var, physical all important, contract F
    const physical = style();
    physical.setProperty('margin-block', 'var(--m)');
    physical.setProperty('margin-top', '1px', 'important');
    physical.setProperty('margin-bottom', '1px', 'important');
    assert.equal(physical.getPropertyValue('margin-block'), 'var(--m)');
    assert.equal(physical.getPropertyPriority('margin-block'), '');

    const directImp = style();
    directImp.setProperty('margin', 'var(--m)', 'important');
    assert.equal(directImp.getPropertyPriority('margin'), 'important');
    const directNot = style();
    directNot.setProperty('margin', 'var(--m)');
    assert.equal(directNot.getPropertyPriority('margin'), '');

    // longhand winner.important unique-cause
    const lh = style();
    lh.setProperty('color', 'red', 'important');
    assert.equal(lh.getPropertyPriority('color'), 'important');
    assert.equal(lh.getPropertyPriority('display'), '');

    // primary contract F with css-wide getPropertyValue still non-empty
    const orig = SHORTHANDS['margin'].contract;
    SHORTHANDS['margin'].contract = () => null;
    try {
      const wide = style();
      for (const name of MARGIN_PHYSICAL) wide.setProperty(name, 'inherit', 'important');
      assert.equal(wide.getPropertyValue('margin'), 'inherit');
      assert.equal(wide.getPropertyPriority('margin'), '');
    } finally {
      SHORTHANDS['margin'].contract = orig;
    }
  });
});

describe('MC/DC leftover unique-cause: setProperty remaining', () => {
  test('all expand, stub store, shorthand notify, bad-string/url, and missing validator', () => {
    const all = style();
    all.setProperty('all', 'var(--x)');
    assert.equal(all.getPropertyValue('all'), 'var(--x)');
    all.setProperty('all', 'inherit');
    assert.equal(all.getPropertyValue('all'), 'inherit');
    assert.equal(all.getPropertyValue('color'), 'inherit');
    assert.equal(all.cssText.includes('all: var'), false);

    const stubbed = style();
    const prevStub = SHORTHANDS['margin'].stub;
    SHORTHANDS['margin'].stub = true;
    try {
      stubbed.setProperty('margin', 'not-a-margin');
      assert.equal(stubbed.getPropertyValue('margin'), 'not-a-margin');
    } finally {
      SHORTHANDS['margin'].stub = prevStub;
    }

    const notify = style();
    let n = 0;
    notify._onChange = () => {
      n++;
    };
    notify.setProperty('margin', '1px', '', false);
    assert.equal(n, 0);
    assert.equal(notify.getPropertyValue('margin-top'), '1px');
    notify.setProperty('margin', '2px');
    assert.equal(n, 1);

    const bad = style();
    bad.setProperty('color', '"oops\n');
    assert.equal(bad.getPropertyValue('color'), '');
    bad.setProperty('background-image', 'url(http://x "y)');
    assert.equal(bad.getPropertyValue('background-image'), '');

    const hooks = ParseHooks as { validatePropertyValue?: typeof ParseHooks.validatePropertyValue };
    const orig = hooks.validatePropertyValue;
    const width = style();
    width.setProperty('width', '10px');
    hooks.validatePropertyValue = undefined;
    try {
      width.setProperty('width', '-100');
      assert.equal(width.getPropertyValue('width'), '-100');
    } finally {
      hooks.validatePropertyValue = orig;
    }

    const prio = style();
    prio.setProperty('color', 'red', undefined);
    assert.equal(prio.getPropertyValue('color'), 'red');
    assert.equal(prio.getPropertyPriority('color'), '');
    prio.setProperty('color', 'green', '  important  ');
    assert.equal(prio.getPropertyPriority('color'), 'important');
  });

  test('unicode-range assemble leftover unique-cause via supported override', () => {
    const s = new FontFaceStyle();
    s.setProperty('unicode-range', 'U+26');
    assert.equal(s.getPropertyValue('unicode-range'), 'U+26');
    s.setProperty('unicode-range', 'not-a-range');
    assert.equal(s.getPropertyValue('unicode-range'), 'U+26');
    s.setProperty('unicode-range', 'U+0-7F, U+26');
    assert.equal(s.getPropertyValue('unicode-range'), 'U+0-7F,U+26');
  });

  test('existing update leftover unique-cause of idx === -1 desync and custom raw', () => {
    const s = style();
    s.setProperty('color', 'red');
    const existing = s.declarations[0];
    s.declarations.splice(0);
    s.setProperty('color', 'blue');
    assert.equal(s.length, 0);
    assert.equal(serialize(existing.value).trim(), 'blue');

    const custom = style();
    custom.setProperty('--x', 'a');
    custom.setProperty('--x', 'b /*c*/');
    assert.equal(custom.getPropertyValue('--x'), 'b /*c*/');
    custom.setProperty('color', 'red');
    custom.setProperty('display', 'block');
    custom.setProperty('color', 'navy');
    assert.deepEqual([...custom], ['--x', 'color', 'display']);
  });

  test('hasVar leftover unique-cause of invalid var vs valid env on a shorthand', () => {
    const s = style();
    s.setProperty('color', 'red');
    s.setProperty('margin', 'var(');
    assert.equal(s.getPropertyValue('margin'), '');
    assert.equal(s.getPropertyValue('color'), 'red');
    s.setProperty('padding', 'env(safe-area-inset-top)');
    assert.equal(s.getPropertyValue('padding').includes('env('), true);
  });
});

describe('MC/DC leftover unique-cause: removeProperty remaining', () => {
  test('all changed F, missing shorthand, logical longhands, stored shorthand, and empty custom AND', () => {
    const kept = style();
    kept.setProperty('direction', 'rtl');
    kept.setProperty('unicode-bidi', 'isolate');
    kept.setProperty('--k', '1');
    let calls = 0;
    kept._onChange = () => {
      calls++;
    };
    assert.equal(kept.removeProperty('all'), '');
    assert.equal(kept.getPropertyValue('direction'), 'rtl');
    assert.equal(kept.getPropertyValue('--k'), '1');
    assert.equal(calls, 0);

    assert.equal(style().removeProperty('margin'), '');

    const logical = style();
    logical.setProperty('margin-block-start', '1px');
    assert.equal(logical.removeProperty('margin'), '');
    assert.equal(logical.getPropertyValue('margin-block-start'), '');

    const stored = style();
    stored.setProperty('margin', 'var(--m)');
    assert.equal(stored.removeProperty('margin'), 'var(--m)');
    assert.equal(stored.length, 0);

    const nonempty = style();
    nonempty.setProperty('--x', 'hello');
    assert.equal(nonempty.removeProperty('--x'), 'hello');
    const longhand = style();
    longhand.setProperty('color', 'red');
    assert.equal(longhand.removeProperty('color'), 'red');

    const desync = style();
    desync.setProperty('margin', '1px');
    desync.declarations.splice(0);
    assert.equal(desync.removeProperty('margin'), '');
    assert.equal(desync.length, 0);
  });
});

describe('MC/DC leftover unique-cause: cssText remaining', () => {
  test('parseStyleAttribute throw, null, -- skip, and expand-fail store', () => {
    const orig = ParseHooks.parseStyleAttribute;
    const s = style();
    s.setProperty('color', 'red');
    ParseHooks.parseStyleAttribute = () => {
      throw new Error('boom');
    };
    try {
      s.cssText = 'display: block';
      assert.equal(s.getPropertyValue('color'), 'red');
      assert.equal(s.getPropertyValue('display'), '');
    } finally {
      ParseHooks.parseStyleAttribute = orig;
    }

    ParseHooks.parseStyleAttribute = (() => null) as unknown as typeof orig;
    try {
      s.cssText = 'display: block';
      assert.equal(s.getPropertyValue('color'), 'red');
    } finally {
      ParseHooks.parseStyleAttribute = orig;
    }

    const inner = new CSSStyleDeclaration();
    inner.declarations.push(decl('--', 'x'));
    inner.declarations.push(decl('color', 'blue'));
    ParseHooks.parseStyleAttribute = () => inner;
    try {
      s.cssText = 'whatever';
      assert.equal([...s].includes('--'), false);
      assert.equal(s.getPropertyValue('color'), 'blue');
    } finally {
      ParseHooks.parseStyleAttribute = orig;
    }

    s.cssText = 'margin: not-a-margin; COLOR: Green';
    assert.equal(s.getPropertyValue('margin'), 'not-a-margin');
    // name is lowercased; ident value case is preserved
    assert.equal(s.getPropertyValue('color'), 'Green');
    assert.equal(s.getPropertyValue('COLOR'), 'Green');
  });

  test('item missing and iterator leftover unique-cause of empty vs filled', () => {
    const empty = style();
    assert.equal(empty.item(0), '');
    assert.deepEqual([...empty], []);
    empty.setProperty('color', 'red');
    assert.equal(empty.item(0), 'color');
    assert.equal(empty.item(9), '');
    assert.deepEqual([...empty], ['color']);
  });
});
