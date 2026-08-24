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
// reqproof:proptest serializeMediaQuery, hasUnclosedConstruct
// Property-based test for media query canonical serialization
// (mediaqueries-4 § 3.2). Every MediaParser.parse() call drives
// hasUnclosedConstruct over the parsed value tree.
//
// Properties (oracle = parse/serialize used as independent consumers):
// 1. Canonical fixpoint: serialize(parse(serialize(parse(x)))) ===
//    serialize(parse(x)) — canonical form is stable under re-parsing.
// 2. Query-count preservation: re-parsing a serialized list never changes
//    how many queries it contains ('not all' replacement is stable).
// 3. Invalid inputs collapse to 'not all' deterministically.
import { test } from 'node:test';
import assert from 'node:assert';
import { MediaParser, serializeMediaQuery } from '../src/MediaParser.ts';

let seed = 0x0badf00d;
function rnd(): number {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
}

const MQ_FRAGMENTS = [
  'screen', 'print', 'all', 'not all', 'only screen', 'tv',
  '(min-width: 100px)', '(width > 50em)', '(max-height: calc(10px + 2em))',
  '(prefers-color-scheme: dark)', '(color)', '(grid)', '(unknown-feature)',
  '(min-width: 10px) and (max-width: 20px)', 'not (color)',
  '(orientation: landscape) or (monochrome)', '--custom-mq',
  '(resolution >= 2dppx)', '(hover: none)', '(width = 100px)',
];

function randomMediaQueryList(): string {
  const n = 1 + Math.floor(rnd() * 3);
  const queries: string[] = [];
  for (let i = 0; i < n; i++) {
    const parts = 1 + Math.floor(rnd() * 3);
    const chosen: string[] = [];
    for (let j = 0; j < parts; j++) {
      chosen.push(MQ_FRAGMENTS[Math.floor(rnd() * MQ_FRAGMENTS.length)]);
    }
    let q = chosen[0];
    // Only condition fragments may chain after media types.
    for (let j = 1; j < chosen.length; j++) {
      if (chosen[j].startsWith('(')) q += ` and ${chosen[j]}`;
    }
    if (rnd() < 0.08) q += '('; // inject unclosed construct / invalid syntax
    queries.push(q);
  }
  return queries.join(', ');
}

function canon(text: string): string[] {
  return MediaParser.parse(text).map(serializeMediaQuery);
}

test('proptest media query canonical form is stable under re-parse (2500 cases)', () => {
  for (let i = 0; i < 2500; i++) {
    const input = randomMediaQueryList();
    const c1 = canon(input);
    const s1 = c1.join(', ');
    const c2 = canon(s1);
    const s2 = c2.join(', ');
    assert.strictEqual(
      s2, s1,
      `canonical form not stable for ${JSON.stringify(input)}: ${JSON.stringify(s1)} -> ${JSON.stringify(s2)}`
    );
    assert.strictEqual(
      c2.length, c1.length,
      `query count changed for ${JSON.stringify(input)} (${c1.length} -> ${c2.length})`
    );
  }
});

test('proptest parse is deterministic on identical input (800 cases)', () => {
  for (let i = 0; i < 800; i++) {
    const input = randomMediaQueryList();
    assert.deepStrictEqual(
      canon(input).join(','), canon(input).join(','),
      `nondeterministic canonicalization of ${JSON.stringify(input)}`
    );
  }
});

test('proptest invalid queries collapse to exactly "not all"', () => {
  // Fully-invalid inputs: every produced query must be the 'not all' fallback.
  // (Note: '(min-width:)' is deliberately excluded — MediaParser models it as
  // a general-enclosed condition instead of flagging the query invalid.)
  const fullyInvalid = ['(', 'not', '(((', 'screen(('];
  for (const text of fullyInvalid) {
    for (const q of MediaParser.parse(text)) {
      assert.strictEqual(q.invalid, true, `expected invalid for ${JSON.stringify(text)}`);
      assert.strictEqual(serializeMediaQuery(q), 'not all');
    }
  }
  // Mixed lists: only the malformed tail collapses; valid heads survive.
  for (let i = 0; i < 400; i++) {
    const text = randomMediaQueryList() + ' ((';
    const queries = MediaParser.parse(text);
    assert.ok(queries.length >= 1, `no queries for ${JSON.stringify(text)}`);
    const last = queries[queries.length - 1];
    assert.strictEqual(last.invalid, true, `tail not invalid for ${JSON.stringify(text)}`);
    assert.strictEqual(serializeMediaQuery(last), 'not all', `tail not 'not all' for ${JSON.stringify(text)}`);
  }
});
