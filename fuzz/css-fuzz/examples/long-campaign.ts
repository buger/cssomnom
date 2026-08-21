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
 * Long structure-aware campaign against cssomnom.
 *
 * Env: CSS_FUZZ_SECONDS (default 120), CSS_FUZZ_ITERS, CSS_FUZZ_CRASH_DIR.
 *
 * ```sh
 * node fuzz/css-fuzz/examples/long-campaign.ts
 * CSS_FUZZ_SECONDS=5 CSS_FUZZ_ITERS=20 node fuzz/css-fuzz/examples/long-campaign.ts
 * ```
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CSS_APIS,
  CssomnomTarget,
  applyMutations,
  genForApi,
  rngFromSeed,
  runStructureAware,
  sampleCssApi,
} from '../src/index.ts';
import type { CssApi } from '../src/index.ts';

function envU64(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (raw === undefined) return defaultValue;
  const n = Number(raw);
  return Number.isFinite(n) ? n : defaultValue;
}

function envOptUsize(key: string): number | undefined {
  const raw = process.env[key];
  if (raw === undefined) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

function crashesDir(): string {
  const p = process.env.CSS_FUZZ_CRASH_DIR ?? 'fuzz/css-fuzz/crashes';
  mkdirSync(p, { recursive: true });
  return p;
}

function writeCrash(dir: string, api: string, seed: number, data: Uint8Array): string {
  const name = `crash-${api}-${seed}.bin`;
  const path = join(dir, name);
  writeFileSync(path, data);
  return path;
}

function main(): void {
  const seconds = envU64('CSS_FUZZ_SECONDS', 120);
  const maxIters = envOptUsize('CSS_FUZZ_ITERS');
  const deadline = Date.now() + seconds * 1000;
  const crashDir = crashesDir();

  console.error(
    `long_campaign: seconds=${seconds} max_iters=${maxIters ?? 'none'} crashes=${crashDir}`,
  );
  console.error(`APIs: ${CSS_APIS.length}`);

  const perApi = new Map<CssApi, number>();
  for (const api of CSS_APIS) perApi.set(api, 0);

  let iters = 0;
  let findings = 0;
  let ok = 0;
  let seedCounter = 0;

  while (Date.now() < deadline) {
    if (maxIters !== undefined && iters >= maxIters) break;

    seedCounter += 1;
    const seed = seedCounter;
    const rng = rngFromSeed(seed);
    const api = sampleCssApi(rng);
    perApi.set(api, (perApi.get(api) ?? 0) + 1);

    let data = genForApi(rng, api);
    const nmut = rng.genRange(0, 4);
    data = applyMutations(rng, data, nmut);

    const target = new CssomnomTarget(api);
    iters += 1;
    try {
      const structured = runStructureAware(data, target);
      if (structured.ok) {
        ok += 1;
      } else {
        findings += 1;
        const path = writeCrash(crashDir, api, seed, data);
        console.error(`FINDING seed=${seed} api=${api} file=${path}: ${structured.error.message}`);
      }
    } catch (err) {
      findings += 1;
      const path = writeCrash(crashDir, api, seed, data);
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      console.error(`THROW seed=${seed} api=${api} file=${path}: ${msg}`);
    }
  }

  const apiCounts = [...perApi.entries()].map(([k, v]) => `${k}=${v}`).join(' ');
  console.log(
    `long_campaign done: iters=${iters} ok=${ok} findings=${findings} apis={${apiCounts}}`,
  );
  if (findings > 0) process.exit(1);
}

main();
