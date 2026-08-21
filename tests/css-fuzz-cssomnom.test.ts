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
 * Harness against real cssomnom. Modest CI iteration count (not another 10k loop).
 *
 * Unexpected throws are findings. Typed TypeError/SyntaxError/DOMException are
 * clean rejects inside CssomnomTarget. Do not swallow throws in empty try/catch.
 */

import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import * as cssfuzz from '../fuzz/css-fuzz/src/index.ts';

const ITERS = Number.parseInt(process.env.CSS_FUZZ_ITERS ?? '32', 10) || 32;
const CRASH_DIR = 'fuzz/css-fuzz/crashes';

/**
 * Corpus seed ids tagged to an open Known Issue. Skip *only* these in the
 * main no-panic suite; never a blanket catch.
 */
const KI_SKIP_CORPUS_IDS: ReadonlySet<string> = new Set();

function recordFinding(name: string, data: Uint8Array, message: string): void {
  mkdirSync(CRASH_DIR, { recursive: true });
  writeFileSync(join(CRASH_DIR, name), data);
  writeFileSync(join(CRASH_DIR, `${name}.txt`), message);
}

test('generate+mutate+no-panic against CssomnomTarget stylesheet/tokenizer/media', () => {
  const apis = ['stylesheet', 'tokenizer', 'media'] as const;
  for (const api of apis) {
    const target = new cssfuzz.CssomnomTarget(api);
    const rng = cssfuzz.rngFromSeed(api.length * 17);
    for (let i = 0; i < ITERS; i++) {
      const doc = cssfuzz.genForApi(rng, api);
      const mutated = cssfuzz.applyMutations(rng, doc, rng.genRange(0, 4));
      const gated = cssfuzz.noPanic(`${api}/${i}`, () => target.parse(mutated));
      if (!gated.ok) {
        recordFinding(`ci-${api}-${i}.bin`, mutated, gated.error.message);
      }
      assert.equal(gated.ok, true, gated.ok ? '' : gated.error.message);
    }
  }
});

test('all corpus seeds: no unexpected throw', () => {
  const target = new cssfuzz.CssomnomTarget('stylesheet');
  for (const entry of cssfuzz.corpusEntries()) {
    if (KI_SKIP_CORPUS_IDS.has(entry.id)) continue;
    const gated = cssfuzz.noPanic(`corpus:${entry.id}`, () => target.parse(entry.data));
    if (!gated.ok) {
      recordFinding(`corpus-${entry.id}.bin`, entry.data, gated.error.message);
    }
    assert.equal(gated.ok, true, gated.ok ? '' : `corpus ${entry.id}: ${gated.error.message}`);
  }
});

test('deep nesting gate against cssomnom', () => {
  const target = new cssfuzz.CssomnomTarget('stylesheet');
  const closed = cssfuzz.genDeepNesting(cssfuzz.DEEP_NEST_DEPTH, true);
  const r1 = cssfuzz.deepNestingSafe('deep_closed', closed, (b) => target.parse(b));
  if (!r1.ok) recordFinding('deep-closed.bin', closed, r1.error.message);
  assert.equal(r1.ok, true, r1.ok ? '' : r1.error.message);

  const open = cssfuzz.genDeepNesting(cssfuzz.DEEP_NEST_DEPTH, false);
  const r2 = cssfuzz.deepNestingSafe('deep_open', open, (b) => target.parse(b));
  if (!r2.ok) recordFinding('deep-open.bin', open, r2.error.message);
  assert.equal(r2.ok, true, r2.ok ? '' : r2.error.message);
});

test('determinism on a few seeds', () => {
  const target = new cssfuzz.CssomnomTarget('stylesheet');
  const rng = cssfuzz.rngFromSeed(42);
  for (let i = 0; i < 8; i++) {
    const doc = cssfuzz.genDocument(rng);
    const r = cssfuzz.determinism(`det/${i}`, doc, (b) => target.parse(b), cssfuzz.outcomesEqual);
    if (!r.ok) recordFinding(`det-${i}.bin`, doc, r.error.message);
    assert.equal(r.ok, true, r.ok ? '' : r.error.message);
  }
});

test('runStructureAware a handful of seeds', () => {
  const target = new cssfuzz.CssomnomTarget('stylesheet');
  for (const seed of [0, 1, 2, 7, 13]) {
    const data = Uint8Array.of(seed, (seed * 5) & 0xff, 0x61, 0x7b);
    const r = cssfuzz.runStructureAware(data, target);
    if (!r.ok) recordFinding(`structured-${seed}.bin`, data, r.error.message);
    assert.equal(r.ok, true, r.ok ? '' : r.error.message);
  }
});

test('tokenizer and media APIs accept simple input without panic', () => {
  const tok = new cssfuzz.CssomnomTarget('tokenizer');
  const media = new cssfuzz.CssomnomTarget('media');
  const sample = cssfuzz.encodeUtf8('a{color:red}');
  const mq = cssfuzz.encodeUtf8('screen and (min-width: 1px)');
  assert.equal(cssfuzz.noPanic('tok', () => tok.parse(sample)).ok, true);
  assert.equal(cssfuzz.noPanic('media', () => media.parse(mq)).ok, true);
});

test('typed_om TypeError is a clean reject not a panic', () => {
  const target = new cssfuzz.CssomnomTarget('typed_om');
  const out = target.parse(cssfuzz.encodeUtf8('a{color:red}'));
  assert.equal(out.kind, 'rejected');
  const color = target.parse(cssfuzz.encodeUtf8('red'));
  assert.ok(color.kind === 'accepted' || color.kind === 'rejected');
});

test('naive vs cssomnom is informational (do not fail CI on class mismatch)', () => {
  const real = new cssfuzz.CssomnomTarget('stylesheet');
  const data = cssfuzz.encodeUtf8('a{color:red}');
  const out = real.parse(data);
  const diff = cssfuzz.compareWithNaive(out, data);
  assert.ok(
    diff === cssfuzz.DiffResult.Match ||
      diff === cssfuzz.DiffResult.AcceptMismatch ||
      diff === cssfuzz.DiffResult.TextMismatch,
  );
});
