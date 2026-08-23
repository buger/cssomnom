/**
 * Overlay reproducer for KI-23: --browser flag interpolates into dist/
 * report paths that escape dist/ (and the repository).
 *
 * scripts/wpt/browser/run.ts:64-66 (verified at HEAD 83ce08f) builds the
 * wptreport/screenshot/html log destinations by raw template interpolation of
 * the operator-supplied --browser argv value:
 *
 *   const reportJson = path.resolve(`dist/report-${browser}.json`);
 *   const screenshotFile = path.resolve(`dist/${browser}-screenshots.txt`);
 *   const reportHtml = path.resolve(`dist/report-${browser}.html`);
 *
 * with no value validation, then materializes them via
 * mkdirSync(dirname(reportJson), {recursive:true}) (L74-77) and hands them to
 * `wpt run --log-wptreport/--log-wptscreenshot/--log-html` as argv (L84-86).
 * A --browser value carrying ../ segments (or a hostile value flowing in from
 * any wrapper that forwards argv) writes attacker-chosen files outside dist/
 * and outside the checkout. This is a pure CLI surface: browser/run.ts has no
 * exported functions (its module body runs the pipeline on import), so this
 * reproducer mirrors the exact resolve/mkdir/write construction against the
 * real templates and cites the source lines above.
 *
 * Asserts the SAFE contract: every derived report path must stay inside
 * dist/ for any --browser value; no file may be materialized outside dist/.
 *
 * Reproduces: KI-23
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Mirror-drift pinning helper (read-only): asserts the exact production sink
 * line still carries the expected substring so a drifted run.ts fails this
 * reproducer loudly instead of being mirrored against a ghost.
 */
function assertPinnedLine(source: string, relPath: string, lineNo: number, needle: string): void {
  const actual = source.split('\n')[lineNo - 1] ?? '';
  assert.ok(
    actual.includes(needle),
    `mirror-drift: ${relPath}:${lineNo} no longer contains ${JSON.stringify(needle)} — ` +
      `production moved; re-sync the mirror legs before trusting their verdicts (line now: ${JSON.stringify(actual.trim())})`,
  );
}

/** Exact templates from scripts/wpt/browser/run.ts:64-66. */
function resolveReportPaths(browser: string): { reportJson: string; screenshotFile: string; reportHtml: string } {
  const reportJson = path.resolve(`dist/report-${browser}.json`);
  const screenshotFile = path.resolve(`dist/${browser}-screenshots.txt`);
  const reportHtml = path.resolve(`dist/report-${browser}.html`);
  return { reportJson, screenshotFile, reportHtml };
}

function containedUnder(candidate: string, rootDir: string): boolean {
  const rel = path.relative(path.resolve(rootDir), path.resolve(candidate));
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}

const ESCAPE_CASES = [
  '../ki23-escape',
  'a/../../b',
  'foo/../../../deep',
  '../../outside',
  'chrome/../../../pwned',
] as const;

describe('KI-23 --browser report-path containment', () => {
  test('positive control: benign browser value keeps all three logs inside dist/', () => {
    const jail = fs.mkdtempSync(path.join(os.tmpdir(), 'ki23-control-'));
    const prevCwd = process.cwd();
    try {
      fs.mkdirSync(path.join(jail, 'project', 'dist'), { recursive: true });
      process.chdir(path.join(jail, 'project'));
      const distRoot = path.resolve('dist');
      const { reportJson, screenshotFile, reportHtml } = resolveReportPaths('chrome');
      for (const p of [reportJson, screenshotFile, reportHtml]) {
        assert.ok(containedUnder(p, distRoot), `benign browser must keep ${p} inside dist/`);
      }
    } finally {
      process.chdir(prevCwd);
      fs.rmSync(jail, { recursive: true, force: true });
    }
  });

  // Reproduces: KI-23
  test('mirror leg: traversal --browser values must not resolve any log path outside dist/', () => {
    const jail = fs.mkdtempSync(path.join(os.tmpdir(), 'ki23-mirror-'));
    const prevCwd = process.cwd();
    try {
      fs.mkdirSync(path.join(jail, 'project', 'dist'), { recursive: true });
      process.chdir(path.join(jail, 'project'));
      const distRoot = path.resolve('dist');
      const escapes: string[] = [];
      for (const browser of ESCAPE_CASES) {
        const { reportJson, screenshotFile, reportHtml } = resolveReportPaths(browser);
        for (const [label, p] of [
          ['reportJson', reportJson],
          ['screenshotFile', screenshotFile],
          ['reportHtml', reportHtml],
        ] as const) {
          if (!containedUnder(p, distRoot)) escapes.push(`${label}(${browser}) -> ${p}`);
        }
      }
      assert.equal(
        escapes.length,
        0,
        `SAFE contract violated: ${escapes.length} derived log path(s) escaped dist/ via interpolated --browser (run.ts:64-66):\n  ${escapes.join('\n  ')}`,
      );
    } finally {
      process.chdir(prevCwd);
      fs.rmSync(jail, { recursive: true, force: true });
    }
  });

  // Reproduces: KI-23
  test('mirror leg: mkdir+write materialization (run.ts:74-77 shape) must stay inside dist/', () => {
    const jail = fs.mkdtempSync(path.join(os.tmpdir(), 'ki23-write-'));
    const prevCwd = process.cwd();
    try {
      fs.mkdirSync(path.join(jail, 'project', 'dist'), { recursive: true });
      process.chdir(path.join(jail, 'project'));
      const distRoot = path.resolve('dist');
      // a/../.. survives inside the reportJson template as path segments:
      // dist/report-a/../../ki23-materialized.json resolves above dist/.
      const browser = 'a/../../ki23-materialized';

      // Mirror of run.ts:74-77 + the --log-wptreport destination write the
      // spawned `wpt run` performs at the same interpolated path.
      const { reportJson } = resolveReportPaths(browser);
      fs.mkdirSync(path.dirname(reportJson), { recursive: true });
      fs.writeFileSync(reportJson, JSON.stringify({ poc: 'ki23' }));

      assert.ok(
        containedUnder(reportJson, distRoot),
        `SAFE contract violated: materialized wptreport landed outside dist/: ${reportJson}`,
      );
    } finally {
      process.chdir(prevCwd);
      fs.rmSync(jail, { recursive: true, force: true });
    }
  });

  // Mirror-drift pinning (Grizz P4): read-only source read; pins the mirrored
  // templates + dist-dir creation to their exact run.ts lines.
  test('mirror-drift pin: run.ts path templates and mkdir sink unchanged', () => {
    const src = fs.readFileSync(
      fileURLToPath(new URL('../../scripts/wpt/browser/run.ts', import.meta.url)),
      'utf-8',
    );
    assertPinnedLine(src, 'scripts/wpt/browser/run.ts', 64, 'dist/report-${browser}.json');
    assertPinnedLine(src, 'scripts/wpt/browser/run.ts', 65, 'dist/${browser}-screenshots.txt');
    assertPinnedLine(src, 'scripts/wpt/browser/run.ts', 66, 'dist/report-${browser}.html');
    assertPinnedLine(src, 'scripts/wpt/browser/run.ts', 76, 'fs.mkdirSync(distDir, { recursive: true });');
    // The report files are materialized by the spawned `wpt run` child via
    // these argv flags (run.ts:84-86), not by run.ts itself — see L115-116.
    assertPinnedLine(src, 'scripts/wpt/browser/run.ts', 84, "'--log-wptreport', reportJson,");
    assertPinnedLine(src, 'scripts/wpt/browser/run.ts', 141, "spawn('python3'");
  });
});
