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
 * Curated seed corpus covering major CSS parser bug-class families
 * (xml-fuzz `corpus.rs` analog).
 *
 * Families (verification inventory — {@link REQUIRED_FAMILIES}):
 * - encoding / BOM / invalid UTF-8
 * - names / idents / custom properties
 * - nesting (rules + `:is()` / `&`)
 * - strings / comments / CDO-CDC
 * - selectors
 * - at-rules
 * - values / functions
 * - structural truncation / unbalanced markup
 */

import { encodeUtf8 } from './rng.ts';

export interface CorpusEntry {
  readonly id: string;
  readonly family: string;
  readonly data: Uint8Array;
}

function text(id: string, family: string, css: string): CorpusEntry {
  return { id, family, data: encodeUtf8(css) };
}

function bytes(id: string, family: string, data: number[] | Uint8Array): CorpusEntry {
  return { id, family, data: data instanceof Uint8Array ? data : Uint8Array.from(data) };
}

/** Inventory families that unit tests assert are present. */
export const REQUIRED_FAMILIES: readonly string[] = [
  'encoding',
  'names',
  'nesting',
  'strings_comments',
  'selectors',
  'at_rules',
  'values_functions',
  'structural',
];

export const CORPUS: readonly CorpusEntry[] = [
  // --- (a) encoding / BOM / invalid UTF-8 ---
  text('enc-utf8-plain', 'encoding', 'a{color:red}'),
  bytes('enc-bom-utf8', 'encoding', [0xef, 0xbb, 0xbf, 0x61, 0x7b, 0x63, 0x6f, 0x6c, 0x6f, 0x72, 0x3a, 0x72, 0x65, 0x64, 0x7d]),
  bytes('enc-overlong', 'encoding', [0x61, 0x7b, 0x63, 0x6f, 0x6e, 0x74, 0x65, 0x6e, 0x74, 0x3a, 0x22, 0xc0, 0xaf, 0x22, 0x7d]),
  bytes('enc-ff-byte', 'encoding', [0x61, 0x7b, 0x63, 0x6f, 0x6c, 0x6f, 0x72, 0x3a, 0x72, 0x65, 0x64, 0xff, 0x7d]),
  bytes('enc-trunc-utf8', 'encoding', [0x61, 0x7b, 0x63, 0x6f, 0x6e, 0x74, 0x65, 0x6e, 0x74, 0x3a, 0x22, 0xe2, 0x82, 0x22, 0x7d]),
  bytes('enc-nul-ident', 'encoding', [0x61, 0x00, 0x62, 0x7b, 0x63, 0x6f, 0x6c, 0x6f, 0x72, 0x3a, 0x72, 0x65, 0x64, 0x7d]),
  text('enc-charset-rule', 'encoding', '@charset "UTF-8"; a{color:red}'),
  text('enc-charset-latin1', 'encoding', '@charset "ISO-8859-1"; a{color:red}'),

  // --- (b) names / idents / custom properties ---
  text('name-simple', 'names', 'div{color:red}'),
  text('name-digit-start', 'names', '1bad{color:red}'),
  text('name-dash-start', 'names', '-foo{color:red}'),
  text('name-double-dash', 'names', '--x{color:red}'),
  text('name-custom-prop', 'names', ':root{--foo: 1px; color: var(--foo)}'),
  text('name-empty-custom', 'names', ':root{--: red}'),
  text('name-keyword-from', 'names', '@keyframes x { from { opacity: 0 } to { opacity: 1 } }'),
  text('name-unicode-escape', 'names', '\\61 {color:red}'),
  text('name-very-long', 'names', `${'x'.repeat(2048)}{color:red}`),
  text('name-vendor', 'names', ':-webkit-any(a){color:red}'),

  // --- (c) nesting ---
  text('nest-simple', 'nesting', 'a{color:red;&:hover{color:blue}}'),
  text('nest-implicit', 'nesting', 'a{b{color:red}}'),
  text('nest-media', 'nesting', 'a{@media screen{color:blue}}'),
  text('nest-ampersand-alone', 'nesting', 'a{&{color:red}}'),
  text('nest-relative', 'nesting', 'a{> b{color:red}}'),
  text('nest-deep-closed', 'nesting', `${'a{'.repeat(40)}color:red${'}'.repeat(40)}`),
  text('nest-is-chain', 'nesting', `${':is('.repeat(20)}a${')'.repeat(20)}{color:red}`),

  // --- (d) strings / comments / CDO-CDC ---
  text('str-dq', 'strings_comments', 'a{content:"hello"}'),
  text('str-sq', 'strings_comments', "a{content:'hello'}"),
  text('str-escaped-quote', 'strings_comments', 'a{content:"he\\"llo"}'),
  text('str-unclosed', 'strings_comments', 'a{content:"hello'),
  text('str-newline-unescaped', 'strings_comments', 'a{content:"hel\nlo"}'),
  text('cmt-block', 'strings_comments', 'a/*c*/{color:red}'),
  text('cmt-unclosed', 'strings_comments', 'a{color:red /* unclosed'),
  text('cmt-nested-star', 'strings_comments', 'a{color:/* * */red}'),
  text('cdo-cdc', 'strings_comments', '<!-- a{color:red} -->'),
  text('cmt-url-lookalike', 'strings_comments', 'a{background:url(/*x*/y)}'),

  // --- (e) selectors ---
  text('sel-universal', 'selectors', '*{color:red}'),
  text('sel-class-id', 'selectors', '.foo#bar{color:red}'),
  text('sel-attr', 'selectors', 'a[href="x"]{color:red}'),
  text('sel-attr-unclosed', 'selectors', 'a[href={color:red}'),
  text('sel-nth', 'selectors', 'a:nth-child(2n+1){color:red}'),
  text('sel-nth-of', 'selectors', 'a:nth-child(2n of .x){color:red}'),
  text('sel-is-where-not', 'selectors', ':is(a, b):where(.x):not(.y){color:red}'),
  text('sel-has', 'selectors', 'a:has(> b){color:red}'),
  text('sel-pseudo-el', 'selectors', 'a::before{content:""}'),
  text('sel-namespace', 'selectors', '@namespace svg "http://www.w3.org/2000/svg"; svg|a{color:red}'),
  text('sel-invalid-hash', 'selectors', 'a# {color:red}'),
  text('sel-comma-trailing', 'selectors', 'a, {color:red}'),

  // --- (f) at-rules ---
  text('at-media', 'at_rules', '@media screen and (min-width: 1px){a{color:red}}'),
  text('at-media-unbalanced', 'at_rules', '@media ((screen {a{color:red}}'),
  text('at-supports', 'at_rules', '@supports (display: grid){a{display:grid}}'),
  text('at-import', 'at_rules', '@import url("x.css") screen; a{color:red}'),
  text('at-import-string', 'at_rules', '@import "x.css";'),
  text('at-keyframes', 'at_rules', '@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}'),
  text('at-layer', 'at_rules', '@layer a,b; @layer a{div{color:red}}'),
  text('at-property', 'at_rules', '@property --x{syntax:"<color>";inherits:true;initial-value:red}'),
  text('at-container', 'at_rules', '@container (min-width: 1px){a{color:red}}'),
  text('at-scope', 'at_rules', '@scope (.a) to (.b){color:red}'),
  text('at-page', 'at_rules', '@page :first{margin:1cm}'),
  text('at-font-face', 'at_rules', '@font-face{font-family:x;src:url(x.woff)}'),
  text('at-unknown', 'at_rules', '@foo bar {a{color:red}}'),
  text('at-nested-media', 'at_rules', '@media a{@media b{div{color:red}}}'),

  // --- (g) values / functions ---
  text('val-calc', 'values_functions', 'a{width:calc(1px + 2%)}'),
  text('val-var', 'values_functions', 'a{color:var(--x, red)}'),
  text('val-var-cycle', 'values_functions', ':root{--a:var(--b);--b:var(--a)}'),
  text('val-url-unquoted', 'values_functions', 'a{background:url(foo.png)}'),
  text('val-url-unclosed', 'values_functions', 'a{background:url(foo'),
  text('val-rgb', 'values_functions', 'a{color:rgb(0 0 0 / 50%)}'),
  text('val-color-mix', 'values_functions', 'a{color:color-mix(in srgb, red 50%, blue)}'),
  text('val-min-max-clamp', 'values_functions', 'a{width:clamp(1px, min(2em, 10%), max(1px, 2px))}'),
  text('val-important', 'values_functions', 'a{color:red !important}'),
  text('val-bad-important', 'values_functions', 'a{color:red ! importa}'),
  text('val-dimension-sci', 'values_functions', 'a{width:1e3px}'),
  text('val-huge-number', 'values_functions', 'a{width:1e999px}'),
  text('val-escape-nl', 'values_functions', 'a{content:"\\A"}'),

  // --- (h) structural truncation / unbalanced ---
  text('struct-empty', 'structural', ''),
  text('struct-ws', 'structural', '   \n\t  '),
  text('struct-open-brace', 'structural', 'a{'),
  text('struct-close-only', 'structural', '}'),
  text('struct-unbalanced', 'structural', 'a{color:red'),
  text('struct-extra-close', 'structural', 'a{color:red}}'),
  text('struct-cut-at', 'structural', '@media screen and (min-width:'),
  text('struct-cut-function', 'structural', 'a{width:calc(1px +'),
  text('struct-cut-selector', 'structural', 'a:nth-child('),
  text('struct-multi-root', 'structural', 'a{color:red}b{color:blue}'),
];

export function corpusEntries(): readonly CorpusEntry[] {
  return CORPUS;
}

export function corpusBytes(): Uint8Array[] {
  return CORPUS.map((e) => e.data);
}

export function corpusFamilies(): string[] {
  return [...new Set(CORPUS.map((e) => e.family))];
}

export function corpusByFamily(family: string): CorpusEntry[] {
  return CORPUS.filter((e) => e.family === family);
}
