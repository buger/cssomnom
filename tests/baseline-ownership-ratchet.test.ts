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
// OWNERSHIP RESOLUTION = STRUCTURED REGISTRY ONLY (tests/fixtures/baselines/
// ownership.json). There is deliberately NO prose matching against KI yaml text:
// the former substring scanner (full id OR 28-char fragment over the open|fixed
// KI corpus) was gameable — any KI yaml whose prose happened to contain a long
// window of an entry id granted silent "ownership" (~13% of then-measured
// wpt-cssom ownership was attributable to such accidental matches). Claims must
// now be explicit, dated, reference a resolvable KI yaml (with a status that
// matches the claim kind), and point at an entry that still exists.
//
// Baselines under ratchet include wpt-sandbox-known-failures.json. Its subtest
// entries were liveness-verified against the WPT crawl lane on 2026-08-24
// (two independent full crawls via scripts/wpt/node/cli.ts run); every entry that
// survived pruning is live-failing and therefore classifiable.
//
// Pure in-memory per AGENTS.md: loads fixture JSONs + KI yaml STATUS lines via fs
// only, no subprocesses, no proof CLI. Classification failures are biased toward
// false-unowned (safe: surfaces an extra visible inventory row); false-owned
// requires an explicit registry claim.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const BASELINES_DIR = path.join(REPO_ROOT, 'tests/fixtures/baselines');
const KI_DIR = path.join(REPO_ROOT, 'proof/known-issues');

export const TRACKED_BASELINES = [
  'lightning-known-failures.json',
  'wpt-cssom-known-failures.json',
  'wpt-sandbox-known-failures.json',
] as const;

export interface UnclaimedRow {
  readonly id: string;
  /** ISO date (YYYY-MM-DD) the entry entered the unclaimed ledger. */
  readonly added: string;
}

/** Structured ownership claim — the ONLY way a baseline skip may cite an owner. */
export interface OwnershipClaim {
  /** Baseline family WITHOUT the .json extension, e.g. 'wpt-sandbox-known-failures'. */
  readonly baseline: string;
  /**
   * Exact entry id in the baseline. For entry-list baselines (lightning,
   * wpt-cssom) this is the raw string; for the sandbox config baseline it is the
   * composite `<file relative path>::<subtest name>`.
   */
  readonly entryId: string;
  /** Owning artifact: 'KI-38' etc., or 'README-deviation' when kind is 'deviation'. */
  readonly owner: string;
  readonly kind: 'open-KI' | 'fixed-KI' | 'deviation';
  /** KI yaml filename for KI kinds; README.md section text for deviations. */
  readonly ref: string;
  /** ISO date (YYYY-MM-DD) the claim was filed. Must not be in the future. */
  readonly claimedAt: string;
}

export interface OwnershipRegistry {
  readonly schema_version: number;
  readonly claims: readonly OwnershipClaim[];
}

export interface RatchetInputs {
  /** baseline filename -> current entry ids */
  baselines: Record<string, string[]>;
  /** committed snapshot: baseline filename -> rows */
  inventory: Record<string, UnclaimedRow[]>;
  /** parsed structured registry (the only ownership oracle) */
  registry: OwnershipRegistry;
  /** current date as YYYY-MM-DD, used to reject future claimedAt values */
  today: string;
  /** directory holding KI yamls, for claim ref existence/status validation */
  kiDir?: string;
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
  kind: 'schema' | 'registry' | 'coverage' | 'growth' | 'obsolete';
  message: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const KI_OWNER = /^KI-\d+$/;
const KINDS = new Set(['open-KI', 'fixed-KI', 'deviation']);
const EXPECTED_KI_STATUS: Record<string, string> = { 'open-KI': 'open', 'fixed-KI': 'fixed' };

/** Validates one claim structurally + referentially; returns violation message or null. */
export function validateClaim(claim: OwnershipClaim, inputs: RatchetInputs): string | null {
  if (!claim || typeof claim !== 'object') return `malformed claim ${JSON.stringify(claim)}`;
  for (const field of ['baseline', 'entryId', 'owner', 'kind', 'ref', 'claimedAt'] as const) {
    const v = (claim as unknown as Record<string, unknown>)[field];
    if (typeof v !== 'string' || v.length === 0) return `claim field "${field}" missing/not a string: ${JSON.stringify(claim)}`;
  }
  if (!TRACKED_BASELINES.some((b) => b.replace(/\.json$/, '') === claim.baseline)) {
    return `claim references unknown baseline "${claim.baseline}"`;
  }
  if (!KINDS.has(claim.kind)) return `claim ${claim.entryId}: invalid kind "${claim.kind}"`;
  if (!ISO_DATE.test(claim.claimedAt)) return `claim ${claim.entryId}: claimedAt must be YYYY-MM-DD, got "${claim.claimedAt}"`;
  if (claim.claimedAt > inputs.today) return `claim ${claim.entryId}: claimedAt ${claim.claimedAt} is in the future`;
  if (claim.kind === 'deviation') {
    // Deviation claims must cite README.md verbatim (see AGENTS.md API boundaries).
    const readme = fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8');
    if (!readme.includes(claim.ref)) return `claim ${claim.entryId}: deviation ref not found verbatim in README.md: "${claim.ref}"`;
    return null;
  }
  if (!KI_OWNER.test(claim.owner)) return `claim ${claim.entryId}: owner must match KI-<n>, got "${claim.owner}"`;
  const yamlPath = path.join(inputs.kiDir ?? KI_DIR, claim.ref);
  if (!fs.existsSync(yamlPath)) return `claim ${claim.entryId}: referenced KI yaml does not exist: ${claim.ref}`;
  const raw = fs.readFileSync(yamlPath, 'utf8');
  const status = raw.match(/^status:\s*(\S+)\s*$/m)?.[1];
  if (status !== EXPECTED_KI_STATUS[claim.kind]) {
    return `claim ${claim.entryId}: ${claim.ref} has status "${status}", expected "${EXPECTED_KI_STATUS[claim.kind]}" for kind ${claim.kind}`;
  }
  return null;
}

/**
 * Core ratchet check. Returns one violation per broken invariant (empty = green).
 * Exported so RED/GREEN demos can inject inputs via loadInputs()' seams.
 */
export function runRatchet(inputs: RatchetInputs): Violation[] {
  const violations: Violation[] = [];

  // --- registry schema + referential integrity ---
  const reg = inputs.registry;
  if (!reg || typeof reg !== 'object' || reg.schema_version !== 1 || !Array.isArray(reg.claims)) {
    violations.push({ kind: 'schema', message: 'ownership.json: expected { schema_version: 1, claims: [...] }' });
  } else {
    for (const claim of reg.claims) {
      const problem = validateClaim(claim, inputs);
      if (problem) violations.push({ kind: 'registry', message: problem });
    }
    // A claim on an entry that no longer exists is dead weight and hides nothing:
    // fail loudly so it gets re-pointed or dropped.
    for (const [baseFile, entries] of Object.entries(inputs.baselines)) {
      const family = baseFile.replace(/\.json$/, '');
      const entrySet = new Set(entries);
      for (const claim of reg.claims) {
        if (claim.baseline !== family) continue;
        if (typeof claim.entryId === 'string' && !entrySet.has(claim.entryId)) {
          violations.push({ kind: 'registry', message: `${baseFile}: claim ${claim.owner}->"${claim.entryId}" points at an entry that no longer exists in the baseline` });
        }
      }
    }
  }

  const claimsByFamily = new Map<string, Set<string>>();
  if (reg && Array.isArray(reg.claims)) {
    for (const claim of reg.claims) {
      if (!claimsByFamily.has(claim.baseline)) claimsByFamily.set(claim.baseline, new Set());
      claimsByFamily.get(claim.baseline)!.add(claim.entryId);
    }
  }

  for (const base of Object.keys(inputs.baselines)) {
    const entries = inputs.baselines[base];
    const snapshot = inputs.inventory[base] ?? [];
    const family = base.replace(/\.json$/, '');
    const ownedIds = claimsByFamily.get(family) ?? new Set<string>();

    // --- schema: every row carries a trackable added: date, ids sorted+unique ---
    let prev: string | null = null;
    for (const row of snapshot) {
      if (!row || typeof row.id !== 'string' || row.id.length === 0 ||
          typeof row.added !== 'string' || !ISO_DATE.test(row.added)) {
        violations.push({ kind: 'schema', message: `${base}: malformed inventory row ${JSON.stringify(row)} (needs { id: string, added: 'YYYY-MM-DD' })` });
      }
      if (prev !== null && row.id <= prev) {
        violations.push({ kind: 'schema', message: `${base}: inventory ids not sorted/unique at "${row.id}"` });
      }
      prev = row.id;
    }

    const snapshotIds = new Set(snapshot.map((r) => r.id));
    const uniqueEntries = [...new Set(entries)];

    // --- coverage: every CURRENT entry is classified owned-or-in-inventory ---
    // --- growth: the unowned ledger never grows vs the committed snapshot ---
    const unowned = uniqueEntries.filter((id) => !ownedIds.has(id));
    const newOffenders = diffNewOffenders(unowned, snapshotIds);
    if (newOffenders.length > 0) {
      violations.push({
        kind: 'coverage',
        message: `${base}: ${newOffenders.length} currently-failing baseline entr${newOffenders.length === 1 ? 'y is' : 'ies are'} neither registry-owned nor in unclaimed-inventory.json:\n${cap(newOffenders)}`,
      });
      violations.push({
        kind: 'growth',
        message: `${base}: unowned debt GREW by ${newOffenders.length} vs committed snapshot (${snapshotIds.size} -> ${snapshotIds.size + newOffenders.length}). New offenders:\n${cap(newOffenders)}`,
      });
    }

    // --- hygiene: snapshot holds no obsolete rows (debt may only shrink) ---
    const entrySet = new Set(uniqueEntries);
    const obsolete = [...snapshotIds].filter((id) => !entrySet.has(id) || ownedIds.has(id)).sort();
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
   * Inventory always loads from the repo so snapshots stay canonical.
   */
  baselineDir?: string;
  /** Registry override seam (defaults to the repo's ownership.json). */
  registry?: OwnershipRegistry;
  /** Pins "today" for deterministic future-date validation in tests. */
  today?: string;
}

interface RawBaseline { exclude?: string[]; knownFailures?: Record<string, string[]> }

/** Normalizes a baseline file into its entry-id list. */
export function loadBaselineEntries(base: string, dir: string): string[] {
  const p = path.join(dir, base);
  assert.ok(fs.existsSync(p), `baseline fixture missing: ${p}`);
  const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as string[] | RawBaseline;
  if (Array.isArray(raw)) return raw;
  // Sandbox crawl-lane config: flatten {exclude, knownFailures} into composite
  // `<file>::<subtest>` ids (names collide across files, so bare names are ambiguous).
  assert.ok(raw.knownFailures, `${p}: expected {exclude, knownFailures}`);
  const ids: string[] = [];
  for (const [file, names] of Object.entries(raw.knownFailures!)) {
    for (const name of names) ids.push(`${file}::${name}`);
  }
  return ids.sort();
}

/** Loads real repo state through the seams. Pure fs reads, no subprocesses. */
export function loadInputs(opts: LoadOptions = {}): RatchetInputs {
  const dir = opts.baselineDir ?? BASELINES_DIR;
  const baselines: Record<string, string[]> = {};
  for (const base of TRACKED_BASELINES) baselines[base] = loadBaselineEntries(base, dir);
  const registryPath = path.join(BASELINES_DIR, 'ownership.json');
  let registry: OwnershipRegistry;
  if (opts.registry) {
    registry = opts.registry;
  } else {
    assert.ok(fs.existsSync(registryPath), `ownership registry missing: ${registryPath}`);
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as OwnershipRegistry;
  }
  const inventory = JSON.parse(
    fs.readFileSync(path.join(BASELINES_DIR, 'unclaimed-inventory.json'), 'utf8')
  ) as Record<string, UnclaimedRow[]>;
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  return { baselines, inventory, registry, today };
}

describe('Baseline ownership ratchet', () => {
  // One shared evaluation of the committed state; individual tests assert per-kind.
  const realViolations = runRatchet(loadInputs());
  const byKind = (kind: Violation['kind']) =>
    realViolations.filter((v) => v.kind === kind).map((v) => v.message);

  test('committed inventory schema is well-formed (sorted unique ids with added: dates)', () => {
    assert.deepStrictEqual(byKind('schema'), [], byKind('schema').join('\n'));
  });

  test('committed ownership registry schema is well-formed (dated, resolvable claims)', () => {
    assert.deepStrictEqual(byKind('registry'), [], byKind('registry').join('\n'));
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

  // Regression guard for the deleted prose-substring matcher. Under the old design,
  // a KI yaml merely CONTAINING a >=28-char window of an entry id granted silent
  // ownership ("magic comment" vector). Ownership now flows exclusively through
  // ownership.json; hostile prose on disk must grant NOTHING.
  test('magic-comment attack: hostile KI prose containing an id fragment grants nothing', () => {
    const FAKE = 'injected-fake-offender|color|ratchet-tripwire-probe: red;';
    const FRAGMENT_WINDOW = 28;
    const fragment = FAKE.toLowerCase().slice(0, FRAGMENT_WINDOW);

    // The legacy attack, reproduced inline: a fake open-KI yaml whose description
    // embeds a 28-char window of the entry id. Assert the OLD matcher would have
    // been gamed by it — i.e. this test guards a real historical vector.
    function legacyScannerOwned(id: string, corpus: string): boolean {
      const lid = id.toLowerCase();
      if (corpus.includes(lid)) return true;
      for (let i = 0; i + FRAGMENT_WINDOW <= lid.length; i++) {
        if (corpus.includes(lid.slice(i, i + FRAGMENT_WINDOW))) return true;
      }
      return false;
    }
    const hostileYaml = [
      'id: KI-999',
      'title: hostile magic-comment injection probe',
      'description: padding padding padding ' + fragment + ' padding',
      'status: open',
    ].join('\n');
    assert.strictEqual(legacyScannerOwned(FAKE, hostileYaml), true,
      'expected the deleted substring matcher to be gameable by the hostile yaml');

    // On disk too: even a physically present open-KI yaml carrying the fragment
    // must not change classification, because the loader never reads prose.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-attack-'));
    try {
      fs.writeFileSync(path.join(tmp, 'KI-999.yaml'), hostileYaml);
      const real = loadInputs();
      const attacked: RatchetInputs = {
        ...real,
        baselines: {
          ...real.baselines,
          'wpt-cssom-known-failures.json': [...real.baselines['wpt-cssom-known-failures.json'], FAKE],
        },
        kiDir: tmp, // hostile corpus sits exactly where KI refs resolve from
      };
      const msgs = runRatchet(attacked).map((v) => `${v.kind}: ${v.message}`).sort();
      const clean: RatchetInputs = { ...real, kiDir: tmp };
      const baselineMsgs = runRatchet(clean).map((v) => `${v.kind}: ${v.message}`).sort();

      const delta = msgs.filter((m) => !baselineMsgs.includes(m));
      assert.strictEqual(delta.length, 2, `expected exactly coverage+growth deltas for the offender, got:\n${delta.join('\n')}`);
      assert.ok(delta.every((m) => m.includes(FAKE)), 'violations must name the offender');
      assert.ok(delta.some((m) => m.startsWith('coverage:')), 'offender must surface as UNOWNED (coverage)');
      assert.ok(delta.some((m) => m.startsWith('growth:')), 'offender must surface as DEBT GROWTH');
      // and explicitly NOT as anything ownership-shaped
      assert.ok(!delta.some((m) => m.startsWith('registry:') || m.startsWith('obsolete:')),
        'hostile prose must not produce ownership effects');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  // RED/GREEN: a registry claim pointing at an id that is not in the baseline must
  // fail loudly instead of silently owning nothing (or worse, hiding real debt).
  test('registry claim on a nonexistent entry id fails loudly', () => {
    const real = loadInputs();
    const ghost: RatchetInputs = {
      ...real,
      registry: {
        schema_version: 1,
        claims: [
          ...real.registry.claims,
          {
            baseline: 'wpt-cssom-known-failures',
            entryId: 'no-such-key|color|ghost-entry: red;',
            owner: 'KI-38',
            kind: 'open-KI',
            ref: 'KI-38.yaml',
            claimedAt: real.today,
          },
        ],
      },
    };
    const hits = runRatchet(ghost).filter((v) => v.kind === 'registry').map((v) => v.message);
    assert.ok(hits.length >= 1, 'expected at least one registry violation');
    assert.ok(hits.some((m) => m.includes('ghost-entry')), `violation must name the ghost entry:\n${hits.join('\n')}`);
  });

  // Schema hardening on claims themselves: future dates and bogus kinds are rejected.
  test('claims with future claimedAt or unknown kind are schema violations', () => {
    const real = loadInputs({ today: '2026-08-24' });
    const bad: RatchetInputs = {
      ...real,
      registry: {
        schema_version: 1,
        claims: [
          ...real.registry.claims,
          {
            baseline: 'wpt-cssom-known-failures',
            entryId: 'future-dated|color|probe: red;',
            owner: 'KI-38',
            kind: 'open-KI',
            ref: 'KI-38.yaml',
            claimedAt: '2026-08-25',
          },
          {
            baseline: 'wpt-cssom-known-failures',
            entryId: 'bogus-kind|color|probe: red;',
            owner: 'KI-38',
            kind: 'rumor' as unknown as OwnershipClaim['kind'],
            ref: 'KI-38.yaml',
            claimedAt: '2026-08-24',
          },
        ],
      },
    };
    const msgs = runRatchet(bad).filter((v) => v.kind === 'registry').map((v) => v.message).join('\n');
    assert.match(msgs, /future-dated/);
    assert.match(msgs, /in the future/);
    assert.match(msgs, /bogus-kind/);
    assert.match(msgs, /invalid kind "rumor"/);
  });
});
