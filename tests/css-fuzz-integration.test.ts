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
/**
 * Integration tests against the in-crate stub (xml-fuzz `tests/integration.rs` analog).
 * Does not assert against cssomnom product behavior.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as cssfuzz from '../fuzz/css-fuzz/src/index.ts';
import type { ParseOutcome } from '../fuzz/css-fuzz/src/index.ts';

test('generators never throw and emit non-empty', () => {
  const rng = cssfuzz.rngFromSeed(99);
  for (let i = 0; i < 40; i++) {
    const doc = cssfuzz.genDocument(rng);
    assert.ok(doc instanceof Uint8Array);
    assert.ok(doc.length > 0, 'generator must emit bytes');
  }
});

test('wellformed and malformed generators are non-empty', () => {
  const rng = cssfuzz.rngFromSeed(5);
  for (let i = 0; i < 20; i++) {
    assert.ok(cssfuzz.genWellformed(rng).length > 0);
    assert.ok(cssfuzz.genMalformed(rng).length > 0);
  }
});

test('two seeds can produce different documents', () => {
  const a = cssfuzz.rngFromSeed(1);
  const b = cssfuzz.rngFromSeed(2);
  const da = cssfuzz.genDocument(a);
  const db = cssfuzz.genDocument(b);
  if (buffersEqual(da, db)) {
    const da2 = cssfuzz.genDocument(a);
    const db2 = cssfuzz.genDocument(b);
    assert.equal(buffersEqual(da2, db2), false, 'generators stuck on single constant document');
  }
});

test('mutations never throw on generated input; every MUTATION_OPS entry runs', () => {
  const rng = cssfuzz.rngFromSeed(7);
  const doc = cssfuzz.genDocument(rng);
  for (const op of cssfuzz.MUTATION_OPS) {
    const out = op(rng, doc);
    assert.ok(out instanceof Uint8Array);
    assert.notEqual(out, doc);
  }
  for (let i = 0; i < 30; i++) {
    const m = cssfuzz.applyMutation(rng, doc);
    assert.ok(m instanceof Uint8Array);
  }
});

test('MUTATION_OPS.length === 28', () => {
  assert.equal(cssfuzz.MUTATION_OPS.length, 28);
});

test('REQUIRED_FAMILIES all present; corpus size >= 30', () => {
  const fams = cssfuzz.corpusFamilies();
  for (const req of cssfuzz.REQUIRED_FAMILIES) {
    assert.ok(fams.includes(req), `missing ${req}`);
  }
  assert.ok(cssfuzz.CORPUS.length >= 30);
  let n = 0;
  const target = new cssfuzz.StubCssParser();
  for (const entry of cssfuzz.corpusEntries()) {
    target.parse(entry.data);
    n += 1;
  }
  assert.ok(n >= 30);
});

test('noPanic catches throws', () => {
  const r = cssfuzz.noPanic('boom', () => {
    throw new Error('x');
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, cssfuzz.GateKind.Panic);
});

test('determinism detects mismatch', () => {
  let n = 0;
  const r = cssfuzz.determinism(
    'flip',
    cssfuzz.encodeUtf8('a'),
    () => {
      n += 1;
      return n;
    },
    (a, b) => a === b,
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, cssfuzz.GateKind.NonDeterminism);
});

test('roundTrip detects mismatch', () => {
  let calls = 0;
  const r = cssfuzz.roundTrip(
    'rt',
    cssfuzz.encodeUtf8('a{color:red}'),
    (_data) => {
      calls += 1;
      return { ok: true as const, ast: calls };
    },
    (_ast) => cssfuzz.encodeUtf8('x'),
    (a, b) => a === b,
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, cssfuzz.GateKind.RoundTripMismatch);
});

test('runStructureAware on several seeds against stub succeeds', () => {
  const target = new cssfuzz.StubCssParser();
  for (const seed of [0, 1, 2, 3, 7, 13, 42, 99]) {
    const data = Uint8Array.of(seed, (seed * 3) & 0xff, 0x61, 0x7b);
    const r = cssfuzz.runStructureAware(data, target);
    assert.equal(r.ok, true, r.ok ? '' : r.error.message);
  }
});

test('pipeline gen → mutate → gate', () => {
  const rng = cssfuzz.rngFromSeed(12345);
  const doc = cssfuzz.genDocument(rng);
  let work: Uint8Array = Uint8Array.from(doc);
  for (let i = 0; i < 3; i++) work = cssfuzz.applyMutation(rng, work);
  const target = new cssfuzz.StubCssParser();
  const gated = cssfuzz.noPanic('pipe', () => {
    const out = target.parse(work);
    matchOutcome(out);
  });
  assert.equal(gated.ok, true);
});

test('stub accepts simple a{color:red} and rejects empty / no brace / invalid utf8', () => {
  const target = new cssfuzz.StubCssParser();
  const ok = target.parse(cssfuzz.encodeUtf8('a{color:red}'));
  assert.equal(ok.kind, 'accepted');
  if (ok.kind === 'accepted') assert.equal(ok.rootHint, 'a');

  assert.equal(target.parse(new Uint8Array()).kind, 'rejected');
  assert.equal(target.parse(cssfuzz.encodeUtf8('color:red')).kind, 'rejected');
  assert.equal(target.parse(Uint8Array.of(0xff, 0xfe, 0x61, 0x7b, 0x7d)).kind, 'rejected');
});

test('outcomesEqual ignores elapsedMs', () => {
  const a: ParseOutcome = {
    kind: 'accepted',
    rootHint: 'a',
    textFingerprint: 'x',
    elapsedMs: 1,
    mode: 'stub',
  };
  const b: ParseOutcome = {
    kind: 'accepted',
    rootHint: 'a',
    textFingerprint: 'x',
    elapsedMs: 99,
    mode: 'stub',
  };
  assert.equal(cssfuzz.outcomesEqual(a, b), true);
});

test('compareOutcomes class mismatch vs match', () => {
  const acc: ParseOutcome = {
    kind: 'accepted',
    rootHint: 'a',
    textFingerprint: 'hello',
    elapsedMs: 1,
    mode: 't',
  };
  const rej: ParseOutcome = {
    kind: 'rejected',
    code: 'e',
    textFingerprint: 'hello',
    elapsedMs: 1,
    mode: 't',
  };
  assert.equal(cssfuzz.compareOutcomes(acc, acc), cssfuzz.DiffResult.Match);
  assert.equal(cssfuzz.compareOutcomes(acc, rej), cssfuzz.DiffResult.AcceptMismatch);
});

test('budget gate sync', () => {
  const r = cssfuzz.withinBudgetSync('fast', 1000, () => 1);
  assert.equal(r.ok, true);
});

test('deep nesting gate on stub', () => {
  const target = new cssfuzz.StubCssParser();
  const deep = cssfuzz.genDeepNesting(80, true);
  const r = cssfuzz.deepNestingSafe('deep', deep, (b) => target.parse(b));
  assert.equal(r.ok, true);
});

test('consumer generate mutate parse is deterministic on stub', () => {
  const rng = cssfuzz.rngFromSeed(99);
  const doc = cssfuzz.genDocument(rng);
  assert.ok(doc.length > 0);
  const mutated = cssfuzz.applyMutation(rng, doc);
  const target = new cssfuzz.StubCssParser();
  const out = target.parse(mutated);
  const out2 = target.parse(mutated);
  assert.equal(cssfuzz.outcomesEqual(out, out2), true);
});

function matchOutcome(r: ParseOutcome): void {
  switch (r.kind) {
    case 'accepted':
    case 'rejected':
    case 'timeout':
      return;
    default: {
      const _x: never = r;
      throw new Error(`unexpected ${_x}`);
    }
  }
}

function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
