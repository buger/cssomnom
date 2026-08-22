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
// Verifies: SYS-REQ-260821-EGCP, SYS-REQ-260821-9YM3, SW-REQ-260821-PD6M,
// SW-REQ-260821-V5GA, SW-REQ-260821-ARC1, INT-REQ-260821-ZP03
// Leftover unique-cause for src/PropertyRegistry.ts besides
// consumeSyntaxComponent (already in tests/mcdc-hotspot-property-registry-syntax.test.ts):
// validate, isComputationallyIndependent, unregister, matchesSyntax, checkItem.
// Drive CSS.registerProperty / matchesSyntax / CSSStyleSheet replaceSync+deleteRule
// / CSSStyleValue.parse / PropertyRegistry.get+unregister.
// css-properties-values-api-1 § 3 #consume-a-syntax-definition /
// § 3.1.3 #computationally-independent / § 3.3 #supported-syntax-strings /
// § 4.1 #the-registerproperty-function / § 2.1 #determining-registration.
// No //mcdc:ignore.
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Parser } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { CSSStyleSheet } from '../src/CSSOM.ts';
import { CSS, CSSStyleValue, CSSKeywordValue } from '../src/typed-om.ts';
import { PropertyRegistry, matchesSyntax } from '../src/PropertyRegistry.ts';
import type { ComponentValue } from '../src/types.ts';

let seq = 0;
function uniqueName(): string {
  seq += 1;
  return `--mcdc-reg2-${seq}`;
}

function values(css: string): ComponentValue[] {
  const tokens = tokenize(css).filter((t) => t.type !== 'whitespace');
  return new Parser(tokens).parseComponentValues();
}

function assertDomSyntax(fn: () => unknown, includes: string, label?: string): void {
  assert.throws(
    fn,
    (err: unknown) =>
      err instanceof DOMException &&
      err.name === 'SyntaxError' &&
      err.message.includes(includes),
    label ?? includes,
  );
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
  assert.ok(stored, `expected ${name} to be stored`);
  return name;
}

function assertIndependent(syntax: string, initialValue: string): string {
  return register(syntax, initialValue);
}

function assertNotIndependent(syntax: string, initialValue: string): void {
  assertDomSyntax(
    () => {
      CSS.registerProperty({
        name: uniqueName(),
        syntax,
        inherits: false,
        initialValue,
      });
    },
    'not computationally independent',
    initialValue,
  );
}

function assertMismatch(syntax: string, initialValue: string): void {
  assertDomSyntax(
    () => {
      CSS.registerProperty({
        name: uniqueName(),
        syntax,
        inherits: false,
        initialValue,
      });
    },
    'does not match syntax',
    `${initialValue} vs ${syntax}`,
  );
}

describe('MC/DC leftover unique-cause: PropertyRegistry besides consumeSyntaxComponent', { concurrency: false }, () => {
  afterEach(() => {
    PropertyRegistry.clear();
  });

  test('validate name-token unique-cause: length, ident, dashed-ident, --, missing name/inherits', () => {
    // css-properties-values-api-1 § 4.1 #the-registerproperty-function
    // Unique-cause of nameTokens.length !== 2 || type !== ident || !startsWith('--')
    // || value === '--' || type !== EOF.
    assertDomSyntax(
      () => CSS.registerProperty({ name: '--foo bar', syntax: '*', inherits: false }),
      'dashed-ident',
      'length !== 2',
    );
    assertDomSyntax(
      () => CSS.registerProperty({ name: '123', syntax: '*', inherits: false }),
      'dashed-ident',
      'type !== ident (number)',
    );
    assertDomSyntax(
      () => CSS.registerProperty({ name: ' ', syntax: '*', inherits: false }),
      'dashed-ident',
      'type !== ident (whitespace)',
    );
    assertDomSyntax(
      () => CSS.registerProperty({ name: '#foo', syntax: '*', inherits: false }),
      'dashed-ident',
      'type !== ident (hash)',
    );
    assertDomSyntax(
      () => CSS.registerProperty({ name: '"--foo"', syntax: '*', inherits: false }),
      'dashed-ident',
      'type !== ident (string)',
    );
    assertDomSyntax(
      () => CSS.registerProperty({ name: 'not-a-custom-prop', syntax: '*', inherits: false }),
      'dashed-ident',
      '!startsWith --',
    );
    assertDomSyntax(
      () => CSS.registerProperty({ name: '--', syntax: '*', inherits: false }),
      'dashed-ident',
      'value === --',
    );
    assertDomSyntax(
      () => CSS.registerProperty({ name: '--foo:', syntax: '*', inherits: false }),
      'dashed-ident',
      'length !== 2 trailing delim',
    );
    register('*');
    register('*', 'x');
    CSS.registerProperty({ name: '---x', syntax: '*', inherits: false });
    CSS.registerProperty({ name: '--1', syntax: '*', inherits: false });
    assert.ok(PropertyRegistry.get('---x'));
    assert.ok(PropertyRegistry.get('--1'));

    assert.throws(
      () =>
        CSS.registerProperty({
          syntax: '*',
          inherits: false,
        } as unknown as { name: string; syntax: string; inherits: boolean }),
      TypeError,
    );
    assert.throws(
      () =>
        CSS.registerProperty({
          name: uniqueName(),
          syntax: '*',
        } as unknown as { name: string; syntax: string; inherits: boolean }),
      TypeError,
    );
    const zeroInherits = uniqueName();
    CSS.registerProperty({
      name: zeroInherits,
      syntax: '*',
      inherits: 0 as unknown as boolean,
    });
    assert.equal(PropertyRegistry.get(zeroInherits)?.inherits, 0 as unknown as boolean);
  });

  test('validate syntax default, * custom-property value, parse-error unique-cause', () => {
    // definition.syntax || '*' — omitted / empty / '*' vs typed.
    const omitted = uniqueName();
    CSS.registerProperty({ name: omitted, inherits: false });
    assert.equal(PropertyRegistry.get(omitted)?.syntax, undefined);

    const emptySyntax = uniqueName();
    CSS.registerProperty({ name: emptySyntax, syntax: '', inherits: false });
    assert.ok(PropertyRegistry.get(emptySyntax));

    register('*');
    register('*', 'anything goes');
    assertDomSyntax(
      () => {
        CSS.registerProperty({
          name: uniqueName(),
          syntax: '<length>',
          inherits: false,
        });
      },
      'initialValue is required',
    );

    // Parser.validateCustomPropertyValue unique-cause (syntax === '*').
    assertDomSyntax(
      () => CSS.registerProperty({ name: uniqueName(), syntax: '*', inherits: false, initialValue: 'foo!' }),
      'not a valid declaration value',
      'top-level !',
    );
    assertDomSyntax(
      () => CSS.registerProperty({ name: uniqueName(), syntax: '*', inherits: false, initialValue: 'a;b' }),
      'not a valid declaration value',
      'top-level semicolon',
    );
    assertDomSyntax(
      () => CSS.registerProperty({ name: uniqueName(), syntax: '*', inherits: false, initialValue: ')' }),
      'not a valid declaration value',
      'unmatched )',
    );
    assertDomSyntax(
      () => CSS.registerProperty({ name: uniqueName(), syntax: '*', inherits: false, initialValue: ']' }),
      'not a valid declaration value',
      'unmatched ]',
    );
    assertDomSyntax(
      () => CSS.registerProperty({ name: uniqueName(), syntax: '*', inherits: false, initialValue: '}' }),
      'not a valid declaration value',
      'unmatched }',
    );
    assertDomSyntax(
      () =>
        CSS.registerProperty({
          name: uniqueName(),
          syntax: '*',
          inherits: false,
          initialValue: 'url(foo"bar)',
        }),
      'not a valid declaration value',
      'bad-url',
    );
    register('*', 'foo( ! )');

    // parser.errors.length unique-cause via unclosed function / simple-block.
    assertDomSyntax(
      () =>
        CSS.registerProperty({
          name: uniqueName(),
          syntax: '<length>',
          inherits: false,
          initialValue: 'calc(10px',
        }),
      'has parse errors',
      'unclosed function',
    );
    assertDomSyntax(
      () =>
        CSS.registerProperty({
          name: uniqueName(),
          syntax: '<length>',
          inherits: false,
          initialValue: '(10px',
        }),
      'has parse errors',
      'unclosed block',
    );
    assertIndependent('<length>', 'calc(10px)');
  });

  test('isComputationallyIndependent var/attr vs nested function unique-cause', () => {
    // css-properties-values-api-1 § 3.1.3 #computationally-independent
    // ['var','attr'].includes(name) T vs F; recursive !independent T vs F.
    assertNotIndependent('<color>', 'var(--x)');
    assertNotIndependent('<length>', 'attr(data-x)');
    assertNotIndependent('<length>', 'VAR(--x)');
    assertNotIndependent('<length>', 'ATTR(data-x)');
    assertNotIndependent('<length>', 'calc(var(--x))');
    assertNotIndependent('<length>', 'calc(attr(data-x))');
    assertNotIndependent('<length>', 'calc(1em)');
    assertNotIndependent('<length>', 'calc(min(1em, 2px))');
    assertNotIndependent('<color>', 'rgb(currentcolor)');
    assertIndependent('<length>', 'calc(10px)');
    assertIndependent('<length>', 'calc(min(1px, 2px))');
    assertIndependent('<color>', 'rgb(0, 0, 0)');
    // env() is not var/attr: independent T, then matchesSyntax F.
    assertMismatch('<length>', 'env(safe-area-inset-top)');
    assertIndependent('<length>', 'calc(env(x))');
  });

  test('isComputationallyIndependent dimension unit AND unique-cause', () => {
    // unit && !(unit in unitToPixels) && !VIEWPORT_UNITS.has && !angle/time/resolution/frequency.
    // B=F (in unitToPixels): absolute lengths are independent.
    for (const unit of ['px', 'cm', 'mm', 'in', 'pt', 'pc', 'q']) {
      assertIndependent('<length>', `1${unit}`);
    }
    // C=F (viewport): independent even though not in unitToPixels.
    for (const unit of [
      'vw', 'vh', 'vi', 'vb', 'vmin', 'vmax',
      'svw', 'svh', 'svi', 'svb', 'svmin', 'svmax',
      'lvw', 'lvh', 'lvi', 'lvb', 'lvmin', 'lvmax',
      'dvw', 'dvh', 'dvi', 'dvb', 'dvmin', 'dvmax',
    ]) {
      assertIndependent('<length>', `1${unit}`);
    }
    // D=F (angle/time/resolution/frequency): independent, then type match.
    assertIndependent('<angle>', '10deg');
    assertIndependent('<angle>', '10grad');
    assertIndependent('<angle>', '1rad');
    assertIndependent('<angle>', '1turn');
    assertIndependent('<time>', '1s');
    assertIndependent('<time>', '10ms');
    assertIndependent('<resolution>', '1dppx');
    assertIndependent('<resolution>', '96dpi');
    assertIndependent('<resolution>', '37dpcm');
    assertIndependent('<resolution>', '1x');
    assertMismatch('<length>', '1Hz');
    assertMismatch('<time>', '1kHz');
    assertIndependent('<length>', 'calc(1Hz)');

    // A,B,C,D all T: not independent (font-relative, container, flex, unknown).
    for (const unit of ['em', 'rem', 'ex', 'ch', 'ic', 'cap', 'lh', 'rlh', 'rex', 'rcap', 'rch', 'ric']) {
      assertNotIndependent('<length>', `1${unit}`);
    }
    for (const unit of ['cqw', 'cqh', 'cqi', 'cqb', 'cqmin', 'cqmax']) {
      assertNotIndependent('<length>', `1${unit}`);
    }
    assertNotIndependent('<flex>', '1fr');
    assertNotIndependent('<length>', '1foo');
  });

  test('isComputationallyIndependent currentcolor ident AND and simple-block recurse', () => {
    // t.type === 'ident' && toLowerCase() === 'currentcolor'
    assertNotIndependent('<color>', 'currentcolor');
    assertNotIndependent('<color>', 'CurrentColor');
    assertIndependent('<color>', 'red');
    assertIndependent('<color>', 'Canvas');
    assert.equal(matchesSyntax(values('currentcolor'), '<color>'), true);

    // t.type === 'simple-block' recurse: independent F vs T then syntax mismatch.
    assertNotIndependent('<length>', '(1em)');
    assertNotIndependent('<length>', '[var(--x)]');
    assertNotIndependent('<length>', '{var(--x)}');
    assertMismatch('<length>', '(10px)');
    assertMismatch('<length>', '[10px]');
  });

  test('unregister origin unique-cause existing F / origin mismatch / matching delete', () => {
    // css-properties-values-api-1 § 2.1 #determining-registration
    // existing && existing.origin === origin
    PropertyRegistry.unregister('--mcdc-reg2-missing', 'css');
    assert.equal(PropertyRegistry.get('--mcdc-reg2-missing'), undefined);

    const jsName = '--mcdc-reg2-js-origin';
    CSS.registerProperty({ name: jsName, syntax: '*', inherits: false });
    PropertyRegistry.unregister(jsName, 'css');
    assert.ok(PropertyRegistry.get(jsName), 'JS origin survives css unregister');
    PropertyRegistry.unregister(jsName, 'js');
    assert.equal(PropertyRegistry.get(jsName), undefined);

    const sheet = new CSSStyleSheet();
    sheet.replaceSync('@property --mcdc-reg2-css-origin { syntax: "*"; inherits: false; }');
    assert.ok(PropertyRegistry.get('--mcdc-reg2-css-origin'));
    PropertyRegistry.unregister('--mcdc-reg2-css-origin', 'js');
    assert.ok(PropertyRegistry.get('--mcdc-reg2-css-origin'), 'CSS origin survives js unregister');
    sheet.deleteRule(0);
    assert.equal(PropertyRegistry.get('--mcdc-reg2-css-origin'), undefined);

    // Public CSSOM: JS-then-CSS then replaceSync unregisters css origin only.
    CSS.registerProperty({ name: '--mcdc-reg2-js-wins', syntax: '*', inherits: false });
    sheet.replaceSync('@property --mcdc-reg2-js-wins { syntax: "<color>"; inherits: true; initial-value: red; }');
    assert.equal(PropertyRegistry.get('--mcdc-reg2-js-wins')?.syntax, '*');
    sheet.replaceSync('');
    assert.ok(PropertyRegistry.get('--mcdc-reg2-js-wins'), 'origin mismatch leaves JS registration');

    // CSS-then-JS overwrites origin to js; sheet replaceSync css-unregister misses it.
    const sheet2 = new CSSStyleSheet();
    sheet2.replaceSync('@property --mcdc-reg2-css-then-js { syntax: "*"; inherits: false; }');
    CSS.registerProperty({
      name: '--mcdc-reg2-css-then-js',
      syntax: '<color>',
      inherits: true,
      initialValue: 'red',
    });
    sheet2.replaceSync('');
    const leftover = PropertyRegistry.get('--mcdc-reg2-css-then-js');
    assert.equal(leftover?.syntax, '<color>');
    PropertyRegistry.unregister('--mcdc-reg2-css-then-js', 'js');
    assert.equal(PropertyRegistry.get('--mcdc-reg2-css-then-js'), undefined);
  });

  test('matchesSyntax leftover: escaped ident startsWith/endsWith unique-cause and ident-literal AND', () => {
    // name.startsWith('<') && name.endsWith('>') after parseSyntax.
    // Escaped ident \00003cfoo is '<foo' (starts T, ends F) → ident literal.
    const ltFoo = '\\00003cfoo';
    const ltFooGt = '\\00003cfoo\\00003e';
    const ltLengthGt = '\\00003clength\\00003e';
    assert.equal(matchesSyntax(values(ltFoo), ltFoo), true);
    assert.equal(matchesSyntax(values('foo'), ltFoo), false);
    register(ltFoo, ltFoo);

    // Escaped '<length>' ident is treated as a type name (starts T, ends T).
    assert.equal(matchesSyntax(values('10px'), ltLengthGt), true);
    assertIndependent(ltLengthGt, '10px');

    // Escaped '<foo>' is not a known type → checkItem falls through to return true.
    assert.equal(matchesSyntax(values('x'), ltFooGt), true);
    assert.equal(matchesSyntax(values('10px'), ltFooGt), true);
    assert.equal(matchesSyntax(values('x y'), ltFooGt), false);
    register(ltFooGt, 'x');
    assert.throws(() => CSSStyleValue.parse(register(ltFooGt, 'x'), 'a b'), TypeError);

    // Ident literal AND: length===1 && type==='ident' && value===name.
    assert.equal(matchesSyntax(values('foo'), 'foo'), true);
    assert.equal(matchesSyntax(values('foo bar'), 'foo'), false);
    assert.equal(matchesSyntax(values('"foo"'), 'foo'), false);
    assert.equal(matchesSyntax(values('bar'), 'foo'), false);
    assert.equal(matchesSyntax(values('FOO'), 'foo'), false);
  });

  test('checkItem leftover: math-function OR, length/number/percentage/integer unique-cause', () => {
    const mathFns: Array<[string, string]> = [
      ['calc(10px)', '<length>'],
      ['min(1px, 2px)', '<length>'],
      ['max(1, 2)', '<number>'],
      ['clamp(1%, 2%, 3%)', '<percentage>'],
      ['round(1, 1)', '<number>'],
      ['mod(5, 2)', '<number>'],
      ['rem(5, 2)', '<number>'],
      ['sin(0)', '<number>'],
      ['cos(0)', '<number>'],
      ['tan(0)', '<number>'],
      ['asin(0)', '<number>'],
      ['acos(1)', '<number>'],
      ['atan(0)', '<number>'],
      ['atan2(1, 1)', '<number>'],
      ['pow(2, 3)', '<number>'],
      ['sqrt(4)', '<number>'],
      ['hypot(3, 4)', '<number>'],
      ['log(1)', '<number>'],
      ['exp(0)', '<number>'],
      ['abs(-1)', '<number>'],
      ['sign(-1)', '<number>'],
    ];
    for (const [css, syntax] of mathFns) {
      assert.equal(matchesSyntax(values(css), syntax), true, css);
    }
    assert.equal(matchesSyntax(values('CALC(10px)'), '<length>'), true);
    assert.equal(matchesSyntax(values('foo()'), '<length>'), false);
    assert.equal(matchesSyntax(values('var(--x)'), '<length>'), false);

    // length: math || (dimension && unitToBase===length) || (number && value===0)
    assert.equal(matchesSyntax(values('10px'), '<length>'), true);
    assert.equal(matchesSyntax(values('10deg'), '<length>'), false);
    assert.equal(matchesSyntax(values('0'), '<length>'), true);
    assert.equal(matchesSyntax(values('1'), '<length>'), false);
    assert.equal(matchesSyntax(values('10%'), '<length>'), false);

    assert.equal(matchesSyntax(values('1.5'), '<number>'), true);
    assert.equal(matchesSyntax(values('10px'), '<number>'), false);
    assert.equal(matchesSyntax(values('10%'), '<percentage>'), true);
    assert.equal(matchesSyntax(values('10px'), '<percentage>'), false);

    // length-percentage: math || length-dim || percentage || number 0
    assert.equal(matchesSyntax(values('10px'), '<length-percentage>'), true);
    assert.equal(matchesSyntax(values('10%'), '<length-percentage>'), true);
    assert.equal(matchesSyntax(values('0'), '<length-percentage>'), true);
    assert.equal(matchesSyntax(values('1'), '<length-percentage>'), false);
    assert.equal(matchesSyntax(values('10deg'), '<length-percentage>'), false);
    assert.equal(matchesSyntax(values('calc(10px + 10%)'), '<length-percentage>'), true);

    // integer: math || (number && numberType==='integer')
    assert.equal(matchesSyntax(values('2'), '<integer>'), true);
    assert.equal(matchesSyntax(values('2.0'), '<integer>'), false);
    assert.equal(matchesSyntax(values('calc(2)'), '<integer>'), true);
    assert.equal(matchesSyntax(values('10px'), '<integer>'), false);

    assert.equal(matchesSyntax(values('10deg'), '<angle>'), true);
    assert.equal(matchesSyntax(values('calc(10deg)'), '<angle>'), true);
    assert.equal(matchesSyntax(values('10px'), '<angle>'), false);
    assert.equal(matchesSyntax(values('1s'), '<time>'), true);
    assert.equal(matchesSyntax(values('calc(1s)'), '<time>'), true);
    assert.equal(matchesSyntax(values('1dppx'), '<resolution>'), true);
    assert.equal(matchesSyntax(values('calc(1dppx)'), '<resolution>'), true);
    assert.equal(matchesSyntax(values('1fr'), '<flex>'), true);
    assert.equal(matchesSyntax(values('calc(1fr)'), '<flex>'), true);
    assert.equal(matchesSyntax(values('10px'), '<flex>'), false);
  });

  test('checkItem leftover: color hash/function/ident OR, url vs image, custom-ident, string', () => {
    assert.equal(matchesSyntax(values('#abc'), '<color>'), true);
    assert.equal(matchesSyntax(values('#abcd'), '<color>'), true);
    assert.equal(matchesSyntax(values('#aabbcc'), '<color>'), true);
    assert.equal(matchesSyntax(values('#aabbccdd'), '<color>'), true);
    assert.equal(matchesSyntax(values('#a'), '<color>'), false);
    assert.equal(matchesSyntax(values('#ab'), '<color>'), false);
    assert.equal(matchesSyntax(values('#abcde'), '<color>'), false);
    assert.equal(matchesSyntax(values('#abcdef0'), '<color>'), false);
    assert.equal(matchesSyntax(values('#ggg'), '<color>'), false);

    for (const fn of [
      'rgb(1, 2, 3)',
      'rgba(1, 2, 3, 0.5)',
      'hsl(0 100% 50%)',
      'hsla(0, 0%, 0%, 1)',
      'hwb(0 0% 0%)',
      'lab(50% 0 0)',
      'lch(50% 0 0)',
      'oklab(0.5 0 0)',
      'oklch(0.5 0 0)',
      'color(srgb 1 0 0)',
    ]) {
      assert.equal(matchesSyntax(values(fn), '<color>'), true, fn);
    }
    assert.equal(matchesSyntax(values('foo()'), '<color>'), false);
    assert.equal(matchesSyntax(values('10px'), '<color>'), false);

    // named T system F; named F system T; both F.
    assert.equal(matchesSyntax(values('red'), '<color>'), true);
    assert.equal(matchesSyntax(values('transparent'), '<color>'), true);
    assert.equal(matchesSyntax(values('Canvas'), '<color>'), true);
    assert.equal(matchesSyntax(values('CanvasText'), '<color>'), true);
    assert.equal(matchesSyntax(values('ButtonFace'), '<color>'), true);
    assert.equal(matchesSyntax(values('Highlight'), '<color>'), true);
    assert.equal(matchesSyntax(values('currentcolor'), '<color>'), true);
    assert.equal(matchesSyntax(values('not-a-color'), '<color>'), false);

    // url: type==='url' || (function && name==='url') — name compare is case-sensitive.
    assert.equal(matchesSyntax(values('url(http://a/)'), '<url>'), true);
    assert.equal(matchesSyntax(values('url("http://a/")'), '<url>'), true);
    assert.equal(matchesSyntax(values('URL("http://a/")'), '<url>'), false);
    assert.equal(matchesSyntax(values('linear-gradient(red, blue)'), '<url>'), false);
    assert.equal(matchesSyntax(values('red'), '<url>'), false);

    // image: type==='url' || type==='function'
    assert.equal(matchesSyntax(values('url(http://a/)'), '<image>'), true);
    assert.equal(matchesSyntax(values('url("http://a/")'), '<image>'), true);
    assert.equal(matchesSyntax(values('URL("http://a/")'), '<image>'), true);
    assert.equal(matchesSyntax(values('linear-gradient(red, blue)'), '<image>'), true);
    assert.equal(matchesSyntax(values('red'), '<image>'), false);

    assert.equal(matchesSyntax(values('banana'), '<custom-ident>'), true);
    assert.equal(matchesSyntax(values('1'), '<custom-ident>'), false);
    for (const kw of ['initial', 'inherit', 'unset', 'revert', 'revert-layer', 'default']) {
      assert.equal(matchesSyntax(values(kw), '<custom-ident>'), false, kw);
    }
    assert.equal(matchesSyntax(values('"hi"'), '<string>'), true);
    assert.equal(matchesSyntax(values('hi'), '<string>'), false);

    register('<url>', 'url(http://a/)');
    register('<url>', 'url("http://a/")');
    register('<image>', 'linear-gradient(red, blue)');
    assertMismatch('<url>', 'URL("http://a/")');
  });

  test('checkItem leftover: transform-function / transform-list unique-cause and return-true fallback', () => {
    const fns = [
      'matrix(1, 0, 0, 1, 0, 0)',
      'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
      'translate(1px)',
      'translate3d(1px, 2px, 3px)',
      'translateX(1px)',
      'translateY(1px)',
      'translateZ(1px)',
      'scale(2)',
      'scale3d(1, 1, 1)',
      'scaleX(2)',
      'scaleY(2)',
      'scaleZ(2)',
      'rotate(1deg)',
      'rotate3d(0, 0, 1, 1deg)',
      'rotateX(1deg)',
      'rotateY(1deg)',
      'rotateZ(1deg)',
      'skew(1deg)',
      'skewX(1deg)',
      'skewY(1deg)',
      'perspective(10px)',
    ];
    for (const css of fns) {
      assert.equal(matchesSyntax(values(css), '<transform-function>'), true, css);
    }
    assert.equal(matchesSyntax(values('10px'), '<transform-function>'), false);
    assert.equal(matchesSyntax(values('unknown-func(1)'), '<transform-function>'), false);
    assert.equal(matchesSyntax(values('none'), '<transform-function>'), false);

    assert.equal(matchesSyntax([], '<transform-list>'), false);
    assert.equal(matchesSyntax(values('none'), '<transform-list>'), false);
    assert.equal(matchesSyntax(values('rotate(1deg) 10px'), '<transform-list>'), false);
    assert.equal(matchesSyntax(values('rotate(1deg) unknown-func(1)'), '<transform-list>'), false);
    assert.equal(matchesSyntax(values('rotate(1deg) translate(1px)'), '<transform-list>'), true);
    register('<transform-list>', 'rotate(1deg) translate(1px)');

    // multiplier leftover: # / + / else (? * none)
    assert.equal(matchesSyntax(values('10px 20px'), '<length>+'), true);
    assert.equal(matchesSyntax([], '<length>+'), false);
    assert.equal(matchesSyntax(values('10px red'), '<length>+'), false);
    assert.equal(matchesSyntax(values('red, blue'), '<color>#'), true);
    assert.equal(matchesSyntax(values('red,'), '<color>#'), false);
    assert.equal(matchesSyntax(values(',red'), '<color>#'), false);
    assert.equal(matchesSyntax(values('10px'), '<length>?'), true);
    assert.equal(matchesSyntax([], '<length>?'), false);
    assert.equal(matchesSyntax(values('10px 20px'), '<length>?'), false);
    assert.equal(matchesSyntax(values('10px'), '<length>*'), true);
    assert.equal(matchesSyntax(values('10px 20px'), '<length>*'), false);
  });

  test('CSSStyleValue.parse on leftover registered syntax drives matchesSyntax', () => {
    const colorName = register('<color>', 'red');
    const parsed = CSSStyleValue.parse(colorName, 'CanvasText');
    assert.ok(parsed instanceof CSSKeywordValue);
    assert.equal((parsed as CSSKeywordValue).value, 'CanvasText');
    assert.throws(() => CSSStyleValue.parse(colorName, 'currentcolor is two'), TypeError);

    const urlName = register('<url>', 'url(http://a/)');
    assert.ok(CSSStyleValue.parse(urlName, 'url("http://b/")'));
    assert.throws(() => CSSStyleValue.parse(urlName, 'URL("http://b/")'), TypeError);

    const angleName = register('<angle>', '10deg');
    assert.ok(CSSStyleValue.parse(angleName, '1turn'));
    assert.throws(() => CSSStyleValue.parse(angleName, '10px'), TypeError);

    const ltFooGt = '\\00003cfoo\\00003e';
    const fallback = register(ltFooGt, 'x');
    assert.ok(CSSStyleValue.parse(fallback, 'anything-one-token'));
    assert.throws(() => CSSStyleValue.parse(fallback, 'two tokens'), TypeError);
  });
});
