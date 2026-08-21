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
 * Per-API classification:
 * - stylesheet / tokenizer / selector / media / parser_api: TypeError is a
 *   **finding** (css-syntax-3 parsers return a stylesheet/tokens/error list,
 *   they do not throw TypeError). Selector/parser_api DOMException/SyntaxError
 *   remain clean spec throws.
 * - typed_om / declaration: TypeError / SyntaxError / DOMException are clean
 *   IDL rejects (css-typed-om-1 `CSSStyleValue.parse`).
 * - RangeError (stack overflow) is always a finding — rethrown so gates
 *   record Panic.
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
import { decodeUtf8Lossy, encodeUtf8 } from './rng.ts';

const SYNTAX_APIS: ReadonlySet<CssApi> = new Set([
  CssApiId.Stylesheet,
  CssApiId.Tokenizer,
  CssApiId.Selector,
  CssApiId.Media,
  CssApiId.ParserApi,
]);

function isTypeError(err: Error): boolean {
  return err instanceof TypeError || err.name === 'TypeError';
}

function isSyntaxOrDom(err: Error): boolean {
  if (err instanceof SyntaxError || err.name === 'SyntaxError') return true;
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) return true;
  return err.name === 'DOMException';
}

/**
 * Whether `err` is a clean, spec-defined reject for `api` (not a fuzzer finding).
 * RangeError is never clean. TypeError is a finding on CSS Syntax surfaces.
 */
export function isCleanError(err: unknown, api: CssApi): boolean {
  if (!(err instanceof Error)) return false;
  if (err instanceof RangeError) return false;
  if (SYNTAX_APIS.has(api)) {
    // css-syntax-3: TypeError (e.g. "Cannot read properties of undefined") is a finding.
    if (isTypeError(err)) return false;
    return isSyntaxOrDom(err);
  }
  // typed_om / declaration: spec IDL throws.
  return isTypeError(err) || isSyntaxOrDom(err);
}

/** Cycle-safe JSON fingerprint. Re-throws non-cycle errors (BigInt, etc.). */
function fingerprintJson(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, v: unknown) => {
    if (typeof v === 'object' && v !== null) {
      if (seen.has(v)) return '[Circular]';
      seen.add(v);
    }
    return v;
  });
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

/** Fingerprint is `${ruleCount}\\n${cssText…}`; drop the count line for re-parse. */
function serializeAcceptedStylesheet(outcome: ParseOutcome): Uint8Array {
  if (outcome.kind !== 'accepted') return encodeUtf8('');
  const nl = outcome.textFingerprint.indexOf('\n');
  const css = nl === -1 ? '' : outcome.textFingerprint.slice(nl + 1);
  return encodeUtf8(css);
}

export class CssomnomTarget implements CssParseTarget {
  readonly api: CssApi;
  /** Stylesheet-only serializer; omitted on tokenizer/media/… so runStructureAware skips RT. */
  print?: (outcome: ParseOutcome) => Uint8Array;

  constructor(api: CssApi = CssApiId.Stylesheet) {
    this.api = api;
    if (api === CssApiId.Stylesheet) {
      this.print = (outcome) => serializeAcceptedStylesheet(outcome);
    }
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
      if (isCleanError(err, this.api)) {
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
        const fp = fingerprintJson(ast);
        return accepted({
          rootHint: 'selector',
          textFingerprint: fp.slice(0, 512),
          elapsedMs: elapsed(),
          mode: this.api,
        });
      }
      case 'media': {
        const queries = MediaParser.parse(text);
        const fp = fingerprintJson(queries);
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
