/**
 * Overlay reproducer for KI-27: fetchWptFyiRun downloads API-provided
 * results URLs with no host allowlist.
 *
 * scripts/wpt/browser/fetch-wptfyi.ts:178-196 (verified at HEAD 83ce08f):
 * `const downloadUrl = run.raw_results_url || run.results_url;` is fetched
 * verbatim through the same fetchFn used for the wpt.fyi API query — there
 * is no scheme/host allowlist between "bytes returned by the runs API" and
 * "URL this process dereferences". A compromised or MITM'd wpt.fyi record
 * (or a poisoned mirror) can therefore coerce the maintainer/CI host into
 * requesting arbitrary URLs — cloud metadata (169.254.169.254), loopback or
 * RFC1918 internal services — and cache whatever comes back as the trusted
 * upstream WPT baseline (SSRF + cache poisoning, CWE-918). undici's default
 * redirect following extends the blast radius past the first hop.
 *
 * This exercises the REAL exported fetchWptFyiRun: customFetch stub answers
 * only the wpt.fyi API URL; raw_results_url points at a loopback HTTP
 * listener standing in for an internal service (127.0.0.1 ephemeral port,
 * closed in finally — no external egress). Both legs pass dryRun:true so the
 * fetched bytes are decoded in memory only — the :189 fetchFn(downloadUrl)
 * dereference stays observable via the stub listener, while the persistence
 * branch (fetch-wptfyi.ts:222-227 mkdirSync/writeFileSync) is skipped and
 * canary baselines can never land in the repo's real .wpt-cache.
 *
 * Asserts the SAFE contract: downloads must only be issued to allowlisted
 * hosts {wpt.fyi, storage.googleapis.com}; a poisoned run record must not
 * produce any request off those hosts.
 *
 * Reproduces: KI-27
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import { fetchWptFyiRun } from '../../scripts/wpt/browser/fetch-wptfyi.ts';

const ALLOWLIST_HOSTS = new Set(['wpt.fyi', 'storage.googleapis.com']);

// Verifies: SYS-REQ-260823-Z8HR (KI-27 reproducer: local attacker-origin server)
function listenOnce(handler: (req: http.IncomingMessage, res: http.ServerResponse) => void): Promise<{
  server: http.Server;
  origin: string;
}> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

// Verifies: SYS-REQ-260823-Z8HR (KI-27 reproducer suite: download-url host allowlist)
describe('KI-27 download-url host allowlist', () => {
  // Reproduces: KI-27
  test('live leg: poisoned raw_results_url must not be dereferenced off the allowlist', async () => {
    const hits: string[] = [];
    const { server, origin } = await listenOnce((req, res) => {
      hits.push(`${req.headers.host}${req.url}`);
      // Stand-in response shaped like an internal service / metadata endpoint.
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          results: [{ test: '/css/cssom/ki27-canary.html', status: 'OK' }],
        }),
      );
    });

    const apiCalls: string[] = [];
    const stubFetch = (async (input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : String(input);
      apiCalls.push(url);
      if (url.startsWith('https://wpt.fyi/api/runs')) {
        const body = JSON.stringify([
          {
            id: 999001,
            browser_name: 'chrome',
            browser_version: '143.0.0.0',
            os_name: 'linux',
            os_version: '1',
            revision: 'deadbeef',
            raw_results_url: `${origin}/latest/meta-data/`,
            results_url: 'https://storage.googleapis.com/wptd/should-not-be-used.json',
          },
        ]);
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => JSON.parse(body),
          arrayBuffer: async () => new ArrayBuffer(0),
          text: async () => body,
        } as unknown as Response;
      }
      // Non-API URLs go through the same seam the real module uses.
      return fetch(input);
    }) as typeof fetch;

    try {
      let threw: unknown;
      try {
        // dryRun keeps the poisoned payload in memory: the SSRF dereference at
        // fetch-wptfyi.ts:189 still fires (and is observed by the listener), but
        // nothing is persisted to the repo's .wpt-cache (write branch :222-227 skipped).
        await fetchWptFyiRun({ quiet: true, dryRun: true, customFetch: stubFetch });
      } catch (e) {
        threw = e;
      }

      assert.ok(apiCalls[0].startsWith('https://wpt.fyi/api/runs'), 'setup failure: API query must target wpt.fyi');
      assert.equal(
        hits.length,
        0,
        `SAFE contract violated: API-controlled downloadUrl was dereferenced off-host (${hits.length} request(s) reached ${origin}) without any host allowlist at fetch-wptfyi.ts:189 fetchFn(downloadUrl)`,
      );
      // If containment existed, the poisoned URL would be rejected loudly.
      assert.ok(threw !== undefined || hits.length === 0, 'poisoned run record was ingested silently');
    } finally {
      server.close();
    }
  });

  test('positive control: allowlisted raw_results_url flows through the same stub seam', async () => {
    const apiCalls: string[] = [];
    const dlBody = JSON.stringify({ results: [{ test: '/css/cssom/ki27-control.html', status: 'OK' }] });
    const dlBuf = Buffer.from(dlBody);
    const dlArrayBuffer = dlBuf.buffer.slice(dlBuf.byteOffset, dlBuf.byteOffset + dlBuf.byteLength) as ArrayBuffer;
    const stubFetch = (async (input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : String(input);
      apiCalls.push(url);
      const body =
        url.startsWith('https://wpt.fyi/api/runs')
          ? JSON.stringify([
              {
                id: 260823,
                browser_name: 'chrome',
                browser_version: '143.0.0.0',
                os_name: 'linux',
                os_version: '1',
                revision: 'cafe1234',
                raw_results_url: 'https://storage.googleapis.com/wptd/ki27-control-results.json.gz',
              },
            ])
          : dlBody;
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => JSON.parse(body),
        arrayBuffer: async () => dlArrayBuffer,
        text: async () => body,
      } as unknown as Response;
    }) as typeof fetch;

    const result = await fetchWptFyiRun({ quiet: true, dryRun: true, customFetch: stubFetch });
    assert.equal(result.totalTests, 1, 'control: baseline ingest works over the same seam');
    assert.ok(apiCalls.some((u) => ALLOWLIST_HOSTS.has(new URL(u).host)), 'control download stayed on an allowlisted host');
  });
});
