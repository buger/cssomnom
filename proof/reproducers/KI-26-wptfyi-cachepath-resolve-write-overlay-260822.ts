/**
 * Overlay reproducer for KI-26: fetch-wptfyi --cache-path writes to an
 * unconstrained path.resolve destination.
 *
 * scripts/wpt/browser/fetch-wptfyi.ts fetchWptFyiRun (L222-227, verified at
 * HEAD 83ce08f) resolves the operator-supplied cachePath with
 * `targetPath = path.resolve(options.cachePath || '.wpt-cache/report-chrome-upstream.json')`
 * then mkdirSync(dirname) + writeFileSync of the fetched baseline — with no
 * allowlisted-base containment. An absolute --cache-path or a traversal form
 * such as dist/../../outside/evil-via-dist.json lands attacker-chosen files
 * anywhere the invoking identity can write, clobbering repo files or dropping
 * payloads outside the checkout. This exercises the REAL exported
 * fetchWptFyiRun with customFetch stubs (zero network egress) against
 * disposable temp storage.
 *
 * Asserts the SAFE contract: every non-dryRun cache write must land inside
 * the allowlisted .wpt-cache base; the default path stays inside (control).
 *
 * Reproduces: KI-26
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fetchWptFyiRun } from '../../scripts/wpt/browser/fetch-wptfyi.ts';
import type { FetchWptFyiOptions } from '../../scripts/wpt/browser/fetch-wptfyi.ts';

const REPORT_BODY = JSON.stringify({
  results: [{ test: '/css/cssom/ki26-canary.html', status: 'OK' }],
});

/** customFetch stub: wpt.fyi API returns one run whose raw_results_url is served locally in-memory. */
// Verifies: SYS-REQ-260823-MPS4 (KI-26 reproducer: in-memory wpt.fyi API + results stub)
function makeStubFetch(): typeof fetch {
  const reportBuf = Buffer.from(REPORT_BODY);
  const exactArrayBuffer = (): ArrayBuffer =>
    reportBuf.buffer.slice(reportBuf.byteOffset, reportBuf.byteOffset + reportBuf.byteLength) as ArrayBuffer;
  return (async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : String(input);
    assert.ok(
      url.startsWith('https://wpt.fyi/api/runs') || url.startsWith('https://storage.googleapis.com/'),
      `stub only serves the wpt.fyi API and its results URL; got ${url}`,
    );
    const isApi = url.startsWith('https://wpt.fyi/api/runs');
    const body = isApi
      ? JSON.stringify([
          {
            id: 260822,
            browser_name: 'chrome',
            browser_version: '143.0.0.0',
            os_name: 'linux',
            os_version: '1',
            revision: 'deadbeef',
            raw_results_url: 'https://storage.googleapis.com/wptd/ki26-fixture-results.json.gz',
          },
        ])
      : REPORT_BODY;
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => JSON.parse(body),
      arrayBuffer: async () => exactArrayBuffer(),
      text: async () => body,
    } as unknown as Response;
  }) as typeof fetch;
}

// Verifies: SYS-REQ-260823-MPS4 (KI-26 reproducer: .wpt-cache containment predicate)
function containedUnder(candidate: string, rootDir: string): boolean {
  const rel = path.relative(path.resolve(rootDir), path.resolve(candidate));
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}

// Verifies: SYS-REQ-260823-MPS4 (KI-26 reproducer: real fetchWptFyiRun invocation leg)
async function runReal(options: FetchWptFyiOptions) {
  return fetchWptFyiRun({ quiet: true, customFetch: makeStubFetch(), ...options });
}

// Verifies: SYS-REQ-260823-MPS4 (KI-26 reproducer suite: cache-path confinement)
describe('KI-26 fetch-wptfyi cache-path confinement', () => {
  test('positive control: default cachePath lands inside .wpt-cache', async () => {
    const lab = fs.mkdtempSync(path.join(os.tmpdir(), 'ki26-control-'));
    const prevCwd = process.cwd();
    try {
      fs.mkdirSync(path.join(lab, 'repo'), { recursive: true });
      process.chdir(path.join(lab, 'repo'));
      const result = await runReal({});
      assert.ok(
        containedUnder(result.cachedPath ?? '', path.resolve('.wpt-cache')),
        `default write must stay inside .wpt-cache, got ${result.cachedPath}`,
      );
      assert.equal(result.totalTests, 1);
    } finally {
      process.chdir(prevCwd);
      fs.rmSync(lab, { recursive: true, force: true });
    }
  });

  // Reproduces: KI-26
  test('absolute --cache-path must not write outside the .wpt-cache base', async () => {
    const lab = fs.mkdtempSync(path.join(os.tmpdir(), 'ki26-abs-'));
    const prevCwd = process.cwd();
    try {
      fs.mkdirSync(path.join(lab, 'repo', '.wpt-cache'), { recursive: true });
      fs.mkdirSync(path.join(lab, 'outside'), { recursive: true });
      process.chdir(path.join(lab, 'repo'));
      const escapeTarget = path.join(lab, 'outside', 'ki26-evil-cache.json');
      const result = await runReal({ cachePath: escapeTarget });
      assert.ok(
        containedUnder(result.cachedPath ?? '', path.resolve('.wpt-cache')),
        `SAFE contract violated: absolute --cache-path wrote fetched baseline outside .wpt-cache at ${result.cachedPath} (fetch-wptfyi.ts:224 unconstrained path.resolve)`,
      );
    } finally {
      process.chdir(prevCwd);
      fs.rmSync(lab, { recursive: true, force: true });
    }
  });

  // Reproduces: KI-26
  test('traversal --cache-path (dist/../../outside/…) must not write outside the .wpt-cache base', async () => {
    const lab = fs.mkdtempSync(path.join(os.tmpdir(), 'ki26-trav-'));
    const prevCwd = process.cwd();
    try {
      fs.mkdirSync(path.join(lab, 'repo'), { recursive: true });
      fs.mkdirSync(path.join(lab, 'outside'), { recursive: true });
      process.chdir(path.join(lab, 'repo'));
      const result = await runReal({ cachePath: 'dist/../../outside/ki26-evil-via-dist.json' });
      assert.ok(
        containedUnder(result.cachedPath ?? '', path.resolve('.wpt-cache')),
        `SAFE contract violated: traversal --cache-path wrote fetched baseline outside .wpt-cache at ${result.cachedPath} (fetch-wptfyi.ts:224-226 mkdir+write)`,
      );
    } finally {
      process.chdir(prevCwd);
      fs.rmSync(lab, { recursive: true, force: true });
    }
  });
});
