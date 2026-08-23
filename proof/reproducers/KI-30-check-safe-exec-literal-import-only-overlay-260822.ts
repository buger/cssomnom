/**
 * Overlay reproducer for KI-30: check-safe-exec only bans literal
 * child_process imports; a dynamic import bypasses the guard.
 *
 * scripts/ci/check-safe-exec.ts (verified at HEAD 83ce08f) is the mechanical
 * preflight gate for the project's own Safe Subprocess Execution contract
 * (AGENTS.md § "Safe Subprocess Execution & Mechanical Preflight Enforcement"):
 *
 *   "Direct imports of `node:child_process` or `child_process` in `scripts/`
 *    and `tests/` are banned and enforced via `pnpm run check:safe-exec`
 *    during preflight."
 *
 * But the detector is a single literal-string regex (check-safe-exec.ts:19):
 *
 *   /(?:from\s*|import\s*\(?\s*|require\s*\(\s*)['"](?:node:)?child_process['"]/
 *
 * which only matches the specifier appearing verbatim after from/import(
 * /require(. A computed-specifier dynamic import — the obvious evasion and an
 * ordinary code shape (`const m = 'node:' + 'child_process';
 * const { execSync } = await import(m);`) — sails through, so an unmonitored
 * child process can be spawned with none of the safe kernel's constraints
 * (--max-old-space-size=512, RSS/state-D watchdog, cleanup tracking). The
 * guard's own success message ("All scripts and tests conform to safe
 * subprocess policies") is then false assurance — a policy_bypass against
 * the documented contract.
 *
 * This mirrors checkFiles() exactly (IMPORT_PATTERN L19, ALLOWED_FILES L6-11,
 * walker L21-35, violation scan L51-72) against disposable mini-repo
 * fixtures. Spawn-free: fixtures are never executed; the demonstrated gap is
 * that a fixture whose body performs unmonitored execSync is reported as
 * conformant by the exact production detection logic.
 *
 * Asserts the SAFE contract: any fixture acquiring child_process must be
 * reported as a violation; the literal form is caught (control).
 *
 * Reproduces: KI-30
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Exact IMPORT_PATTERN source text pinned for mirror-drift detection. */
const PINNED_IMPORT_PATTERN_SRC = String.raw`/(?:from\s*|import\s*\(?\s*|require\s*\(\s*)['"](?:node:)?child_process['"]/;`;

/**
 * Mirror-drift pinning helper (read-only): asserts the exact production line
 * still carries the expected substring so a drifted check-safe-exec.ts fails
 * this reproducer loudly instead of being mirrored against a ghost.
 */
// Verifies: SYS-REQ-260823-486K (KI-30 reproducer: mirror-drift pinning)
function assertPinnedLine(source: string, relPath: string, lineNo: number, needle: string): void {
  const actual = source.split('\n')[lineNo - 1] ?? '';
  assert.ok(
    actual.includes(needle),
    `mirror-drift: ${relPath}:${lineNo} no longer contains ${JSON.stringify(needle)} — ` +
      `production moved; re-sync the mirror legs before trusting their verdicts (line now: ${JSON.stringify(actual.trim())})`,
  );
}

/** Exact IMPORT_PATTERN of scripts/ci/check-safe-exec.ts:19. */
const IMPORT_PATTERN = /(?:from\s*|import\s*\(?\s*|require\s*\(\s*)['"](?:node:)?child_process['"]/;

/** Exact ALLOWED_FILES of scripts/ci/check-safe-exec.ts:6-11. */
const ALLOWED_FILES = new Set([
  'scripts/wpt/node/safe-child-process.ts',
  'scripts/codegen/generate_all.ts',
  'scripts/external_suites/extract_all.ts',
  'scripts/wpt/browser/run.ts',
]);

/** Exact walker of scripts/ci/check-safe-exec.ts:21-35. */
// Verifies: SYS-REQ-260823-486K (KI-30 reproducer: scripts/tests source walker mirror)
function findSourceFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findSourceFiles(fullPath));
    } else if (/\.[tj]sx?$/.test(entry.name) || entry.name.endsWith('.mjs') || entry.name.endsWith('.cjs')) {
      results.push(fullPath);
    }
  }
  return results;
}

interface Violation {
  file: string;
  lineNumber: number;
  lineContent: string;
}

/** Exact checkFiles() of scripts/ci/check-safe-exec.ts:37-72. */
// Verifies: SYS-REQ-260823-486K (KI-30 reproducer: literal-import-only detector mirror)
function checkFiles(repoRoot: string): Violation[] {
  const searchDirs = [path.join(repoRoot, 'scripts'), path.join(repoRoot, 'tests')];
  const allFiles: string[] = [];
  for (const dir of searchDirs) allFiles.push(...findSourceFiles(dir));

  const violations: Violation[] = [];
  for (const filePath of allFiles) {
    const relPath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
    if (ALLOWED_FILES.has(relPath)) continue;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (IMPORT_PATTERN.test(lines[i])) {
        violations.push({ file: relPath, lineNumber: i + 1, lineContent: lines[i].trim() });
      }
    }
  }
  return violations;
}

// Verifies: SYS-REQ-260823-486K (KI-30 reproducer: candidate-file fixture writer)
function writeFixture(root: string, relPath: string, source: string): void {
  const abs = path.join(root, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, source);
}

// Verifies: SYS-REQ-260823-486K (KI-30 reproducer suite: acquisition-form detection coverage)
describe('KI-30 check-safe-exec dynamic-import bypass', () => {
  test('positive control: literal static import is caught by the mirrored guard', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ki30-control-'));
    try {
      writeFixture(
        root,
        'scripts/demo/literal-import.mjs',
        `import { execSync } from 'node:child_process';\nexecSync('echo LITERAL', { stdio: 'inherit' });\n`,
      );
      const violations = checkFiles(root);
      assert.equal(violations.length, 1, 'literal import fixture must produce exactly one violation');
      assert.match(violations[0].lineContent, /child_process/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  // Reproduces: KI-30
  test('live leg: computed-specifier dynamic import must also be reported as a violation', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ki30-bypass-'));
    try {
      // Fixture body performs an UNMONITORED spawn primitive via child_process
      // acquired through a computed specifier; no literal child_process token
      // sits next to import( on any line.
      writeFixture(
        root,
        'scripts/demo/bypass-dynamic.mjs',
        [
          `// Policy-bypass sample: dynamic specifier, no literal child_process string`,
          `// adjacent to import/require/from on the same line.`,
          `const moduleId = 'node:' + 'child_process';`,
          `const { execSync } = await import(moduleId);`,
          `execSync('echo BYPASS_SPAWN_OK', { encoding: 'utf8' });`,
        ].join('\n'),
      );

      const violations = checkFiles(root); // exact production detection logic
      assert.ok(
        violations.length > 0,
        'SAFE contract violated: guard passed a fixture whose body acquires node:child_process via computed-specifier ' +
          `dynamic import and runs unmonitored execSync — AGENTS.md "Safe Subprocess Execution" requires every ` +
          `child_process acquisition in scripts/** to be banned, but the literal-only IMPORT_PATTERN at ` +
          `check-safe-exec.ts:19 matched nothing (${JSON.stringify(violations)})`,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  // Reproduces: KI-30
  test('live leg: variable require form must also be reported as a violation', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ki30-reqvar-'));
    try {
      writeFixture(
        root,
        'scripts/demo/bypass-require-var.mjs',
        [
          `const spec = ['node:', 'child_process'].join('');`,
          `const cp = require(spec);`,
          `cp.execSync('echo BYPASS_REQUIRE_OK', { encoding: 'utf8' });`,
        ].join('\n'),
      );
      const violations = checkFiles(root);
      assert.ok(
        violations.length > 0,
        'SAFE contract violated: guard passed a variable-specifier require of node:child_process running unmonitored execSync',
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  // Mirror-drift pinning (Grizz P4): read-only source read; pins the mirrored
  // IMPORT_PATTERN / ALLOWED_FILES / success-message to their exact lines.
  test('mirror-drift pin: check-safe-exec detector shape unchanged', () => {
    const src = fs.readFileSync(
      fileURLToPath(new URL('../../scripts/ci/check-safe-exec.ts', import.meta.url)),
      'utf-8',
    );
    assertPinnedLine(src, 'scripts/ci/check-safe-exec.ts', 19, PINNED_IMPORT_PATTERN_SRC);
    assertPinnedLine(src, 'scripts/ci/check-safe-exec.ts', 7, 'scripts/wpt/node/safe-child-process.ts');
    // The false-assurance success message is printed by main(), not checkFiles.
    assertPinnedLine(src, 'scripts/ci/check-safe-exec.ts', 94, 'All scripts and tests conform to safe subprocess policies.');
  });
});
