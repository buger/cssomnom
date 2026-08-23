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
 * Seeded, deterministic sampler for CSS "value definition syntax".
 *
 * Implements generation over the grammar defined in CSS Values 4,
 * § "Value definition syntax" (https://www.w3.org/TR/css-values-4/#value-defs):
 *
 * - Combinators: juxtaposition (all of, in order), `|` (exactly one),
 *   `&&` (all of, any order), `||` (one or more, any order, each at most once),
 *   plus the literal `,` and `/` separators.
 * - Groups `[ ... ]`, which may nest and use the same combinators inside.
 * - Quantifiers (applied to the preceding term or group): `?` (0 or 1),
 *   `*` (0+), `+` (1+), `#` (comma-separated list), `{a}` / `{a,b}`, and
 *   combinations such as `#?`. Unbounded repetition is capped to keep
 *   generated values small (spec allows arbitrary repetition).
 * - Terms: keywords / quoted literals, `<type>` references resolved against
 *   {@link DEFAULT_TYPE_POOL}, and `<'property'>` references resolved through
 *   the constructor's `resolveProperty` callback (recursed with depth + 1,
 *   with cycle detection along the active reference chain).
 *
 * Generation is fully deterministic for a given `Rng` state, never throws,
 * and strictly respects the `maxDepth` / `maxLength` bounds: candidates that
 * would exceed a bound cause backtracking (alternative choices / retry
 * attempts) rather than oversized output. Impossible syntaxes yield `null`.
 */

import type { Rng } from '../../css-fuzz/src/rng.ts';

/** Options for {@link SyntaxGenerator.sample}. */
export interface SyntaxSampleOptions {
  /** Recursion guard; deeper backtracking than this fails. Default 6. */
  maxDepth?: number;
  /** Maximum number of characters in the generated value. Default 512. */
  maxLength?: number;
}

/** Discriminated union describing parsed value-definition syntax. */
type SyntaxNode =
  | { readonly kind: 'alternatives'; readonly terms: readonly SyntaxNode[] }
  | { readonly kind: 'allOf'; readonly terms: readonly SyntaxNode[] }
  | { readonly kind: 'anyOrder'; readonly terms: readonly SyntaxNode[] }
  | { readonly kind: 'sequence'; readonly terms: readonly SyntaxNode[] }
  | {
      readonly kind: 'quantified';
      readonly term: SyntaxNode;
      readonly min: number;
      readonly max: number;
      readonly commaSeparated: boolean;
    }
  | { readonly kind: 'literal'; readonly text: string }
  | { readonly kind: 'type'; readonly name: string }
  | { readonly kind: 'property'; readonly name: string };

/** Internal sampling context threaded through the recursive generator. */
interface GenContext {
  readonly rng: Rng;
  readonly maxDepth: number;
  readonly resolveProperty: ((name: string) => string | undefined) | undefined;
  readonly activeProperties: Set<string>;
  readonly parseCached: (syntax: string) => SyntaxNode | null;
}

/** Error thrown internally while parsing malformed syntax; never escapes. */
class SyntaxParseError extends Error {}

/** Cap applied to unbounded repetition (`*`, `+`) and list sizes (`#`). */
const REPEAT_CAP = 4;

/** Retry attempts for combinatorial choices before giving up (backtracking). */
const SAMPLE_ATTEMPTS = 6;

const DEFAULT_MAX_DEPTH = 6;
const DEFAULT_MAX_LENGTH = 512;

const isDigit = (ch: string): boolean => ch >= '0' && ch <= '9';
const isKeywordChar = (ch: string): boolean =>
  (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch === '-' || ch === '_';

function quantify(
  term: SyntaxNode,
  min: number,
  max: number,
  commaSeparated: boolean,
): SyntaxNode {
  return { kind: 'quantified', term, min, max, commaSeparated };
}

/**
 * Recursive-descent parser for value definition syntax.
 * Precedence (loosest to tightest): `|`, `||`, `&&`, juxtaposition.
 * See css-values-4 § "Component value multippliers" and § "Combinators".
 */
class SyntaxParser {
  private readonly src: string;
  private pos = 0;

  constructor(src: string) {
    this.src = src;
  }

  parseRoot(): SyntaxNode {
    this.skipWhitespace();
    const node = this.parseAlternatives();
    this.skipWhitespace();
    if (!this.atEnd()) {
      throw new SyntaxParseError(`unexpected trailing input at ${this.pos}: ${JSON.stringify(this.src)}`);
    }
    return node;
  }

  private atEnd(): boolean {
    return this.pos >= this.src.length;
  }

  private peek(): string {
    return this.pos < this.src.length ? this.src[this.pos] : '';
  }

  private peekAt(offset: number): string {
    return this.pos + offset < this.src.length ? this.src[this.pos + offset] : '';
  }

  private skipWhitespace(): void {
    while (!this.atEnd() && /\s/.test(this.src[this.pos])) {
      this.pos++;
    }
  }

  /** `a | b | c` — exactly one alternative. */
  private parseAlternatives(): SyntaxNode {
    const terms: SyntaxNode[] = [this.parseAnyOrder()];
    for (;;) {
      this.skipWhitespace();
      if (this.peek() === '|' && this.peekAt(1) !== '|') {
        this.pos++;
        terms.push(this.parseAnyOrder());
      } else {
        break;
      }
    }
    return terms.length === 1 ? terms[0] : { kind: 'alternatives', terms };
  }

  /** `a || b` — one or more, any order, each at most once. */
  private parseAnyOrder(): SyntaxNode {
    const terms: SyntaxNode[] = [this.parseAllOf()];
    for (;;) {
      this.skipWhitespace();
      if (this.peek() === '|' && this.peekAt(1) === '|') {
        this.pos += 2;
        terms.push(this.parseAllOf());
      } else {
        break;
      }
    }
    return terms.length === 1 ? terms[0] : { kind: 'anyOrder', terms };
  }

  /** `a && b` — all of, any order. */
  private parseAllOf(): SyntaxNode {
    const terms: SyntaxNode[] = [this.parseSequence()];
    for (;;) {
      this.skipWhitespace();
      if (this.peek() === '&' && this.peekAt(1) === '&') {
        this.pos += 2;
        terms.push(this.parseSequence());
      } else {
        break;
      }
    }
    return terms.length === 1 ? terms[0] : { kind: 'allOf', terms };
  }

  /** Juxtaposition: all of, in order. Stops at `|`, `||`, `&&`, `]`, or end. */
  private parseSequence(): SyntaxNode {
    const terms: SyntaxNode[] = [];
    for (;;) {
      this.skipWhitespace();
      const ch = this.peek();
      if (this.atEnd() || ch === '|' || ch === '&' || ch === ']') break;
      terms.push(this.parseQuantified());
    }
    if (terms.length === 0) {
      throw new SyntaxParseError(`expected a component at ${this.pos}: ${JSON.stringify(this.src)}`);
    }
    return terms.length === 1 ? terms[0] : { kind: 'sequence', terms };
  }

  private parseQuantified(): SyntaxNode {
    let node = this.parseAtom();
    for (;;) {
      const ch = this.peek();
      if (ch === '?') {
        this.pos++;
        node = quantify(node, 0, 1, false);
      } else if (ch === '*') {
        this.pos++;
        node = quantify(node, 0, REPEAT_CAP, false);
      } else if (ch === '+') {
        this.pos++;
        node = quantify(node, 1, REPEAT_CAP, false);
      } else if (ch === '#') {
        this.pos++;
        node = quantify(node, 1, REPEAT_CAP, true);
      } else if (ch === '{') {
        this.pos++;
        const min = this.parseRepeatCount();
        let max = min;
        if (this.peek() === ',') {
          this.pos++;
          max = this.parseRepeatCount();
        }
        if (this.peek() !== '}') {
          throw new SyntaxParseError(`expected '}' at ${this.pos}: ${JSON.stringify(this.src)}`);
        }
        this.pos++;
        if (min > max) {
          throw new SyntaxParseError(`invalid repeat range {${min},${max}}`);
        }
        // Clamp to keep generated values bounded (documented deviation).
        node = quantify(node, Math.min(min, REPEAT_CAP), Math.min(max, REPEAT_CAP), false);
      } else {
        break;
      }
    }
    return node;
  }

  private parseRepeatCount(): number {
    const start = this.pos;
    while (!this.atEnd() && isDigit(this.src[this.pos])) {
      this.pos++;
    }
    if (start === this.pos) {
      throw new SyntaxParseError(`expected a number at ${this.pos}: ${JSON.stringify(this.src)}`);
    }
    return Number.parseInt(this.src.slice(start, this.pos), 10);
  }

  private parseAtom(): SyntaxNode {
    const ch = this.peek();
    if (ch === '[') {
      this.pos++;
      const inner = this.parseAlternatives();
      this.skipWhitespace();
      if (this.peek() !== ']') {
        throw new SyntaxParseError(`expected ']' at ${this.pos}: ${JSON.stringify(this.src)}`);
      }
      this.pos++;
      return inner;
    }
    if (ch === '<') {
      const close = this.src.indexOf('>', this.pos + 1);
      if (close < 0) {
        throw new SyntaxParseError(`unterminated '<' reference: ${JSON.stringify(this.src)}`);
      }
      const inner = this.src.slice(this.pos + 1, close).trim();
      this.pos = close + 1;
      if (inner.startsWith("'") && inner.endsWith("'") && inner.length >= 2) {
        const name = inner.slice(1, -1);
        if (name.length === 0) {
          throw new SyntaxParseError(`empty property reference: ${JSON.stringify(this.src)}`);
        }
        return { kind: 'property', name };
      }
      if (inner.length === 0) {
        throw new SyntaxParseError(`empty type reference: ${JSON.stringify(this.src)}`);
      }
      return { kind: 'type', name: inner };
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const close = this.src.indexOf(quote, this.pos + 1);
      if (close < 0) {
        throw new SyntaxParseError(`unterminated string literal: ${JSON.stringify(this.src)}`);
      }
      const text = this.src.slice(this.pos, close + 1);
      this.pos = close + 1;
      return { kind: 'literal', text };
    }
    if (ch === ',' || ch === '/') {
      this.pos++;
      return { kind: 'literal', text: ch };
    }
    // Bare keyword / literal token (idents, numbers, hyphenated words).
    const start = this.pos;
    while (!this.atEnd() && isKeywordChar(this.src[this.pos])) {
      this.pos++;
    }
    if (start === this.pos) {
      throw new SyntaxParseError(`unexpected character ${JSON.stringify(ch)} at ${this.pos}: ${JSON.stringify(this.src)}`);
    }
    return { kind: 'literal', text: this.src.slice(start, this.pos) };
  }
}

function parseSyntax(source: string): SyntaxNode {
  return new SyntaxParser(source).parseRoot();
}

/** Fisher–Yates shuffle driven purely by the seeded RNG (deterministic). */
function shuffledIndices(rng: Rng, count: number): number[] {
  const indices = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = rng.genRange(0, i + 1);
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }
  return indices;
}

/** Samples `node`; returns `null` on failure. `remaining` is the char budget. */
function sampleNode(node: SyntaxNode, ctx: GenContext, depth: number, remaining: number): string | null {
  // Strict recursion guard: applies uniformly, leaves included.
  if (depth > ctx.maxDepth) return null;

  switch (node.kind) {
    case 'literal':
      return node.text.length <= remaining ? node.text : null;

    case 'type': {
      const pool = DEFAULT_TYPE_POOL[`<${node.name}>`];
      if (!pool || pool.length === 0) return null;
      for (const index of shuffledIndices(ctx.rng, pool.length)) {
        const candidate = pool[index];
        if (candidate.length <= remaining) return candidate;
      }
      return null;
    }

    case 'property': {
      // Cycle detection along the active `<'prop'>` reference chain.
      if (ctx.activeProperties.has(node.name)) return null;
      let innerSyntax: string | undefined;
      try {
        innerSyntax =
          ctx.resolveProperty === undefined ? undefined : ctx.resolveProperty(node.name);
      } catch {
        return null;
      }
      if (innerSyntax === undefined) return null;
      const innerAst = ctx.parseCached(innerSyntax);
      if (innerAst === null) return null;
      ctx.activeProperties.add(node.name);
      try {
        return sampleNode(innerAst, ctx, depth + 1, remaining);
      } finally {
        ctx.activeProperties.delete(node.name);
      }
    }

    case 'sequence': {
      // Juxtaposition: all components, in order (css-values-4 #combinators).
      const parts: string[] = [];
      let used = 0;
      for (const term of node.terms) {
        const separatorBudget = parts.length > 0 ? 1 : 0;
        const part = sampleNode(term, ctx, depth + 1, remaining - used - separatorBudget);
        if (part === null) return null;
        if (part.length > 0) {
          if (parts.length > 0) used += 1;
          parts.push(part);
          used += part.length;
        }
      }
      return parts.join(' ');
    }

    case 'alternatives': {
      // Exactly one alternative; try in RNG-shuffled order.
      for (const index of shuffledIndices(ctx.rng, node.terms.length)) {
        const sampled = sampleNode(node.terms[index], ctx, depth + 1, remaining);
        if (sampled !== null) return sampled;
      }
      return null;
    }

    case 'allOf': {
      // `&&`: every component, any order. Retry permutations on failure.
      for (let attempt = 0; attempt < SAMPLE_ATTEMPTS; attempt++) {
        const parts: string[] = [];
        let used = 0;
        let ok = true;
        for (const index of shuffledIndices(ctx.rng, node.terms.length)) {
          const separatorBudget = parts.length > 0 ? 1 : 0;
          const part = sampleNode(node.terms[index], ctx, depth + 1, remaining - used - separatorBudget);
          if (part === null) {
            ok = false;
            break;
          }
          if (part.length > 0) {
            if (parts.length > 0) used += 1;
            parts.push(part);
            used += part.length;
          }
        }
        if (ok) return parts.join(' ');
      }
      return null;
    }

    case 'anyOrder': {
      // `||`: one or more components, any order, each at most once. Pick a
      // random subset size k in [1, n], then fill it from a shuffled order,
      // skipping components that fail under the remaining budget.
      for (let attempt = 0; attempt < SAMPLE_ATTEMPTS; attempt++) {
        const order = shuffledIndices(ctx.rng, node.terms.length);
        const wanted = ctx.rng.genRange(1, node.terms.length + 1);
        const parts: string[] = [];
        let used = 0;
        for (const index of order) {
          if (parts.length >= wanted) break;
          const separatorBudget = parts.length > 0 ? 1 : 0;
          const part = sampleNode(node.terms[index], ctx, depth + 1, remaining - used - separatorBudget);
          if (part === null) continue;
          if (part.length > 0) {
            if (parts.length > 0) used += 1;
            parts.push(part);
            used += part.length;
          }
        }
        if (parts.length > 0) return parts.join(' ');
      }
      return null;
    }

    case 'quantified': {
      const min = Math.max(0, Math.min(node.min, REPEAT_CAP));
      const max = Math.max(min, Math.min(node.max, REPEAT_CAP));
      const separatorLength = node.commaSeparated ? 2 : 1; // ", " vs " "
      for (let attempt = 0; attempt < SAMPLE_ATTEMPTS; attempt++) {
        const count = min === max ? min : ctx.rng.genRange(min, max + 1);
        const items: string[] = [];
        let used = 0;
        let ok = true;
        for (let k = 0; k < count; k++) {
          const separatorBudget = items.length > 0 ? separatorLength : 0;
          const item = sampleNode(node.term, ctx, depth + 1, remaining - used - separatorBudget);
          if (item === null) {
            ok = false;
            break;
          }
          if (item.length === 0) {
            // An emptied optional item inside a comma list would corrupt the
            // output ("a,,b"); abort this attempt and retry another count.
            // (`items.length < count` always holds here: iteration k has
            // pushed at most k < count items, so only `commaSeparated`
            // decides.)
            if (node.commaSeparated) {
              ok = false;
            }
            break;
          }
          if (items.length > 0) used += separatorLength;
          items.push(item);
          used += item.length;
        }
        if (ok) return joinItems(items, node.commaSeparated);
      }
      return null;
    }
  }
}

function collectTypeRefs(node: SyntaxNode, seen: Set<string>, out: string[]): void {
  switch (node.kind) {
    case 'type':
      if (!seen.has(node.name)) {
        seen.add(node.name);
        out.push(node.name);
      }
      return;
    case 'quantified':
      collectTypeRefs(node.term, seen, out);
      return;
    case 'literal':
    case 'property':
      return;
    default:
      for (const term of node.terms) {
        collectTypeRefs(term, seen, out);
      }
  }
}

/**
 * Joins repetition items. Comma-separated lists normally join with `", "`,
 * but tolerate items that already carry their own comma (e.g. groups written
 * as `[ <x> , ]#`), which must not produce invalid doubled commas.
 */
function joinItems(items: readonly string[], commaSeparated: boolean): string {
  if (!commaSeparated) return items.join(' ');
  let out = '';
  for (const item of items) {
    if (out.length === 0) {
      out = item;
      continue;
    }
    const alreadySeparated = out.endsWith(',') || item.startsWith(',');
    out += (alreadySeparated ? ' ' : ', ') + item;
  }
  return out;
}

function normalizeBound(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fallback;
  return Math.floor(value);
}

/**
 * Fallback pools for `<type>` references encountered in value definitions.
 * Every variant is valid CSS on its own. Multi-word units that must stay
 * glued together (font family names) are quoted; multi-word constructs made
 * of juxtaposed keywords/functions (`left 10px top 20px`, gradients) are
 * emitted whole because they are themselves valid juxtapositions.
 */
export const DEFAULT_TYPE_POOL: Readonly<Record<string, readonly string[]>> = {
  '<length>': ['0px', '8px', '-4px', '1.5em', '2rem', '12pt'],
  '<percentage>': ['0%', '25%', '50%', '100%', '-12.5%'],
  '<length-percentage>': ['0px', '10px', '50%', '100%', 'calc(100% - 16px)'],
  '<number>': ['0', '1', '-2', '0.5', '3.14'],
  '<integer>': ['0', '1', '-3', '42'],
  '<angle>': ['0deg', '45deg', '90deg', '-30deg', '0.25turn', '1.5rad'],
  '<time>': ['0s', '120ms', '300ms', '1s', '2.5s'],
  '<frequency>': ['0Hz', '440Hz', '20kHz', '1.5kHz'],
  '<resolution>': ['96dpi', '150dpi', '2dppx', '1dpcm'],
  '<color>': ['red', '#369', '#ff8800', 'rgb(255 0 0)', 'hsl(120deg 75% 50%)', 'currentcolor'],
  '<url>': ['url("image.png")', 'url("fonts/body.woff2")', 'url(bare.svg)'],
  '<string>': ['"hello"', '"Helvetica Neue"', '""'],
  '<image>': [
    'url("photo.jpg")',
    'linear-gradient(to right, red, blue)',
    'linear-gradient(#fff, #000)',
    'radial-gradient(circle at center, yellow, green)',
  ],
  '<ident>': ['foo', 'bar-baz', '_private'],
  '<custom-ident>': ['foo', 'theme-dark', 'myCustomIdent'],
  '<dashed-ident>': ['--accent', '--spacing-2', '--x'],
  '<position>': ['center', 'left top', 'right bottom', '50% 50%', 'left 10px top 20px'],
  '<bg-position>': ['center', 'top', 'left center', '25% 75%', 'right 5px bottom 10px'],
  '<bg-size>': ['auto', 'cover', 'contain', '100px 100px', '50% auto'],
  '<line-width>': ['thin', 'medium', 'thick', '1px', '2.5px'],
  '<border-style>': ['none', 'solid', 'dashed', 'dotted', 'double'],
  '<border-width>': ['thin', 'medium', 'thick', '2px'],
  '<shadow>': ['1px 2px', 'inset 0 0 4px black', '2px 2px 6px #333', '0 8px 16px rgba(0 0 0 / 0.35)'],
  '<basic-shape>': [
    'inset(8px)',
    'circle(40%)',
    'ellipse(20px 30px at center)',
    'polygon(0 0, 100% 0, 100% 100%)',
  ],
  '<calc-sum>': ['calc(1px + 2px)', 'calc(100% - 16px)', 'calc(2 * 3rem)', 'calc((1em + 2%) / 2)'],
  '<single-transition-timing-function>': [
    'linear',
    'ease-in-out',
    'cubic-bezier(0.25, 0.1, 0.25, 1)',
    'steps(4, end)',
    'step-start',
  ],
  '<font-family>': ['serif', 'sans-serif', 'monospace', 'system-ui', '"Comic Sans MS"'],
  '<flex>': ['0', '1', '2.5', '100'],
  '<transform-list>': [
    'translateX(10px)',
    'rotate(45deg)',
    'scale(1.5)',
    'translate(10px, 20px) rotate(90deg)',
    'matrix(1, 0, 0, 1, 0, 0)',
  ],
};

/**
 * Generates valid CSS values from value definition syntax strings
 * (css-values-4 § "Value definition syntax", https://www.w3.org/TR/css-values-4/#value-defs).
 */
export class SyntaxGenerator {
  private readonly rng: Rng;
  private readonly resolveProperty: ((name: string) => string | undefined) | undefined;
  private readonly astCache = new Map<string, SyntaxNode | null>();

  constructor(rng: Rng, resolveProperty?: (name: string) => string | undefined) {
    this.rng = rng;
    this.resolveProperty = resolveProperty;
  }

  /**
   * Samples one value matching `syntax`; `null` if impossible or generation
   * failed (unknown type, cycle, budget exhaustion). May return `''` when the
   * syntax permits an empty match (e.g. `a?`). Never throws. Output length is
   * guaranteed `<= maxLength` and recursion depth `<= maxDepth`.
   */
  sample(syntax: string, options?: SyntaxSampleOptions): string | null {
    const ast = this.parseCached(syntax);
    if (ast === null) return null;
    const maxDepth = normalizeBound(options?.maxDepth, DEFAULT_MAX_DEPTH);
    const maxLength = normalizeBound(options?.maxLength, DEFAULT_MAX_LENGTH);
    const ctx: GenContext = {
      rng: this.rng,
      maxDepth,
      resolveProperty: this.resolveProperty,
      activeProperties: new Set<string>(),
      parseCached: (source) => this.parseCached(source),
    };
    return sampleNode(ast, ctx, 0, maxLength);
  }

  /** All `<type>` references in `syntax`, deduped, in first-appearance order. */
  listTypeRefs(syntax: string): string[] {
    const ast = this.parseCached(syntax);
    if (ast === null) return [];
    const refs: string[] = [];
    collectTypeRefs(ast, new Set<string>(), refs);
    return refs;
  }

  private parseCached(syntax: string): SyntaxNode | null {
    const cached = this.astCache.get(syntax);
    if (cached !== undefined) return cached;
    let ast: SyntaxNode | null = null;
    try {
      ast = parseSyntax(syntax);
    } catch {
      ast = null;
    }
    this.astCache.set(syntax, ast);
    return ast;
  }
}
