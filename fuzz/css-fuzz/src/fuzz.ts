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
 * High-level structure-aware orchestration (xml-fuzz `fuzz.rs` analog).
 */

import { CORPUS } from './corpus.ts';
import type { GateResult } from './gates.ts';
import { cleanFail, deepNestingSafe, determinism, withinBudgetSync } from './gates.ts';
import { DEEP_NEST_DEPTH, genAmplificationSketch, genDeepNesting, genWork } from './generator.ts';
import { applyMutations } from './mutate.ts';
import type { Rng } from './rng.ts';
import { rngFromData } from './rng.ts';

export { rngFromData } from './rng.ts';

/**
 * Minimal parse target: feed bytes, get a comparable result without throwing.
 * Unexpected throws are findings caught by gates (xml-fuzz `catch_unwind`).
 */
export interface CssParseTarget {
  parse(data: Uint8Array): ParseOutcome;
  sampleProfile?(rng: Rng): void;
}

/**
 * Coarse parse outcome used by gates.
 *
 * {@link outcomesEqual} **ignores** `elapsedMs` so determinism gates do not
 * flake on wall-clock noise; timeouts compare equal regardless of duration.
 */
export type ParseOutcome =
  | {
      kind: 'accepted';
      rootHint: string;
      textFingerprint: string;
      elapsedMs: number;
      mode: string;
    }
  | {
      kind: 'rejected';
      code: string;
      textFingerprint: string;
      elapsedMs: number;
      mode: string;
    }
  | {
      kind: 'timeout';
      elapsedMs: number;
    };

export function accepted(fields: {
  rootHint: string;
  textFingerprint: string;
  elapsedMs: number;
  mode: string;
}): ParseOutcome {
  return { kind: 'accepted', ...fields };
}

export function rejected(fields: {
  code: string;
  textFingerprint: string;
  elapsedMs: number;
  mode: string;
}): ParseOutcome {
  return { kind: 'rejected', ...fields };
}

export function timeout(elapsedMs: number): ParseOutcome {
  return { kind: 'timeout', elapsedMs };
}

/** Partial equality: ignore `elapsedMs`. */
export function outcomesEqual(a: ParseOutcome, b: ParseOutcome): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'timeout' && b.kind === 'timeout') return true;
  if (a.kind === 'accepted' && b.kind === 'accepted') {
    return a.rootHint === b.rootHint && a.textFingerprint === b.textFingerprint && a.mode === b.mode;
  }
  if (a.kind === 'rejected' && b.kind === 'rejected') {
    return a.code === b.code && a.textFingerprint === b.textFingerprint && a.mode === b.mode;
  }
  return false;
}

export function parseOutcomeText(o: ParseOutcome): string {
  if (o.kind === 'timeout') return '';
  return o.textFingerprint;
}

export function parseOutcomeElapsedMs(o: ParseOutcome): number {
  return o.elapsedMs;
}

export function isTimeout(o: ParseOutcome): boolean {
  return o.kind === 'timeout';
}

/** Build work bytes: prefer grammar generation when input is short / empty. */
export function genWorkFromInput(data: Uint8Array): Uint8Array {
  const rng = rngFromData(data);
  if (data.length === 0 || data.length < 4 || rng.genBool(0.55)) {
    const doc = genWork(rng);
    if (data.length > 0 && rng.genBool(0.3)) {
      const pos = rng.genRange(0, doc.length + 1);
      const take = Math.min(data.length, 16);
      const out = new Uint8Array(doc.length + take);
      out.set(doc.subarray(0, pos), 0);
      out.set(data.subarray(0, take), pos);
      out.set(doc.subarray(pos), pos + take);
      return out;
    }
    return doc;
  }
  return data.slice();
}

/**
 * Full structure-aware body: generate/mutate then run gates against `target`.
 *
 * 1. genWorkFromInput
 * 2. apply 0–3 mutations
 * 3. cleanFail parse mutated
 * 4. determinism
 * 5. deepNestingSafe closed + open
 * 6. random corpus seed cleanFail
 * 7. amplification sketch under withinBudgetSync ~3s
 */
export function runStructureAware(data: Uint8Array, target: CssParseTarget): GateResult<void> {
  const rng = rngFromData(data);
  let work = genWorkFromInput(data);
  const nmut = rng.genRange(0, 4);
  work = applyMutations(rng, work, nmut);

  if (target.sampleProfile) target.sampleProfile(rng);

  const cf = cleanFail('parse_mutated', () => {
    target.parse(work);
  });
  if (!cf.ok) return cf;

  const det = determinism('det_mutated', work, (b) => target.parse(b), outcomesEqual);
  if (!det.ok) return det;

  const deep = genDeepNesting(DEEP_NEST_DEPTH, true);
  const d1 = deepNestingSafe('deep_closed', deep, (b) => target.parse(b));
  if (!d1.ok) return d1;

  const deepOpen = genDeepNesting(DEEP_NEST_DEPTH, false);
  const d2 = deepNestingSafe('deep_open', deepOpen, (b) => target.parse(b));
  if (!d2.ok) return d2;

  const entry = CORPUS[rng.genRange(0, CORPUS.length)]!;
  const cseed = cleanFail(`corpus:${entry.id}`, () => {
    target.parse(entry.data);
  });
  if (!cseed.ok) return cseed;

  const expand = genAmplificationSketch(rng);
  const budget = withinBudgetSync('ampl_budget', 3000, () => target.parse(expand));
  if (!budget.ok) return budget;

  return { ok: true, value: undefined };
}

/** Seed helper: all corpus bytes. */
export function eachCorpusSeed(f: (data: Uint8Array) => void): void {
  for (const e of CORPUS) f(e.data);
}
