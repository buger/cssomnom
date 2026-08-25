/**
 * Metamorphic-relation wrappers for the recovery-parser oracles.
 *
 * A metamorphic relation is a meaning-preserving input transformation T with a
 * spec-fixed consequence for the output. Because cssomnom's oracles
 * (lib/invariants.ts) are reference-free *relations themselves*, the practical
 * contract here is counting-based:
 *
 *   findings(checkInput(T(input))) - findings(checkInput(input)) == 0
 *
 * for meaning-preserving T (M1–M3, M5). A positive delta implies EITHER
 * pre-existing debt on the original (both sides carry it, so it cancels) OR a
 * wrapper bug OR a real parser bug that only the transformed shape exposes —
 * every delta is a triage candidate reported with its (original, transformed)
 * pair; it is never counted as a bug directly (see fuzz/oracles/README.md,
 * "Pipeline policy").
 *
 * Relations (each wrapper: `(input) => {relation, transformed}[]`, empty when
 * the transformation is unapplicable):
 *
 *   M1 case-flip          Flip ASCII case of property names and known keyword
 *                         tokens only (never selectors, custom properties, or
 *                         free identifiers). Property names and keyword values
 *                         are ASCII case-insensitive (css-syntax-3 § 3.3
 *                         #input-preprocessing note; css-values-4
 *                         #value-defs; css-cascade property-name matching),
 *                         so parse results must be invariant. Conservative
 *                         position heuristic via tokenize() types: an ident is
 *                         treated as a property name only when the previous
 *                         significant token is `{` `;` or `}` and the next
 *                         significant token is `:`; keywords are flipped only
 *                         inside a declaration-value region.
 *   M2 escape-encode      Replace the leading alnum character of any ident
 *                         token with its `\XX ` hex escape. css-syntax-3
 *                         § 4.3.9 #consume-name decodes escapes exactly, so
 *                         the decoded token values are identical. Strings,
 *                         urls, hashes, dimensions, functions, at-keywords and
 *                         custom-property names (leading `-`) are left alone.
 *   M3 separator inject   Insert ` ` or `/**\/` between whole tokens (token
 *                         boundaries from tokenize offsets). Comments are
 *                         semantically null everywhere (#consume-comment
 *                         returns nothing, css-syntax-3 § 4.3.2) and are
 *                         injected anywhere; whitespace is significant in
 *                         selector preludes (descendant combinator,
 *                         selectors-4) and inside custom-property values
 *                         (css-variables-1 raw text), so whitespace injection
 *                         is RESTRICTED to non-custom declaration-value
 *                         regions. Neither separator can join two adjacent
 *                         tokens: sign/hash/at/dot ambiguities never survive
 *                         as separate tokens (§ 4.3.1/#consume-comments).
 *   M4 chunk-permutation  Not a string transform: re-split the SAME input into
 *                         chunks aligned to token boundaries and require the
 *                         StreamingTokenizer output to equal one-shot
 *                         tokenize() (css-syntax-3 § 3.2 #code-point-input —
 *                         the stream is the stream, whatever the chunking).
 *                         Thin wrapper over the streaming oracle's building
 *                         blocks with boundary-aligned schedules instead of
 *                         arbitrary mid-token splits.
 *   M5 duplicate-rule     Duplicate a complete top-level rule verbatim
 *                         immediately after itself. Cascade-order invariance:
 *                         an identical later origin/duplicate produces the
 *                         same winners (css-cascade-4 #cascading), so no
 *                         observable change. SAFETY RESTRICTION per wave
 *                         brief: a rule is duplicated only when its outermost
 *                         block has no repeated normalized declaration names;
 *                         otherwise the rule is skipped.
 *
 * This module NEVER mutates repo state and never files KIs. Findings are
 * candidates; minimize → cluster → spec-validate downstream.
 */

import { tokenize } from '../../../src/tokenizer.ts';
import { StreamingTokenizer } from '../../../src/streaming-tokenizer.ts';
import { preprocessInput, contentTokens, type Finding } from './invariants.ts';
import type { Token } from '../../../src/types.ts';
import { encodeUtf8, rngFromData, type Rng } from '../../css-fuzz/src/rng.ts';

export const METAMORPHIC_VERSION = 'fuzz/oracles/metamorphic v1';

/** One meaning-preserving variant of an input. */
export interface MetamorphicTransform {
  /** Stable relation label, e.g. `M1:case-flip`. */
  relation: string;
  /** The transformed CSS text (operates on the § 3.3-preprocessed form). */
  transformed: string;
}

export interface TransformOptions {
  /** Deterministic seed driving M3 insertion sampling. Default 20260825. */
  seed?: number;
}

// ---------------------------------------------------------------------------
// Shared token-walking machinery
// ---------------------------------------------------------------------------

/** Max M5 variants emitted per input (attribution beats batch duplication). */
const MAX_DUPLICATE_VARIANTS = 4;

/** Upper bound on M3 insertions per variant (keeps growth linear-ish). */
const MAX_INJECTIONS = 48;

/** Probability that a given token boundary receives an injected separator. */
const INJECTION_PROBABILITY = 0.15;

/**
 * Leading folded comment/whitespace bytes: this tokenizer folds consumed
 * comments into the NEXT token's originalText (css-syntax-3 § 4.3.1
 * #consume-token step 1 + § 4.3.2 #consume-comment "returns nothing"; § 8
 * #serialization permits preserving them), so an ident's originalText can be
 * a folded comment glued to the name (e.g. comment bytes then `color`).
 * Rewrites must touch only the tail after that prefix.
 */
const FOLDED_PREFIX_RE = /^(?:[\s]+|\/\*[\s\S]*?\*\/)*/;

function splitFoldedPrefix(text: string): { head: string; tail: string } {
  const match = FOLDED_PREFIX_RE.exec(text);
  const head = match ? match[0] : '';
  return { head, tail: text.slice(head.length) };
}

function flipAsciiCase(text: string): string {
  let out = '';
  for (const ch of text) {
    const upper = ch.toUpperCase();
    out += upper !== ch ? upper : ch.toLowerCase();
  }
  return out;
}

/**
 * Keywords whose ASCII case never carries meaning in a declaration-value
 * region. Deliberately small and value-only (no pseudo-class/function/
 * selector words) so a mis-detected "value region" cannot silently change a
 * selector. `important` is included on purpose: `!IMPORTANT` must behave like
 * `!important` (css-syntax-3 #consume-declarations `! important` ASCII
 * case-insensitivity).
 */
const CASE_INSENSITIVE_KEYWORDS: ReadonlySet<string> = new Set([
  'inherit', 'initial', 'unset', 'revert', 'revert-layer', 'none', 'auto',
  'normal', 'bold', 'italic', 'oblique', 'small-caps', 'red', 'green', 'blue',
  'black', 'white', 'transparent', 'currentColor', 'solid', 'dashed',
  'dotted', 'double', 'hidden', 'visible', 'block', 'inline', 'flex', 'grid',
  'absolute', 'relative', 'fixed', 'sticky', 'static', 'left', 'right',
  'center', 'top', 'bottom', 'pointer', 'crosshair', 'repeat', 'no-repeat',
  'scroll', 'local', 'both', 'forwards', 'backwards', 'infinite', 'alternate',
  'ease', 'linear', 'important',
].map((keyword) => keyword.toLowerCase()));

/** Significant = neither whitespace nor comment (comments are not tokens). */
function isSignificant(tok: Token): boolean {
  return tok.type !== 'whitespace' && tok.type !== 'comment';
}

interface TokenSite {
  tok: Token;
  index: number;
  /** Brace depth BEFORE this token is applied ({ = +1, } = -1). */
  depthBefore: number;
  /** True when inside a declaration-value region (depth > 0, after `:`). */
  inValue: boolean;
  /** Type of the previous significant token, or null at stream start. */
  prevSigType: string | null;
  /** Next significant token (skipping ws/comments), or null at stream end. */
  nextSig: Token | null;
}

/**
 * Walk the content tokens of `input` and rebuild its preprocessed text from
 * (possibly rewritten) originalText pieces. `rewrite` returns the replacement
 * piece for a token, or null to keep it verbatim. EOF is never offered for
 * rewrite (it may absorb trailing comment bytes that must survive).
 */
function rewriteTokens(
  input: string,
  rewrite: (site: TokenSite) => string | null,
): string {
  const pre = preprocessInput(input);
  const all = tokenize(pre);
  const content = contentTokens(all);
  const sigIndices: number[] = [];
  for (let i = 0; i < content.length; i++) {
    if (isSignificant(content[i]!)) sigIndices.push(i);
  }
  let sigPos = 0;
  let depth = 0;
  let inValue = false;
  let prevSigType: string | null = null;
  let out = '';
  for (let i = 0; i < content.length; i++) {
    const tok = content[i]!;
    while (sigPos < sigIndices.length && sigIndices[sigPos]! < i) sigPos++;
    const nextSigIndex = sigPos < sigIndices.length && sigIndices[sigPos]! === i
      ? sigIndices[sigPos + 1]
      : sigIndices[sigPos];
    const nextSig = nextSigIndex === undefined ? null : content[nextSigIndex]!;
    const site: TokenSite = {
      tok,
      index: i,
      depthBefore: depth,
      inValue,
      prevSigType,
      nextSig,
    };
    const replacement = rewrite(site);
    out += replacement ?? tok.originalText ?? '';
    // State updates happen on the ORIGINAL token stream shape.
    if (tok.type === '{') {
      depth += 1;
      inValue = false;
    } else if (tok.type === '}') {
      depth -= 1;
      inValue = false;
    } else if (tok.type === 'semicolon') {
      inValue = false;
    } else if (tok.type === 'colon' && depth > 0) {
      inValue = true;
    }
    if (isSignificant(tok)) prevSigType = tok.type;
  }
  // Trailing EOF originalText (may hold folded final comments) must survive.
  const eof = all.length > 0 ? all[all.length - 1]! : null;
  if (eof && eof.type === 'EOF') out += eof.originalText ?? '';
  return out;
}

/** Is this ident token a conservative property-name position? */
function isPropertyNameSite(site: TokenSite): boolean {
  if (site.tok.type !== 'ident' || site.depthBefore <= 0 || site.inValue) return false;
  if (site.nextSig?.type !== 'colon') return false;
  return site.prevSigType === '{' || site.prevSigType === 'semicolon' || site.prevSigType === '}';
}

// ---------------------------------------------------------------------------
// M1 — case-flip property names + known keywords
// ---------------------------------------------------------------------------

/**
 * M1: flip ASCII case of property names and whitelisted keyword idents.
 * Returns [] when nothing was eligible (unapplicable ⇒ no variant).
 */
export function m1CaseFlip(input: string): MetamorphicTransform[] {
  let touched = false;
  const transformed = rewriteTokens(input, (site) => {
    if (site.tok.type !== 'ident') return null;
    const { head, tail } = splitFoldedPrefix(site.tok.originalText ?? '');
    if (tail.startsWith('--')) return null; // custom-prop names are case-sensitive
    const eligible =
      isPropertyNameSite(site) ||
      (site.inValue && site.depthBefore > 0 && CASE_INSENSITIVE_KEYWORDS.has(tail.toLowerCase()));
    if (!eligible) return null;
    const flipped = flipAsciiCase(tail);
    if (flipped === tail) return null;
    touched = true;
    return head + flipped;
  });
  return touched ? [{ relation: 'M1:case-flip', transformed }] : [];
}

// ---------------------------------------------------------------------------
// M2 — ascii-escape the leading alnum char of ident tokens
// ---------------------------------------------------------------------------

/**
 * M2: re-encode `foo` as `\66 oo` (css-syntax-3 § 4.3.9 #consume-name: `\` +
 * 1–6 hex digits + optional whitespace, decoded back to the same value).
 * Only plain ident tokens with an ASCII-alnum first character are rewritten;
 * the space terminator is always emitted, which is valid even at EOF.
 */
export function m2EscapeIdentHeads(input: string): MetamorphicTransform[] {
  let touched = false;
  const transformed = rewriteTokens(input, (site) => {
    if (site.tok.type !== 'ident') return null;
    const { head, tail } = splitFoldedPrefix(site.tok.originalText ?? '');
    const first = tail.codePointAt(0);
    if (first === undefined) return null;
    const isAlnum =
      (first >= 0x30 && first <= 0x39) ||
      (first >= 0x41 && first <= 0x5a) ||
      (first >= 0x61 && first <= 0x7a);
    if (!isAlnum) return null; // covers `--custom` too (leading `-`)
    const escaped = `\\${first.toString(16)} ${tail.slice(String.fromCodePoint(first).length)}`;
    touched = true;
    return head + escaped;
  });
  return touched ? [{ relation: 'M2:escape-idents', transformed }] : [];
}

// ---------------------------------------------------------------------------
// M3 — whitespace / comment injection at token boundaries
// ---------------------------------------------------------------------------

/**
 * Why the two variants have DIFFERENT scopes:
 *
 * - Comments are semantically null everywhere: #consume-comment returns
 *   nothing (css-syntax-3 § 4.3.2), they are never tokens, and selectors-4
 *   treats them as transparent between tokens (they do NOT create a
 *   descendant combinator).
 * - Whitespace IS significant in selector/at-rule preludes (it is the
 *   descendant combinator, selectors-4 § 4.1/combinators) and inside custom
 *   property values (css-variables-1 keeps the raw value text). Whitespace
 *   injection is therefore RESTRICTED to declaration-value regions of
 *   non-custom properties, where component-value lists ignore it.
 */
type InjectionScope = 'comment-anywhere' | 'whitespace-value-region';

function injectSeparators(
  input: string,
  separator: string,
  rng: Rng,
  scope: InjectionScope,
): string | null {
  const pre = preprocessInput(input);
  const all = tokenize(pre);
  const content = contentTokens(all);
  if (content.length < 2) return null;

  // Per-boundary eligibility: boundary[i] sits between content[i] and [i+1].
  let depth = 0;
  let inValue = false;
  let customProp = false;
  let prevSig: Token | null = null;
  const eligible: boolean[] = [];
  for (let i = 0; i < content.length; i++) {
    const tok = content[i]!;
    const next = content[i + 1];
    if (scope === 'comment-anywhere') {
      eligible.push(next !== undefined);
    } else {
      const sameBlock = next !== undefined && tok.type !== '}' && next.type !== '{';
      eligible.push(inValue && depth > 0 && !customProp && sameBlock);
    }
    if (tok.type === '{') {
      depth += 1;
      inValue = false;
    } else if (tok.type === '}') {
      depth = Math.max(0, depth - 1);
      inValue = false;
      customProp = false;
    } else if (tok.type === 'semicolon') {
      inValue = false;
      customProp = false;
    } else if (tok.type === 'colon' && depth > 0) {
      inValue = true;
      customProp =
        prevSig?.type === 'ident' &&
        splitFoldedPrefix(prevSig.originalText ?? '').tail.startsWith('--');
    }
    if (isSignificant(tok)) prevSig = tok;
  }

  const candidates: number[] = [];
  for (let i = 0; i < content.length - 1; i++) {
    if (eligible[i]) candidates.push(i);
  }
  if (candidates.length === 0) return null;
  const forced = candidates[candidates.length >> 1]; // ≥1 deterministic insert

  let inserted = 0;
  let out = '';
  for (let i = 0; i < content.length; i++) {
    out += content[i]!.originalText ?? '';
    if (inserted < MAX_INJECTIONS && i < content.length - 1 && eligible[i]) {
      if (i === forced || rng.genBool(INJECTION_PROBABILITY)) {
        out += separator;
        inserted++;
      }
    }
  }
  const eofTok = all[all.length - 1]!;
  if (eofTok.type === 'EOF') out += eofTok.originalText ?? '';
  return inserted > 0 ? out : null;
}

/**
 * M3: two variants — space injection (value regions only) and `/*m3*\/`
 * comment injection (anywhere) — sampled deterministically from the seed,
 * each guaranteed at least one insertion at a deterministic boundary.
 */
export function m3InjectSeparators(input: string, options: TransformOptions = {}): MetamorphicTransform[] {
  const seed = options.seed ?? 20260825;
  const transforms: MetamorphicTransform[] = [];
  const wsRng = rngFromData(encodeUtf8(`${seed}|M3:whitespace-injection|${input.length}`));
  const ws = injectSeparators(input, ' ', wsRng, 'whitespace-value-region');
  if (ws !== null) transforms.push({ relation: 'M3:whitespace-injection', transformed: ws });
  const cmtRng = rngFromData(encodeUtf8(`${seed}|M3:comment-injection|${input.length}`));
  const cmt = injectSeparators(input, '/*m3*/', cmtRng, 'comment-anywhere');
  if (cmt !== null) transforms.push({ relation: 'M3:comment-injection', transformed: cmt });
  return transforms;
}

// ---------------------------------------------------------------------------
// M5 — duplicate a complete top-level rule (conflict-restricted)
// ---------------------------------------------------------------------------

interface TopSegment {
  /** [start, end) slice of the preprocessed text forming one construct. */
  start: number;
  end: number;
  /** Offset of the segment's top-level `{`, or -1 for statement segments. */
  blockOpen: number;
  /** Offset just past the segment's matching top-level `}` (or `;`). */
  blockClose: number;
}

/**
 * Split the top level into construct segments. Reset points: after a top-level
 * `}` (end of qualified/at-rule block) and after a top-level `;` (statement
 * at-rule). Each block segment spans [prelude-inclusive start, closing `}`).
 *
 * Depth counts ONLY braces: function calls tokenize as one `function` token +
 * a separate `)` closer (unbalanced for paren-counting), and paren/bracket
 * interiors are either atomic tokens (url/string) or malformed-conservative.
 * Stray `}` at depth 0 is clamped and resynchronizes the segment start.
 */
function topLevelSegments(content: readonly Token[]): TopSegment[] {
  const segments: TopSegment[] = [];
  let segStart = 0;
  let depth = 0;
  let blockSegStart = -1;
  let blockOpen = -1;
  for (const tok of content) {
    const start = tok.startIndex ?? 0;
    const end = tok.endIndex ?? start;
    if (depth === 0 && tok.type === '{') {
      blockSegStart = segStart;
      blockOpen = start;
      depth = 1;
      continue;
    }
    if (depth === 1 && tok.type === '}') {
      depth = 0;
      segments.push({ start: blockSegStart, end, blockOpen, blockClose: end });
      segStart = end;
      blockSegStart = -1;
      blockOpen = -1;
      continue;
    }
    if (depth === 0 && tok.type === 'semicolon') {
      segStart = end; // statement at-rule / junk boundary: next block owns a clean prelude
      continue;
    }
    if (tok.type === '{') {
      depth += 1;
    } else if (tok.type === '}') {
      depth = Math.max(0, depth - 1);
      if (depth === 0) segStart = end; // stray closer: resynchronize
    }
  }
  return segments;
}

/** Next significant token strictly after `from`, within the segment's block. */
function nextSignificantWithin(content: readonly Token[], from: number, segment: TopSegment): Token | null {
  for (let j = from + 1; j < content.length; j++) {
    const t = content[j]!;
    const s = t.startIndex ?? 0;
    if (s >= segment.blockClose) return null;
    if (isSignificant(t)) return t;
  }
  return null;
}

/**
 * True when the segment has a usable top-level block whose OUTER declarations
 * (relative depth 1) declare no normalized name twice — the wave-brief safety
 * restriction ("rules whose declarations don't overlap after normalization;
 * else skip"). Custom properties participate too: duplication stays
 * conservative at zero cost.
 */
function outerBlockConflictFree(content: readonly Token[], segment: TopSegment): boolean {
  if (segment.blockOpen < 0) return false;
  const seen = new Set<string>();
  let depth = 1; // already inside the segment's opening `{`
  for (let i = 0; i < content.length; i++) {
    const tok = content[i]!;
    const start = tok.startIndex ?? 0;
    if (start <= segment.blockOpen) continue; // skip the opening `{` itself
    if (start >= segment.blockClose) break;
    if (tok.type === '{') {
      depth += 1;
      continue;
    }
    if (tok.type === '}') {
      depth -= 1;
      continue;
    }
    if (depth !== 1 || tok.type !== 'ident') continue;
    if (nextSignificantWithin(content, i, segment)?.type !== 'colon') continue;
    const { tail } = splitFoldedPrefix(tok.originalText ?? '');
    if (tail.length === 0) continue;
    const norm = tail.toLowerCase();
    if (seen.has(norm)) return false;
    seen.add(norm);
  }
  return true;
}

/**
 * M5: duplicate each conflict-safe top-level rule verbatim, immediately after
 * itself (cascade-order invariance: identical duplicate ⇒ identical winners).
 * Rules whose outermost block repeats a normalized declaration name are
 * SKIPPED (wave-brief safety restriction), as are preludes containing CDO/CDC
 * or statement `;` noise.
 */
export function m5DuplicateTopLevelRules(input: string): MetamorphicTransform[] {
  const pre = preprocessInput(input);
  const content = contentTokens(tokenize(pre));
  const transforms: MetamorphicTransform[] = [];
  for (const segment of topLevelSegments(content)) {
    if (transforms.length >= MAX_DUPLICATE_VARIANTS) break;
    if (segment.blockOpen < 0) continue; // statement at-rules: duplication changes @import semantics
    const prelude = pre.slice(segment.start, segment.blockOpen);
    if (/<!--|-->/.test(prelude)) continue; // CDO/CDC noise: keep conservative
    if (!outerBlockConflictFree(content, segment)) continue;
    const segSrc = pre.slice(segment.start, segment.end);
    if (segSrc.trim().length === 0) continue;
    const transformed = pre.slice(0, segment.end) + '\n' + segSrc + pre.slice(segment.end);
    transforms.push({
      relation: `M5:duplicate-rule#${transforms.length}`,
      transformed,
    });
  }
  return transforms;
}

// ---------------------------------------------------------------------------
// Combined wrapper
// ---------------------------------------------------------------------------

/** All string-transforming relations for one input, in stable order. */
export function metamorphicTransforms(input: string, options: TransformOptions = {}): MetamorphicTransform[] {
  return [
    ...m1CaseFlip(input),
    ...m2EscapeIdentHeads(input),
    ...m3InjectSeparators(input, options),
    ...m5DuplicateTopLevelRules(input),
  ];
}

// ---------------------------------------------------------------------------
// M4 — chunk-boundary permutation (equivalence check, thin oracle wrapper)
// ---------------------------------------------------------------------------

/** Default number of boundary-aligned split schedules to try. */
export const DEFAULT_M4_SCHEDULES = 6;

/**
 * M4: feed the SAME input to StreamingTokenizer with chunk cuts placed exactly
 * on token boundaries (schedule s cuts after every (s+1)-th token), and require
 * the streamed (type, originalText) sequence to equal one-shot tokenize().
 * Complements checkStreamingEquivalence(), whose position-derived schedule
 * usually cuts mid-token: boundary-aligned cuts stress the flush/remnant paths
 * (surrogate buffering, trailing-CR holdback) from the other side.
 */
export function checkChunkBoundaryPermutations(
  input: string,
  maxSchedules: number = DEFAULT_M4_SCHEDULES,
): Finding[] {
  const pre = preprocessInput(input);
  const oneShot = contentTokens(tokenize(pre));
  if (oneShot.length < 2) return [];
  const bounds: number[] = [];
  for (const tok of oneShot) bounds.push(tok.endIndex ?? 0);
  const findings: Finding[] = [];

  const expect = oneShot.map((tok) => `${tok.type}\u0000${tok.originalText ?? ''}`);

  for (let schedule = 0; schedule < maxSchedules; schedule++) {
    const stride = schedule + 1;
    const cuts = bounds.filter((_bound, i) => i % stride === stride - 1);
    const streamed: string[] = [];
    try {
      const tokenizer = new StreamingTokenizer();
      let pos = 0;
      for (const cut of cuts) {
        if (cut <= pos) continue;
        tokenizer.appendChunk(pre.slice(pos, cut));
        pos = cut;
        for (const tok of contentTokens(tokenizer.getTokens())) {
          streamed.push(`${tok.type}\u0000${tok.originalText ?? ''}`);
        }
      }
      if (pos < pre.length) tokenizer.appendChunk(pre.slice(pos));
      tokenizer.close();
      for (const tok of contentTokens(tokenizer.getTokens())) {
        streamed.push(`${tok.type}\u0000${tok.originalText ?? ''}`);
      }
    } catch (err) {
      findings.push({
        kind: 'stream-divergence',
        detail: `M4 schedule ${schedule} (stride ${stride}) threw ${err instanceof Error ? err.name : typeof err}: ${cap(err instanceof Error ? err.message : String(err))}`,
        offset: cuts[schedule] ?? undefined,
      });
      continue;
    }
    const n = Math.min(streamed.length, expect.length);
    for (let i = 0; i < n; i++) {
      if (streamed[i] !== expect[i]) {
        findings.push({
          kind: 'stream-divergence',
          detail: `M4 boundary schedule ${schedule} (stride ${stride}) diverged at token #${i}: streamed ${JSON.stringify(cap(streamed[i] ?? '', 60))} vs one-shot ${JSON.stringify(cap(expect[i] ?? '', 60))}`,
          offset: oneShot[i]?.startIndex,
        });
        break;
      }
    }
    if (streamed.length !== expect.length && !findings.some((f) => f.detail.includes(`schedule ${schedule} `))) {
      findings.push({
        kind: 'stream-divergence',
        detail: `M4 boundary schedule ${schedule} (stride ${stride}) token count ${streamed.length} != one-shot ${expect.length}`,
        expected: String(expect.length),
        actual: String(streamed.length),
      });
    }
  }
  return findings;
}

function cap(text: string, max = 300): string {
  return text.length <= max ? text : `${text.slice(0, max)}…(+${text.length - max})`;
}
