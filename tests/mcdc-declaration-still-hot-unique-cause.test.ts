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
// Still-hot unique-cause for src/CSSStyleDeclaration.ts leftovers that
// tests/mcdc-branch-declaration.test.ts and
// tests/mcdc-branch-declaration-leftover.test.ts do not isolate:
// createStyleProxy set `in t && (typeof !== undefined || startsWith('_'))`,
// _addDeclaration shorthand both-important / indexOf -1,
// _getExactWinningDeclaration d.important with winner set,
// hasOverridingLonghand directDecl.important,
// getPropertyValue empty-longhands / anyLogical F / includes(property) F
// with a non-logical contract result, getPropertyPriority empty
// longhands/logical/physical + logical/physical contract T,
// removeProperty empty custom, cssText expand success / hasVar / skip.
// Drive public CSSStyleDeclaration APIs plus declaration-array injection
// (same pattern as leftover). cssom-1 § 6.6.2
// #dom-cssstyledeclaration-getpropertyvalue /
// #dom-cssstyledeclaration-getpropertypriority / § 6.7.1
// #set-a-css-declaration / #dom-cssstyledeclaration-removeproperty /
// #dom-cssstyledeclaration-csstext. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { tokenize } from '../src/tokenizer.ts';
import { serialize } from '../src/serializer.ts';
import { SHORTHANDS, type ShorthandDefinition } from '../src/shorthands.ts';
import { SHORTHANDS_DATA } from '../src/data/gen/shorthands.ts';
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

function addDecl(s: CSSStyleDeclaration, d: Declaration): void {
  (s as unknown as { _addDeclaration(d: Declaration): void })._addDeclaration(d);
}

const MARGIN_PHYSICAL = ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'] as const;
const MARGIN_LOGICAL = ['margin-block-start', 'margin-inline-start', 'margin-block-end', 'margin-inline-end'] as const;

class SupportStyle extends CSSStyleDeclaration {
  _isPropertySupported(property: string): boolean {
    return property.startsWith('zzz-') || super._isPropertySupported(property);
  }
}

describe('MC/DC still-hot unique-cause: createStyleProxy set in/typeof/_', { concurrency: false }, () => {
  test('set leftover unique-cause of typeof undefined vs startsWith("_") with prop in t', () => {
    const s = style();
    // A=T, B=F, C=T: own `_ghost` is in t, value undefined, Reflect.set
    s._ghost = undefined;
    s._ghost = 1;
    assert.equal(s._ghost, 1);
    // A=T, B=F, C=F: `unsetOwn` in t, undefined, not `_` → camel/unsupported expando
    s.unsetOwn = undefined;
    s.unsetOwn = 'kept';
    assert.equal(s.unsetOwn, 'kept');
    // A=T, B=T: defined own field (null is not undefined) uses Reflect.set
    s.parentRule = null;
    assert.equal(s.parentRule, null);
    // A=F: string not in t falls through to camelCase / unsupported
    s.notInTarget = 'expando';
    assert.equal(s.notInTarget, 'expando');
  });
});

describe('MC/DC still-hot unique-cause: _addDeclaration shorthand important and indexOf -1', { concurrency: false }, () => {
  test('shorthand loop unique-cause of existing.important / d.important replace vs skip', () => {
    // existing.important T, d.important T → replace the protected longhand
    const both = new CSSStyleDeclaration([
      decl('margin-top', '1px', true),
      decl('margin', '2px', true),
    ]);
    assert.equal(both.getPropertyValue('margin-top'), '2px');
    assert.equal(both.getPropertyValue('margin-right'), '2px');
    // existing.important F, d.important F → replace (unique-cause of existing.important)
    const neither = new CSSStyleDeclaration([
      decl('margin-top', '1px', false),
      decl('margin', '3px', false),
    ]);
    assert.equal(neither.getPropertyValue('margin-top'), '3px');
    // existing.important T, d.important F → keep (pair for d.important)
    const keep = new CSSStyleDeclaration([
      decl('margin-top', '1px', true),
      decl('margin', '4px', false),
    ]);
    assert.equal(keep.getPropertyValue('margin-top'), '1px');
    assert.equal(keep.getPropertyValue('margin-right'), '4px');
  });

  test('_addDeclaration indexOf -1 unique-cause when map and array are desynced', () => {
    // L168: shorthand longhand in the map, missing from the array.
    // _addDeclaration stores the shorthand as-is after skipping splice.
    const sh = new CSSStyleDeclaration([decl('margin-top', '1px')]);
    sh.declarations.splice(0);
    addDecl(sh, decl('margin', '2px'));
    assert.equal(sh.getPropertyValue('margin'), '2px');
    assert.equal(sh.length, 1);
    // L181: same-name existing in the map, missing from the array
    const same = new CSSStyleDeclaration([decl('color', 'red')]);
    same.declarations.splice(0);
    addDecl(same, decl('color', 'blue'));
    assert.equal(same.getPropertyValue('color'), 'blue');
    assert.equal(same.length, 1);
  });
});

describe('MC/DC still-hot unique-cause: _getExactWinningDeclaration d.important with winner set', { concurrency: false }, () => {
  test('reverse-scan unique-cause of d.important after a non-important later winner', () => {
    // later non-important, earlier important → replace (d.important T, winner.important F)
    const upgrade = style();
    upgrade.setProperty('color', 'red');
    upgrade.declarations.unshift(decl('color', 'blue', true));
    assert.equal(upgrade.getPropertyValue('color'), 'blue');
    // later non-important, earlier non-important → keep later (d.important F)
    const keepLater = style();
    keepLater.setProperty('color', 'red');
    keepLater.declarations.unshift(decl('color', 'navy', false));
    assert.equal(keepLater.getPropertyValue('color'), 'red');
    // later important → break; earlier important is not considered (winner.important T)
    const laterImp = style();
    laterImp.setProperty('color', 'red', 'important');
    laterImp.declarations.unshift(decl('color', 'green', true));
    assert.equal(laterImp.getPropertyValue('color'), 'red');
  });

  test('isAll unique-cause: covering all vs exact, custom, direction, unicode-bidi, all itself', () => {
    const s = style();
    s.setProperty('color', 'red');
    s.declarations.push(decl('all', 'var(--x)'));
    // isMatch F, isAll T for color; later all wins when not important
    assert.equal(s.getPropertyValue('color'), 'var(--x)');
    // earlier important exact beats later non-important all
    const beaten = style();
    beaten.setProperty('display', 'block', 'important');
    beaten.declarations.push(decl('all', 'var(--y)'));
    assert.equal(beaten.getPropertyValue('display'), 'block');
    // isCoveredByAll F
    s.setProperty('direction', 'rtl');
    s.setProperty('unicode-bidi', 'isolate');
    s.setProperty('--keep', '1');
    s.setProperty('all', 'var(--z)');
    assert.equal(s.getPropertyValue('direction'), 'rtl');
    assert.equal(s.getPropertyValue('unicode-bidi'), 'isolate');
    assert.equal(s.getPropertyValue('--keep'), '1');
    assert.equal(s.getPropertyValue('all'), 'var(--z)');
  });
});

describe('MC/DC still-hot unique-cause: hasOverridingLonghand directDecl.important', { concurrency: false }, () => {
  test('d.important T unique-cause of !directDecl.important vs same-importance later longhand', () => {
    // T, F: leftover laterImp — important longhand vs non-important stored shorthand
    const laterImp = style();
    laterImp.setProperty('margin', 'var(--m)');
    laterImp.setProperty('margin-top', '1px', 'important');
    assert.equal(laterImp.getPropertyValue('margin'), '');
    // T, T: important stored shorthand + later important longhand (first if F, idx > T)
    const bothLater = style();
    bothLater.setProperty('margin', 'var(--m)', 'important');
    bothLater.setProperty('margin-top', '1px', 'important');
    assert.equal(bothLater.getPropertyValue('margin'), '');
    // T, T, idx > F: important stored shorthand + earlier important longhand
    const bothEarlier = style();
    bothEarlier.setProperty('margin', 'var(--m)', 'important');
    bothEarlier.declarations.unshift(decl('margin-top', '1px', true));
    assert.equal(bothEarlier.getPropertyValue('margin'), 'var(--m)');
    // F, F later: leftover later same-importance
    const laterSame = style();
    laterSame.setProperty('margin', 'var(--m)');
    laterSame.setProperty('margin-top', '1px');
    assert.equal(laterSame.getPropertyValue('margin'), '');
  });
});

describe('MC/DC still-hot unique-cause: getPropertyValue empty longhands, anyLogical, includes', { concurrency: false }, () => {
  test('shorthandLonghands.length > 0 unique-cause via empty SHORTHANDS_DATA / SHORTHANDS', () => {
    const data = SHORTHANDS_DATA as Record<string, readonly string[]>;
    const prev = data['zzz-empty-data'];
    data['zzz-empty-data'] = [];
    try {
      // shorthandLonghands = [] → length > 0 F, skip css-wide recombination
      assert.equal(style().getPropertyValue('zzz-empty-data'), '');
    } finally {
      if (prev === undefined) delete data['zzz-empty-data'];
      else data['zzz-empty-data'] = prev;
    }
    const fake: ShorthandDefinition = {
      longhands: [],
      expand: () => null,
      contract: () => null,
    };
    SHORTHANDS['zzz-empty'] = fake;
    try {
      const s = new SupportStyle();
      s.setProperty('zzz-empty', 'var(--x)');
      assert.equal(s.getPropertyValue('zzz-empty'), 'var(--x)');
      // length > 0 F: importantCount === 0 && length > 0 is F
      assert.equal(s.getPropertyPriority('zzz-empty'), '');
      s.setProperty('zzz-empty', 'var(--x)', 'important');
      assert.equal(s.getPropertyPriority('zzz-empty'), 'important');
    } finally {
      delete SHORTHANDS['zzz-empty'];
    }
  });

  test('hasAllLogicals T unique-cause of anyLogical F via empty logicalLonghands', () => {
    const orig = SHORTHANDS['margin'].logicalLonghands;
    SHORTHANDS['margin'].logicalLonghands = [];
    try {
      const s = style();
      s.setProperty('margin-top', '1px');
      // hasAllLonghands F, hasAllLogicals T (vacuous every), anyLogical F
      assert.equal(s.getPropertyValue('margin'), '');
    } finally {
      SHORTHANDS['margin'].logicalLonghands = orig;
    }
    // pair: hasAllLogicals T, anyLogical T (all logicals set)
    const logical = style();
    for (const lh of MARGIN_LOGICAL) logical.setProperty(lh, '1px');
    assert.equal(logical.getPropertyValue('margin'), 'logical 1px');
  });

  test('logical prefix unique-cause of includes(property) F with non-logical contract result', () => {
    const orig = SHORTHANDS['border-color'].contract;
    SHORTHANDS['border-color'].contract = () => 'red';
    try {
      const s = style();
      s.setProperty('border-block-start-color', 'red');
      s.setProperty('border-inline-start-color', 'red');
      s.setProperty('border-block-end-color', 'red');
      s.setProperty('border-inline-end-color', 'red');
      // res T, startsWith('logical') F, includes('border-color') F → no prefix
      assert.equal(s.getPropertyValue('border-color'), 'red');
    } finally {
      SHORTHANDS['border-color'].contract = orig;
    }

    // includes T remaining members: padding / inset / scroll-padding
    for (const [prop, logicals] of [
      ['padding', ['padding-block-start', 'padding-inline-start', 'padding-block-end', 'padding-inline-end']],
      ['inset', ['inset-block-start', 'inset-inline-start', 'inset-block-end', 'inset-inline-end']],
      ['scroll-padding', ['scroll-padding-block-start', 'scroll-padding-inline-start', 'scroll-padding-block-end', 'scroll-padding-inline-end']],
    ] as const) {
      const prev = SHORTHANDS[prop].contract;
      SHORTHANDS[prop].contract = () => '1px';
      try {
        const s = style();
        for (const lh of logicals) s.setProperty(lh, '1px');
        assert.equal(s.getPropertyValue(prop), 'logical 1px', prop);
      } finally {
        SHORTHANDS[prop].contract = prev;
      }
    }
  });
});

describe('MC/DC still-hot unique-cause: getPropertyPriority empty lists and contract T/F', { concurrency: false }, () => {
  test('logicalLonghands.length > 0 unique-cause and logical contract T vs F', () => {
    const origLogical = SHORTHANDS['margin'].logicalLonghands;
    const origContract = SHORTHANDS['margin'].contract;
    SHORTHANDS['margin'].logicalLonghands = [];
    try {
      const s = style();
      s.setProperty('margin', 'var(--m)', 'important');
      // getPropertyValue non-empty via stored shorthand; logical [] → length > 0 F
      assert.equal(s.getPropertyPriority('margin'), 'important');
    } finally {
      SHORTHANDS['margin'].logicalLonghands = origLogical;
    }

    // logical all-important, contract T (real contractor); primary incomplete so L431 F
    const logicalT = style();
    for (const lh of MARGIN_LOGICAL) logicalT.setProperty(lh, '1px', 'important');
    assert.equal(logicalT.getPropertyPriority('margin'), 'important');

    // css-wide physical inherit keeps getPropertyValue off contract; stub hits
    // L432 then L440 (logical inherit important, contract F)
    const wide = style();
    for (const lh of MARGIN_PHYSICAL) wide.setProperty(lh, 'inherit', 'important');
    for (const lh of MARGIN_LOGICAL) wide.setProperty(lh, 'inherit', 'important');
    SHORTHANDS['margin'].contract = () => null;
    try {
      assert.equal(wide.getPropertyValue('margin'), 'inherit');
      assert.equal(wide.getPropertyPriority('margin'), '');
    } finally {
      SHORTHANDS['margin'].contract = origContract;
    }
  });

  test('physicalLonghands.length > 0 unique-cause and physical contract T vs F', () => {
    const origPhys = SHORTHANDS['margin-block'].physicalLonghands;
    const origContract = SHORTHANDS['margin-block'].contract;
    SHORTHANDS['margin-block'].physicalLonghands = [];
    try {
      const s = style();
      s.setProperty('margin-block', 'var(--m)', 'important');
      assert.equal(s.getPropertyPriority('margin-block'), 'important');
    } finally {
      SHORTHANDS['margin-block'].physicalLonghands = origPhys;
    }

    const physical = style();
    physical.setProperty('margin-block', 'var(--m)');
    physical.setProperty('margin-top', '1px', 'important');
    physical.setProperty('margin-bottom', '1px', 'important');
    // real contract keys are logical names → F
    assert.equal(physical.getPropertyPriority('margin-block'), '');
    SHORTHANDS['margin-block'].contract = (vals) => (vals['margin-top'] ? '1px' : null);
    try {
      assert.equal(physical.getPropertyPriority('margin-block'), 'important');
    } finally {
      SHORTHANDS['margin-block'].contract = origContract;
    }
  });
});

describe('MC/DC still-hot unique-cause: removeProperty empty custom AND', { concurrency: false }, () => {
  test('startsWith("--") && value.length === 0 unique-cause of empty custom vs nonempty vs longhand', () => {
    const emptyCustom = new CSSStyleDeclaration([decl('--e', '')]);
    assert.equal(emptyCustom.removeProperty('--e'), ' ');
    const nonempty = new CSSStyleDeclaration([decl('--x', 'hello')]);
    assert.equal(nonempty.removeProperty('--x'), 'hello');
    const emptyLonghand = new CSSStyleDeclaration([decl('color', '')]);
    assert.equal(emptyLonghand.removeProperty('color'), serialize(comps('')).trim());
    // shorthand stored vs longhand-in-map desync on remove
    const stored = style();
    stored.setProperty('margin', 'var(--m)');
    stored.declarations.splice(0);
    assert.equal(stored.removeProperty('margin'), '');
    const logicalDesync = style();
    logicalDesync.setProperty('margin-block-start', '1px');
    logicalDesync.declarations.splice(0);
    assert.equal(logicalDesync.removeProperty('margin'), '');
  });
});

describe('MC/DC still-hot unique-cause: cssText expand success / hasVar / skip', { concurrency: false }, () => {
  test('cssText leftover unique-cause of expanded T, var vs env, custom case, unsupported skip', () => {
    const s = style();
    s.cssText = 'margin: 1px 2px 3px 4px';
    assert.equal(s.getPropertyValue('margin-top'), '1px');
    assert.equal(s.getPropertyValue('margin-right'), '2px');
    assert.equal(s.getPropertyValue('margin-bottom'), '3px');
    assert.equal(s.getPropertyValue('margin-left'), '4px');
    assert.equal([...s].includes('margin'), false);

    s.cssText = 'margin: var(--m); padding: env(safe-area-inset-top)';
    assert.equal(s.getPropertyValue('margin'), 'var(--m)');
    assert.equal(s.getPropertyValue('padding').includes('env('), true);

    s.cssText = '--Foo: Bar; not-a-real-property: 1; color: Green';
    assert.equal(s.getPropertyValue('--Foo'), 'Bar');
    assert.equal(s.getPropertyValue('not-a-real-property'), '');
    assert.equal(s.getPropertyValue('color'), 'Green');

    s.cssText = 'margin: 5px !important';
    assert.equal(s.getPropertyPriority('margin-top'), 'important');
    assert.equal(s.getPropertyValue('margin-top'), '5px');

    s.cssText = '';
    assert.equal(s.cssText, '');
    assert.equal(s.length, 0);
  });
});

describe('MC/DC still-hot unique-cause: setProperty hasAllLater F vs T', { concurrency: false }, () => {
  test('existing update unique-cause of later all vs later non-all', () => {
    const withAll = style();
    withAll.setProperty('color', 'red');
    withAll.setProperty('all', 'var(--x)');
    withAll.setProperty('color', 'blue');
    assert.deepEqual([...withAll], ['all', 'color']);
    const noAll = style();
    noAll.setProperty('color', 'red');
    noAll.setProperty('display', 'block');
    noAll.setProperty('color', 'navy');
    assert.deepEqual([...noAll], ['color', 'display']);
    assert.equal(noAll.getPropertyValue('color'), 'navy');
  });
});
