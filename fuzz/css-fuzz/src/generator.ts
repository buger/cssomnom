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
 * Grammar-based CSS document generators (xml-fuzz `generator.rs` analog).
 *
 * Always emit **byte sequences** that are structurally motivated CSS
 * (well-formed when requested, or controlled near-malformed families).
 * Mutations then break boundaries; corpus seeds cover known bug classes.
 *
 * Token / rule shapes follow css-syntax-3 § 3 #tokenization and
 * § 5 #parser-entry-points (qualified rules, at-rules, declarations).
 */

import type { Rng } from './rng.ts';
import { encodeUtf8 } from './rng.ts';

/** Default max generation depth for nested rules. */
export const MAX_GEN_DEPTH = 6;

/** Deep-nesting stress depth (JS stack / recursion surfaces). Modest vs xml-fuzz 120. */
export const DEEP_NEST_DEPTH = 80;

const NAME_FIRST = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';
const NAME_REST = `${NAME_FIRST}0123456789-`;

/** CSS keywords that are valid idents but occupy structural positions. */
export const NAME_KEYWORDS: readonly string[] = [
  'from',
  'to',
  'and',
  'or',
  'not',
  'only',
  'important',
  'inherit',
  'initial',
  'unset',
  'revert',
  'auto',
  'none',
  'all',
  'default',
  'in',
  'of',
  'url',
  'var',
  'calc',
  'rgb',
  'media',
  'supports',
  'import',
  'charset',
  'namespace',
  'layer',
];

const PROPERTIES: readonly string[] = [
  'color',
  'background',
  'width',
  'height',
  'margin',
  'padding',
  'content',
  'display',
  'opacity',
  'font-size',
  'border',
  'top',
  'left',
];

const COLORS: readonly string[] = ['red', 'blue', 'green', 'black', 'white', 'transparent', 'currentColor'];

function utf8(text: string): Uint8Array {
  return encodeUtf8(text);
}

function concat(parts: Array<Uint8Array | number[]>): Uint8Array {
  const arrs = parts.map((p) => (p instanceof Uint8Array ? p : Uint8Array.from(p)));
  let n = 0;
  for (const a of arrs) n += a.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

function pickChar(r: Rng, alphabet: string): string {
  return alphabet.charAt(r.genRange(0, alphabet.length));
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

/** Generate a full stylesheet at random depth. */
export function genDocument(r: Rng): Uint8Array {
  const depth = r.genRange(0, MAX_GEN_DEPTH + 1);
  return genDocumentAtDepth(r, depth);
}

/** Generate at an explicit nesting budget. ~28 families (xml-fuzz analog). */
export function genDocumentAtDepth(r: Rng, depth: number): Uint8Array {
  const family = r.genRange(0, 28);
  switch (family) {
    case 0:
      return utf8(genStyleSheet(r, depth));
    case 1:
      return utf8(genAtMedia(r, depth));
    case 2:
      return utf8(genAtSupports(r, depth));
    case 3:
      return utf8(genAtKeyframes(r));
    case 4:
      return utf8(genAtImport(r));
    case 5:
      return utf8(genAtNamespace(r));
    case 6:
      return utf8(genAtFontFace(r));
    case 7:
      return utf8(genAtLayer(r, depth));
    case 8:
      return utf8(genAtProperty(r));
    case 9:
      return utf8(genAtContainer(r, depth));
    case 10:
      return utf8(genAtScope(r, depth));
    case 11:
      return utf8(genAtPage(r));
    case 12:
      return utf8(genAtCharset(r));
    case 13:
      return utf8(genNesting(r, depth));
    case 14:
      return utf8(genCustomProps(r));
    case 15:
      return utf8(genValuesFunctions(r));
    case 16:
      return utf8(genStringsCommentsCdo(r));
    case 17:
      return genEncodingAdversarial(r);
    case 18:
      return utf8(genNameAdversarial(r));
    case 19:
      return genDeepNesting(Math.min(DEEP_NEST_DEPTH, 20 + depth * 8), true);
    case 20:
      return utf8(genVarCycle(r));
    case 21:
      return utf8(genIsChain(r));
    case 22:
      return utf8(genNthSelector(r));
    case 23:
      return utf8(genHasNotWhere(r));
    case 24:
      return utf8(genAttributeSelectors(r));
    case 25:
      return utf8(genImportant(r));
    case 26:
      return genDeepNesting(DEEP_NEST_DEPTH, false);
    default:
      return utf8(genMixed(r, depth));
  }
}

/** Well-formed document only (no intentional unclosed trees). */
export function genWellformed(r: Rng): Uint8Array {
  const depth = r.genRange(0, MAX_GEN_DEPTH + 1);
  switch (r.genRange(0, 12)) {
    case 0:
      return utf8(genStyleSheet(r, depth));
    case 1:
      return utf8(genAtMedia(r, depth));
    case 2:
      return utf8(genAtSupports(r, depth));
    case 3:
      return utf8(genAtKeyframes(r));
    case 4:
      return utf8(genAtFontFace(r));
    case 5:
      return utf8(genAtLayer(r, depth));
    case 6:
      return utf8(genCustomProps(r));
    case 7:
      return utf8(genValuesFunctions(r));
    case 8:
      return genDeepNesting(r.genRange(5, 40), true);
    case 9:
      return utf8(genNesting(r, depth));
    case 10:
      return utf8(genAtContainer(r, depth));
    default:
      return utf8(genImportant(r));
  }
}

/** Controlled malformed families (structure-aware, not random noise). */
export function genMalformed(r: Rng): Uint8Array {
  switch (r.genRange(0, 10)) {
    case 0:
      return genDeepNesting(DEEP_NEST_DEPTH, false);
    case 1:
      return utf8('a{color:red');
    case 2:
      return utf8('a{content:"unterminated');
    case 3:
      return utf8('a{color:red /* unclosed');
    case 4:
      return utf8('@media ((screen {a{color:red}}');
    case 5:
      return concat([utf8('a{color:'), [0xc0, 0xaf], utf8('red}')]);
    case 6:
      return utf8('a{background:url(foo');
    case 7:
      return utf8('a:nth-child(');
    case 8:
      return utf8('@media screen and (min-width:');
    default: {
      const v = Array.from(genWellformed(r));
      const i = v.lastIndexOf(0x7d); // '}'
      if (i >= 0) v.length = i;
      return v.length > 0 ? Uint8Array.from(v) : utf8('a{');
    }
  }
}

/** Mix of well-formed and malformed (xml-fuzz `gen_work`). */
export function genWork(r: Rng): Uint8Array {
  return r.genBool(0.75) ? genDocument(r) : genMalformed(r);
}

/**
 * Deep nesting of style rules: `closed` controls whether closers are emitted.
 * css-syntax-3 § 5.3.3 #consume-qualified-rule
 */
export function genDeepNesting(depth: number, closed: boolean): Uint8Array {
  const n = Math.max(1, depth);
  const open = 'a{'.repeat(n);
  if (closed) return utf8(`${open}color:red${'}'.repeat(n)}`);
  return utf8(`${open}color:red`);
}

/** Amplification sketches: var() cycles and deep :is() (xml-fuzz entity-expand analog). */
export function genAmplificationSketch(r: Rng): Uint8Array {
  if (r.genBool(0.5)) return utf8(genVarCycle(r));
  const n = r.genRange(16, 48);
  return utf8(`${':is('.repeat(n)}a,b${')'.repeat(n)}{color:red}`);
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/** Spec-valid CSS ident (css-syntax-3 § 4.3.11 #ident-token-diagram). */
export function genValidName(r: Rng): string {
  const len = 1 + r.genRange(0, 10);
  let s = pickChar(r, NAME_FIRST);
  for (let i = 1; i < len; i++) s += pickChar(r, NAME_REST);
  return s;
}

/**
 * Ident with adversarial variants (graphql-fuzz `gen_name` analog).
 * Empty, digit-start, keywords, unicode, BOM, 1KB+.
 */
export function genName(r: Rng): string {
  switch (r.genRange(0, 24)) {
    case 0:
      return '';
    case 1:
      return `${r.genRange(0, 10)}${genValidName(r)}`;
    case 2:
      return r.pick(NAME_KEYWORDS);
    case 3:
      return `--${genValidName(r)}`;
    case 4:
      return `-${genValidName(r)}`;
    case 5:
      return `${genValidName(r)} ${genValidName(r)}`;
    case 6:
      return String.fromCodePoint(0x03b1 + r.genRange(0, 5));
    case 7:
      return `\uFEFF${genValidName(r)}`;
    case 8:
      return pickChar(r, NAME_FIRST).repeat(1024 + r.genRange(0, 64));
    case 9:
      return '_';
    case 10:
      return '\\61';
    case 11:
      return '-';
    default:
      return genValidName(r);
  }
}

export function genSelector(r: Rng): string {
  switch (r.genRange(0, 16)) {
    case 0:
      return '*';
    case 1:
      return genValidName(r);
    case 2:
      return `.${genValidName(r)}`;
    case 3:
      return `#${genValidName(r)}`;
    case 4:
      return `${genValidName(r)}:hover`;
    case 5:
      return `${genValidName(r)}:nth-child(${genNth(r)})`;
    case 6:
      return `:is(${genValidName(r)}, ${genValidName(r)})`;
    case 7:
      return `:where(.${genValidName(r)})`;
    case 8:
      return `:not(.${genValidName(r)})`;
    case 9:
      return `${genValidName(r)}:has(> ${genValidName(r)})`;
    case 10:
      return `${genValidName(r)}[${genValidName(r)}="${genValidName(r)}"]`;
    case 11:
      return `${genValidName(r)} > ${genValidName(r)}`;
    case 12:
      return `${genValidName(r)}, ${genValidName(r)}`;
    case 13:
      return `${genValidName(r)}::before`;
    case 14:
      return '&';
    default:
      return `${genValidName(r)}:hover, .${genValidName(r)}`;
  }
}

export function genMediaQuery(r: Rng): string {
  switch (r.genRange(0, 8)) {
    case 0:
      return 'screen';
    case 1:
      return 'print';
    case 2:
      return 'all';
    case 3:
      return 'screen and (min-width: 1px)';
    case 4:
      return '(prefers-color-scheme: dark)';
    case 5:
      return 'not all';
    case 6:
      return 'only screen and (max-width: 100em)';
    default:
      return `(min-width: ${r.genRange(0, 2000)}px)`;
  }
}

export function genValue(r: Rng): string {
  switch (r.genRange(0, 16)) {
    case 0:
      return r.pick(COLORS);
    case 1:
      return `${r.genRange(0, 100)}px`;
    case 2:
      return `${r.genRange(0, 10)}em`;
    case 3:
      return `${r.genRange(0, 100)}%`;
    case 4:
      return `calc(1px + ${r.genRange(1, 10)}%)`;
    case 5:
      return 'var(--x)';
    case 6:
      return `var(--${genValidName(r)}, ${r.pick(COLORS)})`;
    case 7:
      return 'url(foo.png)';
    case 8:
      return 'url("foo.png")';
    case 9:
      return 'rgb(0 0 0 / 50%)';
    case 10:
      return 'color-mix(in srgb, red 50%, blue)';
    case 11:
      return 'clamp(1px, min(2em, 10%), max(1px, 2px))';
    case 12:
      return `"${genValidName(r)}"`;
    case 13:
      return '#fff';
    case 14:
      return '1e3px';
    default:
      return 'inherit';
  }
}

export function genDeclaration(r: Rng): string {
  if (r.genBool(0.15)) {
    const important = r.genBool(0.5) ? ' !important' : '';
    return `--${genValidName(r)}: ${genValue(r)}${important}`;
  }
  const prop = r.pick(PROPERTIES);
  const important = r.genBool(0.2) ? ' !important' : '';
  if (prop === 'content') return `content: "${genValidName(r)}"${important}`;
  return `${prop}: ${genValue(r)}${important}`;
}

function genNth(r: Rng): string {
  switch (r.genRange(0, 5)) {
    case 0:
      return '2n+1';
    case 1:
      return 'odd';
    case 2:
      return 'even';
    case 3:
      return `${r.genRange(1, 9)}n`;
    default:
      return `2n of .${genValidName(r)}`;
  }
}

function genBlockBody(r: Rng, depth: number): string {
  const n = r.genRange(1, 4);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    if (depth > 0 && r.genBool(0.3)) {
      parts.push(genStyleRule(r, depth - 1));
    } else {
      parts.push(`${genDeclaration(r)};`);
    }
  }
  return parts.join('');
}

function genStyleRule(r: Rng, depth: number): string {
  return `${genSelector(r)}{${genBlockBody(r, depth)}}`;
}

function genStyleSheet(r: Rng, depth: number): string {
  const n = r.genRange(1, 4);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) parts.push(genStyleRule(r, depth));
  return parts.join('');
}

function genAtMedia(r: Rng, depth: number): string {
  return `@media ${genMediaQuery(r)}{${genStyleSheet(r, depth)}}`;
}

function genAtSupports(r: Rng, depth: number): string {
  return `@supports (display: grid){${genStyleSheet(r, depth)}}`;
}

function genAtKeyframes(r: Rng): string {
  const name = genValidName(r);
  return `@keyframes ${name}{from{opacity:0}to{opacity:1}0%{transform:rotate(0)}100%{transform:rotate(360deg)}}`;
}

function genAtImport(r: Rng): string {
  if (r.genBool(0.5)) return `@import url("x.css") ${genMediaQuery(r)};${genStyleRule(r, 0)}`;
  return `@import "x.css";${genStyleRule(r, 0)}`;
}

function genAtNamespace(r: Rng): string {
  return `@namespace ${genValidName(r)} "http://www.w3.org/2000/svg";${genValidName(r)}|${genValidName(r)}{color:red}`;
}

function genAtFontFace(_r: Rng): string {
  return '@font-face{font-family:x;src:url(x.woff)}';
}

function genAtLayer(r: Rng, depth: number): string {
  const a = genValidName(r);
  const b = genValidName(r);
  return `@layer ${a},${b};@layer ${a}{${genStyleSheet(r, depth)}}`;
}

function genAtProperty(r: Rng): string {
  return `@property --${genValidName(r)}{syntax:"<color>";inherits:true;initial-value:red}`;
}

function genAtContainer(r: Rng, depth: number): string {
  return `@container (min-width: 1px){${genStyleSheet(r, depth)}}`;
}

function genAtScope(r: Rng, depth: number): string {
  return `@scope (.${genValidName(r)}) to (.${genValidName(r)}){${genBlockBody(r, depth)}}`;
}

function genAtPage(_r: Rng): string {
  return '@page :first{margin:1cm}';
}

function genAtCharset(r: Rng): string {
  const enc = r.pick(['UTF-8', 'utf-8', 'ISO-8859-1']);
  return `@charset "${enc}";${genStyleRule(r, 0)}`;
}

function genNesting(r: Rng, depth: number): string {
  const inner = depth > 0 ? genStyleRule(r, depth - 1) : `${genDeclaration(r)};`;
  switch (r.genRange(0, 5)) {
    case 0:
      return `${genValidName(r)}{color:red;&:hover{color:blue}${inner}}`;
    case 1:
      return `${genValidName(r)}{${genValidName(r)}{color:red}}`;
    case 2:
      return `${genValidName(r)}{@media screen{color:blue}}`;
    case 3:
      return `${genValidName(r)}{&{color:red}}`;
    default:
      return `${genValidName(r)}{> ${genValidName(r)}{color:red}}`;
  }
}

function genCustomProps(r: Rng): string {
  const n = genValidName(r);
  return `:root{--${n}: ${genValue(r)};color: var(--${n})}`;
}

function genValuesFunctions(r: Rng): string {
  switch (r.genRange(0, 6)) {
    case 0:
      return `a{width:calc(1px + ${r.genRange(1, 20)}%)}`;
    case 1:
      return 'a{color:var(--x, red)}';
    case 2:
      return 'a{background:url(foo.png)}';
    case 3:
      return 'a{color:rgb(0 0 0 / 50%)}';
    case 4:
      return 'a{color:color-mix(in srgb, red 50%, blue)}';
    default:
      return 'a{width:clamp(1px, min(2em, 10%), max(1px, 2px))}';
  }
}

function genStringsCommentsCdo(r: Rng): string {
  switch (r.genRange(0, 6)) {
    case 0:
      return 'a{content:"hello"}';
    case 1:
      return "a{content:'hello'}";
    case 2:
      return 'a{content:"he\\"llo"}';
    case 3:
      return 'a/*c*/{color:red}';
    case 4:
      return '<!-- a{color:red} -->';
    default:
      return 'a{color:/* * */red}';
  }
}

function genEncodingAdversarial(r: Rng): Uint8Array {
  switch (r.genRange(0, 8)) {
    case 0:
      return concat([[0xef, 0xbb, 0xbf], utf8('a{color:red}')]);
    case 1:
      return concat([utf8('a{color:red'), [0xff], utf8('}')]);
    case 2:
      return concat([utf8('a{content:"'), [0xe2, 0x82], utf8('"}')]);
    case 3:
      return concat([utf8('a{content:"'), [0xc0, 0xaf], utf8('"}')]);
    case 4:
      return concat([utf8('a'), [0x00], utf8('b{color:red}')]);
    case 5:
      return concat([utf8('a{content:"'), [0xf0, 0x9f, 0x98], utf8('"}')]);
    case 6:
      return utf8('@charset "ISO-8859-1";a{color:red}');
    default:
      return concat([[0xef, 0xbb, 0xbf], utf8('@charset "UTF-8";a{color:red}')]);
  }
}

function genNameAdversarial(r: Rng): string {
  switch (r.genRange(0, 8)) {
    case 0:
      return '1bad{color:red}';
    case 1:
      return '-foo{color:red}';
    case 2:
      return '--x{color:red}';
    case 3:
      return `${'x'.repeat(256)}{color:red}`;
    case 4:
      return '\\61 {color:red}';
    case 5:
      return ':-webkit-any(a){color:red}';
    case 6:
      return `${genName(r)}{color:red}`;
    default:
      return 'div{color:red}';
  }
}

function genVarCycle(_r: Rng): string {
  return ':root{--a:var(--b);--b:var(--a);--c:var(--a)}a{color:var(--c);width:var(--a)}';
}

function genIsChain(r: Rng): string {
  const n = r.genRange(4, 24);
  return `${':is('.repeat(n)}a${')'.repeat(n)}{color:red}`;
}

function genNthSelector(r: Rng): string {
  return `a:nth-child(${genNth(r)}){color:red}`;
}

function genHasNotWhere(r: Rng): string {
  return `:is(${genValidName(r)}, ${genValidName(r)}):where(.x):not(.y):has(> b){color:red}`;
}

function genAttributeSelectors(r: Rng): string {
  switch (r.genRange(0, 5)) {
    case 0:
      return `a[href="${genValidName(r)}"]{color:red}`;
    case 1:
      return 'a[href^=http]{color:red}';
    case 2:
      return 'a[href~="x"]{color:red}';
    case 3:
      return 'a[href*="x" i]{color:red}';
    default:
      return 'a[href]{color:red}';
  }
}

function genImportant(r: Rng): string {
  if (r.genBool(0.2)) return 'a{color:red ! importa}';
  return `a{${genDeclaration(r)}}`;
}

function genMixed(r: Rng, depth: number): string {
  return `${genAtCharset(r)}${genAtMedia(r, depth)}${genStyleRule(r, depth)}`;
}
