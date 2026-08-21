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
 * Correctness gates (graphql-fuzz / xml-fuzz analog).
 *
 * Each gate asserts one invariant a CSS parser must satisfy. A violation is a
 * **finding** (a real bug in the parser under test), not a fuzzer defect.
 *
 * | Gate | Invariant | Bug class |
 * |---|---|---|
 * | {@link noPanic} | Function returns; does not throw unexpected exceptions. | Truncation panics, assertion throws, stack overflow. |
 * | {@link cleanFail} | Alias of no-panic (accept or typed reject, never crash). | Error-recovery crashes. |
 * | {@link outputValid} | Validator returns `{ ok: true }`. Throw → Panic; `{ ok: false }` → OutputInvalid. | Validator panics or reports invalid output. |
 * | {@link roundTrip} | Parse → print → parse is equivalent. | Printer/parser asymmetry. |
 * | {@link determinism} | Two parses of identical input match. | Stale state / non-deterministic errors. |
 * | {@link deepNestingSafe} | Deeply nested input errors cleanly. | Unbounded-recursion DoS. |
 * | {@link withinBudgetSync} | Completes within a wall-clock budget. | Amplification / hang. |
 */

export const GateKind = {
  Panic: 'Panic',
  OutputInvalid: 'OutputInvalid',
  RoundTripMismatch: 'RoundTripMismatch',
  NonDeterminism: 'NonDeterminism',
  InvariantViolation: 'InvariantViolation',
} as const;
export type GateKind = (typeof GateKind)[keyof typeof GateKind];

export class GateFailure extends Error {
  readonly kind: GateKind;
  readonly label: string;

  constructor(kind: GateKind, label: string, message: string) {
    super(`[${kind}] ${label}: ${message}`);
    this.name = 'GateFailure';
    this.kind = kind;
    this.label = label;
  }
}

export type GateResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: GateFailure };

export function unwrap<T>(result: GateResult<T>): T {
  if (!result.ok) throw result.error;
  return result.value;
}

function asErrorMessage(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

/**
 * Gate 1 — NO-PANIC. Runs `f`; any throw is a finding.
 *
 * Typed `TypeError` / `SyntaxError` / `DOMException` from a CSS API are
 * **not** panics when the caller wraps them; this gate treats *any* throw
 * as a finding. Use {@link noPanicAllowing} when clean rejects are typed throws.
 */
export function noPanic<R>(label: string, f: () => R): GateResult<R> {
  try {
    return { ok: true, value: f() };
  } catch (err) {
    return {
      ok: false,
      error: new GateFailure(GateKind.Panic, label, `threw: ${asErrorMessage(err)}`),
    };
  }
}

/**
 * NO-PANIC that treats a caller-supplied predicate as a clean reject
 * (still returns Ok). Anything else is a finding.
 */
export function noPanicAllowing<R>(
  label: string,
  f: () => R,
  isClean: (err: unknown) => boolean,
): GateResult<R | undefined> {
  try {
    return { ok: true, value: f() };
  } catch (err) {
    if (isClean(err)) return { ok: true, value: undefined };
    return {
      ok: false,
      error: new GateFailure(GateKind.Panic, label, `threw: ${asErrorMessage(err)}`),
    };
  }
}

/** Gate 2 — CLEAN-FAIL. Same as no-panic (xml-fuzz naming). */
export function cleanFail<R>(label: string, f: () => R): GateResult<R> {
  return noPanic(label, f);
}

/**
 * Gate 3 — OUTPUT-VALID.
 *
 * - throw → {@link GateKind.Panic} (same as {@link noPanic})
 * - `{ ok: true }` → pass
 * - `{ ok: false }` → {@link GateKind.OutputInvalid} finding
 *
 * graphql-fuzz analog: panic is a finding; a clean validation error is reported
 * as output-invalid rather than swallowed.
 */
export function outputValid(
  label: string,
  validate: () => { ok: boolean; message?: string },
): GateResult<void> {
  const ran = noPanic(label, validate);
  if (!ran.ok) return ran;
  if (!ran.value.ok) {
    return {
      ok: false,
      error: new GateFailure(
        GateKind.OutputInvalid,
        label,
        ran.value.message ?? 'validator returned { ok: false }',
      ),
    };
  }
  return { ok: true, value: undefined };
}

/**
 * Gate 4 — ROUND-TRIP. If parse succeeds, print then re-parse must match.
 * A first-parse reject is a valid non-round-trip outcome.
 */
export function roundTrip<T>(
  label: string,
  input: Uint8Array,
  parse: (data: Uint8Array) => { ok: true; ast: T } | { ok: false; error: string },
  print: (ast: T) => Uint8Array,
  equal: (a: T, b: T) => boolean,
): GateResult<void> {
  const firstR = noPanic(`${label}/parse1`, () => parse(input));
  if (!firstR.ok) return firstR;
  if (!firstR.value.ok) return { ok: true, value: undefined };

  const ast1 = firstR.value.ast;
  const printedR = noPanic(`${label}/print`, () => print(ast1));
  if (!printedR.ok) return printedR;

  const secondR = noPanic(`${label}/parse2`, () => parse(printedR.value));
  if (!secondR.ok) return secondR;
  if (!secondR.value.ok) {
    return {
      ok: false,
      error: new GateFailure(
        GateKind.RoundTripMismatch,
        label,
        `re-parse of printed output failed: ${secondR.value.error}`,
      ),
    };
  }
  if (!equal(ast1, secondR.value.ast)) {
    return {
      ok: false,
      error: new GateFailure(
        GateKind.RoundTripMismatch,
        label,
        'round-trip AST/fingerprint mismatch',
      ),
    };
  }
  return { ok: true, value: undefined };
}

/**
 * Gate 5 — DETERMINISM. Two parses of identical input must match.
 */
export function determinism<R>(
  label: string,
  input: Uint8Array,
  parse: (data: Uint8Array) => R,
  equal: (a: R, b: R) => boolean,
): GateResult<void> {
  const a = noPanic(`${label}/a`, () => parse(input));
  if (!a.ok) return a;
  const b = noPanic(`${label}/b`, () => parse(input));
  if (!b.ok) return b;
  if (!equal(a.value, b.value)) {
    return {
      ok: false,
      error: new GateFailure(
        GateKind.NonDeterminism,
        label,
        'two parses of identical input produced different results',
      ),
    };
  }
  return { ok: true, value: undefined };
}

/** Gate 6 — DEEP-NESTING-SAFE. Deep input must not throw. */
export function deepNestingSafe<R>(
  label: string,
  deepInput: Uint8Array,
  parse: (data: Uint8Array) => R,
): GateResult<R> {
  return noPanic(label, () => parse(deepInput));
}

/**
 * Gate 7 — RESOURCE BUDGET (same-thread). Fails if elapsed exceeds `budgetMs`
 * after `f` returns (no kill; pair with an external watchdog for hard caps).
 */
export function withinBudgetSync<R>(
  label: string,
  budgetMs: number,
  f: () => R,
): GateResult<R> {
  const start = performance.now();
  const ran = noPanic(`${label}/run`, f);
  if (!ran.ok) return ran;
  const elapsed = performance.now() - start;
  if (elapsed > budgetMs) {
    return {
      ok: false,
      error: new GateFailure(
        GateKind.InvariantViolation,
        label,
        `took ${elapsed.toFixed(1)}ms > budget ${budgetMs}ms`,
      ),
    };
  }
  return ran;
}

/**
 * Convenience: no-panic + determinism + optional round-trip (graphql-fuzz `run_suite`).
 */
export function runSuite<T>(
  label: string,
  input: Uint8Array,
  parse: (data: Uint8Array) => T,
  equal: (a: T, b: T) => boolean,
  print?: (ast: T) => Uint8Array,
  isParsed?: (ast: T) => boolean,
): GateResult<void> {
  const np = noPanic(`${label}/parse`, () => parse(input));
  if (!np.ok) return np;
  const det = determinism(`${label}/det`, input, parse, equal);
  if (!det.ok) return det;
  if (print && isParsed && isParsed(np.value)) {
    return roundTrip(
      `${label}/rt`,
      input,
      (data) => {
        const ast = parse(data);
        return isParsed(ast) ? { ok: true, ast } : { ok: false, error: 'rejected' };
      },
      print,
      equal,
    );
  }
  return { ok: true, value: undefined };
}
