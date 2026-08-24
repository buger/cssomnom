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
// reqproof:proptest escape
// Property-based test: CSS.escape (cssom-1 § 3 #the-css.escape()-method).
// Independent oracle: two different subsystems consume the escaped output —
// (1) the CSS tokenizer must see exactly one identifier token, and (2) the
// selector parser must accept it as a class selector. Neither re-implements
// the character-walk algorithm under test.
import { test } from 'node:test';
import assert from 'node:assert';
import { escape } from '../src/css-escape.ts';
import { tokenize } from '../src/tokenizer.ts';
import { SelectorParser } from '../src/SelectorParser.ts';
import type { Token } from '../src/types.ts';

let seed = 0x0ddba11;
function rnd(): number {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
}

// Alphabet chosen to avoid inputs whose escaping is lossy BY SPEC:
// NUL maps to U+FFFD and escaped lone surrogates normalize to U+FFFD
// (cssom-1 § 2.3 / css-syntax #consume-escaped-code-point). Those two
// normalizations are asserted explicitly in dedicated edge-case tests below.
const ALPHABET = [
  'a', 'B', 'z', '0', '7', '-', '_', '.', '+', '#', '@', '$', '%', '!', '?',
  '*', '/', '(', ')', '[', ']', '{', '}', '<', '>', '=', ':', ';', ',', '~',
  '^', '&', '|', '"', "'", '\\', ' ', '\t', '\n', '\r', '\x01', '\x1f', '\x7f',
  '\u00e9', '\u4f60', '\u{1f600}',
];

function randomString(): string {
  const len = Math.floor(rnd() * 12);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(rnd() * ALPHABET.length)];
  return s;
}

/** Curated edge cases: empty, digit/dash prefixes, control chars, astral. */
const EDGE_CASES = [
  '', '0abc', '-1abc', '--x', '-', '_x', 'a b', 'a\\b', '.5rem', '@media',
  '#hash', '9', '-9', '\x7f', '\x1f', '\u00e9', '\u{1f600}',
  'has~tilde', 'quote"inside', "apos'inside", '*star', '/slash',
];

function identTokens(tokens: Token[]): Token[] {
  return tokens.filter(t => t.type !== 'EOF' && t.type !== 'whitespace');
}

test('proptest escape output re-tokenizes as a single ident token (3000 cases)', () => {
  const inputs = [...EDGE_CASES];
  for (let i = 0; i < 3000; i++) inputs.push(randomString());
  for (const input of inputs) {
    if (input === '') {
      // cssom-1: escaping the empty identifier serializes to the empty string.
      assert.strictEqual(escape(input), '', 'empty identifier must serialize to ""');
      continue;
    }
    const out = escape(input);
    assert.strictEqual(typeof out, 'string');
    // Determinism on identical input.
    assert.strictEqual(escape(input), out);
    // ORACLE 1: the escaped text must be one single identifier token.
    const tokens = identTokens(tokenize(out));
    assert.strictEqual(
      tokens.length, 1,
      `escape(${JSON.stringify(input)}) -> ${JSON.stringify(out)} produced ${tokens.length} tokens`
    );
    assert.strictEqual(tokens[0].type, 'ident', `not an ident token for ${JSON.stringify(input)}`);
  }
});

test('proptest escape output parses as a valid class selector (1500 cases)', () => {
  const inputs = [...EDGE_CASES].filter(s => s !== '');
  for (let i = 0; i < 1500; i++) inputs.push(randomString().slice(0, 10));
  for (const input of inputs) {
    if (input === '') continue;
    // ORACLE 2: '.' + escape(s) is a grammatically valid class selector.
    // Production callers hand SelectorParser component values without EOF
    // (see matcher.ts / specificity.ts), so strip the EOF token here too.
    const selectorText = '.' + escape(input);
    const parser = new SelectorParser(tokenize(selectorText).filter(t => t.type !== 'EOF'));
    const list = parser.parse();
    const selectors = list?.selectors ?? [];
    assert.strictEqual(
      selectors.length, 1,
      `class selector for ${JSON.stringify(input)} did not parse to one selector`
    );
    assert.ok(selectors[0], `selector falsy for ${JSON.stringify(input)}`);
  }
});

test('proptest escape NULL -> U+FFFD and control chars hex-escaped (spec clauses)', () => {
  // Clause 1: NUL becomes REPLACEMENT CHARACTER.
  assert.strictEqual(escape('a\x00b'), 'a\uFFFDb');
  // Clause 2: C0 controls and DEL escape as code point + space.
  assert.strictEqual(escape('\x01'), '\\1 ');
  assert.strictEqual(escape('\x1f'), '\\1f ');
  assert.strictEqual(escape('\x7f'), '\\7f ');
  // Clause 3: leading digit escaped.
  assert.strictEqual(escape('9lives'), '\\39 lives');
  // Clause 4: digit after leading '-' escaped.
  assert.strictEqual(escape('-9lives'), '-\\39 lives');
  // Clause 5: lone dash escaped.
  assert.strictEqual(escape('-'), '\\-');
  // Clause 7: other specials backslash-escaped verbatim.
  assert.strictEqual(escape('a.b'), 'a\\.b');
});
