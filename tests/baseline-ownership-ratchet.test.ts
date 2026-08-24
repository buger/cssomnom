/** @license Copyright 2026 Google LLC. SPDX-License-Identifier: Apache-2.0 */
// Baseline ownership ratchet — freezes unowned known-failures debt.
//
// Context: baseline skips in tests/fixtures/baselines/*-known-failures.json silently
// erode coverage when entries go stale (test now passes but is still skipped), and
// live-failing entries are almost entirely unowned (no KI, no documented deviation).
// This suite makes that debt VISIBLE and MONOTONIC:
//   1. Every current baseline entry must be classified owned-or-in-inventory.
//   2. The unowned inventory can never grow vs the committed snapshot; new unowned
//      entries fail preflight with a diff of the new offenders.
//   3. Every inventory row carries an `added:` date so cleanup is trackable.
//
// Pure in-memory per AGENTS.md: loads fixture JSONs + KI yamls via fs only,
// no subprocesses, no proof CLI. Ownership classification is intentionally
// CONSERVATIVE (false-unowned is safe: it surfaces an extra visible inventory row;
// false-owned would silently hide debt).
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const BASELINES_DIR = path.join(REPO_ROOT, 'tests/fixtures/baselines');
const KI_DIR = path.join(REPO_ROOT, 'proof/known-issues');

// Baselines under ratchet. wpt-sandbox-known-failures.json is EXCLUDED: it is a
// crawl-lane config object ({exclude, knownFailures}), not an entry list; its
// ~9.2k subtest entries need the WPT crawl lane to verify liveness before they
// can be classified.
export const TRACKED_BASELINES = [
  'lightning-known-failures.json',
  'wpt-cssom-known-failures.json',
] as const;

export interface UnclaimedRow {
  readonly id: string;
  /** ISO date (YYYY-MM-DD) the entry entered the unclaimed ledger. */
  readonly added: string;
}

export interface RatchetInputs {
  /** baseline filename -> current entry ids */
  baselines: Record<string, string[]>;
  /** committed snapshot: baseline filename -> rows */
  inventory: Record<string, UnclaimedRow[]>;
  /** concatenated lowercase text of ownable known issues (open | fixed) */
  kiCorpus: string;
}

// Documented intentional deviations that may claim a baseline skip WITHOUT a KI.
// Each entry MUST cite its README section; see README.md "Intentional Non-Goals &
// Boundaries" for the deviation registry convention. Currently no documented
// deviation claims any baseline entry.
const DOCUMENTED_DEVIATIONS: ReadonlyArray<{ match: RegExp; why: string }> = [
  // Example shape:
  // { match: /getComputedStyle/, why: 'README.md § Intentional Non-Goals & Boundaries' },
];

// A baseline entry counts as KI-owned only if an open|fixed KI's text contains the
// full entry id OR a contiguous fragment of this length. Long windows keep the
// matcher conservative: incidental vocabulary overlaps cannot fake ownership.
const OWNERSHIP_FRAGMENT_WINDOW = 28;

function isOwnedByKnownIssue(id: string, kiCorpus: string): boolean {
  const lid = id.toLowerCase();
  if (kiCorpus.includes(lid)) return true;
  for (let i = 0; i + OWNERSHIP_FRAGMENT_WINDOW <= lid.length; i++) {
    if (kiCorpus.includes(lid.slice(i, i + OWNERSHIP_FRAGMENT_WINDOW))) return true;
  }
  return false;
}

/** Entries that are neither covered by a documented deviation nor by an open/fixed KI. */
export function classifyUnowned(entries: readonly string[], inputs: RatchetInputs): Set<string> {
  const unowned = new Set<string>();
  for (const id of entries) {
    if (DOCUMENTED_DEVIATIONS.some((d) => d.match.test(id))) continue;
    if (isOwnedByKnownIssue(id, inputs.kiCorpus)) continue;
    unowned.add(id);
  }
  return unowned;
}

function diffNewOffenders(current: Iterable<string>, snapshotIds: ReadonlySet<string>): string[] {
  const fresh: string[] = [];
  for (const id of current) if (!snapshotIds.has(id)) fresh.push(id);
  return fresh.sort();
}

function cap(list: readonly string[], n = 10): string {
  const shown = list.slice(0, n).map((s) => `  - ${s}`);
  if (list.length > n) shown.push(`  ... (+${list.length - n} more)`);
  return shown.join('\n');
}

export interface Violation {
  kind: 'schema' | 'coverage' | 'growth' | 'obsolete';
  message: string;
}

/**
 * Core ratchet check. Returns one violation per broken invariant (empty = green).
 * Exported so RED/GREEN demos can inject baselines via loadInputs()' seam.
 */
export function runRatchet(inputs: RatchetInputs): Violation[] {
  const violations: Violation[] = [];
  const addedPattern = /^\d{4}-\d{2}-\d{2}$/;

  for (const base of Object.keys(inputs.baselines)) {
    const entries = inputs.baselines[base];
    const snapshot = inputs.inventory[base] ?? [];

    // --- schema: every row carries a trackable added: date, ids sorted+unique ---
    let prev: string | null = null;
    for (const row of snapshot) {
      if (!row || typeof row.id !== 'string' || row.id.length === 0 ||
          typeof row.added !== 'string' || !addedPattern.test(row.added)) {
        violations.push({ kind: 'schema', message: `${base}: malformed inventory row ${JSON.stringify(row)} (needs { id: string, added: 'YYYY-MM-DD' })` });
      }
      if (prev !== null && row.id <= prev) {
        violations.push({ kind: 'schema', message: `${base}: inventory ids not sorted/unique at "${row.id}"` });
      }
      prev = row.id;
    }

    const snapshotIds = new Set(snapshot.map((r) => r.id));
    const unowned = classifyUnowned(entries, inputs);

    // --- coverage: every CURRENT entry is classified owned-or-in-inventory ---
    // --- growth: the unowned ledger never grows vs the committed snapshot ---
    const newOffenders = diffNewOffenders(unowned, snapshotIds);
    if (newOffenders.length > 0) {
      violations.push({
        kind: 'coverage',
        message: `${base}: ${newOffenders.length} currently-failing baseline entr${newOffenders.length === 1 ? 'y is' : 'ies are'} neither KI-owned nor in unclaimed-inventory.json:\n${cap(newOffenders)}`,
      });
      violations.push({
        kind: 'growth',
        message: `${base}: unowned debt GREW by ${newOffenders.length} vs committed snapshot (${snapshotIds.size} -> ${snapshotIds.size + newOffenders.length}). New offenders:\n${cap(newOffenders)}`,
      });
    }

    // --- hygiene: snapshot holds no obsolete rows (debt may only shrink) ---
    const entrySet = new Set(entries);
    const stillUnowned = classifyUnowned(snapshotIds, inputs);
    const obsolete = [...snapshotIds].filter((id) => !entrySet.has(id) || !stillUnowned.has(id)).sort();
    if (obsolete.length > 0) {
      violations.push({
        kind: 'obsolete',
        message: `${base}: ${obsolete.length} inventoried entr${obsolete.length === 1 ? 'y' : 'ies'} no longer failing-unowned (fixed/pruned/now owned?) — remove them to shrink the debt ledger:\n${cap(obsolete)}`,
      });
    }
  }
  return violations;
}

export interface LoadOptions {
  /**
   * Path-injection seam for RED/GREEN demonstrations: directory holding the
   * baseline JSON files. Defaults to the repo's tests/fixtures/baselines.
   * Inventory + KI corpus always load from the repo so snapshots stay canonical.
   */
  baselineDir?: string;
}

/** Loads real repo state through the seams. Pure fs reads, no subprocesses. */
export function loadInputs(opts: LoadOptions = {}): RatchetInputs {
  const dir = opts.baselineDir ?? BASELINES_DIR;
  const baselines: Record<string, string[]> = {};
  for (const base of TRACKED_BASELINES) {
    const p = path.join(dir, base);
    assert.ok(fs.existsSync(p), `baseline fixture missing: ${p}`);
    baselines[base] = JSON.parse(fs.readFileSync(p, 'utf8')) as string[];
  }
  let kiCorpus = '';
  for (const f of fs.readdirSync(KI_DIR)) {
    if (!f.endsWith('.yaml')) continue;
    const raw = fs.readFileSync(path.join(KI_DIR, f), 'utf8');
    // Only open|fixed known issues own debt; withdrawn KIs do not.
    if (/^status:\s*(open|fixed)\s*$/m.test(raw)) kiCorpus += '\n' + raw.toLowerCase();
  }
  const inventoryPath = path.join(BASELINES_DIR, 'unclaimed-inventory.json');
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8')) as Record<string, UnclaimedRow[]>;
  return { baselines, inventory, kiCorpus };
}

describe('Baseline ownership ratchet', () => {
  // One shared evaluation of the committed state; individual tests assert per-kind.
  const realViolations = runRatchet(loadInputs());
  const byKind = (kind: Violation['kind']) =>
    realViolations.filter((v) => v.kind === kind).map((v) => v.message);

  test('committed inventory schema is well-formed (sorted unique ids with added: dates)', () => {
    assert.deepStrictEqual(byKind('schema'), [], byKind('schema').join('\n'));
  });

  test('every current baseline entry is classified owned-or-in-inventory', () => {
    assert.deepStrictEqual(byKind('coverage'), [], byKind('coverage').join('\n'));
  });

  test('unowned debt never grows vs committed snapshot', () => {
    assert.deepStrictEqual(byKind('growth'), [], byKind('growth').join('\n'));
  });

  test('inventory contains no obsolete rows (entries still failing and unowned)', () => {
    assert.deepStrictEqual(byKind('obsolete'), [], byKind('obsolete').join('\n'));
  });

  // Durable RED/GREEN evidence: proves the grow-check actually fires on injected
  // debt (guards against a vacuous checker that passes by accident).
  test('tripwire self-test: an injected unowned offender is flagged as growth', () => {
    const real = loadInputs();
    const FAKE = 'injected-fake-offender|color|ratchet-tripwire-probe: red;';
    const red: RatchetInputs = {
      ...real,
      baselines: {
        ...real.baselines,
        'wpt-cssom-known-failures.json': [...real.baselines['wpt-cssom-known-failures.json'], FAKE],
      },
    };
    const kinds = runRatchet(red).filter((v) => v.kind === 'growth').map((v) => v.message);
    assert.strictEqual(kinds.length, 1, 'expected exactly one growth violation');
    assert.match(kinds[0]!, /GREW by 1/);
    assert.match(kinds[0]!, new RegExp(FAKE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});
