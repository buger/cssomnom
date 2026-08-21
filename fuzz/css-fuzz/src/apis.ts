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
 * Every cssomnom public surface we drive (xml-fuzz `apis.rs` analog).
 */

import { genDeclaration, genDocument, genMalformed, genMediaQuery, genSelector, genValue } from './generator.ts';
import type { Rng } from './rng.ts';
import { encodeUtf8 } from './rng.ts';

export const CssApi = {
  Stylesheet: 'stylesheet',
  Tokenizer: 'tokenizer',
  Selector: 'selector',
  Media: 'media',
  TypedOm: 'typed_om',
  ParserApi: 'parser_api',
  Declaration: 'declaration',
} as const;

export type CssApi = (typeof CssApi)[keyof typeof CssApi];

export const CSS_APIS: readonly CssApi[] = [
  CssApi.Stylesheet,
  CssApi.Tokenizer,
  CssApi.Selector,
  CssApi.Media,
  CssApi.TypedOm,
  CssApi.ParserApi,
  CssApi.Declaration,
];

export function sampleCssApi(rng: Rng): CssApi {
  return CSS_APIS[rng.genRange(0, CSS_APIS.length)]!;
}

/** Generate structure-aware bytes appropriate for `api`. */
export function genForApi(rng: Rng, api: CssApi): Uint8Array {
  switch (api) {
    case 'stylesheet':
    case 'tokenizer':
    case 'parser_api':
      return rng.genBool(0.15) ? genMalformed(rng) : genDocument(rng);
    case 'selector':
      return encodeUtf8(genSelector(rng));
    case 'media':
      return encodeUtf8(genMediaQuery(rng));
    case 'typed_om':
      return encodeUtf8(genValue(rng));
    case 'declaration':
      return encodeUtf8(genDeclaration(rng));
    default: {
      const _exhaustive: never = api;
      return genDocument(rng);
    }
  }
}
