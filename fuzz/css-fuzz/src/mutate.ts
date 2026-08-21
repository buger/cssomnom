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
 * CSS-aware mutation operators (xml-fuzz `mutate.rs` analog).
 *
 * Each operator targets a structural / encoding boundary where a CSS parser
 * state machine transitions (css-syntax-3 § 3 #tokenization, § 5 #css-parsing).
 * Operators return a **new** `Uint8Array` (never mutate in place).
 */

import type { Rng } from './rng.ts';
import { encodeUtf8 } from './rng.ts';

const STRUCTURAL = encodeUtf8("{}()[]:;,@!\"'`");

const INVALID_UTF8: readonly Uint8Array[] = [
  Uint8Array.of(0xc0, 0xaf),
  Uint8Array.of(0xc1, 0xbf),
  Uint8Array.of(0xe0, 0x80, 0xaf),
  Uint8Array.of(0xf0, 0x80, 0x80, 0x80),
  Uint8Array.of(0xe0),
  Uint8Array.of(0xf0, 0x80),
  Uint8Array.of(0xff),
  Uint8Array.of(0xfe),
  Uint8Array.of(0xed, 0xa0, 0x80),
];

export type MutationFn = (r: Rng, data: Uint8Array) => Uint8Array;

function findAny(data: Uint8Array, set: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (set.includes(data[i]!)) out.push(i);
  }
  return out;
}

function findByte(data: Uint8Array, b: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i] === b) out.push(i);
  }
  return out;
}

function findSeq(data: Uint8Array, pat: Uint8Array): number[] {
  const out: number[] = [];
  if (pat.length === 0 || data.length < pat.length) return out;
  for (let i = 0; i <= data.length - pat.length; i++) {
    let ok = true;
    for (let j = 0; j < pat.length; j++) {
      if (data[i + j] !== pat[j]) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(i);
  }
  return out;
}

function truncateAt(data: Uint8Array, idx: number): Uint8Array {
  const n = Math.max(0, Math.min(idx, data.length));
  return data.slice(0, n);
}

function insertAt(data: Uint8Array, pos: number, extra: Uint8Array): Uint8Array {
  const p = Math.max(0, Math.min(pos, data.length));
  const out = new Uint8Array(data.length + extra.length);
  out.set(data.subarray(0, p), 0);
  out.set(extra, p);
  out.set(data.subarray(p), p + extra.length);
  return out;
}

function copy(data: Uint8Array): Uint8Array {
  return data.slice();
}

function pickPos(r: Rng, pos: number[]): number | undefined {
  if (pos.length === 0) return undefined;
  return pos[r.genRange(0, pos.length)];
}

function cutAfterSeq(r: Rng, data: Uint8Array, pat: Uint8Array, extraMax = 0): Uint8Array {
  const hits = findSeq(data, pat);
  const i = pickPos(r, hits);
  if (i === undefined) return copy(data);
  const extra = extraMax > 0 ? r.genRange(0, extraMax + 1) : 0;
  return truncateAt(data, Math.min(data.length, i + pat.length + extra));
}

export function truncateAfterOpenBrace(_r: Rng, data: Uint8Array): Uint8Array {
  const pos = findByte(data, 0x7b); // {
  const i = pos.at(-1);
  if (i === undefined) return copy(data);
  return truncateAt(data, i + 1);
}

export function truncateInsideDeclaration(r: Rng, data: Uint8Array): Uint8Array {
  const colons = findByte(data, 0x3a); // :
  const i = pickPos(r, colons);
  if (i === undefined) return copy(data);
  return truncateAt(data, Math.min(data.length, i + 1 + r.genRange(0, 4)));
}

export function truncateInsideFunction(r: Rng, data: Uint8Array): Uint8Array {
  const opens = findByte(data, 0x28); // (
  const i = pickPos(r, opens);
  if (i === undefined) return copy(data);
  if (i + 1 >= data.length) return copy(data);
  const cut = i + 1 + r.genRange(0, data.length - i - 1);
  return truncateAt(data, cut);
}

export function truncateInsideString(r: Rng, data: Uint8Array): Uint8Array {
  const quotes = findAny(data, encodeUtf8('"\''));
  const i = pickPos(r, quotes);
  if (i === undefined) return copy(data);
  return truncateAt(data, Math.min(data.length, i + 1 + r.genRange(0, 6)));
}

export function truncateInsideComment(r: Rng, data: Uint8Array): Uint8Array {
  return cutAfterSeq(r, data, encodeUtf8('/*'), 4);
}

export function truncateAfterAtKeyword(r: Rng, data: Uint8Array): Uint8Array {
  const ats = findByte(data, 0x40); // @
  const i = pickPos(r, ats);
  if (i === undefined) return copy(data);
  return truncateAt(data, Math.min(data.length, i + 1 + r.genRange(1, 12)));
}

export function truncateInsideSelector(r: Rng, data: Uint8Array): Uint8Array {
  const braces = findByte(data, 0x7b); // {
  const i = pickPos(r, braces);
  if (i === undefined || i === 0) return copy(data);
  const cut = r.genRange(0, i);
  return truncateAt(data, Math.max(1, cut));
}

export function truncateInsideUrl(r: Rng, data: Uint8Array): Uint8Array {
  const hits = findSeq(data, encodeUtf8('url('));
  const i = pickPos(r, hits);
  if (i === undefined) return truncateInsideFunction(r, data);
  return truncateAt(data, Math.min(data.length, i + 4 + r.genRange(0, 6)));
}

export function injectInvalidUtf8(r: Rng, data: Uint8Array): Uint8Array {
  const seq = r.pick(INVALID_UTF8);
  const pos = r.genRange(0, data.length + 1);
  return insertAt(data, pos, seq);
}

export function injectLoneSurrogate(r: Rng, data: Uint8Array): Uint8Array {
  const seq = r.genBool(0.5) ? Uint8Array.of(0xed, 0xa0, 0x80) : encodeUtf8('\\uD800');
  const pos = r.genRange(0, data.length + 1);
  return insertAt(data, pos, seq);
}

export function byteflipStructural(r: Rng, data: Uint8Array): Uint8Array {
  const pos = findAny(data, STRUCTURAL);
  const i = pickPos(r, pos);
  if (i === undefined) return copy(data);
  const out = copy(data);
  out[i] = (out[i]! ^ 0x01) & 0xff;
  return out;
}

export function swapBraceBracket(r: Rng, data: Uint8Array): Uint8Array {
  const pos = findAny(data, encodeUtf8('{}[]'));
  const i = pickPos(r, pos);
  if (i === undefined) return copy(data);
  const out = copy(data);
  const b = out[i]!;
  if (b === 0x7b) out[i] = 0x5b; // { -> [
  else if (b === 0x7d) out[i] = 0x5d; // } -> ]
  else if (b === 0x5b) out[i] = 0x7b; // [ -> {
  else out[i] = 0x7d; // ] -> }
  return out;
}

export function injectDeepNesting(r: Rng, data: Uint8Array): Uint8Array {
  const n = r.genRange(20, 80);
  const prefix = encodeUtf8('a{'.repeat(n));
  const out = new Uint8Array(prefix.length + data.length);
  out.set(prefix, 0);
  out.set(data, prefix.length);
  return out;
}

export function injectUnbalancedBrace(r: Rng, data: Uint8Array): Uint8Array {
  const extra = r.genBool(0.5) ? encodeUtf8('{') : encodeUtf8('(');
  const pos = r.genRange(0, data.length + 1);
  return insertAt(data, pos, extra);
}

export function injectUnclosedString(r: Rng, data: Uint8Array): Uint8Array {
  const q = r.genBool(0.5) ? encodeUtf8('"') : encodeUtf8("'");
  const pos = r.genRange(0, data.length + 1);
  return insertAt(data, pos, q);
}

export function duplicateProperty(r: Rng, data: Uint8Array): Uint8Array {
  const colons = findByte(data, 0x3a);
  const i = pickPos(r, colons);
  if (i === undefined) return insertAt(data, data.length, encodeUtf8('color:red;color:blue;'));
  let start = i;
  while (start > 0) {
    const b = data[start - 1]!;
    if (b === 0x7b || b === 0x3b || b === 0x20 || b === 0x0a || b === 0x09) break;
    start--;
  }
  let end = i + 1;
  while (end < data.length && data[end] !== 0x3b && data[end] !== 0x7d) end++;
  if (end < data.length && data[end] === 0x3b) end++;
  const frag = data.slice(start, end);
  if (frag.length === 0) return copy(data);
  return insertAt(data, end, frag);
}

export function injectNulByte(r: Rng, data: Uint8Array): Uint8Array {
  const pos = r.genRange(0, data.length + 1);
  return insertAt(data, pos, Uint8Array.of(0x00));
}

export function injectBomPrefix(_r: Rng, data: Uint8Array): Uint8Array {
  return insertAt(data, 0, Uint8Array.of(0xef, 0xbb, 0xbf));
}

export function stripRandomCloser(r: Rng, data: Uint8Array): Uint8Array {
  const closers = findAny(data, encodeUtf8('})]\n'));
  const filtered = closers.filter((i) => data[i] === 0x7d || data[i] === 0x29 || data[i] === 0x5d);
  const i = pickPos(r, filtered);
  if (i === undefined) return copy(data);
  const out = new Uint8Array(data.length - 1);
  out.set(data.subarray(0, i), 0);
  out.set(data.subarray(i + 1), i);
  return out;
}

export function swapColonSemicolon(r: Rng, data: Uint8Array): Uint8Array {
  const pos = findAny(data, encodeUtf8(':;'));
  const i = pickPos(r, pos);
  if (i === undefined) return copy(data);
  const out = copy(data);
  out[i] = out[i] === 0x3a ? 0x3b : 0x3a;
  return out;
}

export function injectUnclosedComment(r: Rng, data: Uint8Array): Uint8Array {
  const pos = r.genRange(0, data.length + 1);
  return insertAt(data, pos, encodeUtf8('/* unclosed'));
}

export function injectBadEscape(r: Rng, data: Uint8Array): Uint8Array {
  const pos = r.genRange(0, data.length + 1);
  const frag = r.pick([encodeUtf8('\\'), encodeUtf8('\\'), encodeUtf8('\\\n'), encodeUtf8('\\00')]);
  return insertAt(data, pos, frag);
}

export function unbalanceMediaParens(r: Rng, data: Uint8Array): Uint8Array {
  const hits = findSeq(data, encodeUtf8('@media'));
  if (hits.length > 0) {
    const i = pickPos(r, hits)!;
    return insertAt(data, i + 6, encodeUtf8('(('));
  }
  const parens = findByte(data, 0x29); // )
  const i = pickPos(r, parens);
  if (i === undefined) return insertAt(data, 0, encodeUtf8('@media (('));
  const out = new Uint8Array(data.length - 1);
  out.set(data.subarray(0, i), 0);
  out.set(data.subarray(i + 1), i);
  return out;
}

export function injectExtraCloser(r: Rng, data: Uint8Array): Uint8Array {
  const extra = r.pick([encodeUtf8('}'), encodeUtf8(')'), encodeUtf8(']')]);
  const pos = r.genRange(0, data.length + 1);
  return insertAt(data, pos, extra);
}

export function truncateAtImportant(r: Rng, data: Uint8Array): Uint8Array {
  const hits = findSeq(data, encodeUtf8('!important'));
  if (hits.length === 0) {
    const bangs = findByte(data, 0x21);
    const i = pickPos(r, bangs);
    if (i === undefined) return copy(data);
    return truncateAt(data, i + 1);
  }
  const i = pickPos(r, hits)!;
  return truncateAt(data, i + 1 + r.genRange(0, 9));
}

export function injectCdoCdc(r: Rng, data: Uint8Array): Uint8Array {
  const frag = r.pick([encodeUtf8('<!--'), encodeUtf8('-->')]);
  const pos = r.genRange(0, data.length + 1);
  return insertAt(data, pos, frag);
}

export function messCustomProperty(r: Rng, data: Uint8Array): Uint8Array {
  const hits = findSeq(data, encodeUtf8('--'));
  const i = pickPos(r, hits);
  if (i === undefined) return insertAt(data, data.length, encodeUtf8('--:red;'));
  switch (r.genRange(0, 3)) {
    case 0:
      return insertAt(data, i + 2, encodeUtf8('-'));
    case 1:
      return truncateAt(data, i + 2);
    default: {
      const out = copy(data);
      if (i + 2 < out.length) out[i + 2] = 0x20;
      return out;
    }
  }
}

export function injectNestedAmpersand(r: Rng, data: Uint8Array): Uint8Array {
  const braces = findByte(data, 0x7b);
  const i = pickPos(r, braces);
  const pos = i === undefined ? r.genRange(0, data.length + 1) : i + 1;
  return insertAt(data, pos, encodeUtf8('&:hover{color:blue}'));
}

/** Registry of all CSS-aware mutations. Tests assert `MUTATION_OPS.length === 28`. */
export const MUTATION_OPS: readonly MutationFn[] = [
  truncateAfterOpenBrace,
  truncateInsideDeclaration,
  truncateInsideFunction,
  truncateInsideString,
  truncateInsideComment,
  truncateAfterAtKeyword,
  truncateInsideSelector,
  truncateInsideUrl,
  injectInvalidUtf8,
  injectLoneSurrogate,
  byteflipStructural,
  swapBraceBracket,
  injectDeepNesting,
  injectUnbalancedBrace,
  injectUnclosedString,
  duplicateProperty,
  injectNulByte,
  injectBomPrefix,
  stripRandomCloser,
  swapColonSemicolon,
  injectUnclosedComment,
  injectBadEscape,
  unbalanceMediaParens,
  injectExtraCloser,
  truncateAtImportant,
  injectCdoCdc,
  messCustomProperty,
  injectNestedAmpersand,
];

/** Pick one operator at random. If input is too short, return a copy. */
export function applyMutation(r: Rng, data: Uint8Array): Uint8Array {
  if (data.length < 2) return copy(data);
  const op = MUTATION_OPS[r.genRange(0, MUTATION_OPS.length)]!;
  return op(r, data);
}

/** Apply `n` successive mutations. */
export function applyMutations(r: Rng, data: Uint8Array, n: number): Uint8Array {
  let cur = copy(data);
  for (let i = 0; i < n; i++) cur = applyMutation(r, cur);
  return cur;
}
