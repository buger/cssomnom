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
 * Consumer example: generate → mutate → no-panic against cssomnom.
 *
 * ```sh
 * node fuzz/css-fuzz/examples/fuzz-loop.ts
 * ```
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CORPUS,
  CssomnomTarget,
  applyMutation,
  eachCorpusSeed,
  genDocument,
  noPanic,
  rngFromSeed,
  runStructureAware,
} from '../src/index.ts';

const crashDir = process.env.CSS_FUZZ_CRASH_DIR ?? 'fuzz/css-fuzz/crashes';

function writeCrash(name: string, data: Uint8Array): void {
  mkdirSync(crashDir, { recursive: true });
  writeFileSync(join(crashDir, name), data);
}

function main(): void {
  const target = new CssomnomTarget('stylesheet');
  let findings = 0;
  let ok = 0;

  eachCorpusSeed((seed) => {
    const r = runStructureAware(seed, target);
    if (r.ok) ok += 1;
    else {
      findings += 1;
      writeCrash(`crash-corpus-${ok + findings}.bin`, seed);
      console.error(`FINDING on corpus seed: ${r.error.message}`);
    }
  });

  for (let seed = 0; seed < 64; seed++) {
    const rng = rngFromSeed(seed);
    const doc = genDocument(rng);
    let work = applyMutation(rng, doc);
    work = applyMutation(rng, work);

    const np = noPanic('cssomnom-parse', () => target.parse(work));
    if (!np.ok) {
      findings += 1;
      writeCrash(`crash-loop-${seed}.bin`, work);
      console.error(`FINDING seed=${seed}: ${np.error.message}`);
      continue;
    }

    const structured = runStructureAware(work, target);
    if (structured.ok) ok += 1;
    else {
      findings += 1;
      writeCrash(`crash-structured-${seed}.bin`, work);
      console.error(`FINDING structured seed=${seed}: ${structured.error.message}`);
    }
  }

  console.log(
    `css_fuzz example complete: ok_iters=${ok} findings=${findings} corpus=${CORPUS.length}`,
  );
  if (findings > 0) process.exit(1);
}

main();
