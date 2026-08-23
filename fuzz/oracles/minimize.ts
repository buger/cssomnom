/**
 * Generic delta-debugging minimizer for oracle findings (Zeller-style greedy
 * hierarchical shrink).
 *
 * Given an input and a predicate ("this input still trips the oracle"), remove
 * whole lines first, then character chunks at decreasing granularities,
 * accepting every removal for which the predicate stays true. Passes repeat
 * until a fixpoint (nothing more can go) or the evaluation budget runs out.
 *
 * Deterministic by construction: fixed granularity ladder, left-to-right
 * sweeps, no randomness — identical inputs always yield identical minimizers,
 * which keeps downstream clustering reproducible.
 *
 * Usage:
 *   node fuzz/oracles/minimize.ts --input FILE [--check fixpoint|conservation|refixate|streaming|all]
 *   cat repro.css | node fuzz/oracles/minimize.ts --stdin --check all
 *
 * Never mutates repo state; prints a JSON summary on stdout.
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { checkInput } from './lib/invariants.ts';

/** Default evaluation budget (predicate calls) per minimization. */
const DEFAULT_MAX_EVALS = 4000;

/** Granularity ladder for both the line pass and the character-chunk passes. */
const CHUNK_SIZES: readonly number[] = [64, 32, 16, 8, 4, 2, 1];

export interface DeltaDebugOptions {
  /** Hard cap on predicate invocations. Default 4000. */
  maxEvals?: number;
}

export interface DeltaDebugResult {
  /** Smallest input found that still satisfies the predicate. */
  minimized: string;
  /** Number of predicate invocations spent (including initial/final checks). */
  evals: number;
  /**
   * False iff the predicate rejected the *initial* input (nothing to minimize)
   * or the final minimized string somehow lost the property (budget-exhaustion
   * safety net — with a healthy predicate this cannot happen because removals
   * are only ever accepted on a live predicate).
   */
  ok: boolean;
}

/**
 * Split into lines, keeping the trailing "\n" attached to each line so that
 * join('') reproduces the input byte-for-byte (css-syntax-3 § 3.3
 * #input-preprocessing normalizes CR/FF to LF upstream; here we treat the raw
 * string as-is).
 */
function splitLines(text: string): string[] {
  if (text === '') return [];
  return text.split(/(?<=\n)/);
}

/**
 * Greedy sweep: try deleting every contiguous run of `count` units, advancing
 * past the chunk only when its removal was rejected. Mutates nothing; returns
 * the (possibly updated) unit array.
 */
function sweep(
  units: string[],
  count: number,
  test: (s: string) => boolean,
  budgetLeft: () => boolean,
): { units: string[]; changed: boolean } {
  let current = units;
  let changed = false;
  let i = 0;
  while (i < current.length && budgetLeft()) {
    const rest = current.slice(0, i).concat(current.slice(i + count));
    if (rest.length === 0 && current.length <= count) {
      // Refuse to vanish entirely: a minimized empty string carries no signal.
      break;
    }
    if (test(rest.join(''))) {
      current = rest;
      changed = true;
      // Stay at index i: the following chunk slid into this slot.
    } else {
      i += 1;
    }
  }
  return { units: current, changed };
}

export function deltaDebug(
  input: string,
  predicate: (s: string) => boolean,
  options: DeltaDebugOptions = {},
): DeltaDebugResult {
  const maxEvals = options.maxEvals ?? DEFAULT_MAX_EVALS;
  let evals = 0;
  const test = (s: string): boolean => {
    evals += 1;
    return predicate(s);
  };

  if (!test(input)) {
    return { minimized: input, evals, ok: false };
  }

  let current = input;

  outer: while (true) {
    const beforeRound = current;

    // --- line-level pass -------------------------------------------------
    for (const size of CHUNK_SIZES) {
      const lines = splitLines(current);
      if (lines.length > 1 || (lines.length === 1 && lines[0] !== current)) {
        const swept = sweep(lines, size, test, () => evals < maxEvals);
        current = swept.units.join('');
        if (current === '') break outer;
      }
      if (evals >= maxEvals) break outer;
    }

    // --- character-chunk passes ------------------------------------------
    // Spread iterates code points, so surrogate pairs stay intact during
    // removal (css-syntax-3 § 3.3: lone surrogates would otherwise be
    // manufactured by the minimizer itself).
    for (const size of CHUNK_SIZES) {
      const points = [...current];
      if (points.length > 1) {
        const swept = sweep(points, size, test, () => evals < maxEvals);
        current = swept.units.join('');
        if (current === '') break outer;
      }
      if (evals >= maxEvals) break outer;
    }

    if (current === beforeRound) break; // fixpoint: a full round removed nothing
  }

  // Final verification: the minimized string must still satisfy the predicate.
  const ok = test(current);
  return { minimized: current, evals, ok };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CheckSelection {
  /** Oracle finding kinds this run treats as "interesting". */
  kinds: ReadonlySet<string>;
  /** Whether chunked-streaming equivalence participates (slower). */
  streaming: boolean;
}

const CHECK_KINDS: Record<string, readonly string[]> = {
  fixpoint: ['fixpoint-unstable', 'rules-dropped-on-reparse', 'parse-threw', 'serialize-threw'],
  conservation: ['token-gap', 'token-overlap', 'text-loss'],
  refixate: ['token-refixate'],
  streaming: ['stream-divergence'],
};

function resolveCheck(name: string): CheckSelection {
  if (name === 'all') {
    const all = new Set<string>();
    for (const kinds of Object.values(CHECK_KINDS)) for (const kind of kinds) all.add(kind);
    return { kinds: all, streaming: true };
  }
  const kinds = CHECK_KINDS[name];
  if (!kinds) {
    throw new Error(`unknown --check '${name}' (expected fixpoint|conservation|refixate|streaming|all)`);
  }
  return { kinds: new Set(kinds), streaming: name === 'streaming' };
}

function parseArgs(argv: readonly string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  let current: string | null = null;
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      current = arg.slice(2);
      map.set(current, []);
    } else if (current !== null) {
      map.get(current)?.push(arg);
    }
  }
  return map;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const selection = resolveCheck(args.get('check')?.[0] ?? 'all');
  const maxEvalsRaw = Number.parseInt(args.get('max-evals')?.[0] ?? '', 10);

  let original: string;
  if (args.has('input')) {
    original = readFileSync(args.get('input')![0]!, 'utf8');
  } else if (args.has('stdin')) {
    original = await readStdin();
  } else {
    process.stderr.write('minimize: provide --input FILE or --stdin\n');
    process.exitCode = 1;
    return;
  }

  const result = deltaDebug(original, (s) => {
    const { findings } = checkInput(s, { streaming: selection.streaming });
    return findings.some((f) => selection.kinds.has(f.kind));
  }, Number.isNaN(maxEvalsRaw) ? {} : { maxEvals: maxEvalsRaw });

  const minimizedFindings = checkInput(result.minimized, { streaming: selection.streaming }).findings;
  const findingKinds = [...new Set(minimizedFindings.map((f) => f.kind).filter((k) => selection.kinds.has(k)))];

  process.stdout.write(
    `${JSON.stringify({
      originalLen: original.length,
      minimizedLen: result.minimized.length,
      evals: result.evals,
      ok: result.ok,
      findingKinds,
      minimized: result.minimized,
    })}\n`,
  );

  if (!result.ok) process.exitCode = 1;
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((err: unknown) => {
    process.stderr.write(`${String(err)}\n`);
    process.exitCode = 1;
  });
}
