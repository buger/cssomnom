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
 * `css-fuzz` — structure-aware CSS fuzzer (graphql-fuzz / xml-fuzz analog).
 *
 * # Pillars
 *
 * - **Generators** ({@link generator}): grammar-based well-formed and controlled
 *   malformed CSS covering encoding, names, nesting, at-rules, selectors, values.
 * - **Mutations** ({@link mutate}): CSS-aware operators that truncate/corrupt at
 *   brace, declaration, function, string, comment, and UTF-8 boundaries.
 * - **Corpus** ({@link corpus}): curated seeds for major CSS parser bug-class families.
 * - **Gates** ({@link gates}): no-panic, clean-fail, determinism, deep-nesting-safe,
 *   output-valid, within-budget. Round-trip is opt-in via {@link runSuite} or
 *   `CssParseTarget.print` (wired by {@link runStructureAware} when present).
 * - **Orchestration** ({@link fuzz}): {@link runStructureAware} + {@link CssParseTarget}.
 */

export const VERSION = '0.1.0';

export * as apis from './apis.ts';
export * as corpus from './corpus.ts';
export * as differential from './differential.ts';
export * as fuzz from './fuzz.ts';
export * as gates from './gates.ts';
export * as generator from './generator.ts';
export * as mutate from './mutate.ts';
export * as rng from './rng.ts';

export { CSS_APIS, CssApi, genForApi, sampleCssApi } from './apis.ts';
export type { CssApi as CssApiName } from './apis.ts';
export {
  CORPUS,
  REQUIRED_FAMILIES,
  corpusByFamily,
  corpusBytes,
  corpusEntries,
  corpusFamilies,
} from './corpus.ts';
export type { CorpusEntry } from './corpus.ts';
export {
  DiffResult,
  NaiveStructuralParser,
  OutcomeClass,
  compareOutcomes,
  compareWithNaive,
  outcomeClass,
} from './differential.ts';
export {
  accepted,
  eachCorpusSeed,
  genWorkFromInput,
  isTimeout,
  outcomesEqual,
  parseOutcomeElapsedMs,
  parseOutcomeText,
  rejected,
  rngFromData,
  runStructureAware,
  timeout,
} from './fuzz.ts';
export type { CssParseTarget, ParseOutcome } from './fuzz.ts';
export {
  GateFailure,
  GateKind,
  cleanFail,
  deepNestingSafe,
  determinism,
  noPanic,
  noPanicAllowing,
  outputValid,
  roundTrip,
  runSuite,
  unwrap,
  withinBudgetSync,
} from './gates.ts';
export type { GateResult } from './gates.ts';
export {
  DEEP_NEST_DEPTH,
  MAX_GEN_DEPTH,
  NAME_KEYWORDS,
  genAmplificationSketch,
  genDeclaration,
  genDeepNesting,
  genDocument,
  genDocumentAtDepth,
  genMalformed,
  genMediaQuery,
  genName,
  genSelector,
  genValidName,
  genValue,
  genWellformed,
  genWork,
} from './generator.ts';
export { MUTATION_OPS, applyMutation, applyMutations } from './mutate.ts';
export type { MutationFn } from './mutate.ts';
export {
  SeededRng,
  decodeUtf8Lossy,
  encodeUtf8,
  isValidUtf8,
  rngFromSeed,
} from './rng.ts';
export type { Rng } from './rng.ts';
export { StubCssParser } from './stub-parser.ts';
export { CssomnomTarget, isCleanError } from './target-cssomnom.ts';
