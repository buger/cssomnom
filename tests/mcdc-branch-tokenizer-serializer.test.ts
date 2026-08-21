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
// Verifies: SYS-REQ-260821-SBJ7, SW-REQ-260821-7M07, SYS-REQ-260821-KV30, SW-REQ-260821-YTV6
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/tokenizer.ts';
import { serialize } from '../src/serializer.ts';
import { parse } from '../src/parser.ts';
import {
  CSSAtRule,
  CSSFontFaceRule,
  CSSImportRule,
  CSSKeyframesRule,
  CSSMediaRule,
  CSSNamespaceRule,
  CSSPageRule,
  CSSScopeRule,
  CSSStartingStyleRule,
  CSSSupportsRule,
} from '../src/CSSOM.ts';
import type { Token } from '../src/types.ts';

function first(css: string, unicodeRanges = false): Token {
  const tokens = tokenize(css, unicodeRanges);
  assert.ok(tokens.length >= 1);
  return tokens[0];
}

function nonEof(css: string, unicodeRanges = false): Token[] {
  return tokenize(css, unicodeRanges).filter((t) => t.type !== 'EOF');
}

describe('MC/DC leftover: unicode escapes (css-syntax-3 § 4.3.7 #consume-escaped-code-point)', () => {
  test('hex escapes of 1 and 6 digits decode; trailing whitespace is consumed', () => {
    assert.equal(first('\\61').type, 'ident');
    assert.equal(first('\\61').value, 'a');
    assert.equal(first('\\61 ').value, 'a');
    assert.equal(first('\\000061b').value, 'ab');
    assert.equal(first('\\62\nident').value, 'bident');
  });

  test('hex 0, surrogates, and values above U+10FFFF become U+FFFD', () => {
    assert.equal(first('\\0').value, '\uFFFD');
    assert.equal(first('\\000000').value, '\uFFFD');
    assert.equal(first('\\d800').value, '\uFFFD');
    assert.equal(first('\\DFFF').value, '\uFFFD');
    assert.equal(first('\\110000').value, '\uFFFD');
  });

  test('EOF after a backslash and a non-hex escaped code point', () => {
    assert.equal(first('\\').value, '\uFFFD');
    assert.equal(first('foo\\').value, 'foo\uFFFD');
    assert.equal(first('\\*foo').value, '*foo');
    assert.equal(first('\\z').value, 'z');
  });

  test('escaped newline continues a string; hex newline in a string is a code point', () => {
    const continued = first('"foo\\\nbar"');
    assert.equal(continued.type, 'string');
    assert.equal(continued.value, 'foobar');

    const newline = first('"foo\\a bar"');
    assert.equal(newline.type, 'string');
    assert.equal(newline.value, 'foo\nbar');

    const nul = first('"\\0"');
    assert.equal(nul.type, 'string');
    assert.equal(nul.value, '\uFFFD');
  });

  test('ident and at-keyword sequences started by an escape, including dash-plus-escape', () => {
    assert.equal(first('-\\31 foo').type, 'ident');
    assert.equal(first('-\\31 foo').value, '-1foo');
    assert.equal(first('@\\6d edia').type, 'at-keyword');
    assert.equal(first('@\\6d edia').value, 'media');
    assert.equal(serialize(tokenize('-\\31 foo')), '-\\31 foo');
    assert.equal(serialize(tokenize('@\\6d edia')), '@media');
  });

  test('invalid escape at the start of a token is a delim backslash', () => {
    const tokens = nonEof('\\\nident');
    assert.equal(tokens[0].type, 'delim');
    assert.equal(tokens[0].value, '\\');
    assert.equal(tokens[1].type, 'whitespace');
    assert.equal(tokens[2].type, 'ident');
    assert.equal(tokens[2].value, 'ident');
  });
});

describe('MC/DC leftover: bad-url (css-syntax-3 § 4.3.6 #consume-url-token, § 4.3.14 #consume-remnants-of-bad-url)', () => {
  test('unquoted url with ", \', (, or a non-printable is a bad-url', () => {
    assert.equal(first('url(foo"bar)').type, 'bad-url');
    assert.equal(first('url(foo"bar)').value, 'foo');
    assert.equal(first("url(foo'bar)").type, 'bad-url');
    assert.equal(first("url(foo'bar)").value, 'foo');
    assert.equal(first('url(foo(bar))').type, 'bad-url');
    assert.equal(first('url(foo(bar))').value, 'foo');
    assert.equal(first('url(foo\u0001bar)').type, 'bad-url');
    assert.equal(first('url(\u0007x)').type, 'bad-url');
  });

  test('whitespace after the url body: ) keeps url, non-) is bad-url, EOF keeps url', () => {
    assert.equal(first('url(foo )').type, 'url');
    assert.equal(first('url(foo )').value, 'foo');
    assert.equal(first('url(foo bar)').type, 'bad-url');
    assert.equal(first('url(foo bar)').value, 'foo');
    assert.equal(first('url(foo ').type, 'url');
    assert.equal(first('url(foo').type, 'url');
    assert.equal(first('url(foo').value, 'foo');
  });

  test('valid escape in a url is consumed; invalid escape and remnants-with-escape are bad-url', () => {
    const escaped = first('url(\\000041foo)');
    assert.equal(escaped.type, 'url');
    assert.equal(escaped.value, 'Afoo');

    const closeParen = first('url(foo\\)');
    assert.equal(closeParen.type, 'url');
    assert.equal(closeParen.value, 'foo)');

    const badEscape = first('url(foo\\\n)');
    assert.equal(badEscape.type, 'bad-url');

    const remnants = first('url(foo bar\\41)');
    assert.equal(remnants.type, 'bad-url');
    assert.equal(first('url(foo \\))').type, 'bad-url');
  });

  test('serialize of a bad-url token uses the default token arm', () => {
    assert.equal(serialize([{ type: 'bad-url', value: 'foo' }]), 'foo');
    assert.equal(serialize(tokenize('url(foo"bar)')), 'foo');
    assert.equal(serialize([{ type: 'bad-url', value: '' }]), '');
  });
});

describe('MC/DC leftover: CDO and CDC (css-syntax-3 § 4.3.1 #consume-token)', () => {
  test('<!-- is CDO; prefixes that are not the full sequence stay delims', () => {
    assert.equal(first('<!--').type, 'CDO');
    assert.equal(first('<!--').value, '<!--');

    assert.equal(first('<').type, 'delim');
    assert.equal(first('<').value, '<');

    const bang = nonEof('<!');
    assert.equal(bang[0].type, 'delim');
    assert.equal(bang[0].value, '<');
    assert.equal(bang[1].type, 'delim');
    assert.equal(bang[1].value, '!');

    const almost = nonEof('<!-');
    assert.deepEqual(almost.map((t) => t.value), ['<', '!', '-']);
    assert.ok(almost.every((t) => t.type === 'delim'));

    const extra = nonEof('<!---');
    assert.equal(extra[0].type, 'CDO');
    assert.equal(extra[1].type, 'delim');
    assert.equal(extra[1].value, '-');
  });

  test('--> is CDC; -- is an ident; lone - and -> are delims', () => {
    assert.equal(first('-->').type, 'CDC');
    assert.equal(first('-->').value, '-->');
    assert.equal(first('--').type, 'ident');
    assert.equal(first('--').value, '--');
    assert.equal(first('-').type, 'delim');
    assert.equal(first('-').value, '-');
    const arrow = nonEof('->');
    assert.equal(arrow[0].type, 'delim');
    assert.equal(arrow[0].value, '-');
    assert.equal(arrow[1].type, 'delim');
    assert.equal(arrow[1].value, '>');
  });

  test('serialize round-trips CDO and CDC and inserts a separator before CDC after an ident', () => {
    assert.equal(serialize(tokenize('<!-- -->')), '<!-- -->');
    assert.equal(serialize([{ type: 'CDO', value: '<!--' }, { type: 'CDC', value: '-->' }]), '<!---->');
    assert.equal(
      serialize([
        { type: 'ident', value: 'foo' },
        { type: 'CDC', value: '-->' },
      ]),
      'foo/**/-->',
    );
  });
});

describe('MC/DC leftover: hash id vs unrestricted (css-syntax-3 § 4.3.1 #consume-token)', () => {
  test('ident-start after # is hashType id; digits and #-digit are unrestricted', () => {
    const id = first('#id');
    assert.equal(id.type, 'hash');
    assert.equal(id.value, 'id');
    assert.equal(id.hashType, 'id');

    const digits = first('#123');
    assert.equal(digits.type, 'hash');
    assert.equal(digits.value, '123');
    assert.equal(digits.hashType, 'unrestricted');

    const dashLetter = first('#-a');
    assert.equal(dashLetter.type, 'hash');
    assert.equal(dashLetter.hashType, 'id');
    assert.equal(dashLetter.value, '-a');

    const dashDigit = first('#-1');
    assert.equal(dashDigit.type, 'hash');
    assert.equal(dashDigit.hashType, 'unrestricted');
    assert.equal(dashDigit.value, '-1');

    const custom = first('#--');
    assert.equal(custom.type, 'hash');
    assert.equal(custom.hashType, 'id');
    assert.equal(custom.value, '--');
  });

  test('escape after # starts an id hash; newline after \\ does not', () => {
    const escaped = first('#\\31 foo');
    assert.equal(escaped.type, 'hash');
    assert.equal(escaped.value, '1foo');
    assert.equal(escaped.hashType, 'id');

    const dashEscape = first('#-\\31 ');
    assert.equal(dashEscape.type, 'hash');
    assert.equal(dashEscape.hashType, 'id');
    assert.equal(dashEscape.value, '-1');

    const eofEscape = first('#\\');
    assert.equal(eofEscape.type, 'hash');
    assert.equal(eofEscape.hashType, 'id');
    assert.equal(eofEscape.value, '\uFFFD');

    const invalid = nonEof('#\\\nfoo');
    assert.equal(invalid[0].type, 'delim');
    assert.equal(invalid[0].value, '#');
    assert.equal(invalid[1].type, 'delim');
    assert.equal(invalid[1].value, '\\');
  });

  test('bare # and # followed by a non-ident are delim tokens', () => {
    assert.equal(first('#').type, 'delim');
    assert.equal(first('#').value, '#');
    const hashDot = nonEof('#.');
    assert.equal(hashDot[0].type, 'delim');
    assert.equal(hashDot[0].value, '#');
    assert.equal(hashDot[1].type, 'delim');
    assert.equal(hashDot[1].value, '.');
    const hashNl = nonEof('#\nfoo');
    assert.equal(hashNl[0].type, 'delim');
    assert.equal(hashNl[0].value, '#');
    assert.equal(hashNl[1].type, 'whitespace');
  });

  test('serialize of id and unrestricted hashes both emit # plus the name', () => {
    assert.equal(serialize([{ type: 'hash', value: 'id', hashType: 'id' }]), '#id');
    assert.equal(serialize([{ type: 'hash', value: '123', hashType: 'unrestricted' }]), '#123');
    assert.equal(serialize(tokenize('#id')), '#id');
    assert.equal(serialize(tokenize('#123')), '#123');
  });
});

describe('MC/DC leftover: scientific numbers (css-syntax-3 § 4.3.12 #consume-number)', () => {
  test('e/E exponents with optional sign are type number', () => {
    const e = first('1e2');
    assert.equal(e.type, 'number');
    assert.equal(e.value, 100);
    assert.equal(e.numberType, 'number');

    const E = first('1E2');
    assert.equal(E.type, 'number');
    assert.equal(E.value, 100);
    assert.equal(E.numberType, 'number');

    const plus = first('1e+2');
    assert.equal(plus.value, 100);

    const minus = first('1e-2');
    assert.equal(minus.value, 0.01);

    const upperMinus = first('1E-3');
    assert.equal(upperMinus.value, 0.001);
  });

  test('e that is not followed by a digit (or +/- digit) stays a dimension unit', () => {
    const justE = first('1e');
    assert.equal(justE.type, 'dimension');
    assert.equal(justE.value, 1);
    assert.equal(justE.unit, 'e');
    assert.equal(justE.numberType, 'integer');

    const ePlus = nonEof('1e+');
    assert.equal(ePlus[0].type, 'dimension');
    assert.equal(ePlus[0].unit, 'e');
    assert.equal(ePlus[1].type, 'delim');
    assert.equal(ePlus[1].value, '+');

    const ePlusX = nonEof('1e+x');
    assert.equal(ePlusX[0].type, 'dimension');
    assert.equal(ePlusX[0].unit, 'e');
    assert.equal(ePlusX[1].type, 'delim');
    assert.equal(ePlusX[2].type, 'ident');

    const ex = first('1ex');
    assert.equal(ex.type, 'dimension');
    assert.equal(ex.unit, 'ex');
  });

  test('decimal, signed, dimension, and percentage scientific forms, plus would-start-number false rows', () => {
    assert.equal(first('.5e2').value, 50);
    const signed = first('+1.5e-2');
    assert.equal(signed.value, 0.015);
    assert.equal(signed.sign, '+');
    assert.equal(first('+.5').value, 0.5);
    assert.equal(first('-.5').value, -0.5);

    const dim = first('-1e10px');
    assert.equal(dim.type, 'dimension');
    assert.equal(dim.value, -10000000000);
    assert.equal(dim.unit, 'px');
    assert.equal(dim.sign, '-');

    const pct = first('1e2%');
    assert.equal(pct.type, 'percentage');
    assert.equal(pct.value, 100);

    const notDecimal = nonEof('1.e2');
    assert.equal(notDecimal[0].type, 'number');
    assert.equal(notDecimal[0].value, 1);
    assert.equal(notDecimal[0].numberType, 'integer');
    assert.equal(notDecimal[1].type, 'delim');
    assert.equal(notDecimal[1].value, '.');

    const dotIdent = nonEof('.foo');
    assert.equal(dotIdent[0].type, 'delim');
    assert.equal(dotIdent[0].value, '.');
    assert.equal(dotIdent[1].type, 'ident');

    const plusDot = nonEof('+.');
    assert.deepEqual(plusDot.map((t) => t.value), ['+', '.']);
    assert.ok(plusDot.every((t) => t.type === 'delim'));
  });

  test('serialize of scientific tokens uses decimal form, not e-notation', () => {
    assert.equal(serialize(tokenize('1e2')), '100');
    assert.equal(serialize(tokenize('1e-2')), '0.01');
    assert.equal(serialize(tokenize('1e+2px')), '100px');
    assert.equal(serialize([{ type: 'dimension', value: 10, unit: '', numberType: 'integer', sign: null }]), '10');
  });
});

describe('MC/DC leftover: serialize of at-rules (cssom-1 § 6.2 #serialize-a-css-rule, css-syntax-3 § 8 #serialization)', () => {
  test('at-keyword tokens serialize with identifier escaping; bare @ is a delim', () => {
    assert.equal(first('@media').type, 'at-keyword');
    assert.equal(first('@').type, 'delim');
    assert.equal(first('@-foo').type, 'at-keyword');
    const atDot = nonEof('@.');
    assert.equal(atDot[0].type, 'delim');
    assert.equal(atDot[0].value, '@');
    assert.equal(serialize([{ type: 'at-keyword', value: 'media' }]), '@media');
    assert.equal(serialize([{ type: 'at-keyword', value: '0foo' }]), '@\\30 foo');
    assert.equal(serialize(tokenize('@media')), '@media');
  });

  test('unknown at-rule statement, empty block, declarations, and nested qualified rule', () => {
    const statement = parse('@foo bar;').cssRules[0] as CSSAtRule;
    assert.ok(statement instanceof CSSAtRule);
    assert.equal(statement.cssText, '@foo bar;');

    const empty = parse('@foo { }').cssRules[0] as CSSAtRule;
    assert.ok(empty instanceof CSSAtRule);
    assert.equal(empty.cssText, '@foo  { }');

    const decls = parse('@foo { color: red; }').cssRules[0] as CSSAtRule;
    assert.equal(decls.cssText, '@foo  {\n  color: red;\n}');

    const nested = parse('@foo { p { color: red; } }').cssRules[0] as CSSAtRule;
    assert.equal(nested.cssText, '@foo  {\n  p { color: red; }\n}');
  });

  test('grouping at-rules: empty media uses a newline body; empty keyframes/scope use { }', () => {
    const mediaEmpty = parse('@media { }').cssRules[0] as CSSMediaRule;
    assert.ok(mediaEmpty instanceof CSSMediaRule);
    assert.equal(mediaEmpty.cssText, '@media {\n}');

    const mediaAll = parse('@media all { }').cssRules[0] as CSSMediaRule;
    assert.equal(mediaAll.cssText, '@media all {\n}');

    const mediaRules = parse('@media all { p { color: red; } }').cssRules[0] as CSSMediaRule;
    assert.equal(mediaRules.cssText, '@media all {\n  p { color: red; }\n}');

    const keyframes = parse('@keyframes spin { }').cssRules[0] as CSSKeyframesRule;
    assert.ok(keyframes instanceof CSSKeyframesRule);
    assert.equal(keyframes.cssText, '@keyframes spin { }');

    const scope = parse('@scope { }').cssRules[0] as CSSScopeRule;
    assert.ok(scope instanceof CSSScopeRule);
    assert.equal(scope.cssText, '@scope { }');

    const scopeFilled = parse('@scope (div) to (span) { p { color: green; } }').cssRules[0] as CSSScopeRule;
    assert.equal(scopeFilled.cssText.includes('@scope (div) to (span)'), true);
    assert.equal(scopeFilled.cssText.includes('p { color: green; }'), true);
  });

  test('import, namespace, supports, font-face, page, and starting-style cssText', () => {
    const imp = parse('@import "x.css";').cssRules[0] as CSSImportRule;
    assert.ok(imp instanceof CSSImportRule);
    assert.equal(imp.cssText, '@import url("x.css");');

    const ns = parse('@namespace ns url("http://n");').cssRules[0] as CSSNamespaceRule;
    assert.ok(ns instanceof CSSNamespaceRule);
    assert.equal(ns.cssText, '@namespace ns url("http://n");');

    const supports = parse('@supports (display: grid) { a { color: blue; } }').cssRules[0] as CSSSupportsRule;
    assert.ok(supports instanceof CSSSupportsRule);
    assert.equal(supports.cssText, '@supports (display: grid) {\n  a { color: blue; }\n}');

    const fontFace = parse('@font-face { font-family: X; src: url(x); }').cssRules[0] as CSSFontFaceRule;
    assert.ok(fontFace instanceof CSSFontFaceRule);
    assert.equal(fontFace.cssText.includes('@font-face'), true);
    assert.equal(fontFace.cssText.includes('font-family: X'), true);

    const page = parse('@page { margin: 1cm; }').cssRules[0] as CSSPageRule;
    assert.ok(page instanceof CSSPageRule);
    assert.equal(page.cssText.startsWith('@page'), true);
    assert.equal(page.cssText.includes('margin: 1cm'), true);

    const starting = parse('@starting-style { }').cssRules[0] as CSSStartingStyleRule;
    assert.ok(starting instanceof CSSStartingStyleRule);
    assert.equal(starting.cssText, '@starting-style {\n}');
  });
});
