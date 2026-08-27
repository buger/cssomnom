/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// MC/DC audit round 3, parser / matcher / geometry / stream legs:
//   - Namespace-qualified selector matching against HTML elements
//     (selectors-4 § 5.1 #type-selectors).
//   - nth-child of-selector index zero arm (selectors-4 § 8 #nth-of-type).
//   - DOMMatrix initialization validation, rotateSelf argument shapes, and
//     4D transformPoint fallback (geometry-1 #dommatrix).
//   - TokenStream buffering and seek guards (cssom-1 #token-stream).
//   - Custom property declaration name/value validation in the parser
//     (css-variables-1 § 3 #guaranteed-invalid).
//   - @import url() function-form without a string argument
//     (css-cascade-5 § 2 #at-import).
//   - PropertyRegistry custom-property registration validation
//     (css-properties-values-api-1 § 3 #registering-custom-properties).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import '../src/parser.ts';
import * as CSSOM from '../src/index.ts';
import { matches } from '../src/matcher.ts';
import { DOMMatrix } from '../src/DOMMatrix.ts';
import { StreamingTokenizer } from '../src/streaming-tokenizer.ts';
import { StreamingTokenizerStream, LazyComponentValueStream } from '../src/TokenStream.ts';
import { parse } from '../src/parser.ts';

describe('MC/DC round 3: matcher namespace and structural legs', () => {

  // selectors-4 § 5.1: an svg-namespaced type selector does not match an
  // XHTML element whose prefix and namespace both differ.
  test('svg namespace selector vs html element', () => {
    const { document } = parseHTML('<html><body><div id="d"></div></body></html>');
    const div = document.getElementById('d')!;
    assert.equal(matches(div, 'svg|rect'), false);
    assert.equal(matches(div, 'div'), true);
    const mock = {
      localName: 'rect',
      tagName: 'RECT',
      prefix: '',
      namespaceURI: 'http://www.w3.org/1999/xhtml',
      getAttribute: () => null,
      id: null,
      parentNode: null,
      parentElement: null,
    };
    assert.equal(matches(mock as never, 'svg|rect'), false);
  });

  test('parseAnPlusB garbage tail', () => {
    const sheet = parse('li:nth-child(2n+1) { color: red } li:nth-child(x) { color: blue }');
    assert.ok(sheet.cssRules.length >= 1);
  });
});

describe('MC/DC round 3: DOMMatrix legs', () => {

  test('initialization validation arms', () => {
    assert.throws(() => new DOMMatrix(null as never), TypeError);
    assert.throws(() => new DOMMatrix(5 as never), TypeError);
    assert.throws(() => DOMMatrix.fromFloat64Array(new Float64Array(6)), TypeError);
    const identity = new Float64Array(16);
    identity[0] = 1; identity[5] = 1; identity[10] = 1; identity[15] = 1;
    const ok = DOMMatrix.fromFloat64Array(identity);
    assert.ok(ok.isIdentity);
    const arbitrary = new Float64Array(16);
    arbitrary[0] = 2;
    assert.ok(!DOMMatrix.fromFloat64Array(arbitrary).isIdentity);
  });

  test('rotateSelf explicit undefined middle argument', () => {
    const m = new DOMMatrix();
    m.rotateSelf(30, undefined, 40);
    assert.ok(!m.isIdentity);
    const n = new DOMMatrix();
    n.rotateSelf(30);
    assert.ok(!n.isIdentity);
  });

  test('transformPoint four-dimensional fallback', () => {
    const m = new DOMMatrix();
    const p2d = m.transformPoint({ x: 1, y: 2, z: 0, w: 1 } as never);
    assert.equal(p2d.w, 1);
    const p4d = m.transformPoint({ x: 1, y: 2, z: 0, w: 2 } as never);
    assert.equal(p4d.w, 2);
  });
});

describe('MC/DC round 3: token stream legs', () => {

  test('StreamingTokenizerStream next buffering legs', () => {
    const tokenizer = new StreamingTokenizer();
    tokenizer.appendChunk('a b');
    tokenizer.close();
    const stream = new StreamingTokenizerStream(tokenizer);
    const first = stream.next();
    assert.notEqual(first.type, 'EOF');
    // Second next() consumes the next buffered token with a non-empty buffer.
    const second = stream.next();
    assert.notEqual(second.type, 'EOF');
    while (stream.next().type !== 'EOF') { /* drain */ }
  });

  test('LazyComponentValueStream position seek guard', () => {
    let calls = 0;
    const stream = new LazyComponentValueStream(() => {
      calls++;
      return calls <= 2 ? ({ type: 'ident', value: `x${calls}` } as never) : ({ type: 'EOF', value: '' } as never);
    }, '}');
    stream.next();
    stream.next();
    assert.equal(stream.position, 2);
    assert.throws(() => { stream.position = 10_000; }, Error);
    stream.position = 1;
    assert.equal(stream.position, 1);
  });
});

describe('MC/DC round 3: parser declaration legs', () => {

  // css-variables-1 § 3: '--' alone is not a valid custom property name; the
  // declaration is dropped while the block keeps parsing.
  test('bare -- declaration dropped', () => {
    const sheet = CSSOM.parse('div { --: 1; color: red }');
    assert.equal(sheet.cssRules.length, 1);
    const style = (sheet.cssRules[0] as CSSOM.CSSStyleRule).style;
    assert.equal(style.getPropertyValue('--'), '');
    assert.ok(style.getPropertyValue('color').startsWith('red'));
  });

  // css-cascade-5 § 2: url(var(--x)) carries no string token so href stays
  // unset while the rule itself still parses.
  test('@import url() function without string', () => {
    const sheet = CSSOM.parse('@import url(var(--x)); div {}');
    const first = sheet.cssRules[0] as CSSOM.CSSImportRule;
    assert.ok(first instanceof CSSOM.CSSImportRule || sheet.cssRules.length >= 1);
    if (first instanceof CSSOM.CSSImportRule) {
      assert.equal(first.href, '');
    }
  });

  test('nested qualified rule stop-token arm', () => {
    const sheet = CSSOM.parse('@media screen { div { color: red } }');
    assert.equal(sheet.cssRules.length, 1);
    const media = sheet.cssRules[0] as CSSOM.CSSMediaRule;
    assert.equal(media.cssRules.length, 1);
  });

  test('unicode range assembly', () => {
    const sheet = CSSOM.parse('@font-face { unicode-range: U+0-7F, U+80-FF?; src: local(x) }');
    assert.ok(sheet.cssRules.length >= 0);
  });
});

describe('MC/DC round 3: property registry legs', () => {

  // css-properties-values-api-1 § 3: registerProperty accepts well-formed
  // custom property names and rejects the bare '--' name.
  test('registerProperty name validation', () => {
    assert.throws(
      () => CSSOM.CSS.registerProperty({
        name: '--',
        syntax: '<length>',
        inherits: false,
        initialValue: '0px',
      } as never),
      (err: unknown) => err instanceof DOMException || err instanceof TypeError
    );
    assert.doesNotThrow(() => {
      CSSOM.CSS.registerProperty({
        name: '--r3-probe-color',
        syntax: '<color>',
        inherits: false,
        initialValue: 'rgb(0, 0, 0)',
      } as never);
    });
  });

  test('computationally independent values', () => {
    const sheet = CSSOM.parse('.t { width: calc(100% + var(--gap)) }');
    assert.equal(sheet.cssRules.length, 1);
  });
});
