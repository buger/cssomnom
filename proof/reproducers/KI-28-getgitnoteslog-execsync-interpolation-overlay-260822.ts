/**
 * Overlay reproducer for KI-28: getGitNotesLog builds a shell command by
 * string interpolation and executes it with execSync.
 *
 * scripts/wpt/node/safe-child-process.ts:303-305 (verified at HEAD 83ce08f):
 *
 *   export function getGitNotesLog(count = 5, ref = 'wpt') {
 *     const stdout = execSync(`git log -n ${count} --notes=${ref} --format="%h %N"`, ...)
 *
 * Both count and ref are interpolated into a single command line handed to
 * /bin/sh -c. Any caller-controlled count/ref (e.g. CLI args or values read
 * back from progress state) becomes arbitrary shell command execution as the
 * process user. The argv-based siblings execGit (L283-285) and addGitNote
 * (L293) show the safe pattern and stay clean under identical input.
 *
 * This imports the REAL exported getGitNotesLog / addGitNote / execGit from
 * safe-child-process.ts and drives them inside a disposable temp git repo;
 * the injected payload only echoes a marker and touches a marker file inside
 * that temp dir. Child-process use in THIS file: argv-form execFileSync for
 * one-time temp-repo scaffolding in setupTempRepo() — outside any monitored
 * surface, never fed attacker input. The FINDING under test is the production
 * kernel's own execSync string-form inside getGitNotesLog
 * (safe-child-process.ts:305), which the live legs drive with
 * metacharacter-bearing count/ref; no raw child_process call here executes
 * attacker-controlled content.
 *
 * Asserts the SAFE contract: shell metacharacters in count/ref must be
 * passed as data (argv), never executed; the argv-based sibling stays safe
 * under identical input (control).
 *
 * Reproduces: KI-28
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  addGitNote,
  execGit,
  getGitCommitInfo,
  getGitNotesLog,
} from '../../scripts/wpt/node/safe-child-process.ts';

const REF_MARKER = 'KI28_REF_MARKER';
const COUNT_MARKER = 'KI28_COUNT_MARKER';

// Verifies: SYS-REQ-260823-0A2D (KI-28 reproducer: seeded git-notes fixture repo)
// reqproof:proptest:skip seeds a temporary git repository via child_process execSync; filesystem and subprocess state, not constructible in isolation
function setupTempRepo(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  const run = (args: string[]) =>
    execFileSync('git', args, { cwd: dir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  run(['init', '-q']);
  run(['config', 'user.email', 'ki28-poc@example.com']);
  run(['config', 'user.name', 'KI28 PoC']);
  fs.writeFileSync(path.join(dir, 'README'), 'ki28\n');
  run(['add', 'README']);
  run(['commit', '-qm', 'init']);
}

// Verifies: SYS-REQ-260823-0A2D (KI-28 reproducer suite: argv-vs-shell contract)
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
describe('KI-28 getGitNotesLog command injection', () => {
  test('positive control: benign ref/count return seeded notes via the real helper', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki28-control-'));
    const prevCwd = process.cwd();
    try {
      setupTempRepo(dir);
      process.chdir(dir);
      const { commitHash } = getGitCommitInfo();
      assert.match(commitHash, /^[0-9a-f]+$/, 'setup: commit hash must resolve');
      assert.ok(addGitNote(commitHash, '{"totalPassing":42}', 'wpt'), 'setup: addGitNote must succeed');
      const log = getGitNotesLog(1, 'wpt');
      assert.equal(log.length, 1);
      assert.ok(log[0].note.includes('"totalPassing":42'), 'seeded note must round-trip');
      assert.equal(fs.readdirSync(dir).filter((f) => f.includes('MARKER')).length, 0);
    } finally {
      process.chdir(prevCwd);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // Reproduces: KI-28
  test('live leg: metacharacter-bearing ref must not execute as a shell command', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki28-ref-'));
    const prevCwd = process.cwd();
    try {
      setupTempRepo(dir);
      process.chdir(dir);
      const { commitHash } = getGitCommitInfo();
      addGitNote(commitHash, '{"totalPassing":1}', 'wpt');

      const evilRef = `wpt; echo ${REF_MARKER}; touch ki28-ref-marker #`;
      const entries = getGitNotesLog(1, evilRef);

      const markerFile = path.join(dir, 'ki28-ref-marker');
      const parsedMarker = entries.some((e) => e.commitHash === REF_MARKER || e.note.includes(REF_MARKER));
      assert.ok(
        !fs.existsSync(markerFile) && !parsedMarker,
        `SAFE contract violated: interpolated ref executed in /bin/sh via execSync at safe-child-process.ts:305 ` +
          `(touch marker exists=${fs.existsSync(markerFile)}, echo output parsed=${parsedMarker}) — attacker-controlled ref reached sh -c`,
      );
    } finally {
      process.chdir(prevCwd);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // Reproduces: KI-28
  test('live leg: metacharacter-bearing count must not execute as a shell command', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki28-count-'));
    const prevCwd = process.cwd();
    try {
      setupTempRepo(dir);
      process.chdir(dir);
      const { commitHash } = getGitCommitInfo();
      addGitNote(commitHash, '{"totalPassing":1}', 'wpt');

      const evilCount = `1; echo ${COUNT_MARKER}; touch ki28-count-marker #`;
      // Stub-cast convention (mirrors the documented `as unknown as Response`
      // stub casts in KI-25/26/27): the production signature's `number` type is
      // unsound — getGitNotesLog interpolates the parameter into an execSync
      // command line instead of validating it — so deliberately violating the
      // declared type here IS the injection primitive under test.
      const entries = getGitNotesLog(evilCount as unknown as number, 'wpt');

      const markerFile = path.join(dir, 'ki28-count-marker');
      const parsedMarker = entries.some((e) => e.commitHash === COUNT_MARKER || e.note.includes(COUNT_MARKER));
      assert.ok(
        !fs.existsSync(markerFile) && !parsedMarker,
        `SAFE contract violated: interpolated count executed in /bin/sh via execSync at safe-child-process.ts:305 ` +
          `(touch marker exists=${fs.existsSync(markerFile)}, echo output parsed=${parsedMarker})`,
      );
    } finally {
      process.chdir(prevCwd);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('contrast control: argv-based sibling execGit stays inert under identical injection', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki28-sibling-'));
    const prevCwd = process.cwd();
    try {
      setupTempRepo(dir);
      process.chdir(dir);
      const evilRef = `wpt; touch ki28-sibling-marker #`;
      const out = execGit(['log', '-n', '1', `--notes=${evilRef}`, '--format=%h %N']); // argv array — no shell
      assert.equal(
        fs.existsSync(path.join(dir, 'ki28-sibling-marker')),
        false,
        'argv sibling must never execute injected content',
      );
      assert.equal(typeof out, 'string');
    } finally {
      process.chdir(prevCwd);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
