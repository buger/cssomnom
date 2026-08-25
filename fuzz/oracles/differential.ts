/**
 * Expectation-side differential harness (WAVE-B).
 *
 * Unlike input-only cross-checks, this compares cssomnom's PARSED+PROJECTED
 * output against other projects' RECORDED EXPECTED OUTPUTS at scale:
 *
 *   lightning : 1247 recorded serialized strings  (tests/fixtures/external/lightningcss.json)
 *   nv        : 43 recorded rule/selector/prop expectations (nv-tests.json)
 *   rrweb     : 49 recorded recursive cssRules structures  (rrweb-tests.json)
 *   csstree   : 27 recorded csstree ASTs (STRUCTURAL projection only) (csstree-tests.json)
 *   postcss   : 32 recorded PostCSS ASTs (STRUCTURAL projection only) (postcss-tests.json)
 *
 * Every mismatch is CLASSIFIED, never auto-accused:
 *   - known-divergent : the case is already acknowledged by an existing
 *     baseline/sibling skip set (lightning-known-failures.json, the mirrored
 *     nv/rrweb/csstable/postcss skip sets below) — NOT a net-new finding.
 *   - net-new         : no baseline acknowledges it → the deliverable list.
 *
 * Reconciliation contract: projectors mirror the sibling suites'
 * normalization semantics EXACTLY (see lib/projectors.ts), so for any suite
 * the number of matches among non-baselined cases must reconcile with the
 * sibling suite's pass count. Run each sibling once before/after to verify.
 *
 * Usage:
 *   node fuzz/oracles/differential.ts [--suite lightning|nv|rrweb|csstree|postcss|all]
 *        [--budget-ms N] [--max-list N] [--out REPORT.json] [--selftest]
 *
 * Never mutates repo state; writes only the optional --out report file.
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Parser } from '../../src/parser.ts';
import { tokenize } from '../../src/tokenizer.ts';
import {
  capStr,
  extractStyleAssertionKeys,
  normalizeLightning,
  normalizeNVValue,
  normalizeSelector,
  projectLiveStyle,
  projectRecordedStyle,
  projectStructuralFromCSSOM,
  projectStructuralFromCSSTree,
  projectStructuralFromPostCSS,
  recordedRuleCount,
  structuralCompare,
} from './lib/projectors.ts';

export const DIFFERENTIAL_VERSION = 'fuzz/oracles/differential wave-b v1';

const DEFAULT_BUDGET_MS = 600_000;
const MISMATCH_CAP = 400;
const SOURCE_SNIPPET_MAX = 120;
const PREFIX_MAX = 160;

// ---------------------------------------------------------------------------
// Known-divergent registries
// ---------------------------------------------------------------------------

interface LightningFixture {
  type: string;
  source: string;
  expected?: string;
}

/** Read-only consumption of the acknowledged-failure baseline (1100 keys). */
function loadLightningBaseline(): Set<string> {
  const url = new URL('../../tests/fixtures/baselines/lightning-known-failures.json', import.meta.url);
  return new Set(JSON.parse(readFileSync(url, 'utf8')) as string[]);
}

/**
 * Weak cross-lane heuristic: WPT known-failure entries are keyed by WPT test
 * ids, which external fixtures do not carry. We surface their recorded
 * css-text segment and classify a lightning mismatch as known-divergent only
 * if its normalized EXPECTATION verbatim-contains such an acknowledged
 * fragment (≥8 chars to avoid noise). This can under-trigger, never
 * over-trigger net-new classification beyond an acknowledged class.
 */
function loadWPTKnownTexts(): string[] {
  const url = new URL('../../tests/fixtures/baselines/wpt-cssom-known-failures.json', import.meta.url);
  const entries = JSON.parse(readFileSync(url, 'utf8')) as string[];
  return entries
    .map((entry) => entry.split('|').pop() ?? '')
    .filter((text) => text.length >= 8);
}

/** Mirrored from tests/external-nv.test.ts `knownSkips` (input-keyed). */
const NV_KNOWN_SKIPS = new Set<string>([
  '@-moz-keyframes foo {} @--keyframes bar {} @-webkit-keyframes quux {}',
  'some invalid junk @media projection {body{background:black}}',
  '* {\tborder:\tnone\t} \n#foo {font-size: 12px; background:#fff;}',
  'img:not(/*)*/[src]){background:url(data:image/png;base64,FooBar)}',
  'h2 {font: normal\n1.6em\r\nTimes New Roman,\tserif  ;}',
  "h1 {font-family: 'Times New Roman', Helvetica Neue, sans-serif }",
  "h3 {font-family: 'times new roman'} ",
]);

/** Mirrored from tests/external-rrweb.test.ts `knownSkips` (input-keyed). */
const RRWEB_KNOWN_SKIPS = new Set<string>([
  'some invalid junk @media projection {body{background:black}}',
  '* {\tborder:\tnone\t} \n#foo {font-size: 12px; background:#fff;}',
  'img:not(/*)*/[src]){background:url(data:image/png;base64,FooBar)}',
  '@media/**/print {*{background:#fff}}',
  '@media screen{a{color:blue !important;background:red;} @font-face { font-family: \'Arial2\'; } }',
  '@-moz-keyframes foo {} @--keyframes bar {} @-webkit-keyframes quux {}',
  '@host { body { background: red; } }',
  '@-moz-document url(http://www.w3.org/), url-prefix(http://www.w3.org/Style/), domain(mozilla.org), regexp("https:.*")\n{\n/*comments*/\nbody { color: purple; background: yellow; }\n}',
  'a{}@-moz-document/**/url-prefix(http://www.w3.org/Style/){body { color: purple; background: yellow; }}',
  '@starting-style { body { background: red; } }',
  '@starting-style { @media screen { body { background: red; } } }',
  '@media screen { @starting-style { body { background: red; } } }',
  '@-some-ridiculously-long-vendor-prefix-that-must-be-supported-keyframes therulename /*comment*/{0%{top:0px; left:0px; background:red;}100% {top:4em; left:40px; background:maroon;}}',
  'h2 {font: normal\n1.6em\r\nTimes New Roman,\tserif  ;}',
  "h1 {font-family: 'Times New Roman', Helvetica Neue, sans-serif }",
  "h3 {font-family: 'times new roman'} ",
]);

/** Mirrored from tests/external-roundtrip.test.ts `knownCSSTreeSkips` (name-keyed). */
const CSSTREE_KNOWN_SKIPS = new Set<string>([
  'comment only',
  'comment and whitespaces only',
  'BOM UTF-16BE #2',
  'BOM UTF-16LE',
  'BOM UTF-16LE #2',
  'stylesheet.0',
  'stylesheet.1',
  'stylesheet.3',
  'stylesheet.4',
  'stylesheet.c.0',
  'stylesheet.s.0',
  'stylesheet.s.1',
  'stylesheet.s.3',
  'CDO',
  'CDC',
  'CDO/CDC',
  'rule with a bad-string token (issue #93)',
  'issue #250',
  'issue111.test1',
]);

/**
 * Mirrored from tests/external-roundtrip.test.ts `postCSSSpecTransformCases`:
 * cases where CSSOM spec mandates dropping comments/duplicate declarations/
 * hacks. The sibling suite relaxes them to parse-success checks only, so a
 * structural divergence on these names is pre-acknowledged.
 */
const POSTCSS_KNOWN_DIVERGENT = new Set<string>([
  'atrule-decls',
  'atrule-empty',
  'atrule-no-semicolon',
  'atrule-no-space',
  'comments',
  'custom-properties',
  'escape',
  'extends',
  'function',
  'ie-progid',
  'important',
  'inside',
  'no-selector',
  'prop',
  'quotes',
  'rule-at',
  'selector',
  'semicolons',
]);

// ---------------------------------------------------------------------------
// Suite plumbing
// ---------------------------------------------------------------------------

export type SuiteName = 'lightning' | 'nv' | 'rrweb' | 'csstree' | 'postcss';
const ALL_SUITES: readonly SuiteName[] = ['lightning', 'nv', 'rrweb', 'csstree', 'postcss'];

export interface SuiteStats {
  total: number;
  /** Cases actually projected + compared (or error-path checked). */
  compared: number;
  match: number;
  /** NET-NEW mismatches (no baseline acknowledges them) — the deliverable. */
  mismatch: number;
  /** Mismatches acknowledged by an existing baseline/sibling skip set. */
  knownDivergent: number;
  /** Skipped: expectation absent/malformed in the fixture itself. */
  noExpectation: number;
  /** Extra counters (documented additions beyond the required six fields). */
  matchWithBaselineHit: number;
  budgetSkipped: number;
  harnessError: number;
}

export interface MismatchRecord {
  suite: SuiteName;
  id: string;
  sourceSnippet: string;
  expectedPrefix: string;
  actualPrefix: string;
  baselineHit: boolean;
}

export interface DifferentialReport {
  tool: typeof DIFFERENTIAL_VERSION;
  generatedAt: string;
  args: Record<string, string>;
  perSuite: Record<SuiteName, SuiteStats>;
  mismatches: MismatchRecord[];
  mismatchesTotalNetNew: number;
  mismatchesCapReached: boolean;
  truncatedByBudget: boolean;
}

interface RunState {
  stats: SuiteStats;
  mismatches: MismatchRecord[];
  truncatedByBudget: boolean;
  startedAt: number;
  budgetMs: number;
}

function newStats(): SuiteStats {
  return {
    total: 0,
    compared: 0,
    match: 0,
    mismatch: 0,
    knownDivergent: 0,
    noExpectation: 0,
    matchWithBaselineHit: 0,
    budgetSkipped: 0,
    harnessError: 0,
  };
}

function recordOutcome(
  state: RunState,
  suite: SuiteName,
  id: string,
  source: string,
  equal: boolean,
  baselineHit: boolean,
  expectedText: string,
  actualText: string,
): void {
  state.stats.compared++;
  if (equal) {
    state.stats.match++;
    if (baselineHit) state.stats.matchWithBaselineHit++;
    return;
  }
  if (baselineHit) {
    state.stats.knownDivergent++;
    return;
  }
  state.stats.mismatch++;
  if (state.mismatches.length < MISMATCH_CAP) {
    state.mismatches.push({
      suite,
      id,
      sourceSnippet: capStr(source.replace(/\s+/g, ' ').trim(), SOURCE_SNIPPET_MAX),
      expectedPrefix: capStr(expectedText.replace(/\s+/g, ' ').trim(), PREFIX_MAX),
      actualPrefix: capStr(actualText.replace(/\s+/g, ' ').trim(), PREFIX_MAX),
      baselineHit: false,
    });
  }
}

function budgetExceeded(state: RunState): boolean {
  return Date.now() - state.startedAt > state.budgetMs;
}

function markBudgetSkip(state: RunState, remaining: number): void {
  state.stats.budgetSkipped += remaining;
  state.truncatedByBudget = true;
}

/** Parse exactly like every sibling suite does (tokenize → parseStyleSheet). */
function parseSheet(source: string): unknown {
  return new Parser(tokenize(source)).parseStyleSheet();
}

function errorName(err: unknown): string {
  return String((err as Error | null)?.name ?? err);
}

function collectDense(container: unknown, count: number): unknown[] {
  const out: unknown[] = [];
  for (let i = 0; i < count; i++) out.push((container as unknown[])[i]);
  return out;
}

function loadJSON<T>(relPath: string): T {
  const url = new URL(relPath, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as T;
}

// ---------------------------------------------------------------------------
// Recorded-side projections (nv + rrweb) — mirror each field the sibling
// suites assert, applying the exact same normalizers to BOTH sides.
// ---------------------------------------------------------------------------

interface RecordedRuleLike {
  selectorText?: unknown;
  conditionText?: unknown;
  media?: unknown;
  style?: unknown;
  cssRules?: unknown;
}

function recordedMediaItems(recordedMedia: unknown): string[] {
  if (recordedMedia === null || typeof recordedMedia !== 'object') return [];
  const rec = recordedMedia as Record<string, unknown>;
  const length =
    typeof rec.length === 'number'
      ? rec.length
      : Object.keys(rec).filter((k) => !Number.isNaN(Number(k))).length;
  const items: string[] = [];
  for (let j = 0; j < length; j++) items.push(normalizeNVValue(String(rec[String(j)])));
  return items;
}

function recordedSelector(recNode: RecordedRuleLike): string {
  // The sibling suites normalize BOTH sides' selectors identically; here the
  // recorded half goes through the very same normalizeSelector.
  return normalizeSelector(String(recNode.selectorText));
}

/**
 * Recursively compare one recorded rule against our live rule, asserting
 * precisely the fields present in the recording.
 *
 * Assertion surfaces (mirroring each sibling suite EXACTLY):
 *   - rrweb (recursive: true) — tests/external-rrweb.test.ts assertRules:
 *     selectorText, conditionText (RAW), media items (RAW), style manifest,
 *     AND nested cssRules (count first, then per-index).
 *   - nv (recursive: false) — tests/external-nv.test.ts: TOP-LEVEL rules
 *     only; selectorText + style manifest when present. The nv suite never
 *     reads conditionText/media/nested cssRules, so neither do we.
 *
 * Style probes are restricted to recorded keys (dunder-keys, length,
 * parentRule, _importants, _vendorPrefix all skipped); named keys via
 * getPropertyValue, indexed keys via item().
 */
function compareRulePair(
  rec: RecordedRuleLike | undefined,
  live: unknown,
  path: string,
  opts: { recursive: boolean },
): { equal: boolean; detail?: string } {
  if (rec === undefined || rec === null) return { equal: true };

  if (rec.selectorText !== undefined) {
    const liveSel = (live as RecordedRuleLike | null)?.selectorText;
    const projectedLive = normalizeSelector(String(liveSel));
    const projectedRec = recordedSelector(rec);
    if (projectedLive !== projectedRec) {
      return {
        equal: false,
        detail: `${path}.selector ${JSON.stringify(projectedLive)} !== recorded ${JSON.stringify(projectedRec)}`,
      };
    }
  }

  if (opts.recursive && rec.conditionText !== undefined) {
    const liveCond = String((live as RecordedRuleLike | null)?.conditionText);
    const recCond = String(rec.conditionText);
    if (liveCond !== recCond) {
      return { equal: false, detail: `${path}.conditionText ${JSON.stringify(liveCond)} !== recorded ${JSON.stringify(recCond)}` };
    }
  }

  if (opts.recursive && rec.media !== undefined) {
    const liveMedia = (live as { media?: unknown } | null)?.media;
    const expectedItems = recordedMediaItems(rec.media);
    const actualItems: string[] = [];
    for (let j = 0; j < expectedItems.length; j++) {
      actualItems.push(normalizeNVValue(String((liveMedia as string[] | undefined)?.[j])));
    }
    const cmp = structuralCompare(actualItems, expectedItems);
    if (!cmp.equal) {
      return { equal: false, detail: `${path}.media: ${String(cmp.detail)} (${cmp.path ?? ''})` };
    }
  }

  if (rec.style !== undefined) {
    const manifest = extractStyleAssertionKeys(rec.style);
    const liveProj = projectLiveStyle((live as { style?: unknown } | null)?.style, manifest);
    const recProj = projectRecordedStyle(rec.style);
    const cmp = structuralCompare(liveProj, recProj);
    if (!cmp.equal) {
      return { equal: false, detail: `${path}.style: ${String(cmp.detail)} (${cmp.path ?? ''})` };
    }
  }

  if (opts.recursive && rec.cssRules !== undefined) {
    const liveChildren = (live as { cssRules?: ArrayLike<unknown> } | null)?.cssRules;
    if (liveChildren === undefined || liveChildren === null) {
      return { equal: false, detail: `${path}.cssRules missing on our side` };
    }
    const recCount = recordedRuleCount(rec.cssRules);
    if ((liveChildren as { length?: number }).length !== recCount) {
      return {
        equal: false,
        detail: `${path}.cssRules length ${(liveChildren as { length?: number }).length} !== recorded ${recCount}`,
      };
    }
    const recList = collectDense(rec.cssRules, recCount);
    for (let c = 0; c < recCount; c++) {
      const sub = compareRulePair(
        recList[c] as RecordedRuleLike | undefined,
        liveChildren[c],
        `${path}[${c}]`,
        opts,
      );
      if (!sub.equal) return sub;
    }
  }

  return { equal: true };
}

function compareRuleLists(
  recordedRoot: unknown,
  liveRules: ArrayLike<unknown>,
  opts: { recursive: boolean },
): { equal: boolean; detail?: string } {
  const recCount = recordedRuleCount(recordedRoot);
  if ((liveRules as { length?: number }).length !== recCount) {
    return {
      equal: false,
      detail: `top-level rule count ${(liveRules as { length?: number }).length} !== recorded ${recCount}`,
    };
  }
  const recList = collectDense(recordedRoot, recCount);
  for (let r = 0; r < recCount; r++) {
    const sub = compareRulePair(recList[r] as RecordedRuleLike | undefined, liveRules[r], `$${r}`, opts);
    if (!sub.equal) return sub;
  }
  return { equal: true };
}

// ---------------------------------------------------------------------------
// Suite runners
// ---------------------------------------------------------------------------

function runLightningSuite(state: RunState): void {
  const fixtures = loadJSON<LightningFixture[]>('../../tests/fixtures/external/lightningcss.json');
  const baseline = loadLightningBaseline();
  const wptTexts = loadWPTKnownTexts();
  const isErrorTest = (type: string): boolean =>
    type === 'error_test' || type === 'css_modules_error_test' || type === 'error_recovery_test';

  state.stats.total = fixtures.length;
  for (let i = 0; i < fixtures.length; i++) {
    if (budgetExceeded(state)) {
      markBudgetSkip(state, fixtures.length - i);
      return;
    }
    const fixture = fixtures[i];
    const baselineHit =
      baseline.has(`${fixture.type}|${normalizeLightning(fixture.source)}`) ||
      (typeof fixture.expected === 'string' &&
        wptTexts.some((fragment) => fixture.expected?.includes(fragment) === true));

    if (isErrorTest(fixture.type)) {
      // Mirror the sibling's assertion shape: error tests expect a throw
      // (DOMException or SyntaxError), never a cssText comparison.
      let threwCorrectly = false;
      let threwOther: string | null = null;
      try {
        parseSheet(fixture.source);
      } catch (err) {
        if (err instanceof DOMException || err instanceof SyntaxError) threwCorrectly = true;
        else threwOther = errorName(err);
      }
      recordOutcome(
        state,
        'lightning',
        `${i}:${fixture.type}`,
        fixture.source,
        threwCorrectly,
        baselineHit,
        '(throws DOMException/SyntaxError)',
        threwCorrectly ? '(throws)' : threwOther !== null ? `(threw ${threwOther})` : '(parsed without throwing)',
      );
      continue;
    }

    if (typeof fixture.expected !== 'string') {
      // 77 fixtures record `"expected": null` (JSON null, not undefined).
      state.stats.noExpectation++;
      continue;
    }

    // cssText join identical to the sibling: '\n'-joined per-rule cssText.
    let actualJoined = '';
    let parserThrew: string | null = null;
    try {
      const sheet = parseSheet(fixture.source) as { cssRules: ArrayLike<{ cssText: string }> };
      const parts: string[] = [];
      for (let r = 0; r < sheet.cssRules.length; r++) parts.push(sheet.cssRules[r].cssText);
      actualJoined = parts.join('\n');
    } catch (err) {
      parserThrew = errorName(err);
    }

    const nActual = normalizeLightning(
      parserThrew !== null ? `<<parser threw: ${parserThrew}>>` : actualJoined,
    );
    const nExpected = normalizeLightning(fixture.expected);
    recordOutcome(
      state,
      'lightning',
      `${i}:${fixture.type}`,
      fixture.source,
      nActual === nExpected,
      baselineHit,
      nExpected,
      nActual,
    );
  }
}

interface NVFixture {
  input?: string;
  result?: { cssRules?: unknown };
}

function runNVSuite(state: RunState): void {
  const tests = loadJSON<NVFixture[]>('../../tests/fixtures/external/nv-tests.json');
  state.stats.total = tests.length;
  for (let i = 0; i < tests.length; i++) {
    if (budgetExceeded(state)) {
      markBudgetSkip(state, tests.length - i);
      return;
    }
    const testCase = tests[i];
    if (typeof testCase.input !== 'string' || testCase.result?.cssRules === undefined) {
      state.stats.noExpectation++;
      continue;
    }
    const baselineHit = NV_KNOWN_SKIPS.has(testCase.input);

    let liveRules: ArrayLike<unknown> = [];
    let parseFailure: string | null = null;
    try {
      liveRules = (parseSheet(testCase.input) as { cssRules: ArrayLike<unknown> }).cssRules;
    } catch (err) {
      parseFailure = errorName(err);
    }

    if (parseFailure !== null) {
      recordOutcome(
        state,
        'nv',
        `nv#${i}`,
        testCase.input,
        false,
        baselineHit,
        JSON.stringify(testCase.result.cssRules),
        `<<parser threw: ${parseFailure}>>`,
      );
      continue;
    }

    // nv asserts the TOP LEVEL only (selectorText + style manifest) — the
    // sibling suite never recurses into nested cssRules nor reads media.
    const cmp = compareRuleLists(testCase.result.cssRules, liveRules, { recursive: false });
    recordOutcome(
      state,
      'nv',
      `nv#${i}`,
      testCase.input,
      cmp.equal,
      baselineHit,
      JSON.stringify(testCase.result.cssRules),
      cmp.detail !== undefined ? cmp.detail : describeLiveRules(liveRules),
    );
  }
}

interface NamedFixture {
  name?: string;
  input?: string;
  result?: { cssRules?: unknown };
}

function runRRWebSuite(state: RunState): void {
  const tests = loadJSON<NamedFixture[]>('../../tests/fixtures/external/rrweb-tests.json');
  state.stats.total = tests.length;
  for (let i = 0; i < tests.length; i++) {
    if (budgetExceeded(state)) {
      markBudgetSkip(state, tests.length - i);
      return;
    }
    const testCase = tests[i];
    if (typeof testCase.input !== 'string' || testCase.result?.cssRules === undefined) {
      state.stats.noExpectation++;
      continue;
    }
    const baselineHit = RRWEB_KNOWN_SKIPS.has(testCase.input);

    let liveRules: ArrayLike<unknown> = [];
    let parseFailure: string | null = null;
    try {
      liveRules = (parseSheet(testCase.input) as { cssRules: ArrayLike<unknown> }).cssRules;
    } catch (err) {
      parseFailure = errorName(err);
    }

    if (parseFailure !== null) {
      recordOutcome(
        state,
        'rrweb',
        `rrweb#${i}`,
        testCase.input,
        false,
        baselineHit,
        JSON.stringify(testCase.result.cssRules),
        `<<parser threw: ${parseFailure}>>`,
      );
      continue;
    }

    const cmp = compareRuleLists(testCase.result.cssRules, liveRules, { recursive: true });
    recordOutcome(
      state,
      'rrweb',
      `rrweb#${i}`,
      testCase.input,
      cmp.equal,
      baselineHit,
      JSON.stringify(testCase.result.cssRules),
      cmp.detail !== undefined ? cmp.detail : describeLiveRules(liveRules),
    );
  }
}

function describeLiveRules(liveRules: ArrayLike<unknown>): string {
  const parts: string[] = [];
  const count = (liveRules as { length?: number }).length ?? 0;
  for (let r = 0; r < Math.min(count, 4); r++) {
    const rule = liveRules[r] as { constructor?: { name?: string }; cssText?: string } | undefined;
    parts.push(rule?.constructor?.name ?? '?');
  }
  return `${count} rule(s): ${parts.join(',')}${count > 4 ? ',…' : ''}`;
}

interface StructuralFixture {
  name?: string;
  input?: string;
  result?: unknown;
}

function runCSSTreeSuite(state: RunState): void {
  const tests = loadJSON<StructuralFixture[]>('../../tests/fixtures/external/csstree-tests.json');
  state.stats.total = tests.length;
  for (let i = 0; i < tests.length; i++) {
    if (budgetExceeded(state)) {
      markBudgetSkip(state, tests.length - i);
      return;
    }
    const testCase = tests[i];
    if (typeof testCase.input !== 'string' || testCase.result === undefined) {
      // Fixture index 25 in this file ships without an input (mirrors the
      // sibling's [Invalid Test Item] skip).
      state.stats.noExpectation++;
      continue;
    }
    const baselineHit = CSSTREE_KNOWN_SKIPS.has(testCase.name ?? '');
    let actualProj: ReturnType<typeof projectStructuralFromCSSOM>;
    try {
      actualProj = projectStructuralFromCSSOM(parseSheet(testCase.input));
    } catch (err) {
      recordOutcome(
        state,
        'csstree',
        `csstree#${i}:${testCase.name ?? ''}`,
        testCase.input,
        false,
        baselineHit,
        '(structural)',
        `<<parser threw: ${errorName(err)}>>`,
      );
      continue;
    }
    const expectedProj = projectStructuralFromCSSTree(testCase.result);
    const cmp = structuralCompare(actualProj, expectedProj);
    recordOutcome(
      state,
      'csstree',
      `csstree#${i}:${testCase.name ?? ''}`,
      testCase.input,
      cmp.equal,
      baselineHit,
      JSON.stringify(expectedProj),
      cmp.detail !== undefined ? `${String(cmp.detail)} @${cmp.path ?? ''}` : JSON.stringify(actualProj),
    );
  }
}

function runPostCSSSuite(state: RunState): void {
  const tests = loadJSON<StructuralFixture[]>('../../tests/fixtures/external/postcss-tests.json');
  state.stats.total = tests.length;
  for (let i = 0; i < tests.length; i++) {
    if (budgetExceeded(state)) {
      markBudgetSkip(state, tests.length - i);
      return;
    }
    const testCase = tests[i];
    if (typeof testCase.input !== 'string' || testCase.result === undefined) {
      state.stats.noExpectation++;
      continue;
    }
    const baselineHit = POSTCSS_KNOWN_DIVERGENT.has(testCase.name ?? '');
    let actualProj: ReturnType<typeof projectStructuralFromCSSOM>;
    try {
      actualProj = projectStructuralFromCSSOM(parseSheet(testCase.input));
    } catch (err) {
      recordOutcome(
        state,
        'postcss',
        `postcss#${i}:${testCase.name ?? ''}`,
        testCase.input,
        false,
        baselineHit,
        '(structural)',
        `<<parser threw: ${errorName(err)}>>`,
      );
      continue;
    }
    const expectedProj = projectStructuralFromPostCSS(testCase.result);
    const cmp = structuralCompare(actualProj, expectedProj);
    recordOutcome(
      state,
      'postcss',
      `postcss#${i}:${testCase.name ?? ''}`,
      testCase.input,
      cmp.equal,
      baselineHit,
      JSON.stringify(expectedProj),
      cmp.detail !== undefined ? `${String(cmp.detail)} @${cmp.path ?? ''}` : JSON.stringify(actualProj),
    );
  }
}

// ---------------------------------------------------------------------------
// Self-test: three hand-pinned mini-fixtures asserting EXACT projections.
// ---------------------------------------------------------------------------

interface PinResult {
  label: string;
  pass: boolean;
  detail?: string;
}

function runSelfTest(): PinResult[] {
  const results: PinResult[] = [];

  // Pin 1 — lightning projector: whitespace-normalized cssText join.
  {
    const sheet = parseSheet('.a{color:red}\n.b{width:1px}') as {
      cssRules: ArrayLike<{ cssText: string }>;
    };
    const parts: string[] = [];
    for (let r = 0; r < sheet.cssRules.length; r++) parts.push(sheet.cssRules[r].cssText);
    const actual = normalizeLightning(parts.join('\n'));
    const pinned = '.a { color: red; } .b { width: 1px; }';
    results.push({
      label: `lightning join → "${actual}"`,
      pass: actual === pinned,
      detail: actual === pinned ? undefined : `want "${pinned}"`,
    });
  }

  // Pin 2 — nv projector: named+indexed style probes with __*/length skips.
  {
    const recorded = {
      selectorText: 'a',
      style: { 0: 'color', 1: 'font-size', color: 'red', 'font-size': '12px', __starts: 2, length: 2 },
    };
    const live = (
      parseSheet('a{color:red;font-size:12px}') as { cssRules: ArrayLike<unknown> }
    ).cssRules[0];
    const cmp = compareRulePair(recorded, live, '$', { recursive: false });
    results.push({
      label: 'nv pair a{color:red;font-size:12px}',
      pass: cmp.equal,
      detail: cmp.detail,
    });
  }

  // Pin 3 — rrweb projector: recursive @media structure, _importants skipped.
  {
    const recorded = {
      media: { 0: 'screen', length: 1 },
      cssRules: [
        {
          selectorText: 'a',
          style: { 0: 'color', color: 'red', length: 1, _importants: { color: '' } },
        },
      ],
    };
    const live = (
      parseSheet('@media screen{a{color:red}}') as { cssRules: ArrayLike<unknown> }
    ).cssRules[0];
    const cmp = compareRulePair(recorded, live, '$', { recursive: true });
    results.push({
      label: 'rrweb pair @media screen{a{color:red}}',
      pass: cmp.equal,
      detail: cmp.detail,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function parseArgs(argv: readonly string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  let current: string | null = null;
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      current = arg.slice(2);
      if (!map.has(current)) map.set(current, []);
    } else if (current !== null) {
      map.get(current)?.push(arg);
    }
  }
  return map;
}

function runSuites(selected: readonly SuiteName[], budgetMs: number): DifferentialReport {
  const perSuite = {} as Record<SuiteName, SuiteStats>;
  const allMismatches: MismatchRecord[] = [];
  let truncated = false;
  const startedAt = Date.now();

  for (const suite of selected) {
    const state: RunState = {
      stats: newStats(),
      mismatches: [],
      truncatedByBudget: false,
      startedAt,
      budgetMs,
    };
    switch (suite) {
      case 'lightning':
        runLightningSuite(state);
        break;
      case 'nv':
        runNVSuite(state);
        break;
      case 'rrweb':
        runRRWebSuite(state);
        break;
      case 'csstree':
        runCSSTreeSuite(state);
        break;
      case 'postcss':
        runPostCSSSuite(state);
        break;
    }
    perSuite[suite] = state.stats;
    allMismatches.push(...state.mismatches);
    truncated = truncated || state.truncatedByBudget;
  }

  return {
    tool: DIFFERENTIAL_VERSION,
    generatedAt: new Date().toISOString(),
    args: { suites: selected.join(','), budgetMs: String(budgetMs) },
    perSuite,
    mismatches: allMismatches,
    mismatchesTotalNetNew: allMismatches.length,
    mismatchesCapReached: allMismatches.length >= MISMATCH_CAP,
    truncatedByBudget: truncated,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.has('selftest')) {
    process.stdout.write('=== differential --selftest ===\n');
    let failed = 0;
    for (const pin of runSelfTest()) {
      process.stdout.write(`${pin.pass ? 'PASS' : 'FAIL'} ${pin.label}${pin.pass ? '' : ` :: ${pin.detail ?? ''}`}\n`);
      if (!pin.pass) failed++;
    }
    process.stdout.write(failed === 0 ? 'selftest: PASS (3/3)\n' : `selftest: FAIL (${failed} failing)\n`);
    if (failed > 0) process.exitCode = 1;
    return;
  }

  const suiteArg = args.get('suite')?.[0] ?? 'all';
  const selected: SuiteName[] =
    suiteArg === 'all' ? [...ALL_SUITES] : ALL_SUITES.filter((s) => s === suiteArg);
  if (selected.length === 0) {
    process.stderr.write(`unknown --suite '${suiteArg}' (use lightning|nv|rrweb|csstree|postcss|all)\n`);
    process.exitCode = 1;
    return;
  }
  const budgetMs =
    Number.parseInt(args.get('budget-ms')?.[0] ?? String(DEFAULT_BUDGET_MS), 10) || DEFAULT_BUDGET_MS;
  const maxList = Number.parseInt(args.get('max-list')?.[0] ?? '20', 10) || 20;

  const report = runSuites(selected, budgetMs);

  const outFile = args.get('out')?.[0];
  if (outFile !== undefined) {
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, JSON.stringify(report, null, 2));
  }

  const header = [
    '',
    `=== differential (${DIFFERENTIAL_VERSION}) ===`,
    'suite      total compared match net-new known-div no-exp err budget-skip',
  ];
  const lines = selected.map((suite) => {
    const s = report.perSuite[suite];
    return (
      `${suite.padEnd(10)} ${String(s.total).padStart(5)} ${String(s.compared).padStart(8)} ` +
      `${String(s.match).padStart(5)} ${String(s.mismatch).padStart(7)} ${String(s.knownDivergent).padStart(9)} ` +
      `${String(s.noExpectation).padStart(6)} ${String(s.harnessError).padStart(3)} ${String(s.budgetSkipped).padStart(11)}`
    );
  });
  const netNewTotal = selected.reduce((acc, s) => acc + report.perSuite[s].mismatch, 0);
  const footer = [
    `net-new mismatches: ${netNewTotal}${report.truncatedByBudget ? ' [BUDGET-TRUNCATED]' : ''}`,
    ...report.mismatches.slice(0, maxList).map(
      (m) => `[${m.id}] src: ${m.sourceSnippet}\n    exp: ${m.expectedPrefix}\n    act: ${m.actualPrefix}`,
    ),
    outFile !== undefined ? `report: ${outFile}` : '(no --out given; stdout summary only)',
    '',
  ];
  process.stdout.write([...header, ...lines, ...footer, ''].join('\n'));
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((err: unknown) => {
    process.stderr.write(`${String(err)}\n`);
    process.exitCode = 1;
  });
}
