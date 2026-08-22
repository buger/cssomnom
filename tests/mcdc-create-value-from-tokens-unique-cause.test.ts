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
// Verifies: SYS-REQ-260821-HGFK, SYS-REQ-260821-Y6R3, SW-REQ-260821-7AKJ, SW-REQ-260821-E5D5, INT-REQ-260821-9SGA, SW-REQ-260821-HNRG
// Unique-cause leftovers for src/typed-om/values/style-value-parser.ts
// createValueFromTokens (3/8 D, 5 incomplete) and anonymous ParseHooks.validatePropertyValue
// at L433 (4/9 D, 5 incomplete) after tests/mcdc-hotspot-parse-all.test.ts,
// tests/mcdc-hotspot-parse-all-more.test.ts, tests/mcdc-parseall-unique-cause.test.ts,
// tests/mcdc-parseall-still-hot-unique-cause.test.ts,
// tests/mcdc-parseall-remaining-unique-cause.test.ts,
// tests/mcdc-parseall-round5-unique-cause.test.ts,
// tests/mcdc-parseall-round6-unique-cause.test.ts, and
// tests/mcdc-parseall-round7-unique-cause.test.ts.
// Last recapture: createValueFromTokens 3/8 D, 10/15 C, incomplete 5
// (next seam: values[?].type === "comment"); unnamed L433 4/9 D, 16/22 C,
// incomplete 5 (next seam: lowerVal.includes env/attr).
// Drive CSSStyleValue.parse / parseAll for createValueFromTokens.
// css-syntax-3 § 4.3.2 #consume-comments discards comment tokens, so the
// comment unique-cause injects CommentTokens through ParseHooks.parseComponentValues
// (not getter mutation). L433 is only reached from CSSStyleDeclaration.setProperty;
// parseAll does not call validatePropertyValue. No //mcdc:ignore.
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSS,
  CSSStyleValue,
  CSSKeywordValue,
  CSSUnparsedValue,
  CSSUnitValue,
  CSSPositionValue,
} from '../src/typed-om.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { tokenize } from '../src/tokenizer.ts';
import { LIST_PROPERTIES } from '../src/typed-om/style-map/style-validation.ts';
import type { CommentToken, ComponentValue, SimpleToken } from '../src/types.ts';

function parseAll(property: string, css: string): CSSStyleValue[] {
  return CSSStyleValue.parseAll(property, css);
}

const origParseComponentValues = ParseHooks.parseComponentValues;
const MIXED_LIST = '-Webkit-Box-Pack';
const CUSTOM_LEN = '--mcdc-cvft-len';
const CUSTOM_STAR = '--mcdc-cvft-star';

function restoreHooks(): void {
  ParseHooks.parseComponentValues = origParseComponentValues;
  LIST_PROPERTIES.delete(MIXED_LIST);
  LIST_PROPERTIES.delete(CUSTOM_LEN);
  LIST_PROPERTIES.delete(CUSTOM_STAR);
}

function valuesOf(css: string): ComponentValue[] {
  return origParseComponentValues(tokenize(css));
}

function comment(value = 'c'): CommentToken {
  return { type: 'comment', value };
}

function comma(): SimpleToken {
  return { type: 'comma', value: ',' };
}

function withComponentValues(values: ComponentValue[], fn: () => void): void {
  ParseHooks.parseComponentValues = () => values;
  try {
    fn();
  } finally {
    restoreHooks();
  }
}

function isEmptyValueError(err: unknown): boolean {
  return err instanceof TypeError && err.message === 'Invalid empty value';
}

describe('MC/DC unique-cause: createValueFromTokens + validatePropertyValue L433', { concurrency: false }, () => {
  afterEach(() => {
    restoreHooks();
  });

  // css-syntax-3 § 4.3.2 #consume-comments / css-typed-om-1 § 6.6 #parse-a-cssstylevalue
  test('L101/L105 comment unique-cause: leading/trailing comment vs whitespace vs neither', () => {
    const px = valuesOf('10px');
    const shadow = valuesOf('1px 2px red');

    // Unique-cause: type === 'comment' T with type === 'whitespace' F (leading).
    // Real `/*c*/10px` never emits a comment token (consumeComments discards).
    withComponentValues([comment('lead'), ...px], () => {
      const led = parseAll('width', '10px');
      assert.equal(led.length, 1);
      assert.ok(led[0] instanceof CSSUnitValue);
      assert.equal((led[0] as CSSUnitValue).value, 10);
      assert.equal((led[0] as CSSUnitValue).unit, 'px');
      const first = CSSStyleValue.parse('width', '10px');
      assert.ok(first instanceof CSSUnitValue);
    });
    withComponentValues([comment('lead'), ...shadow], () => {
      const led = parseAll('box-shadow', '1px 2px red');
      assert.equal(led.length, 1);
      assert.equal(led[0].constructor, CSSStyleValue);
      assert.equal(led[0].toString(), '1px 2px red');
    });

    // Unique-cause: trailing comment T with whitespace F (L105 end walk).
    withComponentValues([...px, comment('trail')], () => {
      const trailed = parseAll('width', '10px');
      assert.ok(trailed[0] instanceof CSSUnitValue);
      assert.equal((trailed[0] as CSSUnitValue).value, 10);
    });
    withComponentValues([...shadow, comment('trail')], () => {
      const trailed = parseAll('box-shadow', '1px 2px red');
      assert.equal(trailed[0].constructor, CSSStyleValue);
    });

    // Both ends: start walk and end walk each unique-cause comment T.
    withComponentValues([comment('a'), ...px, comment('b')], () => {
      const both = parseAll('width', '10px');
      assert.ok(both[0] instanceof CSSUnitValue);
    });
    withComponentValues([comment('a'), ...valuesOf('1')], () => {
      const z = parseAll('z-index', '1');
      assert.ok(z[0] instanceof CSSUnitValue);
    });

    // Unique-cause: type === 'whitespace' T (comment skipped). Real CSS strings.
    const leadWs = parseAll('width', ' 10px');
    assert.ok(leadWs[0] instanceof CSSUnitValue);
    assert.equal((leadWs[0] as CSSUnitValue).value, 10);
    const trailWs = parseAll('width', '10px ');
    assert.ok(trailWs[0] instanceof CSSUnitValue);
    const bothWs = parseAll('width', '  10px  ');
    assert.ok(bothWs[0] instanceof CSSUnitValue);
    const shadowWs = parseAll('box-shadow', ' 1px 2px red ');
    assert.equal(shadowWs[0].constructor, CSSStyleValue);

    // Unique-cause: whitespace F and comment F (ident/dimension first and last).
    const plain = parseAll('width', '10px');
    assert.ok(plain[0] instanceof CSSUnitValue);
    const named = parseAll('animation-name', 'spin');
    assert.ok(named[0] instanceof CSSKeywordValue);
    const multi = parseAll('box-shadow', '1px 2px red');
    assert.equal(multi[0].constructor, CSSStyleValue);

    // Real comment text is discarded; parse still reifies (not a comment token).
    const discarded = parseAll('width', '/*c*/10px/*d*/');
    assert.ok(discarded[0] instanceof CSSUnitValue);
    assert.equal((discarded[0] as CSSUnitValue).value, 10);
  });

  // css-syntax-3 § 5.4.8 #parse-a-list-of-component-values
  test('L109 start>end T via comment-only list segment on mixed-case LIST', () => {
    // L259 uses propLower and strips comments; L386 keeps the original key and
    // comments. A comment-only middle segment unique-causes start > end with
    // type === 'comment' (round5 `/* x */` never emitted comment tokens).
    LIST_PROPERTIES.add(MIXED_LIST);
    const center = valuesOf('center');
    const start = valuesOf('start');

    withComponentValues([...center, comma(), comment('mid'), comma(), ...start], () => {
      assert.throws(() => parseAll(MIXED_LIST, 'center, start'), isEmptyValueError);
      assert.throws(() => CSSStyleValue.parse(MIXED_LIST, 'center, start'), isEmptyValueError);
    });

    LIST_PROPERTIES.add(MIXED_LIST);
    withComponentValues([...center, comma(), comment('a'), comment('b'), comma(), ...start], () => {
      assert.throws(() => parseAll(MIXED_LIST, 'center, start'), isEmptyValueError);
    });

    // Comment-only first / last segment (still non-empty overall for L172).
    LIST_PROPERTIES.add(MIXED_LIST);
    withComponentValues([comment('only'), comma(), ...start], () => {
      assert.throws(() => parseAll(MIXED_LIST, ',start'), isEmptyValueError);
    });
    LIST_PROPERTIES.add(MIXED_LIST);
    withComponentValues([...center, comma(), comment('only')], () => {
      assert.throws(() => parseAll(MIXED_LIST, 'center,'), isEmptyValueError);
    });

    // All-comment input fails L172 before createValueFromTokens (different message).
    withComponentValues([comment('x'), comment('y')], () => {
      assert.throws(
        () => parseAll('width', '10px'),
        (err: unknown) =>
          err instanceof TypeError && err.message.includes('Invalid empty value for property'),
      );
    });

    // Non-empty mixed-case LIST still reifies (start > end F).
    LIST_PROPERTIES.add(MIXED_LIST);
    const both = parseAll(MIXED_LIST, 'center, start');
    assert.equal(both.length, 2);
    assert.ok(both[0] instanceof CSSKeywordValue);
    assert.ok(both[1] instanceof CSSKeywordValue);
    LIST_PROPERTIES.delete(MIXED_LIST);
  });

  // css-typed-om-1 § 3.4 #unparsedvalue-objects / css-properties-values-api-1
  test('L115/L117/L122 pairable startsWith/syntax/position F; property F and !def mute', () => {
    CSS.registerProperty({
      name: CUSTOM_LEN,
      syntax: '<length>',
      inherits: false,
      initialValue: '0px',
    });
    CSS.registerProperty({
      name: CUSTOM_STAR,
      syntax: '*',
      inherits: false,
      initialValue: 'x',
    });

    // Unique-cause: property.startsWith('--') T, def T, syntax === '*' F, then
    // trimmed.length === 1 → CSSUnitValue. LIST + comma reaches createValueFromTokens
    // (unregistered customs return at _parseAll L197 and never get here).
    LIST_PROPERTIES.add(CUSTOM_LEN);
    const lens = parseAll(CUSTOM_LEN, '1px, 2px');
    assert.equal(lens.length, 2);
    assert.ok(lens[0] instanceof CSSUnitValue);
    assert.ok(lens[1] instanceof CSSUnitValue);
    assert.equal((lens[0] as CSSUnitValue).value, 1);
    const firstLen = CSSStyleValue.parse(CUSTOM_LEN, '1px, 2px');
    assert.ok(firstLen instanceof CSSUnitValue);
    LIST_PROPERTIES.delete(CUSTOM_LEN);

    // Unique-cause: def.syntax === '*' T → CSSUnparsedValue inside createValueFromTokens.
    const star = parseAll(CUSTOM_STAR, 'foo bar');
    assert.ok(star[0] instanceof CSSUnparsedValue);
    LIST_PROPERTIES.add(CUSTOM_STAR);
    const starList = parseAll(CUSTOM_STAR, 'foo, bar');
    assert.equal(starList.length, 2);
    assert.ok(starList.every((v) => v instanceof CSSUnparsedValue));
    LIST_PROPERTIES.delete(CUSTOM_STAR);

    // Unique-cause: startsWith('--') F (standard property) and POSITION F.
    const width = parseAll('width', '10px');
    assert.ok(width[0] instanceof CSSUnitValue);
    const quoted = parseAll('animation-name', '"spin"');
    assert.equal(quoted[0].constructor, CSSStyleValue);
    const shadows = parseAll('box-shadow', '1px 2px red, 3px 4px blue');
    assert.equal(shadows.length, 2);
    assert.equal(shadows[0].constructor, CSSStyleValue);

    // Unregistered custom returns at L197 (CSSUnparsedValue) and never evaluates
    // createValueFromTokens `!def`. Mute: !def at L117.
    const unreg = parseAll('--mcdc-cvft-unreg', 'hello');
    assert.ok(unreg[0] instanceof CSSUnparsedValue);

    // POSITION T returns at _parseAll L204; createValueFromTokens L122 T is mute.
    const pos = parseAll('object-position', 'left');
    assert.ok(pos[0] instanceof CSSPositionValue);
    const bgPos = parseAll('background-position', 'left, right');
    assert.equal(bgPos.length, 2);
    assert.ok(bgPos[0] instanceof CSSPositionValue);
  });

  // cssom-1 § 6.7.1 #set-a-css-declaration / css-variables-1 #using-variables
  // css-values-4 § 10 #math / css-env-1 #env-function / css-values-5 #attr-notation
  test('L433 var/calc/env/attr OR unique-cause via setProperty', () => {
    const decl = new CSSStyleDeclaration();

    // Unique-cause: includes('var(') T (calc/env/attr skipped).
    assert.equal(ParseHooks.validatePropertyValue('width', 'var(--x)'), true);
    decl.setProperty('width', 'var(--x)');
    assert.equal(decl.getPropertyValue('width'), 'var(--x)');
    assert.ok(parseAll('width', 'var(--x)')[0] instanceof CSSUnparsedValue);

    // Unique-cause: var F, calc T (env/attr skipped).
    assert.equal(ParseHooks.validatePropertyValue('width', 'calc(1px + 1px)'), true);
    decl.setProperty('width', 'calc(1px + 1px)');
    assert.equal(decl.getPropertyValue('width'), 'calc(1px + 1px)');
    assert.ok(CSSStyleValue.parse('width', 'calc(1px + 1px)'));

    // Unique-cause: var F, calc F, env T (attr skipped). Missing recapture seam.
    assert.equal(ParseHooks.validatePropertyValue('width', 'env(safe-area-inset-top)'), true);
    assert.equal(ParseHooks.validatePropertyValue('width', 'ENV(safe-area-inset-left)'), true);
    decl.setProperty('width', 'env(safe-area-inset-top)');
    assert.equal(decl.getPropertyValue('width'), 'env(safe-area-inset-top)');
    decl.setProperty('padding-top', 'env(safe-area-inset-top)');
    assert.equal(decl.getPropertyValue('padding-top'), 'env(safe-area-inset-top)');
    // parseAll still grammar-checks; env() is not <length> for width.
    assert.throws(() => parseAll('width', 'env(safe-area-inset-top)'), TypeError);

    // Unique-cause: var F, calc F, env F, attr T. Missing recapture seam.
    assert.equal(ParseHooks.validatePropertyValue('content', 'attr(data-x)'), true);
    assert.equal(ParseHooks.validatePropertyValue('width', 'attr(data-w px)'), true);
    assert.equal(ParseHooks.validatePropertyValue('content', 'ATTR(href)'), true);
    decl.setProperty('content', 'attr(data-x)');
    assert.equal(decl.getPropertyValue('content'), 'attr(data-x)');
    decl.setProperty('width', 'attr(data-w px)');
    assert.equal(decl.getPropertyValue('width'), 'attr(data-w px)');
    const attrParsed = parseAll('content', 'attr(data-x)');
    assert.equal(attrParsed[0].constructor, CSSStyleValue);
    assert.equal(attrParsed[0].toString(), 'attr(data-x)');
    assert.ok(CSSStyleValue.parse('content', 'attr(href)'));

    // Unique-cause: all four F. Falls through to later checks (accept 10px).
    assert.equal(ParseHooks.validatePropertyValue('width', '10px'), true);
    decl.setProperty('width', '10px');
    assert.equal(decl.getPropertyValue('width'), '10px');
    assert.ok(parseAll('width', '10px')[0] instanceof CSSUnitValue);

    // Nested needles must not be used for unique-cause (var+env would not isolate).
    assert.equal(ParseHooks.validatePropertyValue('width', 'var(--x, env(safe-area-inset-top))'), true);
  });

  test('L428 custom startsWith T; L436 some(bad-string|bad-url) T vs length 0', () => {
    // Unique-cause: property.startsWith('--') T. setProperty skips the hook for
    // custom properties (`else if (!property.startsWith('--'))`).
    assert.equal(ParseHooks.validatePropertyValue('--mcdc-cvft', 'hello'), true);
    assert.equal(ParseHooks.validatePropertyValue('--x', '1px'), true);
    assert.equal(ParseHooks.validatePropertyValue('---', 'x'), true);
    const custom = parseAll('--mcdc-cvft', 'hello');
    assert.ok(custom[0] instanceof CSSUnparsedValue);

    // Unique-cause: startsWith F (standard / unknown).
    assert.equal(ParseHooks.validatePropertyValue('width', '10px'), true);
    assert.equal(ParseHooks.validatePropertyValue('color', 'red'), true);

    // Unique-cause: tokens.length === 0 T (some skipped). Comments discarded.
    assert.equal(ParseHooks.validatePropertyValue('width', ''), false);
    assert.equal(ParseHooks.validatePropertyValue('width', '   '), false);
    assert.equal(ParseHooks.validatePropertyValue('width', '/*c*/'), false);
    const decl = new CSSStyleDeclaration();
    decl.setProperty('width', '10px');
    decl.setProperty('width', '   ');
    assert.equal(decl.getPropertyValue('width'), '10px');

    // Unique-cause: length === 0 F && some() T (bad-string / bad-url).
    // css-syntax-3 § 4.3.10 #consume-string-token: newline → bad-string.
    // setProperty returns before the hook on bad tokens.
    const badString = `"foo${'\n'}bar"`;
    assert.equal(ParseHooks.validatePropertyValue('content', badString), false);
    assert.equal(ParseHooks.validatePropertyValue('width', badString), false);
    assert.equal(ParseHooks.validatePropertyValue('background-image', 'url(foo"bar)'), false);
    assert.equal(ParseHooks.validatePropertyValue('width', 'url(http://example.com "bad")'), false);
    decl.setProperty('content', badString);
    assert.equal(decl.getPropertyValue('content'), '');
    assert.throws(() => parseAll('content', badString), TypeError);
    assert.throws(() => parseAll('background-image', 'url(foo"bar)'), TypeError);

    // EOF-unclosed string is a string token, not bad-string (css-syntax-3 § 4.3.10).
    assert.equal(ParseHooks.validatePropertyValue('width', '"unclosed'), true);

    // Unique-cause: length === 0 F && some() F (valid tokens).
    assert.equal(ParseHooks.validatePropertyValue('width', '10px'), true);
    assert.equal(ParseHooks.validatePropertyValue('content', '"ok"'), true);
  });

  // cssom-1 § 6.7.1 #set-a-css-declaration / css-values-4 #typedef-flex
  test('L441 unitless number AND: flex vs number vs integer vs all-F', () => {
    const decl = new CSSStyleDeclaration();

    // Unique-cause: includes('<number>') F, includes('<integer>') F, includes('<flex>') T.
    // grid-auto-columns / grid-auto-rows / border-*-clip list <flex> without number|integer.
    assert.equal(ParseHooks.validatePropertyValue('grid-auto-columns', '1'), true);
    assert.equal(ParseHooks.validatePropertyValue('grid-auto-rows', '2'), true);
    assert.equal(ParseHooks.validatePropertyValue('border-top-clip', '1'), true);
    assert.equal(ParseHooks.validatePropertyValue('border-left-clip', '3'), true);
    decl.setProperty('grid-auto-columns', '1');
    assert.equal(decl.getPropertyValue('grid-auto-columns'), '1');
    decl.setProperty('grid-auto-rows', '2');
    assert.equal(decl.getPropertyValue('grid-auto-rows'), '2');
    decl.setProperty('border-top-clip', '1');
    assert.equal(decl.getPropertyValue('border-top-clip'), '1');
    // parseAll still grammar-checks; unitless 1 is not <flex>. Use 1fr for parse.
    const gac = parseAll('grid-auto-columns', '1fr');
    assert.ok(gac[0] instanceof CSSUnitValue);
    assert.equal((gac[0] as CSSUnitValue).value, 1);
    assert.equal((gac[0] as CSSUnitValue).unit, 'fr');
    assert.throws(() => parseAll('grid-auto-columns', '1'), TypeError);

    // Unique-cause: includes('<number>') T (integer/flex skipped).
    assert.equal(ParseHooks.validatePropertyValue('flex-grow', '1'), true);
    assert.equal(ParseHooks.validatePropertyValue('opacity', '1'), true);
    decl.setProperty('flex-grow', '1');
    assert.equal(decl.getPropertyValue('flex-grow'), '1');

    // Unique-cause: number F, integer T (flex skipped).
    assert.equal(ParseHooks.validatePropertyValue('z-index', '1'), true);
    assert.equal(ParseHooks.validatePropertyValue('order', '2'), true);
    assert.equal(ParseHooks.validatePropertyValue('orphans', '3'), true);
    decl.setProperty('z-index', '1');
    assert.equal(decl.getPropertyValue('z-index'), '1');

    // Unique-cause: number F, integer F, flex F → reject unitless non-zero.
    assert.equal(ParseHooks.validatePropertyValue('width', '1'), false);
    assert.equal(ParseHooks.validatePropertyValue('width', '-100'), false);
    assert.equal(ParseHooks.validatePropertyValue('height', '100'), false);
    decl.setProperty('width', '10px');
    decl.setProperty('width', '1');
    assert.equal(decl.getPropertyValue('width'), '10px');
    decl.setProperty('width', '-100');
    assert.equal(decl.getPropertyValue('width'), '10px');
    assert.throws(() => parseAll('width', '1'), TypeError);

    // Zero is excluded by value !== 0 (does not enter L441).
    assert.equal(ParseHooks.validatePropertyValue('width', '0'), true);
    decl.setProperty('width', '0');
    assert.equal(decl.getPropertyValue('width'), '0');

    // Mute: L447 value !== undefined F (tokenizer always sets dimension.value).
    assert.equal(ParseHooks.validatePropertyValue('width', '-10px'), true);
    assert.equal(ParseHooks.validatePropertyValue('width', '10px'), true);
  });
});
