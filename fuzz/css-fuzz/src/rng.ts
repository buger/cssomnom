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
 * Seeded RNG for structure-aware fuzzing (xml-fuzz / graphql-fuzz analog).
 *
 * Mulberry32: deterministic, fast, no `Math.random()`. Every campaign
 * iteration is replayable from the seed / input bytes.
 */

export interface Rng {
  nextU32(): number;
  /** Uniform in `[0, 1)`. */
  nextFloat(): number;
  /** Integer in `[min, maxExclusive)`. */
  genRange(min: number, maxExclusive: number): number;
  genBool(p?: number): boolean;
  pick<T>(items: readonly T[]): T;
  genBytes(n: number): Uint8Array;
}

/**
 * Mulberry32 PRNG. Construct from a 32-bit seed or from fuzz-engine bytes
 * via {@link rngFromData}.
 */
export class SeededRng implements Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  nextU32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  nextFloat(): number {
    return this.nextU32() / 4294967296;
  }

  genRange(min: number, maxExclusive: number): number {
    if (maxExclusive <= min) return min;
    const span = maxExclusive - min;
    return min + (this.nextU32() % span);
  }

  genBool(p = 0.5): boolean {
    return this.nextFloat() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('SeededRng.pick: empty array');
    }
    return items[this.genRange(0, items.length)]!;
  }

  genBytes(n: number): Uint8Array {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = this.nextU32() & 0xff;
    return out;
  }
}

/**
 * Derive a deterministic RNG from fuzz-engine bytes (xml-fuzz `rng_from_data`).
 */
export function rngFromData(data: Uint8Array): SeededRng {
  let seed = 2166136261;
  for (let i = 0; i < data.length; i++) {
    seed ^= data[i]!;
    seed = Math.imul(seed, 16777619) >>> 0;
    seed = (seed + ((i & 0xff) << ((i % 4) * 8))) >>> 0;
  }
  if (data.length === 0) seed = 1;
  return new SeededRng(seed);
}

export function rngFromSeed(seed: number): SeededRng {
  return new SeededRng(seed >>> 0);
}

export function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function decodeUtf8Lossy(data: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(data);
}

export function isValidUtf8(data: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(data);
    return true;
  } catch {
    return false;
  }
}
