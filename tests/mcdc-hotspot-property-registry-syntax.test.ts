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
// Verifies: SYS-REQ-260821-EGCP, SW-REQ-260821-PD6M, INT-REQ-260821-ZP03
// Leftover unique-cause rows for src/PropertyRegistry.ts consumeSyntaxComponent
// (css-properties-values-api-1 § 3 #consume-a-syntax-component /
// § 3 #consume-a-syntax-definition / § 3.3 #supported-syntax-strings /
// § 5.2 #+-and-#-multipliers). No //mcdc:ignore.
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Parser } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { CSS, CSSStyleValue, CSSKeywordValue } from '../src/typed-om.ts';
import { PropertyRegistry, matchesSyntax } from '../src/PropertyRegistry.ts';
import type { ComponentValue } from '../src/types.ts';

let seq = 0;
function uniqueName(): string {
  seq += 1;
  return `--mcdc-syntax-${seq}`;
}

function values(css: string): ComponentValue[] {
  const tokens = tokenize(css).filter((t) => t.type !== 'whitespace');
  return new Parser(tokens).parseComponentValues();
}

function register(syntax: string, initialValue?: string): string {
  const name = uniqueName();
  const definition: { name: string; syntax: string; inherits: boolean; initialValue?: string } = {
    name,
    syntax,
    inherits: false,
  };
  if (initialValue !== undefined) {
    definition.initialValue = initialValue;
  }
  CSS.registerProperty(definition);
  const stored = PropertyRegistry.get(name);
  assert.ok(stored);
  assert.equal(stored.syntax, syntax);
  return name;
}

function assertInvalidSyntax(syntax: string): void {
  assert.throws(
    () => {
      CSS.registerProperty({
        name: uniqueName(),
        syntax,
        inherits: false,
        initialValue: 'red',
      });
    },
    (err: unknown) =>
      err instanceof DOMException &&
      err.name === 'SyntaxError' &&
      err.message.startsWith('Invalid syntax string'),
  );
}

function assertInitialMismatch(syntax: string, initialValue: string): void {
  assert.throws(
    () => {
      CSS.registerProperty({
        name: uniqueName(),
        syntax,
        inherits: false,
        initialValue,
      });
    },
    (err: unknown) =>
      err instanceof DOMException &&
      err.name === 'SyntaxError' &&
      err.message.includes('does not match syntax'),
  );
}

describe('MC/DC leftover: PropertyRegistry consumeSyntaxComponent', { concurrency: false }, () => {
  afterEach(() => {
    PropertyRegistry.clear();
  });

  test('data type names: <color>, unknown, empty, unterminated, inner junk', () => {
    // css-properties-values-api-1 § 3 #consume-a-data-type-name
    register('<color>', 'red');
    register('<length-percentage>', '10px');
    register('<length-percentage>', '10%');

    assertInvalidSyntax('<foo>');
    assertInvalidSyntax('<>');
    assertInvalidSyntax('<COLOR>');
    assertInvalidSyntax('<Length>');
    assertInvalidSyntax('<color');
    assertInvalidSyntax('<');
    assertInvalidSyntax('<color >');
    assertInvalidSyntax('< length >');
    assertInvalidSyntax('<color+>');
    assertInvalidSyntax('<color()>');
  });

  test('unexpected syntax-component start tokens', () => {
    assertInvalidSyntax('1');
    assertInvalidSyntax('"foo"');
    assertInvalidSyntax('#abc');
    assertInvalidSyntax('>');
    assertInvalidSyntax('+');
    assertInvalidSyntax('#');
    assertInvalidSyntax('|');
    assertInvalidSyntax('|<length>');
  });

  test('ident literals, CSS-wide keywords, and custom-ident type', () => {
    // css-properties-values-api-1 § 3 #consume-a-syntax-component
    // css-values-4 § 3.2 #custom-idents / css-cascade-5 #defaulting-keywords
    register('auto', 'auto');
    register('none', 'none');
    register('BIG', 'BIG');
    assertInitialMismatch('BIG', 'big');
    register('--foo', '--foo');
    register('<custom-ident>', 'banana');
    register('<custom-ident>', 'auto');
    assertInitialMismatch('<custom-ident>', 'initial');
    assertInitialMismatch('<custom-ident>', 'INHERIT');
    assertInitialMismatch('<custom-ident>', 'unset');
    assertInitialMismatch('<custom-ident>', 'revert');
    assertInitialMismatch('<custom-ident>', 'revert-layer');
    assertInitialMismatch('<custom-ident>', 'default');

    for (const keyword of ['initial', 'inherit', 'unset', 'revert', 'revert-layer', 'default']) {
      assertInvalidSyntax(keyword);
      assertInvalidSyntax(keyword.toUpperCase());
    }
  });

  test('adjacent multipliers + # ? * and {A,B} closed vs EOF', () => {
    // css-properties-values-api-1 § 5.2 #+-and-#-multipliers
    // css-values-4 § 3.1 #component-multipliers (`?` `*` `{A,B}`)
    register('<length>+', '10px');
    register('<length>+', '10px 20px');
    assertInitialMismatch('<length>+', '10px red');
    assertInitialMismatch('<length>+', ' ');

    register('<color>#', 'red');
    register('<color>#', 'red, blue');
    assertInitialMismatch('<color>#', 'red, 10px');
    assertInitialMismatch('<color>#', 'red,');
    assertInitialMismatch('<color>#', ',red');

    register('<length>?', '10px');
    register('<length>*', '10px');
    assertInitialMismatch('<length>*', '10px 20px');

    register('<length>{1,2}', '10px');
    register('<length>{1,2}', '10px 20px');
    register('<length>{1,4}', '1px 2px 3px 4px');
    register('<length>{}', '10px');
    register('<length>{1,2', '10px');
    register('<length>{', '10px');
  });

  test('whitespace then multiplier unique-cause (+ # ? * {) vs | or junk', () => {
    register('<length> +', '10px 20px');
    register('<color> #', 'red, blue');
    register('<length> ?', '10px');
    register('<length> *', '10px');
    register('<length> {1,2}', '10px 20px');
    register('<length> {1,2', '10px');
    register('<percentage> ', '10%');

    register('<color> | <length>', 'red');
    register('<color> | <length>', '10px');
    assertInvalidSyntax('<length> !');
    assertInvalidSyntax('<length> <percentage>');
    assertInvalidSyntax('<color> #red');
  });

  test('| unions, trailing pipe, double pipe, and * universal', () => {
    // css-properties-values-api-1 § 3 #consume-a-syntax-definition
    register('<color>|<length>', 'red');
    register('<color>|<length>', '10px');
    assertInitialMismatch('<color>|<length>', 'foo');

    register('foo | bar | baz', 'foo');
    register('foo | bar | baz', 'bar');
    register('foo | bar | baz', 'baz');
    assertInitialMismatch('foo | bar | baz', 'qux');

    register('none | <color>', 'none');
    register('none | <color>', '#00ff00');
    register('--foo | <color>', '--foo');
    register('--foo | <color>', 'blue');
    register('foo | <length>#', 'foo');
    register('foo | <length>#', '1px, 2px');
    register('<string>+ | <string>#', '"a" "b"');
    register('<string>+ | <string>#', '"a", "b"');
    register('<transform-function> | <integer>', 'rotate(45deg)');
    register('<transform-function> | <integer>', '2');

    register('<color>\t|   foo', 'foo');
    register('<color>\n|   foo', 'red');
    register('<length>|', '10px');

    assertInvalidSyntax('foo||bar');
    assertInvalidSyntax('foo | | bar');
    assertInvalidSyntax('   ');

    register('*');
    register('*', ':> hello');
    register('*', "yep 'this is valid too'");
  });

  test('<transform-list> is pre-multiplied so a trailing multiplier is invalid', () => {
    // css-properties-values-api-1 § 3 #pre-multiplied-data-type-name
    register('<transform-list>', 'rotate(45deg)');
    register('<transform-list>', 'rotate(45deg) translate(10px)');
    assertInvalidSyntax('<transform-list>+');
    assertInvalidSyntax('<transform-list>#');
  });

  test('matchesSyntax <color> named, hash, function, system, currentcolor, miss', () => {
    assert.equal(matchesSyntax(values('red'), '<color>'), true);
    assert.equal(matchesSyntax(values('Canvas'), '<color>'), true);
    assert.equal(matchesSyntax(values('currentcolor'), '<color>'), true);
    assert.equal(matchesSyntax(values('#abc'), '<color>'), true);
    assert.equal(matchesSyntax(values('#abcd'), '<color>'), true);
    assert.equal(matchesSyntax(values('#aabbcc'), '<color>'), true);
    assert.equal(matchesSyntax(values('#aabbccdd'), '<color>'), true);
    assert.equal(matchesSyntax(values('#ab'), '<color>'), false);
    assert.equal(matchesSyntax(values('#abcde'), '<color>'), false);
    assert.equal(matchesSyntax(values('#ggg'), '<color>'), false);
    assert.equal(matchesSyntax(values('rgb(1, 2, 3)'), '<color>'), true);
    assert.equal(matchesSyntax(values('rgba(1, 2, 3, 0.5)'), '<color>'), true);
    assert.equal(matchesSyntax(values('hsl(0 100% 50%)'), '<color>'), true);
    assert.equal(matchesSyntax(values('color(srgb 1 0 0)'), '<color>'), true);
    assert.equal(matchesSyntax(values('lab(50% 0 0)'), '<color>'), true);
    assert.equal(matchesSyntax(values('foo()'), '<color>'), false);
    assert.equal(matchesSyntax(values('not-a-color'), '<color>'), false);
    assert.equal(matchesSyntax(values('10px'), '<color>'), false);
    assert.equal(matchesSyntax([], '<color>'), false);
  });

  test('matchesSyntax <length>+ every-item unique-cause and # comma list', () => {
    assert.equal(matchesSyntax(values('10px'), '<length>+'), true);
    assert.equal(matchesSyntax(values('10px 20px'), '<length>+'), true);
    assert.equal(matchesSyntax(values('calc(1px)'), '<length>+'), true);
    assert.equal(matchesSyntax(values('0'), '<length>+'), true);
    assert.equal(matchesSyntax(values('10px red'), '<length>+'), false);
    assert.equal(matchesSyntax(values('10deg'), '<length>+'), false);
    assert.equal(matchesSyntax([], '<length>+'), false);
    assert.equal(matchesSyntax(values('   '), '<length>+'), false);

    assert.equal(matchesSyntax(values('red, blue'), '<color>#'), true);
    assert.equal(matchesSyntax(values('red, 10px'), '<color>#'), false);
    assert.equal(matchesSyntax(values('red,'), '<color>#'), false);
    assert.equal(matchesSyntax(values(',red'), '<color>#'), false);
  });

  test('matchesSyntax * short-circuit, invalid syntax false, ident and type unions', () => {
    assert.equal(matchesSyntax([], '*'), true);
    assert.equal(matchesSyntax(values(':> hello'), '*'), true);
    assert.equal(matchesSyntax(values('red'), ''), false);
    assert.equal(matchesSyntax(values('red'), '   '), false);
    assert.equal(matchesSyntax(values('red'), '<nope>'), false);
    assert.equal(matchesSyntax(values('red'), '<color'), false);

    assert.equal(matchesSyntax(values('red'), '<color> | <length>'), true);
    assert.equal(matchesSyntax(values('10px'), '<color> | <length>'), true);
    assert.equal(matchesSyntax(values('zzz'), '<color> | <length>'), false);
    assert.equal(matchesSyntax(values('foo'), 'foo | bar'), true);
    assert.equal(matchesSyntax(values('bar'), 'foo | bar'), true);
    assert.equal(matchesSyntax(values('FOO'), 'foo | bar'), false);
    assert.equal(matchesSyntax(values('--foo'), '--foo | <color>'), true);
    assert.equal(matchesSyntax(values('banana'), '<custom-ident>'), true);
    assert.equal(matchesSyntax(values('inherit'), '<custom-ident>'), false);
  });

  test('matchesSyntax remaining supported types including transform-function miss', () => {
    assert.equal(matchesSyntax(values('1.5'), '<number>'), true);
    assert.equal(matchesSyntax(values('10%'), '<percentage>'), true);
    assert.equal(matchesSyntax(values('2'), '<integer>'), true);
    assert.equal(matchesSyntax(values('1.5'), '<integer>'), false);
    assert.equal(matchesSyntax(values('10deg'), '<angle>'), true);
    assert.equal(matchesSyntax(values('1s'), '<time>'), true);
    assert.equal(matchesSyntax(values('1dppx'), '<resolution>'), true);
    assert.equal(matchesSyntax(values('1fr'), '<flex>'), true);
    assert.equal(matchesSyntax(values('url(http://a/)'), '<url>'), true);
    assert.equal(matchesSyntax(values('linear-gradient(red, blue)'), '<image>'), true);
    assert.equal(matchesSyntax(values('"hi"'), '<string>'), true);
    assert.equal(matchesSyntax(values('rotate(1deg)'), '<transform-function>'), true);
    assert.equal(matchesSyntax(values('10px'), '<transform-function>'), false);
    assert.equal(matchesSyntax(values('unknown-func(1)'), '<transform-function>'), false);
    assert.equal(matchesSyntax([], '<transform-list>'), false);
    assert.equal(matchesSyntax(values('none'), '<transform-list>'), false);
    assert.equal(matchesSyntax(values('rotate(1deg) translate(1px)'), '<transform-list>'), true);
  });

  test('CSS.registerProperty then CSSStyleValue.parse drives matchesSyntax', () => {
    const colorName = register('<color>', 'red');
    const parsedColor = CSSStyleValue.parse(colorName, 'blue');
    assert.ok(parsedColor instanceof CSSKeywordValue);
    assert.equal((parsedColor as CSSKeywordValue).value, 'blue');
    assert.throws(() => CSSStyleValue.parse(colorName, '10px'), TypeError);

    const lengthPlus = register('<length>+', '1px');
    const parsedList = CSSStyleValue.parse(lengthPlus, '1px 2px');
    assert.ok(parsedList instanceof CSSStyleValue);
    assert.equal(parsedList.toString().includes('1px'), true);
    assert.throws(() => CSSStyleValue.parse(lengthPlus, 'red'), TypeError);

    const unionName = register('<color> | auto', 'red');
    const parsedAuto = CSSStyleValue.parse(unionName, 'auto');
    assert.ok(parsedAuto instanceof CSSKeywordValue);
    assert.equal((parsedAuto as CSSKeywordValue).value, 'auto');

    const identName = register('foo | bar', 'foo');
    const parsedIdent = CSSStyleValue.parse(identName, 'bar');
    assert.ok(parsedIdent instanceof CSSKeywordValue);
    assert.equal((parsedIdent as CSSKeywordValue).value, 'bar');
    assert.throws(() => CSSStyleValue.parse(identName, 'baz'), TypeError);

    const starName = register('*', 'x');
    const parsedStar = CSSStyleValue.parse(starName, 'anything goes');
    assert.ok(parsedStar);
  });
});
