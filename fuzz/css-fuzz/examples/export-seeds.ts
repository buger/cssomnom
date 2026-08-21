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
 * Export corpus entries + a generated batch into `corpus_export/{family}/`.
 *
 * ```sh
 * node fuzz/css-fuzz/examples/export-seeds.ts
 * ```
 */

import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CSS_APIS, corpusEntries, genDocument, genForApi, genMalformed, rngFromSeed } from '../src/index.ts';

function main(): void {
  const exportRoot = process.env.CSS_FUZZ_EXPORT_DIR ?? 'fuzz/css-fuzz/corpus_export';
  const genN = Number.parseInt(process.env.CSS_FUZZ_EXPORT_GEN ?? '32', 10) || 32;
  const dictDest = process.env.CSS_FUZZ_DICT ?? 'fuzz/css-fuzz/css-fuzz.dict';

  let corpusCount = 0;
  for (const entry of corpusEntries()) {
    const dir = join(exportRoot, entry.family);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${entry.id}.css`), entry.data);
    corpusCount += 1;
  }

  const genDir = join(exportRoot, 'generated');
  mkdirSync(genDir, { recursive: true });
  const rng = rngFromSeed(0x005eedf0);
  let genCount = 0;

  for (let i = 0; i < genN; i++) {
    const doc = genDocument(rng);
    writeFileSync(join(genDir, `doc-${String(i).padStart(4, '0')}.css`), doc);
    genCount += 1;
    const mal = genMalformed(rng);
    writeFileSync(join(genDir, `mal-${String(i).padStart(4, '0')}.css`), mal);
    genCount += 1;
  }

  for (let ai = 0; ai < CSS_APIS.length; ai++) {
    const api = CSS_APIS[ai]!;
    const dir = join(genDir, `api-${api}`);
    mkdirSync(dir, { recursive: true });
    for (let j = 0; j < 4; j++) {
      const r = rngFromSeed((ai + 1) * 10_000 + j);
      const data = genForApi(r, api);
      writeFileSync(join(dir, `seed-${j}.bin`), data);
      genCount += 1;
    }
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const dictSrc = join(here, '..', 'css-fuzz.dict');
  mkdirSync(dirname(dictDest), { recursive: true });
  try {
    copyFileSync(dictSrc, dictDest);
  } catch {
    // destination may be the same as source
  }

  console.log(
    `export_seeds: corpus_entries=${corpusCount} generated_files=${genCount} root=${exportRoot} dict=${dictDest}`,
  );

  const families: string[] = [];
  for (const e of readdirSync(exportRoot, { withFileTypes: true })) {
    if (e.isDirectory()) {
      const n = readdirSync(join(exportRoot, e.name)).length;
      families.push(`${e.name}=${n}`);
    }
  }
  families.sort();
  console.log(`families: ${families.join(' ')}`);
}

main();
