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
 * In-crate reference CSS "parser" for exercising gates without cssomnom
 * (xml-fuzz `StubXmlParser` analog). Brace/ident heuristic only.
 */

import type { CssParseTarget, ParseOutcome } from './fuzz.ts';
import { accepted, rejected } from './fuzz.ts';
import { decodeUtf8Lossy, isValidUtf8 } from './rng.ts';

/** Extremely small wellformed-ish checker + fingerprint. */
export class StubCssParser implements CssParseTarget {
  parse(data: Uint8Array): ParseOutcome {
    return StubCssParser.scan(data);
  }

  static scan(data: Uint8Array): ParseOutcome {
    if (data.length === 0) {
      return rejected({
        code: 'empty',
        textFingerprint: '',
        elapsedMs: 0,
        mode: 'stub',
      });
    }
    const invalidUtf8 = !isValidUtf8(data);
    const textFingerprint = decodeUtf8Lossy(data).slice(0, 256);
    let opens = 0;
    let closes = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] === 0x7b) opens++;
      else if (data[i] === 0x7d) closes++;
    }
    if (opens === 0) {
      return rejected({
        code: 'no_block',
        textFingerprint,
        elapsedMs: 0,
        mode: 'stub',
      });
    }
    if (invalidUtf8) {
      return rejected({
        code: `stub_reject:o=${opens}:c=${closes}:utf8=false`,
        textFingerprint,
        elapsedMs: 0,
        mode: 'stub',
      });
    }
    const badlyUnbalanced = closes === 0 || opens > closes + 3 || closes > opens + 1;
    if (badlyUnbalanced) {
      return rejected({
        code: `stub_reject:o=${opens}:c=${closes}:utf8=true`,
        textFingerprint,
        elapsedMs: 0,
        mode: 'stub',
      });
    }
    return accepted({
      rootHint: extractFirstIdent(data) ?? 'unknown',
      textFingerprint,
      elapsedMs: 0,
      mode: 'stub',
    });
  }
}

function extractFirstIdent(data: Uint8Array): string | undefined {
  let i = 0;
  while (i < data.length) {
    const c = data[i]!;
    const isStart =
      (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || c === 0x5f || c === 0x2d;
    if (isStart) {
      let j = i + 1;
      while (j < data.length) {
        const d = data[j]!;
        const ok =
          (d >= 0x41 && d <= 0x5a) ||
          (d >= 0x61 && d <= 0x7a) ||
          (d >= 0x30 && d <= 0x39) ||
          d === 0x5f ||
          d === 0x2d;
        if (!ok) break;
        j++;
      }
      if (j > i) return decodeUtf8Lossy(data.subarray(i, j));
    }
    i++;
  }
  return undefined;
}
