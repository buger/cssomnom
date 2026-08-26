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
// Witness for INT-REQ-260826-ATRD (at-rule dispatch decomposition of
// SW-REQ-260822-73TM): the ASCII-case-insensitive at-keyword fold and the
// Object.hasOwn handler-table hit construct a typed CSSOM rule; a table miss
// (including prototype-polluting spellings) falls back to CSSAtRule. Public
// parse() surface only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, CSSMediaRule, CSSKeyframesRule, CSSAtRule } from '../src/index.ts';

// SW-REQ-260822-73TM:nominal:nominal
test('mixed-case and alias at-keywords fold to a typed CSSOM rule', () => {
  // css-syntax-3 infra #ascii-case-insensitive: @MEDIA folds to @media.
  const media = parse('@MEDIA screen { a { b: c } }');
  assert.ok(media.cssRules[0] instanceof CSSMediaRule, 'typed CSSMediaRule');

  // The -keyframes alias family resolves through the same fold.
  const alias = parse('@-WEBKIT-KEYFRAMES spin { from { opacity: 0 } to { opacity: 1 } }');
  assert.ok(alias.cssRules[0] instanceof CSSKeyframesRule, 'typed CSSKeyframesRule');
});

// SW-REQ-260822-73TM:nominal:negative
test('handler-table misses fall back to CSSAtRule, never the prototype chain', () => {
  // Object.hasOwn guard: @__proto__ / @constructor are NOT table entries and
  // must not resolve through Object.prototype.
  const proto = parse('@__proto__ { x: y }');
  assert.ok(proto.cssRules[0] instanceof CSSAtRule, 'prototype spelling falls back');
  const ctor = parse('@constructor { x: y }');
  assert.ok(ctor.cssRules[0] instanceof CSSAtRule, 'constructor spelling falls back');
  const unknown = parse('@totally-unknown-at-rule { x: y }');
  assert.ok(unknown.cssRules[0] instanceof CSSAtRule, 'unknown at-rule falls back');
});
