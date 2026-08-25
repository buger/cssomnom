/**
 * Expectation-side projectors for the differential harness
 * (`fuzz/oracles/differential.ts`).
 *
 * Each external suite (lightningcss / nv / rrweb / csstree / postcss) records
 * its EXPECTED OUTPUT in a different shape. A "projector" renders cssomnom's
 * parse result — and the fixture's recorded expectation — into the SAME
 * comparable shape, so a generic deep-compare can decide match/mismatch.
 *
 * FIDELITY CONTRACT (read before trusting any single mismatch):
 *
 *   - lightning : high fidelity. Both sides are whitespace-normalized CSS
 *     text (identical normalization to tests/external-lightning.test.ts).
 *   - nv        : high fidelity for the asserted surface only (rule count,
 *     selectorText, per-property getPropertyValue). Mirrors
 *     tests/external-nv.test.ts normalizers exactly.
 *   - rrweb     : high fidelity for the recorded recursive structure
 *     (selectorText / conditionText / media items / style props / nested
 *     cssRules). Mirrors tests/external-rrweb.test.ts exactly, including its
 *     raw (unnormalized) conditionText/media comparisons.
 *   - csstree /
 *     postcss    : STRUCTURAL PROJECTION ONLY — top-level rule count, the
 *     selectors list and per-rule declaration counts. Full AST-shape equality
 *     is impossible across models (csstree/postcss preserve comments, raws,
 *     source offsets and exact input formatting; CSSOM mandates canonical
 *     serialization and shorthand expansion per cssom-1 § 5.4.3). Known
 *     consequences:
 *       * declaration COUNTS on our side reflect post-expansion longhands,
 *         so shorthand inputs (`border: 1px solid red`) legitimately diverge;
 *       * top-level comments/CDO/CDC present in the recorded ASTs vanish on
 *         our side (css-syntax-3 § 5.4.1) — these cases are pre-acknowledged
 *         via the known-divergent name sets mirrored from the sibling suites.
 *
 * This module is deliberately PURE: it never imports the parser or touches
 * the filesystem, so it can be unit-pinned (`--selftest`) without repo state.
 * It never mutates repo state and never files KIs (see fuzz/oracles/README.md).
 */

// ---------------------------------------------------------------------------
// Normalizers — mirrored VERBATIM from the sibling suites so that every case
// they already pass stays passing under re-projection. Do not "improve" these
// locally; change the sibling suite first if normalization must evolve.
// ---------------------------------------------------------------------------

/** tests/external-lightning.test.ts `normalize` (also used for baseline keys). */
export const normalizeLightning = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Shared by nv + rrweb suites: single quotes → double quotes. */
export const normalizeQuotes = (s: string): string => s.replace(/'/g, '"');

/** Shared by nv + rrweb suites: collapse all whitespace runs, trim ends. */
export const normalizeWhitespace = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Shared by nv + rrweb suites: strip quotes inside url(...) tokens. */
export const normalizeUrls = (s: string): string =>
  s.replace(/url\("([^"]+)"\)/g, 'url($1)').replace(/url\('([^']+)'\)/g, 'url($1)');

/** Shared by nv + rrweb suites: pad combinators, collapse whitespace. */
export const normalizeSelector = (s: string): string =>
  s.replace(/\s*([>+~||])\s*/g, ' $1 ').replace(/\s+/g, ' ').trim();

/** nv/rrweb value pipeline: exactly the sibling's composition order. */
export const normalizeNVValue = (s: string): string =>
  normalizeUrls(normalizeWhitespace(normalizeQuotes(s)));

// ---------------------------------------------------------------------------
// Style-key filtering — mirrors which keys the sibling suites assert on.
// ---------------------------------------------------------------------------

/**
 * Keys ignored when walking a RECORDED style object. The first four mirror
 * tests/external-rrweb.test.ts; `__*`/`length` are skipped by both nv+rrweb.
 */
const IGNORED_STYLE_KEYS = new Set(['length', 'parentRule', '_importants', '_vendorPrefix']);

function isAssertedStyleKey(key: string): boolean {
  if (key.startsWith('__')) return false; // internal offsets (__starts/__ends)
  return !IGNORED_STYLE_KEYS.has(key);
}

function isNumericKey(key: string): boolean {
  return Number.isNaN(Number(key)) === false;
}

export interface StyleAssertion {
  /** Named properties → normalized getPropertyValue value (keys sorted). */
  named: Record<string, string>;
  /** Indexed positions → style.item(n) values, ascending position order. */
  indexed: string[];
}

/**
 * Extract the assertion manifest from a RECORDED style object: which named
 * keys and indexed positions the sibling suite would probe. Order of probes
 * is irrelevant to the outcome (each key is compared independently), but we
 * sort named keys so projections serialize deterministically.
 */
export function extractStyleAssertionKeys(recordedStyle: unknown): {
  namedKeys: string[];
  indexedPositions: number[];
} {
  const namedKeys: string[] = [];
  const indexedPositions: number[] = [];
  if (recordedStyle === null || typeof recordedStyle !== 'object') {
    return { namedKeys, indexedPositions };
  }
  for (const key of Object.keys(recordedStyle as Record<string, unknown>)) {
    if (!isAssertedStyleKey(key)) continue;
    if (isNumericKey(key)) indexedPositions.push(Number(key));
    else namedKeys.push(key);
  }
  namedKeys.sort();
  indexedPositions.sort((a, b) => a - b);
  return { namedKeys, indexedPositions };
}

/** Project a RECORDED style object into the comparable StyleAssertion shape. */
export function projectRecordedStyle(recordedStyle: unknown): StyleAssertion {
  const { namedKeys, indexedPositions } = extractStyleAssertionKeys(recordedStyle);
  const rec = (recordedStyle ?? {}) as Record<string, unknown>;
  const named: Record<string, string> = {};
  for (const key of namedKeys) {
    const value = rec[key];
    named[key] = normalizeNVValue(typeof value === 'string' ? value : String(value));
  }
  const indexed = indexedPositions.map((pos) => {
    const value = rec[String(pos)];
    return normalizeNVValue(typeof value === 'string' ? value : String(value));
  });
  return { named, indexed };
}

/**
 * Project OUR live CSSStyleDeclaration using the manifest extracted from the
 * recorded expectation — this mirrors the sibling suites exactly: they probe
 * precisely the keys present in the fixture and nothing else (so extra
 * longhands produced by shorthand expansion never cause false mismatches).
 */
export function projectLiveStyle(
  liveStyle: unknown,
  manifest: { namedKeys: string[]; indexedPositions: number[] },
): StyleAssertion {
  const style = liveStyle as
    | { getPropertyValue(prop: string): string; item(index: number): string }
    | undefined;
  const named: Record<string, string> = {};
  const indexed: string[] = [];
  if (style === undefined || style === null) {
    // Missing live style cannot satisfy any recorded assertion; emit empty
    // projection — the deep-compare against the recorded one will fail with a
    // clear path (named/indexed length divergence).
    for (const key of manifest.namedKeys) named[key] = '';
    for (let i = 0; i < manifest.indexedPositions.length; i++) indexed.push('');
    return { named, indexed };
  }
  for (const key of manifest.namedKeys) {
    named[key] = normalizeNVValue(style.getPropertyValue(key));
  }
  for (const pos of manifest.indexedPositions) {
    indexed.push(normalizeNVValue(style.item(pos)));
  }
  return { named, indexed };
}

/** Array-like length detection — mirrors tests/external-rrweb.test.ts. */
export function recordedRuleCount(recordedRules: unknown): number {
  if (Array.isArray(recordedRules)) return recordedRules.length;
  if (recordedRules !== null && typeof recordedRules === 'object') {
    const rec = recordedRules as Record<string, unknown>;
    if (typeof rec.length === 'number') return rec.length;
    return Object.keys(rec).filter((k) => !Number.isNaN(Number(k))).length;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Structural projection (csstree + postcss) — see FIDELITY CONTRACT above.
// ---------------------------------------------------------------------------

export type StructuralEntry =
  | { kind: 'style'; selectors: string[]; decls: number }
  | { kind: 'atrule'; name: string; decls: number; rules: number }
  | { kind: 'decl' }
  | { kind: 'comment' }
  | { kind: 'raw' }
  | { kind: 'cdo' }
  | { kind: 'cdc' };

export interface StructuralProjection {
  rules: StructuralEntry[];
}

/** Canonicalize a comma-separated selector list (both sides run this). */
export function canonicalizeSelectorList(joined: string): string[] {
  const withoutComments = joined.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutComments.split(',').map((part) => part.replace(/\s+/g, ' ').trim());
}

/** Derive the at-rule name from OUR serialized cssText (`@media …` → media). */
export function atruleNameFromCssText(cssText: string): string {
  // Ident characters beyond ASCII letters/digits/hyphen are rare in at-rule
  // names; terminate at the first whitespace/'{'/';'/'(' which always ends
  // the prelude of the serialized form.
  const m = /^@([^\s{;(]+)/.exec(cssText);
  return m !== null ? m[1].toLowerCase() : '(unknown)';
}

/**
 * Project OUR stylesheet (top level only) into the structural shape.
 * Discriminator order matters: CSSStyleRule extends CSSGroupingRule, so
 * presence of `cssRules` alone cannot identify grouping at-rules — a string
 * `selectorText` identifies style rules first. Declarations are counted via
 * style.length (post-expansion longhands — documented fidelity limitation);
 * rules below the top level are counted, not walked.
 */
export function projectStructuralFromCSSOM(sheet: unknown): StructuralProjection {
  const rules: StructuralEntry[] = [];
  const top = (sheet as { cssRules?: unknown } | null)?.cssRules;
  const count = typeof (top as { length?: number } | null)?.length === 'number'
    ? (top as { length: number }).length
    : 0;
  for (let i = 0; i < count; i++) {
    const rule = (top as unknown[])[i] as Record<string, unknown> | undefined;
    if (rule === undefined || rule === null) continue;
    const cssText = typeof rule.cssText === 'string' ? rule.cssText : '';
    if (cssText.startsWith('@')) {
      // At-rules first: CSSPageRule/CSSMarginRule etc. ALSO expose
      // selectorText, so selectorText presence cannot identify style rules.
      const childCount =
        typeof (rule.cssRules as { length?: number } | null)?.length === 'number'
          ? (rule.cssRules as { length: number }).length
          : 0;
      rules.push({
        kind: 'atrule',
        name: atruleNameFromCssText(cssText),
        decls: 0, // grouping at-rules expose no direct declarations in CSSOM
        rules: childCount,
      });
    } else if (typeof rule.selectorText === 'string') {
      // Qualified (style) rule.
      rules.push({
        kind: 'style',
        selectors: canonicalizeSelectorList(rule.selectorText),
        decls: countDeclarationsLive(rule.style),
      });
    } else {
      rules.push({ kind: 'raw' });
    }
  }
  return { rules };
}

function countDeclarationsLive(style: unknown): number {
  const len = (style as { length?: number } | null)?.length;
  return typeof len === 'number' ? len : 0;
}

type CSSTreeNode = {
  type?: string;
  name?: unknown;
  property?: unknown;
  value?: unknown;
  children?: CSSTreeNode[];
  block?: CSSTreeNode;
  prelude?: CSSTreeNode;
  loc?: unknown;
  [key: string]: unknown;
};

function childrenOf(node: CSSTreeNode | null | undefined, key: 'children' | 'nodes'): CSSTreeNode[] {
  if (node === undefined || node === null) return [];
  const value = node[key];
  return Array.isArray(value) ? (value as CSSTreeNode[]) : [];
}

/** Minimal csstree-selector → text serializer (structural fidelity only). */
function csstreeSelectorToText(nodes: CSSTreeNode[]): string {
  let out = '';
  for (const node of nodes) {
    switch (node.type) {
      case 'TypeSelector':
        out += String(node.name ?? '');
        break;
      case 'ClassSelector':
        out += `.${String(node.name ?? '')}`;
        break;
      case 'IdSelector':
        out += `#${String(node.name ?? '')}`;
        break;
      case 'AttributeSelector':
        out += `[${String((node.name as CSSTreeNode | undefined)?.name ?? '')}]`;
        break;
      case 'PseudoElementSelector':
        out += `::${String(node.name ?? '')}`;
        break;
      case 'PseudoClassSelector': {
        const inner = node.children !== undefined
          ? `(${childrenOf(node, 'children')
              .map((sel) => csstreeSelectorToText(childrenOf(sel, 'children')))
              .join(',')})`
          : '';
        out += `:${String(node.name ?? '')}${inner}`;
        break;
      }
      case 'Combinator':
        out += ` ${String(node.name ?? ' ')} `;
        break;
      case 'WhiteSpace':
      case 'Comment':
        break; // dropped; canonicalization handles the rest symmetrically
      case 'NestingSelector':
        out += '&';
        break;
      case 'Raw':
        out += String(node.value ?? '');
        break;
      default:
        out += `<?${String(node.type ?? '?')}>`; // visible, deterministic fallback
    }
  }
  return out;
}

/**
 * Project a RECORDED csstree StyleSheet AST into the structural shape.
 * Limitation: selector text is rebuilt by a MINIMAL serializer (the corpus
 * only exercises Type/Class/PseudoClass selectors); unknown node types render
 * as `<?TYPE>` placeholders so divergence is visible, never silent.
 */
export function projectStructuralFromCSSTree(ast: unknown): StructuralProjection {
  const rules: StructuralEntry[] = [];
  const root = ast as CSSTreeNode | null;
  for (const node of childrenOf(root, 'children')) {
    switch (node.type) {
      case 'Rule': {
        const joined = childrenOf(node.prelude, 'children')
          .map((sel) => csstreeSelectorToText(childrenOf(sel, 'children')))
          .join(',');
        const blockChildren = childrenOf(node.block, 'children');
        rules.push({
          kind: 'style',
          selectors: canonicalizeSelectorList(joined),
          decls: blockChildren.filter((c) => c.type === 'Declaration').length,
        });
        break;
      }
      case 'Atrule': {
        const blockChildren = childrenOf(node.block, 'children');
        rules.push({
          kind: 'atrule',
          name: String(node.name ?? '').toLowerCase(),
          decls: blockChildren.filter((c) => c.type === 'Declaration').length,
          rules: blockChildren.filter((c) => c.type === 'Rule' || c.type === 'Atrule').length,
        });
        break;
      }
      case 'Raw':
        rules.push({ kind: 'raw' });
        break;
      case 'CDO':
        rules.push({ kind: 'cdo' });
        break;
      case 'CDC':
        rules.push({ kind: 'cdc' });
        break;
      default:
        rules.push({ kind: 'raw' });
    }
  }
  return { rules };
}

/**
 * Project a RECORDED PostCSS root AST into the structural shape. PostCSS
 * records plain selector strings, so no serializer guesswork is needed here.
 */
export function projectStructuralFromPostCSS(ast: unknown): StructuralProjection {
  const rules: StructuralEntry[] = [];
  const root = ast as CSSTreeNode | null;
  const nodes = childrenOf(root, 'nodes');
  for (const node of nodes) {
    switch (node.type) {
      case 'rule': {
        rules.push({
          kind: 'style',
          selectors: canonicalizeSelectorList(String(node.selector ?? '')),
          decls: childrenOf(node, 'nodes').filter((c) => c.type === 'decl').length,
        });
        break;
      }
      case 'atrule': {
        const childNodes = childrenOf(node, 'nodes');
        rules.push({
          kind: 'atrule',
          name: String(node.name ?? '').toLowerCase(),
          decls: childNodes.filter((c) => c.type === 'decl').length,
          rules: childNodes.filter((c) => c.type === 'rule' || c.type === 'atrule').length,
        });
        break;
      }
      case 'decl':
        rules.push({ kind: 'decl' });
        break;
      case 'comment':
        rules.push({ kind: 'comment' });
        break;
      default:
        rules.push({ kind: 'raw' });
    }
  }
  return { rules };
}

// ---------------------------------------------------------------------------
// Cycle-safe structural deep-compare (deterministic key order).
// ---------------------------------------------------------------------------

export interface CompareResult {
  equal: boolean;
  /** Dot path of first divergence (when unequal). */
  path?: string;
  detail?: string;
}

const MAX_COMPARE_DEPTH = 64;

/**
 * Deep-compare two JSON-ish projections. Object key order is irrelevant
 * (keys are compared sorted); arrays are order-sensitive; ancestor-tracking
 * makes cyclic inputs safe (aligned cycles compare equal instead of
 * overflowing the stack — DOM parent pointers must never crash the harness).
 */
export function structuralCompare(a: unknown, b: unknown): CompareResult {
  return compareInner(a, b, '$', new Map<unknown, Set<unknown>>(), 0);
}

function compareInner(
  a: unknown,
  b: unknown,
  path: string,
  ancestors: Map<unknown, Set<unknown>>,
  depth: number,
): CompareResult {
  if (depth > MAX_COMPARE_DEPTH) {
    return { equal: false, path, detail: `max depth ${MAX_COMPARE_DEPTH} exceeded` };
  }
  if (Object.is(a, b)) return { equal: true };
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return { equal: false, path, detail: `${fmt(a)} !== ${fmt(b)}` };
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return { equal: false, path, detail: 'array vs non-array' };
  }
  // Cycle guard: if a↔b are already being compared higher up, aligned cycles
  // are structurally equal by construction.
  const seenForA = ancestors.get(a);
  if (seenForA !== undefined && seenForA.has(b)) return { equal: true };

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return { equal: false, path, detail: `length ${a.length} !== ${b.length}` };
    }
    ancestors.set(a, (ancestors.get(a) ?? new Set()).add(b));
    for (let i = 0; i < a.length; i++) {
      const sub = compareInner(a[i], b[i], `${path}[${i}]`, ancestors, depth + 1);
      if (!sub.equal) return sub;
    }
    return { equal: true };
  }

  const ka = Object.keys(a as Record<string, unknown>).sort();
  const kb = Object.keys(b as Record<string, unknown>).sort();
  if (ka.join('\u0000') !== kb.join('\u0000')) {
    const onlyA = ka.filter((k) => !kb.includes(k));
    const onlyB = kb.filter((k) => !ka.includes(k));
    return {
      equal: false,
      path,
      detail: `key sets differ${onlyA.length ? ` only-ours:${onlyA.slice(0, 4).join(',')}` : ''}${
        onlyB.length ? ` only-recorded:${onlyB.slice(0, 4).join(',')}` : ''
      }`,
    };
  }
  ancestors.set(a, (ancestors.get(a) ?? new Set()).add(b));
  for (const key of ka) {
    const sub = compareInner(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
      `${path}.${key}`,
      ancestors,
      depth + 1,
    );
    if (!sub.equal) return sub;
  }
  return { equal: true };
}

function fmt(v: unknown): string {
  if (typeof v === 'string') return JSON.stringify(v);
  return String(v);
}

// ---------------------------------------------------------------------------
// Byte-stability helper: deterministic JSON stringify is unnecessary because
// we construct report objects with fixed key insertion order and sort all
// dynamic collections before writing; callers rely on that contract.
// ---------------------------------------------------------------------------

/** Cap embedded detail strings (mirrors lib/invariants.ts cap() style). */
export function capStr(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…(+${text.length - max})`;
}
