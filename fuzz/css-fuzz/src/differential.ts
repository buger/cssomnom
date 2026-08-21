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
 * Differential oracles: compare parse outcomes (xml-fuzz `differential.rs`).
 *
 * Informational: do not fail CI solely because naive ≠ cssomnom.
 */

import type { CssParseTarget, ParseOutcome } from './fuzz.ts';
import { accepted, parseOutcomeText, rejected } from './fuzz.ts';
import { decodeUtf8Lossy, isValidUtf8 } from './rng.ts';

export const DiffResult = {
  Match: 'Match',
  AcceptMismatch: 'AcceptMismatch',
  TextMismatch: 'TextMismatch',
} as const;
export type DiffResult = (typeof DiffResult)[keyof typeof DiffResult];

export const OutcomeClass = {
  Accept: 'Accept',
  Reject: 'Reject',
  Timeout: 'Timeout',
} as const;
export type OutcomeClass = (typeof OutcomeClass)[keyof typeof OutcomeClass];

export function outcomeClass(o: ParseOutcome): OutcomeClass {
  if (o.kind === 'accepted') return OutcomeClass.Accept;
  if (o.kind === 'rejected') return OutcomeClass.Reject;
  return OutcomeClass.Timeout;
}

function normalizeText(s: string): string {
  return [...s].filter((c) => !/\s/u.test(c)).join('');
}

/**
 * Compare two outcomes for accept/reject class and fingerprint divergence.
 */
export function compareOutcomes(a: ParseOutcome, b: ParseOutcome): DiffResult {
  const ca = outcomeClass(a);
  const cb = outcomeClass(b);
  if (ca !== cb) return DiffResult.AcceptMismatch;

  const ta = parseOutcomeText(a);
  const tb = parseOutcomeText(b);
  if (ca === OutcomeClass.Accept) {
    const na = normalizeText(ta);
    const nb = normalizeText(tb);
    if (na.length > 0 && nb.length > 0 && na !== nb) {
      if (Math.abs(na.length - nb.length) > 32 || na !== nb) {
        return DiffResult.TextMismatch;
      }
    }
  }
  return DiffResult.Match;
}

/**
 * Minimal structural checker: balanced-ish braces, UTF-8, not empty.
 * Not a real CSS parser — only for differential accept/reject class tests.
 */
export class NaiveStructuralParser implements CssParseTarget {
  parse(data: Uint8Array): ParseOutcome {
    return NaiveStructuralParser.classify(data);
  }

  static classify(data: Uint8Array): ParseOutcome {
    if (data.length === 0) {
      return rejected({
        code: 'empty',
        textFingerprint: '',
        elapsedMs: 0,
        mode: 'naive',
      });
    }
    const text = decodeUtf8Lossy(data).slice(0, 256);
    if (!isValidUtf8(data)) {
      return rejected({
        code: 'utf8',
        textFingerprint: text,
        elapsedMs: 0,
        mode: 'naive',
      });
    }
    let opens = 0;
    let closes = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] === 0x7b) opens++;
      else if (data[i] === 0x7d) closes++;
    }
    if (opens === 0) {
      return rejected({
        code: 'no_block',
        textFingerprint: text,
        elapsedMs: 0,
        mode: 'naive',
      });
    }
    if (closes > 0 && opens <= closes + 4) {
      return accepted({
        rootHint: firstIdent(data) ?? 'unknown',
        textFingerprint: text,
        elapsedMs: 0,
        mode: 'naive',
      });
    }
    return rejected({
      code: `struct:o=${opens}:c=${closes}`,
      textFingerprint: text,
      elapsedMs: 0,
      mode: 'naive',
    });
  }
}

function firstIdent(data: Uint8Array): string | undefined {
  for (let i = 0; i < data.length; i++) {
    const c = data[i]!;
    if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) {
      let j = i + 1;
      while (j < data.length) {
        const d = data[j]!;
        const ok =
          (d >= 0x41 && d <= 0x5a) ||
          (d >= 0x61 && d <= 0x7a) ||
          (d >= 0x30 && d <= 0x39) ||
          d === 0x2d;
        if (!ok) break;
        j++;
      }
      return decodeUtf8Lossy(data.subarray(i, j));
    }
  }
  return undefined;
}

/** Diff a real target outcome against the naive structural class (accept/reject only). */
export function compareWithNaive(targetOut: ParseOutcome, data: Uint8Array): DiffResult {
  const naive = NaiveStructuralParser.classify(data);
  const ca = outcomeClass(targetOut);
  const cb = outcomeClass(naive);
  if (ca === OutcomeClass.Timeout) return DiffResult.Match;
  if (ca !== cb) return DiffResult.AcceptMismatch;
  return DiffResult.Match;
}
