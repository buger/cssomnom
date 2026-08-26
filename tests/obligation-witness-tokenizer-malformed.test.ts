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
// Obligation witnesses for the tokenizer malformed-escape recovery policy
// (css-syntax-3 § 4.3.7 consume-escaped-code-point): the declared policy is
// DETERMINISTIC RECOVERY — invalid escaped code points decode to U+FFFD and
// hex runs stop at 6 digits, preserving the remainder — never a partial
// declaration, never a raw NUL/surrogate code unit in the stored value.
// Driven through the public parse() surface only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/index.ts';

function contentOf(css: string): string {
  const sheet = parse(css);
  assert.equal(sheet.cssRules.length, 1, 'declaration rule survives malformed escape');
  return (sheet.cssRules[0] as { style: { getPropertyValue(k: string): string } }).style.getPropertyValue('content');
}

// SW-REQ-260822-7R6Z:malformed_recovers_or_errors_loudly:nominal
// SW-REQ-260822-7R6Z:overflow_safety:nominal
test('valid and at-cap escapes decode to their code points (happy path)', () => {
  // Nominal path of the recovery policy: an escape within the 6-digit cap
  // decodes to the authored code point.
  const inCap = contentOf('.t { content: "\\41"; }');
  assert.equal(inCap, '"A"');
  const four = contentOf('.t { content: "\\1234"; }');
  assert.equal(four, '"\u1234"');
  // Exactly six hex digits — the cap boundary — still decodes to the scalar.
  const maxScalar = contentOf('.t { content: "\\10FFFF"; }');
  assert.equal(maxScalar, '"\u{10FFFF}"');
});

// SW-REQ-260822-7R6Z:malformed_recovers_or_errors_loudly:negative
// SW-REQ-260822-7R6Z:overflow_safety:negative
test('NUL and surrogate escapes recover to U+FFFD instead of raw code units', () => {
  // css-syntax-3 § 4.3.7: a NUL code point or a value outside the scalar
  // range is replaced by U+FFFD; the declaration is still stored.
  const nul = contentOf('.t { content: "\\0"; }');
  assert.equal(nul, '"\uFFFD"');
  const surrogate = contentOf('.t { content: "\\D800"; }');
  assert.equal(surrogate, '"\uFFFD"');
  const aboveMax = contentOf('.t { content: "\\110000"; }');
  assert.equal(aboveMax, '"\uFFFD"');
});

// SW-REQ-260822-7R6Z:malformed_recovers_or_errors_loudly:negative
test('over-long hex escape stops at 6 digits and preserves the remainder', () => {
  // css-syntax-3 § 4.3.7 caps the hex run at 6 digits; the 7th digit stays a
  // literal character. U+123456 exceeds U+10FFFF, so the escape decodes to
  // U+FFFD and the trailing '7' survives: deterministic recovery that keeps
  // exactly what the spec says is preserved.
  const overlong = contentOf('.t { content: "\\1234567"; }');
  assert.equal(overlong, '"\uFFFD7"');
});
