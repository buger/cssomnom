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
// reqproof:proptest compareCascadeDeclarations
// Property-based test: compareCascadeDeclarations (CSS Cascade 5 § 6 sort).
// Independent oracle: precedence-bucket ranking computed from a flat lookup
// table (origin/importance/layer/inline), then layer/specificity/source-order
// tie-breaks verified through order-theoretic properties (antisymmetry,
// transitivity/totality via sort, determinism) on generated declaration pairs.
import { test } from 'node:test';
import assert from 'node:assert';
import { compareCascadeDeclarations } from '../src/cascade/cascade-sorter.ts';
import type { MatchedDeclaration } from '../src/cascade/types.ts';

let seed = 0x51ed270b;
function rnd(): number {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
}

function randomDecl(sourceOrder: number): MatchedDeclaration {
  const important = rnd() < 0.5;
  // Infinity means "unlayered"; otherwise a small integer layer index.
  const layered = rnd() < 0.6;
  return {
    name: 'width',
    value: [] as unknown as MatchedDeclaration['value'],
    important,
    isInline: rnd() < 0.25,
    layerOrder: layered ? Math.floor(rnd() * 5) : Infinity,
    specificity: [Math.floor(rnd() * 3), Math.floor(rnd() * 4), Math.floor(rnd() * 3)],
    sourceOrder,
    rule: undefined,
  } as unknown as MatchedDeclaration;
}

// Independent oracle for the FIRST cascade key only: origin & importance.
// Flat table per CSS Cascade 5 § 6 (important inline > important layered >
// important unlayered > normal inline > normal unlayered > normal layered).
function precedence(decl: MatchedDeclaration): number {
  if (decl.important && decl.isInline) return 60;
  if (decl.important && decl.layerOrder !== Infinity) return 50;
  if (decl.important) return 40;
  if (!decl.important && decl.isInline) return 30;
  if (!decl.important && decl.layerOrder === Infinity) return 20;
  return 10;
}

function sign(n: number): number {
  return n < 0 ? -1 : n > 0 ? 1 : 0;
}

test('proptest compareCascadeDeclarations antisymmetric + deterministic (3000 pairs)', () => {
  for (let i = 0; i < 3000; i++) {
    const a = randomDecl(Math.floor(rnd() * 50));
    const b = randomDecl(Math.floor(rnd() * 50));
    const ab = compareCascadeDeclarations(a, b);
    // Determinism: same inputs, same output.
    assert.strictEqual(ab, compareCascadeDeclarations(a, b), `nondeterministic at case ${i}`);
    // Antisymmetry: cmp(a,b) === -cmp(b,a).
    assert.strictEqual(sign(ab), -sign(compareCascadeDeclarations(b, a)), `asymmetric at case ${i}`);
    // Zero must be symmetric.
    if (ab === 0) assert.strictEqual(compareCascadeDeclarations(b, a), 0);
  }
});

test('proptest origin/importance bucket dominates all later keys (2000 pairs)', () => {
  for (let i = 0; i < 2000; i++) {
    const a = randomDecl(0);
    const b = randomDecl(100000);
    if (precedence(a) !== precedence(b)) {
      const expected = sign(precedence(a) - precedence(b));
      assert.strictEqual(
        sign(compareCascadeDeclarations(a, b)),
        expected,
        `bucket violated: prec(${precedence(a)},${precedence(b)}) case ${i}`
      );
    }
  }
});

test('proptest comparator sorts into a non-decreasing total order (500 shuffles)', () => {
  for (let i = 0; i < 500; i++) {
    const decls: MatchedDeclaration[] = [];
    for (let j = 0; j < 24; j++) decls.push(randomDecl(j));
    const sorted = [...decls].sort(compareCascadeDeclarations);
    for (let j = 1; j < sorted.length; j++) {
      assert.ok(
        compareCascadeDeclarations(sorted[j - 1], sorted[j]) <= 0,
        `sort produced out-of-order pair at index ${j} (case ${i})`
      );
    }
  }
});

test('proptest equal declarations in every key always compare equal', () => {
  for (let i = 0; i < 1000; i++) {
    const a = randomDecl(i);
    const b: MatchedDeclaration = { ...a, specificity: [...a.specificity] };
    assert.strictEqual(compareCascadeDeclarations(a, b), 0);
  }
});
