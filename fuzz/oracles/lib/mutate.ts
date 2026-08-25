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
 * Deterministic mutation operators for the invalid-superset oracle.
 *
 * The oracle's contract (inverted from valid-subset.ts): take a *valid*
 * declaration value sampled from a property's own grammar and produce
 * *grammar-invalid* mutants. A conforming recovery parser must DROP every
 * such mutant (cssom-1 #parse-a-declaration: a declaration whose value does
 * not match the property grammar is a parse error and is ignored), so any
 * retained mutant is an accept-invalid finding.
 *
 * Design constraints:
 * - Fully deterministic given the caller's {@link Rng} stream: same seed ⇒
 *   byte-identical mutant sequences (no Math.random anywhere).
 * - Ops are string-level and self-contained; this module deliberately does
 *   NOT import the production tokenizer (decoupling, mirroring
 *   fuzz/oracles/lib/invariants.ts). {@link tokenizeLoosely} is a structural
 *   splitter, not a css-syntax-3 conformant tokenizer — it only needs to be
 *   good enough to keep mutation sites OUTSIDE of strings, urls and custom
 *   properties.
 * - Case-safety: `case-corrupt` never touches anything case-sensitive per
 *   css-syntax-3 § 3.3/#ident-token-token semantics — strings and urls are
 *   opaque tokens, and idents beginning with `-`/`--` (custom properties,
 *   css-variables-1 #custom-property) are excluded outright.
 */

import type { Rng } from '../../css-fuzz/src/rng.ts';

/** Granular op tags; doubles as the (property × op) clustering key downstream. */
export type MutationOp =
  | 'token-delete'
  | 'token-duplicate'
  | 'punct-;;'
  | 'punct-{{'
  | 'punct-,,'
  | 'truncate-token'
  | 'unterminated-url'
  | 'unit-swap'
  | 'case-corrupt';

/** Canonical op order; iteration is deterministic (no Set ordering). */
export const MUTATION_OPS: readonly MutationOp[] = [
  'token-delete',
  'token-duplicate',
  'punct-;;',
  'punct-{{',
  'punct-,,',
  'truncate-token',
  'unterminated-url',
  'unit-swap',
  'case-corrupt',
];

/** One applied mutation: the new value plus the op tag that produced it. */
export interface Mutation {
  op: MutationOp;
  value: string;
}

/** A {@link Mutation} bound to a declaration, ready to parse. */
export interface DeclarationMutation extends Mutation {
  property: string;
  /** Minimal repro stylesheet: `.o{prop:mutant;}` (mirrors valid-subset.ts). */
  snippet: string;
}

// ---------------------------------------------------------------------------
// Structural tokenizer (NOT css-syntax-3 conformant — see module docs)
// ---------------------------------------------------------------------------

export type LooseTokenKind =
  | 'ws'
  | 'string'
  | 'url'
  | 'block'
  | 'ident'
  | 'hash'
  | 'number'
  | 'percentage'
  | 'dimension'
  | 'delim';

export interface LooseToken {
  kind: LooseTokenKind;
  text: string;
  /** Offset of `text` within the scanned value. */
  start: number;
}

const isIdentStart = (ch: string): boolean => /[A-Za-z_-]/.test(ch) || ch.charCodeAt(0) >= 0x80;
const isIdentChar = (ch: string): boolean => /[A-Za-z0-9_-]/.test(ch) || ch.charCodeAt(0) >= 0x80;
const NUMBER_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;
/** Dimension-unit tail of a numeric token (`px`, `deg`, …). */
const UNIT_RE = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)([A-Za-z_-][A-Za-z0-9_-]*)$/;

/**
 * Split `value` into coarse tokens. Atomic kinds (`string`, `url`, `block`)
 * never expose their interiors as mutation sites, which is what makes the
 * case/url/string safety guarantees below trivial to uphold. Unterminated
 * strings/urls simply run to end-of-input (still one opaque token).
 */
export function tokenizeLoosely(value: string): LooseToken[] {
  const tokens: LooseToken[] = [];
  const n = value.length;
  let i = 0;
  while (i < n) {
    const ch = value[i]!;
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < n && /\s/.test(value[j]!)) j += 1;
      tokens.push({ kind: 'ws', text: value.slice(i, j), start: i });
      i = j;
      continue;
    }
    // `url(` (css-syntax-3 § 4.3.6 shape) — matched case-insensitively at a
    // token boundary; contents consumed opaquely to the matching `)` or EOF.
    if (matchesUrlIntro(value, i)) {
      const j = consumeUrl(value, i + 4);
      tokens.push({ kind: 'url', text: value.slice(i, j), start: i });
      i = j;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const j = consumeString(value, i);
      tokens.push({ kind: 'string', text: value.slice(i, j), start: i });
      i = j;
      continue;
    }
    if (isIdentStart(ch)) {
      let j = i + 1;
      while (j < n && isIdentChar(value[j]!)) j += 1;
      if (value[j] === '(') {
        // Function call: fold `name(...)` into ONE atomic block token so ops
        // can never splice inside `var(--x)` / `rgb(1,2,3)` arguments.
        const jEnd = consumeBalanced(value, j);
        tokens.push({ kind: 'block', text: value.slice(i, jEnd), start: i });
        i = jEnd;
        continue;
      }
      tokens.push({ kind: 'ident', text: value.slice(i, j), start: i });
      i = j;
      continue;
    }
    if (ch === '#' && i + 1 < n && isIdentChar(value[i + 1]!)) {
      let j = i + 1;
      while (j < n && isIdentChar(value[j]!)) j += 1;
      tokens.push({ kind: 'hash', text: value.slice(i, j), start: i });
      i = j;
      continue;
    }
    if (/\d/.test(ch) || ((ch === '.' || ch === '+' || ch === '-') && /\d|\./.test(value[i + 1] ?? ''))) {
      const m = NUMBER_RE.exec(value.slice(i));
      if (m !== null) {
        let j = i + m[0].length;
        if (value[j] === '%') {
          j += 1;
          tokens.push({ kind: 'percentage', text: value.slice(i, j), start: i });
          i = j;
          continue;
        }
        if (j < n && isIdentStart(value[j]!)) {
          let k = j + 1;
          while (k < n && isIdentChar(value[k]!)) k += 1;
          tokens.push({ kind: 'dimension', text: value.slice(i, k), start: i });
          i = k;
          continue;
        }
        tokens.push({ kind: 'number', text: value.slice(i, j), start: i });
        i = j;
        continue;
      }
    }
    tokens.push({ kind: 'delim', text: ch, start: i });
    i += 1;
  }
  return tokens;
}

function matchesUrlIntro(value: string, i: number): boolean {
  return (
    (value[i] === 'u' || value[i] === 'U') &&
    (value[i + 1] === 'r' || value[i + 1] === 'R') &&
    (value[i + 2] === 'l' || value[i + 2] === 'L') &&
    value[i + 3] === '(' &&
    !(i > 0 && isIdentChar(value[i - 1]!))
  );
}

/** Returns end index after the url token starting at `afterParen` context. */
function consumeUrl(value: string, bodyStart: number): number {
  const n = value.length;
  let j = bodyStart;
  while (j < n) {
    const ch = value[j]!;
    if (ch === '\\') {
      j += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      j = consumeString(value, j);
      continue;
    }
    if (ch === ')') return j + 1;
    j += 1;
  }
  return n; // unterminated: runs to EOF (bad-url territory)
}

/** Returns end index just past the closing quote (or EOF if unterminated). */
function consumeString(value: string, start: number): number {
  const quote = value[start]!;
  const n = value.length;
  let j = start + 1;
  while (j < n) {
    const ch = value[j]!;
    if (ch === '\\') {
      j += 2;
      continue;
    }
    if (ch === quote) return j + 1;
    j += 1;
  }
  return n;
}

/** Returns end index just past the `)` closing the block opened at `openIdx`. */
function consumeBalanced(value: string, openIdx: number): number {
  const n = value.length;
  let depth = 0;
  let j = openIdx;
  while (j < n) {
    const ch = value[j]!;
    if (ch === '\\') {
      j += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      j = consumeString(value, j);
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      j += 1;
      if (depth === 0) return j;
      continue;
    }
    j += 1;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Mutation operators
// ---------------------------------------------------------------------------

function contentIndices(tokens: readonly LooseToken[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]!.kind !== 'ws') out.push(i);
  }
  return out;
}

function applyOp(op: MutationOp, value: string, rng: Rng): string | null {
  const tokens = tokenizeLoosely(value);
  const content = contentIndices(tokens);
  switch (op) {
    case 'token-delete': {
      // Need ≥2 content tokens: deleting the only token yields `prop:`,
      // which measures nothing about recovery (empty value is dropped
      // trivially and wastes a mutant slot).
      if (content.length < 2) return null;
      const t = tokens[rng.pick(content)]!;
      return value.slice(0, t.start) + value.slice(t.start + t.text.length);
    }
    case 'token-duplicate': {
      if (content.length === 0) return null;
      const t = tokens[rng.pick(content)]!;
      const end = t.start + t.text.length;
      // Space-separated duplication keeps tokens distinct (`10px 10px`),
      // never gluing `10px10px`.
      return `${value.slice(0, end)} ${t.text}${value.slice(end)}`;
    }
    case 'punct-;;':
    case 'punct-{{':
    case 'punct-,,': {
      // Interior gaps only (between adjacent tokens) when available.
      const gaps: number[] = [];
      for (let k = 0; k + 1 < tokens.length; k++) {
        gaps.push(tokens[k]!.start + tokens[k]!.text.length);
      }
      if (gaps.length > 0) {
        const at = rng.pick(gaps)!;
        return `${value.slice(0, at)}${PUNCT[op]}${value.slice(at)}`;
      }
      // Single-token values: appending at end. `red{{` opens an unclosed
      // block and `red,,` leaves an empty list item — both grammar-invalid
      // for every property. NEVER append `;;`: a trailing semicolon merely
      // terminates the declaration (css-syntax-3 § 5.4.1
      // #consume-declarations), leaving `prop:red` — spec-valid retention,
      // i.e. a guaranteed false positive.
      if (op === 'punct-;;') return null;
      return value + PUNCT[op];
    }
    case 'truncate-token': {
      // Numbers/percentages/dimensions are excluded: cutting them often
      // leaves a smaller-but-still-valid number (`10px` → `10`), which is a
      // guaranteed-false-positive class. Strings/urls/blocks/idents/hashes
      // truncate into unbalanced or unknown-token territory instead.
      const eligible = content.filter((idx) => TRUNCATABLE.has(tokens[idx]!.kind) && tokens[idx]!.text.length >= 2);
      if (eligible.length === 0) return null;
      const t = tokens[rng.pick(eligible)]!;
      let cuts: number[] = [];
      for (let k = 1; k < t.text.length; k++) cuts.push(k);
      if (t.kind === 'hash') {
        // Heads of lengths 3/4/6/8 are valid hex colors (#abc, #abcd,
        // #abcdef, #abcdef01) — avoid those cut points to stay conservative.
        const safe = cuts.filter((k) => !VALID_HEX_HEAD_LENGTHS.has(k));
        if (safe.length === 0) return null;
        cuts = safe;
      }
      const k = rng.pick(cuts)!;
      const end = t.start + t.text.length;
      return value.slice(0, t.start + k) + value.slice(end);
    }
    case 'unterminated-url':
      // `url(` + value with NO closing paren: css-syntax-3 § 4.3.6 forces an
      // EOF-in-url ⇒ bad-url token, and bad-url matches no value grammar —
      // invalid by construction.
      return `url(${value}`;
    case 'unit-swap': {
      const swappable = content.filter((idx) => {
        if (tokens[idx]!.kind !== 'dimension') return false;
        const unit = unitOf(tokens[idx]!.text);
        return unit === 'px' || unit === 'deg';
      });
      if (swappable.length === 0) return null;
      const t = tokens[rng.pick(swappable)]!;
      const unit = unitOf(t.text)!;
      const swapped = `${t.text.slice(0, t.text.length - unit.length)}${unit === 'px' ? 'deg' : 'px'}`;
      return value.slice(0, t.start) + swapped + value.slice(t.start + t.text.length);
    }
    case 'case-corrupt': {
      // Plain idents only: never strings/urls (opaque tokens above), never
      // `-`/`--`-prefixed idents (vendor prefixes / custom properties are
      // case-SENSITIVE — css-variables-1 #custom-property).
      const idents = content.filter(
        (idx) => tokens[idx]!.kind === 'ident' && !tokens[idx]!.text.startsWith('-') && /[a-zA-Z]/.test(tokens[idx]!.text),
      );
      if (idents.length === 0) return null;
      const t = tokens[rng.pick(idents)]!;
      const rel = t.text.search(/[a-zA-Z]/);
      const ch = t.text[rel]!;
      const flipped = ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase();
      const newText = `${t.text.slice(0, rel)}${flipped}${t.text.slice(rel + 1)}`;
      return value.slice(0, t.start) + newText + value.slice(t.start + t.text.length);
    }
  }
  // Unreachable for the closed MutationOp union; kept for TS control flow.
  return null;
}

const PUNCT: Record<'punct-;;' | 'punct-{{' | 'punct-,,', string> = {
  'punct-;;': ';;',
  'punct-{{': '{{',
  'punct-,,': ',,',
};

const TRUNCATABLE: ReadonlySet<LooseTokenKind> = new Set<LooseTokenKind>(['ident', 'string', 'url', 'block', 'hash']);

/** Head lengths that form valid hex colors (css-syntax-3 § 4.3.14-ish). */
const VALID_HEX_HEAD_LENGTHS: ReadonlySet<number> = new Set([3, 4, 6, 8]);

function unitOf(dimensionText: string): string | null {
  return UNIT_RE.exec(dimensionText)?.[2] ?? null;
}

/**
 * Produce one grammar-invalid mutant of the valid `value`, or `null` when no
 * op applies (e.g. a single `10deg`-only value offers no px↔deg swap).
 * Deterministic: the op/site choices consume the caller's `Rng` stream only.
 */
export function mutateValid(value: string, rng: Rng): Mutation | null {
  const pool: MutationOp[] = [...MUTATION_OPS];
  while (pool.length > 0) {
    const op = rng.pick(pool);
    pool.splice(pool.indexOf(op), 1);
    const mutated = applyOp(op, value, rng);
    if (mutated !== null && mutated !== value) return { op, value: mutated };
  }
  return null;
}

/**
 * Mutate a valid `property: value` pair into `.o{property:mutant;}` — the
 * minimal-repro snippet format shared with valid-subset.ts.
 */
export function mutateDeclaration(property: string, value: string, rng: Rng): DeclarationMutation | null {
  const mutation = mutateValid(value, rng);
  if (mutation === null) return null;
  return { ...mutation, property, snippet: `.o{${property}:${mutation.value};}` };
}
