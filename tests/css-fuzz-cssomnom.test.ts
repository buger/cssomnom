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

test('stylesheet parse of a{color:red} is accepted with a style-rule fingerprint', () => {
  const target = new cssfuzz.CssomnomTarget('stylesheet');
  const out = target.parse(cssfuzz.encodeUtf8('a{color:red}'));
  assert.equal(out.kind, 'accepted');
  if (out.kind !== 'accepted') return;
  assert.match(out.textFingerprint, /color|red/i);
  const ruleCount = Number.parseInt(out.textFingerprint.split('\n')[0] ?? '0', 10);
  assert.ok(
    ruleCount >= 1 || /style/i.test(out.rootHint),
    `expected a style rule, rootHint=${out.rootHint} fingerprint=${out.textFingerprint}`,
  );
});

test('tokenizer fingerprint of a{color:red} includes ident and brace token types', () => {
  const tok = new cssfuzz.CssomnomTarget('tokenizer');
  const out = tok.parse(cssfuzz.encodeUtf8('a{color:red}'));
  assert.equal(out.kind, 'accepted');
  if (out.kind !== 'accepted') return;
  assert.ok(out.textFingerprint.length > 0, 'tokenizer fingerprint must not be empty');
  assert.match(out.textFingerprint, /ident/);
  assert.match(out.textFingerprint, /\{/);
});

test('media on screen does not throw; kind is accepted or rejected with a string fingerprint', () => {
  const media = new cssfuzz.CssomnomTarget('media');
  const gated = cssfuzz.noPanic('media-screen', () => media.parse(cssfuzz.encodeUtf8('screen')));
  assert.equal(gated.ok, true, gated.ok ? '' : gated.error.message);
  if (!gated.ok) return;
  const out = gated.value;
  assert.ok(out.kind === 'accepted' || out.kind === 'rejected', `unexpected kind ${out.kind}`);
  if (out.kind === 'accepted' || out.kind === 'rejected') {
    assert.equal(typeof out.textFingerprint, 'string');
  }
});

test('typed_om parses red for color; not-a-color is a clean reject; stylesheet garbage does not throw', () => {
  const typed = new cssfuzz.CssomnomTarget('typed_om');
  const color = typed.parse(cssfuzz.encodeUtf8('red'));
  assert.equal(color.kind, 'accepted', 'CSSStyleValue.parse("color", "red") must be accepted');

  const bad = typed.parse(cssfuzz.encodeUtf8('not-a-color!!!'));
  assert.equal(bad.kind, 'rejected');

  const sheet = new cssfuzz.CssomnomTarget('stylesheet');
  const garbage = cssfuzz.noPanic('sheet-garbage', () =>
    sheet.parse(cssfuzz.encodeUtf8('@@@ garbage {{{')),
  );
  assert.equal(garbage.ok, true, garbage.ok ? '' : garbage.error.message);
  if (!garbage.ok) return;
  assert.ok(garbage.value.kind === 'accepted' || garbage.value.kind === 'rejected');
});

test('well-formed a{color:red} is Match vs naive (both accept)', () => {
  const real = new cssfuzz.CssomnomTarget('stylesheet');
  const data = cssfuzz.encodeUtf8('a{color:red}');
  const out = real.parse(data);
  assert.equal(out.kind, 'accepted');
  const diff = cssfuzz.compareWithNaive(out, data);
  // Naive brace/ident checker and cssomnom both accept this well-formed style rule.
  assert.equal(diff, cssfuzz.DiffResult.Match);
});

test('stylesheet round-trip: parse a{color:red} → serialize → re-parse fingerprints equal', () => {
  const target = new cssfuzz.CssomnomTarget('stylesheet');
  const data = cssfuzz.encodeUtf8('a{color:red}');
  const first = target.parse(data);
  assert.equal(first.kind, 'accepted');
  if (first.kind !== 'accepted') return;
  assert.equal(typeof target.print, 'function', 'CssomnomTarget stylesheet must implement print');
  const printed = target.print!(first);
  const second = target.parse(printed);
  assert.equal(second.kind, 'accepted');
  if (second.kind !== 'accepted') return;
  assert.equal(first.textFingerprint, second.textFingerprint);

  const rt = cssfuzz.roundTrip(
    'cssomnom-a-color-red',
    data,
    (bytes) => {
      const o = target.parse(bytes);
      return o.kind === 'accepted' ? { ok: true as const, ast: o } : { ok: false as const, error: o.kind };
    },
    (ast) => target.print!(ast),
    (a, b) => a.textFingerprint === b.textFingerprint,
  );
  assert.equal(rt.ok, true, rt.ok ? '' : rt.error.message);
});
