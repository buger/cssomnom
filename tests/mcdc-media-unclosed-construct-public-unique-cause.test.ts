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
// Verifies: SYS-REQ-260821-5283, SW-REQ-260821-W8S1, INT-REQ-260821-MZW3
// Public-API unique-cause for src/MediaParser.ts hasUnclosedConstruct
// (simple-block.unclosed / function.unclosed / nested recurse). Drive only
// MediaParser.parse / evaluate / serializeMediaQuery. Unbalanced `(` is
// `not all` (mediaqueries-4 § 3.2 #error-handling, css-syntax-3 § 2.2
// #autoclosing / § 5.5.9 #consume-simple-block / § 5.5.10 #consume-function).
// `'name' in v` F (function token without name) and nested-unclosed inside a
// closed outer are UNREACHABLE: consumeComponentValue always builds
// CSSFunction.name, and closing the outer requires closing the inner first.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MediaParser,
  serializeMediaQuery,
} from '../src/MediaParser.ts';

function ser(text: string): string[] {
  return MediaParser.parse(text).map(serializeMediaQuery);
}

function invalid(text: string): boolean {
  const queries = MediaParser.parse(text);
  assert.equal(queries.length, 1, `expected one query for ${JSON.stringify(text)}`);
  return queries[0].invalid === true;
}

describe('MC/DC public unique-cause: hasUnclosedConstruct via MediaParser.parse', () => {
  test('unbalanced `(` simple-block unique-cause unclosed T vs closed F', () => {
    assert.deepEqual(ser('('), ['not all']);
    assert.equal(invalid('('), true);
    assert.equal(MediaParser.evaluate('('), false);
    assert.deepEqual(ser('(('), ['not all']);
    assert.deepEqual(ser('((('), ['not all']);
    assert.deepEqual(ser('(color'), ['not all']);
    assert.deepEqual(ser('(min-width: 1px'), ['not all']);
    assert.deepEqual(ser('(aspect-ratio: 16/9'), ['not all']);
    assert.deepEqual(ser('not ('), ['not all']);
    assert.deepEqual(ser('only ('), ['not all']);
    assert.deepEqual(ser('screen and (color'), ['not all']);

    assert.equal(invalid('(color)'), false);
    assert.equal(ser('(color)')[0], '(color)');
    assert.equal(MediaParser.evaluate('(color)'), true);
    assert.equal(invalid('(min-width: 1px)'), false);
    assert.equal(MediaParser.evaluate('(min-width: 1px)'), true);
  });

  test('unclosed function unique-cause type===function and name in T', () => {
    assert.deepEqual(ser('foo('), ['not all']);
    assert.equal(invalid('foo('), true);
    assert.deepEqual(ser('calc('), ['not all']);
    assert.deepEqual(ser('min(1px'), ['not all']);
    assert.deepEqual(ser('(foo('), ['not all']);
    assert.deepEqual(ser('(color('), ['not all']);
    assert.deepEqual(ser('(calc(1px'), ['not all']);
    assert.deepEqual(ser('(width: calc(1px'), ['not all']);
    assert.deepEqual(ser('calc(min(1px'), ['not all']);
    assert.deepEqual(ser('calc((1px)'), ['not all']);

    assert.equal(invalid('min(1px, 2px)'), false);
    assert.equal(ser('min(1px, 2px)')[0], 'min(1px, 2px)');
    assert.equal(invalid('(foo())'), false);
    assert.equal(ser('(foo())')[0], 'foo()');
    assert.equal(invalid('(calc(1px))'), false);
    assert.equal(ser('(calc(1px))')[0], 'calc(1px)');
    assert.equal(invalid('calc((1px))'), false);
    assert.equal(ser('calc((1px))')[0], 'calc(1px)');
  });

  test('nested closed simple-block unique-cause recurse F; mixed brackets', () => {
    assert.equal(invalid('((color))'), false);
    assert.equal(ser('((color))')[0], '(color)');
    assert.equal(MediaParser.evaluate('((color))'), true);
    assert.equal(invalid('((min-width: 1px))'), false);
    assert.equal(MediaParser.evaluate('((min-width: 1px))'), true);
    assert.equal(invalid('(calc(min(1px, 2px)))'), false);
    assert.equal(invalid('((color)'), true);
    assert.equal(invalid('screen and ((color)'), true);
    assert.equal(invalid('(color['), true);
    assert.equal(invalid('(color[])'), false);
    assert.equal(ser('(color[])')[0], '(color [])');
    assert.equal(invalid('(color[x])'), false);
    assert.equal(ser('(color[x])')[0], '(color [x])');
  });

  test('non-block/non-function values skip hasUnclosedConstruct arms', () => {
    assert.deepEqual(ser('all'), ['all']);
    assert.equal(MediaParser.evaluate('all'), true);
    assert.deepEqual(ser('screen'), ['screen']);
    assert.equal(invalid('url()'), false);
    assert.equal(ser('url()')[0], 'url("")');
    assert.equal(invalid('(url())'), false);
    assert.deepEqual(ser('all, (color'), ['all', 'not all']);
    assert.deepEqual(ser('all,'), ['all', 'not all']);
    assert.deepEqual(ser(', all'), ['not all', 'all']);
    // Comma inside the unclosed `(` is not a list separator.
    assert.deepEqual(ser('(color, all'), ['not all']);
    assert.equal(MediaParser.evaluate('all, (color'), true);
    assert.equal(MediaParser.evaluate('(color'), false);
  });
});
