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
 * Real cssomnom adapter (xml-fuzz `libxml2_target.rs` analog).
 *
 * Typed TypeError / SyntaxError / DOMException are clean rejects.
 * RangeError (stack overflow) and other throws are findings — rethrown so
 * gates record Panic. This adapter does not swallow unexpected throws.
 */

import { parse } from '../../../src/parser.ts';
import { tokenize } from '../../../src/tokenizer.ts';
import { ParseHooks } from '../../../src/parse-hooks.ts';
import { SelectorParser } from '../../../src/SelectorParser.ts';
import { MediaParser } from '../../../src/MediaParser.ts';
import { CSSStyleValue } from '../../../src/typed-om.ts';
import { CSS } from '../../../src/parser-api.ts';
import type { CssApi } from './apis.ts';
import { CssApi as CssApiId } from './apis.ts';
import type { CssParseTarget, ParseOutcome } from './fuzz.ts';
import { accepted, rejected } from './fuzz.ts';
import { decodeUtf8Lossy } from './rng.ts';

/** TypeError, SyntaxError, DOMException — clean CSS API rejects. RangeError is a finding. */
export function isCleanError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err instanceof RangeError) return false;
  if (err instanceof TypeError || err instanceof SyntaxError) return true;
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) return true;
  const name = err.name;
  return name === 'TypeError' || name === 'SyntaxError' || name === 'DOMException';
}

function errorCode(err: unknown): string {
  if (err instanceof Error) return `${err.name}:${err.message}`.slice(0, 240);
  return String(err).slice(0, 240);
}

function fingerprintSlice(data: Uint8Array): string {
  return decodeUtf8Lossy(data).slice(0, 256);
}

function fingerprintSheet(sheet: { cssRules: { length: number; item(i: number): { cssText?: string } | null } }): string {
  const n = sheet.cssRules.length;
  const parts: string[] = [String(n)];
  for (let i = 0; i < n; i++) {
    const rule = sheet.cssRules.item(i);
    parts.push(rule?.cssText ?? '');
  }
  return parts.join('\n');
}

function rootHintSheet(sheet: { cssRules: { length: number; item(i: number): object | null } }): string {
  if (sheet.cssRules.length === 0) return 'empty';
  const first = sheet.cssRules.item(0);
  if (!first) return 'empty';
  return first.constructor?.name ?? 'CSSRule';
}

export class CssomnomTarget implements CssParseTarget {
  readonly api: CssApi;

  constructor(api: CssApi = CssApiId.Stylesheet) {
    this.api = api;
  }

  /**
   * Parse `data`. Clean typed rejects become {@link ParseOutcome} Rejected.
   * Unexpected throws (including RangeError) propagate to gates as Panic.
   */
  parse(data: Uint8Array): ParseOutcome {
    const start = performance.now();
    try {
      return this.parseApi(data, start);
    } catch (err) {
      if (isCleanError(err)) {
        return rejected({
          code: errorCode(err),
          textFingerprint: fingerprintSlice(data),
          elapsedMs: performance.now() - start,
          mode: this.api,
        });
      }
      throw err;
    }
  }

  private parseApi(data: Uint8Array, start: number): ParseOutcome {
    const text = decodeUtf8Lossy(data);
    const elapsed = () => performance.now() - start;
    switch (this.api) {
      case 'stylesheet': {
        const sheet = parse(text);
        return accepted({
          rootHint: rootHintSheet(sheet),
          textFingerprint: fingerprintSheet(sheet),
          elapsedMs: elapsed(),
          mode: this.api,
        });
      }
      case 'tokenizer': {
        const tokens = tokenize(text);
        const types = tokens.map((t) => t.type).join(',');
        return accepted({
          rootHint: tokens[0]?.type ?? 'empty',
          textFingerprint: types,
          elapsedMs: elapsed(),
          mode: this.api,
        });
      }
      case 'selector': {
        const tokens = tokenize(text);
        const values = ParseHooks.parseComponentValues(tokens);
        const ast = new SelectorParser(values).parse();
        let fp = '';
        try {
          fp = JSON.stringify(ast);
        } catch {
          fp = String(ast);
        }
        return accepted({
          rootHint: 'selector',
          textFingerprint: fp.slice(0, 512),
          elapsedMs: elapsed(),
          mode: this.api,
        });
      }
      case 'media': {
        const queries = MediaParser.parse(text);
        let fp = '';
        try {
          fp = JSON.stringify(queries);
        } catch {
          fp = String(queries.length);
        }
        return accepted({
          rootHint: queries.length === 0 ? 'empty' : 'media',
          textFingerprint: fp.slice(0, 512),
          elapsedMs: elapsed(),
          mode: this.api,
        });
      }
      case 'typed_om': {
        const value = CSSStyleValue.parse('color', text);
        return accepted({
          rootHint: value.constructor.name,
          textFingerprint: String(value),
          elapsedMs: elapsed(),
          mode: this.api,
        });
      }
      case 'parser_api': {
        const rules = CSS.parseStylesheetSync(text);
        const fp = rules.map((rule) => String(rule)).join('\n');
        return accepted({
          rootHint: rules[0]?.constructor.name ?? 'empty',
          textFingerprint: `${rules.length}|${fp}`.slice(0, 1024),
          elapsedMs: elapsed(),
          mode: this.api,
        });
      }
      case 'declaration': {
        const decl = CSS.parseDeclaration(text);
        if (decl === null) {
          return rejected({
            code: 'null-declaration',
            textFingerprint: fingerprintSlice(data),
            elapsedMs: elapsed(),
            mode: this.api,
          });
        }
        return accepted({
          rootHint: decl.name,
          textFingerprint: String(decl),
          elapsedMs: elapsed(),
          mode: this.api,
        });
      }
      default: {
        const _exhaustive: never = this.api;
        return rejected({
          code: `unknown-api:${String(_exhaustive)}`,
          textFingerprint: fingerprintSlice(data),
          elapsedMs: elapsed(),
          mode: 'unknown',
        });
      }
    }
  }
}
