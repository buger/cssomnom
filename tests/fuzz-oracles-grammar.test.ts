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

// Tests for the seeded value-definition-syntax sampler (fuzz oracle).
// Grammar under test: CSS Values 4 § "Value definition syntax"
// (https://www.w3.org/TR/css-values-4/#value-defs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STANDARD_PROPERTIES_SYNTAX } from '../src/data/gen/standard-syntax.ts';
import { DEFAULT_TYPE_POOL, SyntaxGenerator } from '../fuzz/oracles/lib/grammar-gen.ts';
import { rngFromSeed } from '../fuzz/css-fuzz/src/rng.ts';

/** True if `value` contains C0/C1 control characters other than whitespace. */
// Allowed whitespace: 0x09 (tab), 0x0A (LF), 0x0D (CR), 0x20 (space).
function hasControlChar(value: string): boolean {
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0x09 || code === 0x0a || code === 0x0d || code === 0x20) continue;
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function makeResolver(): (name: string) => string | undefined {
  return (name) => STANDARD_PROPERTIES_SYNTAX[name];
}

test('same seed produces an identical sample sequence', () => {
  const syntaxes = [
    'background',
    'margin',
    '<number># [alpha | beta]{2}',
    "<'width'>",
    '<length-percentage>{1,4} && <color>?',
  ];
  const a = new SyntaxGenerator(rngFromSeed(1234), makeResolver());
  const b = new SyntaxGenerator(rngFromSeed(1234), makeResolver());
  for (const syntax of syntaxes) {
    const seqA: (string | null)[] = [];
    const seqB: (string | null)[] = [];
    for (let i = 0; i < 10; i++) {
      seqA.push(a.sample(syntax));
      seqB.push(b.sample(syntax));
    }
    assert.deepStrictEqual(seqA, seqB);
    for (const value of seqA) assert.notEqual(value, null, syntax);
  }
});

test('different seeds produce different sequences', () => {
  const a = new SyntaxGenerator(rngFromSeed(1));
  const b = new SyntaxGenerator(rngFromSeed(2));
  const seqA: string[] = [];
  const seqB: string[] = [];
  for (let i = 0; i < 20; i++) {
    seqA.push(String(a.sample('<color> | <length-percentage> | <basic-shape>')));
    seqB.push(String(b.sample('<color> | <length-percentage> | <basic-shape>')));
  }
  assert.notDeepStrictEqual(seqA, seqB);
});

test('30 real properties sample non-null across >=5 seeds', () => {
  const names = Object.keys(STANDARD_PROPERTIES_SYNTAX).sort();
  assert.ok(names.length >= 30, 'expected a substantial property table');
  // Deterministically pick 30 entries spread across the sorted table.
  const stride = Math.max(1, Math.floor(names.length / 30));
  const subset: string[] = [];
  for (let i = 0; i < names.length && subset.length < 30; i += stride) {
    subset.push(names[i]);
  }
  assert.equal(subset.length, 30);

  for (const name of subset) {
    const syntax = STANDARD_PROPERTIES_SYNTAX[name];
    assert.ok(syntax, name);
    for (const seed of [1, 7, 42, 1337, 20260823]) {
      const gen = new SyntaxGenerator(rngFromSeed(seed), makeResolver());
      const value = gen.sample(syntax);
      assert.ok(value !== null, `${name} (${JSON.stringify(syntax)}) seed=${seed}`);
      assert.ok(value.length > 0, `${name} produced empty value`);
      assert.ok(value.length <= 512, `${name} exceeded default maxLength: ${value}`);
      assert.ok(!hasControlChar(value), `${name}: control char in ${JSON.stringify(value)}`);
    }
  }
});

test('quantifier `<number>#` generates comma lists of 1..4 numbers', () => {
  const gen = new SyntaxGenerator(rngFromSeed(9));
  let sawMultiItem = false;
  for (let i = 0; i < 40; i++) {
    const value = gen.sample('<number>#');
    assert.ok(value !== null);
    const parts = value.split(',').map((part) => part.trim());
    assert.ok(parts.length >= 1 && parts.length <= 4, JSON.stringify(value));
    if (parts.length > 1) sawMultiItem = true;
    for (const part of parts) {
      assert.match(part, /^-?(\d+(\.\d+)?|\.\d+)$/);
    }
  }
  assert.ok(sawMultiItem, 'expected at least one multi-item list');
});

test('`[a | b]{2}` always yields exactly two items', () => {
  const gen = new SyntaxGenerator(rngFromSeed(11));
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const value = gen.sample('[alpha | beta]{2}');
    assert.ok(value !== null);
    const items = value.split(' ');
    assert.equal(items.length, 2, JSON.stringify(value));
    for (const item of items) assert.ok(item === 'alpha' || item === 'beta');
    seen.add(value);
  }
  assert.ok(seen.size >= 2, 'expected variety across repeats');
});

test('`a? b` yields only "b" or "a b", both observed', () => {
  const gen = new SyntaxGenerator(rngFromSeed(13));
  const seen = new Set<string>();
  for (let i = 0; i < 60; i++) {
    const value = gen.sample('a? b');
    assert.ok(value !== null);
    assert.ok(value === 'b' || value === 'a b', JSON.stringify(value));
    seen.add(value);
  }
  assert.ok(seen.has('b'));
  assert.ok(seen.has('a b'));
});

test('`a && b` yields all components in either order', () => {
  const gen = new SyntaxGenerator(rngFromSeed(17));
  const seen = new Set<string>();
  for (let i = 0; i < 60; i++) {
    const value = gen.sample('first && second');
    assert.ok(value !== null);
    assert.ok(value === 'first second' || value === 'second first', JSON.stringify(value));
    seen.add(value);
  }
  assert.ok(seen.has('first second'));
  assert.ok(seen.has('second first'));
});

test('`a || b` yields one-or-more any-order subsets', () => {
  const allowed = new Set(['left', 'right', 'left right', 'right left']);
  const gen = new SyntaxGenerator(rngFromSeed(19));
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const value = gen.sample('left || right');
    assert.ok(value !== null);
    assert.ok(allowed.has(value), JSON.stringify(value));
    seen.add(value);
  }
  for (const expected of allowed) {
    assert.ok(seen.has(expected), `missing outcome ${JSON.stringify(expected)}`);
  }
});

test('`<length>{1,2}` and `<integer>#?` respect their counts', () => {
  const gen = new SyntaxGenerator(rngFromSeed(23));
  const lengthPool = new Set(DEFAULT_TYPE_POOL['<length>']);
  let sawTwoLengths = false;
  let sawEmptyList = false;
  for (let i = 0; i < 80; i++) {
    const lengths = gen.sample('<length>{1,2}');
    assert.ok(lengths !== null);
    const items = lengths.split(' ');
    assert.ok(items.length >= 1 && items.length <= 2, JSON.stringify(lengths));
    if (items.length === 2) sawTwoLengths = true;
    for (const item of items) assert.ok(lengthPool.has(item), item);

    const optionalList = gen.sample('<integer>#?');
    assert.ok(optionalList !== null);
    if (optionalList === '') {
      sawEmptyList = true;
    } else {
      const ints = optionalList.split(',').map((part) => part.trim());
      assert.ok(ints.length >= 1 && ints.length <= 4);
      for (const int of ints) assert.match(int, /^-?\d+$/);
    }
  }
  assert.ok(sawTwoLengths);
  assert.ok(sawEmptyList);
});

test('listTypeRefs collects unique types in first-appearance order', () => {
  const gen = new SyntaxGenerator(rngFromSeed(1));
  const refs = gen.listTypeRefs("<'width'> || <color># [ <length> | <percentage> ]{1,2} <url> <length>");
  assert.deepEqual(refs, ['color', 'length', 'percentage', 'url']);
  // Property references are not type references.
  assert.deepEqual(gen.listTypeRefs("<'grid-area'> <'line-width'>"), []);
  // Malformed syntax yields an empty list instead of throwing.
  assert.deepEqual(gen.listTypeRefs('[unclosed'), []);
  assert.deepEqual(gen.listTypeRefs('plain | keywords'), []);
});

test("<'property'> recursion resolves through the callback", () => {
  const gen = new SyntaxGenerator(rngFromSeed(21), makeResolver());
  const widthValues = new Set([
    ...DEFAULT_TYPE_POOL['<length-percentage>'],
    'auto',
    'fit-content',
    'max-content',
    'min-content',
  ]);
  for (let i = 0; i < 25; i++) {
    const value = gen.sample("<'width'>");
    assert.ok(value !== null);
    assert.ok(widthValues.has(value), `unexpected width value ${JSON.stringify(value)}`);
  }

  // Nested property reference chains also resolve.
  const composed = gen.sample("<'border-width'> <'border-style'> <color>");
  assert.ok(composed !== null);
  assert.ok(composed.split(' ').length >= 3, composed);
});

test("unknown and cyclic <'property'> references fail safely", () => {
  const unknown = new SyntaxGenerator(rngFromSeed(3));
  assert.equal(unknown.sample("<'nope'>"), null);

  // A purely self-referential grammar has no producible match.
  const cyclic = new SyntaxGenerator(rngFromSeed(4), (name) =>
    name === 'selfref' ? "<'selfref'>" : undefined,
  );
  assert.equal(cyclic.sample("<'selfref'>"), null);

  // A recursive grammar with an alternative terminates on that alternative
  // instead of hanging or overflowing.
  const chain = new SyntaxGenerator(rngFromSeed(4), (name) =>
    name === 'chain' ? "[ done | <'chain'> ]" : undefined,
  );
  assert.equal(chain.sample("<'chain'>"), 'done');

  const throwing = new SyntaxGenerator(rngFromSeed(5), () => {
    throw new Error('resolver exploded');
  });
  assert.equal(throwing.sample("<'boom'>"), null);
});

test('maxLength is respected strictly and still admits values', () => {
  const gen = new SyntaxGenerator(rngFromSeed(31));
  let successes = 0;
  for (let i = 0; i < 300; i++) {
    const value = gen.sample('<shadow> <color>? <length>#', { maxLength: 24 });
    if (value === null) continue;
    successes++;
    assert.ok(value.length <= 24, `too long (${value.length}): ${JSON.stringify(value)}`);
  }
  assert.ok(successes > 0, 'tight budget should still admit short samples');
});

test('maxDepth bounds recursion strictly', () => {
  const gen = new SyntaxGenerator(rngFromSeed(37));
  const nested = '[ [ alpha | beta ] ]{2}';
  assert.ok(gen.sample(nested, { maxDepth: 6 }) !== null);
  assert.equal(gen.sample(nested, { maxDepth: 1 }), null);
  assert.equal(gen.sample(nested, { maxDepth: 0 }), null);
});

test('malformed syntax returns null without throwing', () => {
  const gen = new SyntaxGenerator(rngFromSeed(41));
  const malformed = [
    '',
    '   ',
    '[',
    ']',
    '[unclosed',
    '<unclosed',
    '<>',
    '"oops',
    'a{2,1}',
    'a{',
    'a{}',
    '|',
    '||',
    '&&',
    'a |',
    'a &&',
    ')',
    '@',
  ];
  for (const syntax of malformed) {
    assert.equal(gen.sample(syntax), null, JSON.stringify(syntax));
    assert.deepEqual(gen.listTypeRefs(syntax), [], JSON.stringify(syntax));
  }
});

test('comma lists never emit doubled commas when items carry their own', () => {
  // Regression: `[ <x> , ]#` must not produce "a ,, b".
  const gen = new SyntaxGenerator(rngFromSeed(61));
  let sawList = false;
  for (let i = 0; i < 40; i++) {
    const value = gen.sample('[ <shadow> , ]#');
    assert.ok(value !== null);
    assert.ok(!value.includes(',,') && !value.includes(', ,'), JSON.stringify(value));
    if (value.includes(',')) sawList = true;
  }
  assert.ok(sawList);
});

test('default type pool is complete and clean', () => {
  const requiredKeys = [
    '<length>',
    '<percentage>',
    '<length-percentage>',
    '<number>',
    '<integer>',
    '<angle>',
    '<time>',
    '<frequency>',
    '<resolution>',
    '<color>',
    '<url>',
    '<string>',
    '<image>',
    '<ident>',
    '<custom-ident>',
    '<dashed-ident>',
    '<position>',
    '<bg-position>',
    '<bg-size>',
    '<line-width>',
    '<border-style>',
    '<border-width>',
    '<shadow>',
    '<basic-shape>',
    '<calc-sum>',
    '<single-transition-timing-function>',
    '<font-family>',
  ];
  for (const key of requiredKeys) {
    const pool = DEFAULT_TYPE_POOL[key];
    assert.ok(Array.isArray(pool) && pool.length >= 2 && pool.length <= 6, key);
  }
  for (const [key, variants] of Object.entries(DEFAULT_TYPE_POOL)) {
    for (const variant of variants) {
      assert.ok(variant.length > 0 && variant.length <= 64, key);
      assert.ok(!hasControlChar(variant), key);
    }
  }
  for (const variant of DEFAULT_TYPE_POOL['<calc-sum>']) {
    assert.match(variant, /^calc\(.+\)$/);
  }
  // Font family names containing spaces must be quoted.
  for (const variant of DEFAULT_TYPE_POOL['<font-family>']) {
    if (variant.includes(' ')) assert.ok(variant.startsWith('"') && variant.endsWith('"'), variant);
  }
});

test('every pooled type reference samples within budget', () => {
  for (const key of Object.keys(DEFAULT_TYPE_POOL)) {
    const gen = new SyntaxGenerator(rngFromSeed(key.length + 53));
    for (let i = 0; i < 10; i++) {
      const value = gen.sample(`${key}`, { maxLength: 128 });
      assert.ok(value !== null, key);
      assert.ok(value.length <= 128, `${key}: ${value}`);
    }
  }
});
