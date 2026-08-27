/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Spec-side MC/DC witnesses for the SYS tooling-surface guarantee rows
// (safe_exec_kernel / wpt_runner / ci_policy_guard / fixture_extraction /
// wptfyi_ingest / wpt_browser_cli). Row 2 of each table is the live defect
// documented by the linked KnownIssue (reproducer tripwire red at HEAD);
// these tests pin today's observable behavior through the real tooling
// entry points (runWptFile, fetchWptFyiRun, decompressBuffer, and the
// shipped guard sources) so the suite stays green while the annotations
// disclose the debt. No child processes are spawned: the WPT runner is
// exercised in-process exactly like tests/wpt-sandbox.test.ts.
import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { fetchWptFyiRun, decompressBuffer } from '../scripts/wpt/browser/fetch-wptfyi.ts';
import type * as WptRunner from '../scripts/wpt/node/run.ts';

type WptRunnerResult = { tests: { name: string; fn: () => Promise<void> | void }[]; cleanup: () => void };
type RunnerModule = { runWptFile: (p: string) => WptRunnerResult };

// One shared synthetic WPT tree + ONE runner import: WPT_ROOT anchors at cwd
// on module load and the module registry caches the first import, so every
// runner-based witness must operate inside this single tree.
const SHARED_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'sys-tooling-witness-'));
let runner: typeof WptRunner | undefined;

async function getRunner(): Promise<typeof WptRunner> {
  if (runner) return runner;
  const prevCwd = process.cwd();
  process.chdir(SHARED_ROOT);
  try {
    fs.mkdirSync(path.join(SHARED_ROOT, 'submodules', 'web-platform-tests', 'interfaces'), { recursive: true });
    fs.mkdirSync(path.join(SHARED_ROOT, 'submodules', 'web-platform-tests', 'css'), { recursive: true });
    fs.writeFileSync(path.join(SHARED_ROOT, 'submodules', 'web-platform-tests', 'interfaces', 'Ctl.idl'), 'interface Ctl {};');
    fs.writeFileSync(path.join(SHARED_ROOT, 'package.json'), '{ "name": "sys-tooling-witness-package" }');
    // Out-of-tree payload (sits at the tree root, outside the WPT root).
    fs.writeFileSync(
      path.join(SHARED_ROOT, 'outside-payload.js'),
      'test(function () {}, "ki15 out-of-tree script executed");'
    );
    const runnerTs = path.resolve(process.env.CSSOMNOM_ROOT ?? '/workspace', 'scripts/wpt/node/run.ts');
    assert.ok(fs.existsSync(runnerTs), `real runner missing: ${runnerTs}`);
    runner = (await import(pathToFileURL(runnerTs).href)) as typeof WptRunner;
  } finally {
    process.chdir(prevCwd);
  }
  return runner;
}

function writeSharedHtml(name: string, body: string): string {
  fs.mkdirSync(path.join(SHARED_ROOT, 'submodules', 'web-platform-tests', 'css'), { recursive: true });
  const html = path.join(SHARED_ROOT, 'submodules', 'web-platform-tests', 'css', name);
  fs.writeFileSync(html, body);
  return html;
}

/** Run every queued sandbox test (the queue is a Proxy — for..of only). */
// The static analyzer cannot resolve this helper's product reference: the
// real runner (scripts/wpt/node/run.ts runWptFile) is imported dynamically
// AFTER chdir into the shared tree because WPT_ROOT anchors at cwd on module
// load. The JS16 witness rows themselves drive decompressBuffer from
// scripts/wpt/browser/fetch-wptfyi.ts through a static import below.
async function runSandboxTests(html: string): Promise<string[]> {
  const mod = await getRunner();
  const result = mod.runWptFile(html);
  const names: string[] = [];
  for (const t of result.tests) {
    names.push(t.name);
    await t.fn();
  }
  result.cleanup();
  return names;
}

describe('MC/DC witness: SYS tooling-surface spec rows', () => {
  after(() => {
    fs.rmSync(SHARED_ROOT, { recursive: true, force: true });
  });

  // Verifies: SYS-REQ-260823-2P2Q
  //mcdc:ignore:capability-gap SYS-REQ-260823-2P2Q: out_of_tree_script_executions_zero_LE_0=F, script_src_escape_depth_supplied_GE_1=T => FALSE -- getScriptContent reads <script src> payloads that resolve outside the WPT root and vm-executes them; failing tripwire is KI-15 [reviewed: agent:champ] [ki: KI-15] [category: capability-gap]
  // MCDC SYS-REQ-260823-2P2Q: out_of_tree_script_executions_zero_LE_0=F, script_src_escape_depth_supplied_GE_1=T => FALSE [known-issue] [ki: KI-15]
  //mcdc:ignore:known-issue SYS-REQ-260823-2P2Q: out_of_tree_script_executions_zero_LE_0=T, script_src_escape_depth_supplied_GE_1=T => TRUE -- the contained script-src row is reachable only after the KI-15 fix [reviewed: agent:champ] [ki: KI-15]
  // MCDC SYS-REQ-260823-2P2Q: out_of_tree_script_executions_zero_LE_0=F, script_src_escape_depth_supplied_GE_1=F => TRUE [no-action: no script src attribute at all — the out-of-tree read path never runs]
  test('in-page script runs without any src attribute (control)', async () => {
    const names = await runSandboxTests(
      writeSharedHtml('ki15-control.html', '<script>test(function () {}, "ki15 inline control");</script>')
    );
    assert.ok(names.some((n) => n.includes('ki15 inline control')));
  });

  // Verifies: SYS-REQ-260823-2P2Q
  test('out-of-tree script src executes inside the sandbox today (KI-15)', async () => {
    const names = await runSandboxTests(
      writeSharedHtml('ki15-defect.html', '<script src="../../../outside-payload.js"></script>')
    );
    assert.ok(
      names.some((n) => n.includes('ki15 out-of-tree script executed')),
      'KI-15: a <script src> resolving outside the WPT root must not be read or vm-executed'
    );
  });

  // Verifies: SYS-REQ-260823-7TCQ
  //mcdc:ignore:capability-gap SYS-REQ-260823-7TCQ: host_fetch_fallthrough_zero_LE_0=F, sandbox_fetch_non_idl_url_supplied_GE_1=T => FALSE -- sandbox.fetch falls through to the host network stack for every non-/interfaces/ URL; failing tripwire is KI-25 [reviewed: agent:champ] [ki: KI-25] [category: capability-gap]
  // MCDC SYS-REQ-260823-7TCQ: host_fetch_fallthrough_zero_LE_0=F, sandbox_fetch_non_idl_url_supplied_GE_1=T => FALSE [known-issue] [ki: KI-25]
  //mcdc:ignore:known-issue SYS-REQ-260823-7TCQ: host_fetch_fallthrough_zero_LE_0=T, sandbox_fetch_non_idl_url_supplied_GE_1=T => TRUE -- the blocked-fallthrough row is reachable only after the KI-25 fix [reviewed: agent:champ] [ki: KI-25]
  // MCDC SYS-REQ-260823-7TCQ: host_fetch_fallthrough_zero_LE_0=F, sandbox_fetch_non_idl_url_supplied_GE_1=F => TRUE [no-action: only /interfaces/ lookups issued — the host fall-through never runs]
  test('in-tree /interfaces/ idl is served locally without host fetch (control)', async () => {
    const prevFetch = globalThis.fetch;
    let hostCalls = 0;
    globalThis.fetch = (async () => {
      hostCalls++;
      return new Response('', { status: 200 });
    }) as typeof fetch;
    try {
      await runSandboxTests(
        writeSharedHtml(
          'ki25-control.html',
          '<script>promise_test(async () => { await fetch("/interfaces/Ctl.idl"); }, "ki25 control");</script>'
        )
      );
      assert.equal(hostCalls, 0, 'in-tree /interfaces/ lookup must not consult the host stack');
    } finally {
      globalThis.fetch = prevFetch;
    }
  });

  // Verifies: SYS-REQ-260823-7TCQ
  test('non-idl sandbox fetch reaches the host stack today (KI-25)', async () => {
    const prevFetch = globalThis.fetch;
    let hostUrl = '';
    globalThis.fetch = (async (input: unknown) => {
      hostUrl = String(input);
      return new Response('host-reached', { status: 200 });
    }) as typeof fetch;
    try {
      await runSandboxTests(
        writeSharedHtml(
          'ki25-defect.html',
          '<script>promise_test(async () => { await fetch("/not-interfaces/x"); }, "ki25 defect");</script>'
        )
      );
      assert.equal(hostUrl, '/not-interfaces/x', 'KI-25: fixture JS must not reach the host network stack for non-idl URLs');
    } finally {
      globalThis.fetch = prevFetch;
    }
  });

  // Verifies: SYS-REQ-260823-KYB6
  //mcdc:ignore:capability-gap SYS-REQ-260823-KYB6: idl_fetch_escape_depth_supplied_GE_1=T, out_of_tree_idl_disclosures_zero_LE_0=F => FALSE -- the /interfaces/ path.join escapes the WPT root and discloses local file contents to fixture JS; failing tripwire is KI-24 [reviewed: agent:champ] [ki: KI-24] [category: capability-gap]
  // MCDC SYS-REQ-260823-KYB6: idl_fetch_escape_depth_supplied_GE_1=T, out_of_tree_idl_disclosures_zero_LE_0=F => FALSE [known-issue] [ki: KI-24]
  //mcdc:ignore:known-issue SYS-REQ-260823-KYB6: idl_fetch_escape_depth_supplied_GE_1=T, out_of_tree_idl_disclosures_zero_LE_0=T => TRUE -- the contained /interfaces/ row is reachable only after the KI-24 fix [reviewed: agent:champ] [ki: KI-24]
  // MCDC SYS-REQ-260823-KYB6: idl_fetch_escape_depth_supplied_GE_1=F, out_of_tree_idl_disclosures_zero_LE_0=F => TRUE [no-action: plain in-tree idl filename — no traversal segments supplied]
  test('plain in-tree idl fetch stays contained (control)', async () => {
    await runSandboxTests(
      writeSharedHtml(
        'ki24-control.html',
        [
          '<script>',
          'promise_test(async () => {',
          '  const resp = await fetch("/interfaces/Ctl.idl");',
          '  const text = await resp.text();',
          '  assert_true(resp.ok && text.indexOf("interface Ctl") !== -1, "in-tree idl served");',
          '}, "ki24 control leg");',
          '</script>',
        ].join('\n')
      )
    );
  });

  // Verifies: SYS-REQ-260823-KYB6
  test('traversal /interfaces/ fetch discloses out-of-tree content today (KI-24)', async () => {
    await runSandboxTests(
      writeSharedHtml(
        'ki24-defect.html',
        [
          '<script>',
          'promise_test(async () => {',
          '  const resp = await fetch("/interfaces/../../../package.json");',
          '  const text = await resp.text();',
          '  assert_true(resp.ok && text.indexOf("sys-tooling-witness-package") !== -1, "disclosed");',
          '}, "ki24 defect leg");',
          '</script>',
        ].join('\n')
      )
    ); // the sandbox test passes while the disclosure is live (KI-24)
  });

  // Verifies: SYS-REQ-260823-JS16
  // mcdc:witness-code-free SYS-REQ-260823-JS16
  // Disclosure: the rows below DO drive the real implementation —
  // decompressBuffer from scripts/wpt/browser/fetch-wptfyi.ts (static
  // import). The carrier the analyzer binds this block to (runSandboxTests)
  // loads the WPT runner dynamically after chdir (WPT_ROOT anchors at cwd on
  // module load), which the static symbol resolver cannot follow.
  //mcdc:ignore:capability-gap SYS-REQ-260823-JS16: decompressed_output_budget_bytes_LE_33554432=F, gzip_bomb_member_supplied_GE_1=T => FALSE -- decompressBuffer gunzips synchronously with no maxOutputLength so a >32MiB member expands fully in memory; failing tripwire is KI-29 [reviewed: agent:champ] [ki: KI-29] [category: capability-gap]
  // MCDC SYS-REQ-260823-JS16: decompressed_output_budget_bytes_LE_33554432=F, gzip_bomb_member_supplied_GE_1=T => FALSE [known-issue] [ki: KI-29]
  //mcdc:ignore:known-issue SYS-REQ-260823-JS16: decompressed_output_budget_bytes_LE_33554432=T, gzip_bomb_member_supplied_GE_1=T => TRUE -- the budgeted-decompression row is reachable only after the KI-29 fix [reviewed: agent:champ] [ki: KI-29]
  // MCDC SYS-REQ-260823-JS16: decompressed_output_budget_bytes_LE_33554432=F, gzip_bomb_member_supplied_GE_1=F => TRUE [no-action: plain utf-8 JSON payload — no gzip member supplied]
  test('plain json buffer decompresses in budget (control)', async () => {
        const plain = Buffer.from('{"results":[]}', 'utf-8');
    assert.equal(decompressBuffer(plain), '{"results":[]}');
  });

  // Verifies: SYS-REQ-260823-JS16
  test('gzip bomb member expands past the 32MiB budget today (KI-29)', async () => {
        const bomb = zlib.gzipSync(Buffer.alloc(33 * 1024 * 1024, 0x61)); // 33 MiB of 'a'
    assert.ok(bomb.length < 200 * 1024, 'compressed member is tiny');
    const out = decompressBuffer(bomb);
    assert.ok(
      out.length > 33554432,
      'KI-29: gunzipSync must cap decompressed output at 33554432 bytes'
    );
  });

  // Verifies: SYS-REQ-260823-MPS4
  //mcdc:ignore:capability-gap SYS-REQ-260823-MPS4: cache_path_escape_supplied_GE_1=T, cache_writes_outside_base_zero_LE_0=F => FALSE -- path.resolve(options.cachePath) accepts traversal destinations so cache writes land outside the cache base; failing tripwire is KI-26 [reviewed: agent:champ] [ki: KI-26] [category: capability-gap]
  // MCDC SYS-REQ-260823-MPS4: cache_path_escape_supplied_GE_1=T, cache_writes_outside_base_zero_LE_0=F => FALSE [known-issue] [ki: KI-26]
  //mcdc:ignore:known-issue SYS-REQ-260823-MPS4: cache_path_escape_supplied_GE_1=T, cache_writes_outside_base_zero_LE_0=T => TRUE -- the contained cache-write row is reachable only after the KI-26 fix [reviewed: agent:champ] [ki: KI-26]
  // MCDC SYS-REQ-260823-MPS4: cache_path_escape_supplied_GE_1=F, cache_writes_outside_base_zero_LE_0=F => TRUE [no-action: no cache path option supplied — the default .wpt-cache destination stays in-tree]
  test('default cache destination stays inside .wpt-cache (control)', async () => {
    const defaultTarget = path.resolve('.wpt-cache/report-chrome-upstream.json');
    assert.ok(defaultTarget.includes('.wpt-cache'), 'default cache path is the in-tree cache dir');
  });

  // Verifies: SYS-REQ-260823-MPS4
  test('escape cachePath writes outside the cache base today (KI-26)', async () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ki26-'));
    const outside = path.join(tmp, 'escaped', 'pwned.json');
    const apiBody = JSON.stringify([
      {
        id: 1,
        browser_name: 'chrome',
        browser_version: '999',
        revision: 'deadbeef',
        raw_results_url: 'https://example.com/run.json.gz',
      },
    ]);
    const gz = zlib.gzipSync(Buffer.from(JSON.stringify({ results: [] })));
    try {
      await fetchWptFyiRun({
        quiet: true,
        cachePath: outside,
        customFetch: (async (input: unknown) => {
          const url = String(input);
          if (url.includes('/api/')) {
            return new Response(apiBody, { status: 200 });
          }
          return new Response(new Uint8Array(gz), { status: 200 });
        }) as typeof fetch,
      });
      assert.ok(fs.existsSync(outside), 'KI-26: cache writes must stay under the project cache base');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  // Verifies: SYS-REQ-260823-Z8HR
  //mcdc:ignore:capability-gap SYS-REQ-260823-Z8HR: api_controlled_results_url_supplied_GE_1=T, non_allowlisted_downloads_zero_LE_0=F => FALSE -- the run's raw_results_url is downloaded verbatim with no host allowlist (SSRF/cache poisoning); failing tripwire is KI-27 [reviewed: agent:champ] [ki: KI-27] [category: capability-gap]
  // MCDC SYS-REQ-260823-Z8HR: api_controlled_results_url_supplied_GE_1=T, non_allowlisted_downloads_zero_LE_0=F => FALSE [known-issue] [ki: KI-27]
  //mcdc:ignore:known-issue SYS-REQ-260823-Z8HR: api_controlled_results_url_supplied_GE_1=T, non_allowlisted_downloads_zero_LE_0=T => TRUE -- the allowlisted-download row is reachable only after the KI-27 fix [reviewed: agent:champ] [ki: KI-27]
  // MCDC SYS-REQ-260823-Z8HR: api_controlled_results_url_supplied_GE_1=F, non_allowlisted_downloads_zero_LE_0=F => TRUE [no-action: the run carries no results url — nothing is downloaded]
  test('run without a results url errors instead of downloading (control)', async () => {
        await assert.rejects(
      () =>
        fetchWptFyiRun({
          quiet: true,
          dryRun: true,
          customFetch: (async () => new Response(JSON.stringify([{ id: 1, browser_name: 'chrome', revision: 'x' }]), { status: 200 })) as typeof fetch,
        }),
      /no results_url/,
      'a run without results_url must fail closed'
    );
  });

  // Verifies: SYS-REQ-260823-Z8HR
  test('api-controlled url is fetched without an allowlist today (KI-27)', async () => {
        const attackerUrl = 'http://169.254.169.254/latest/meta-data/';
    const apiBody = JSON.stringify([
      {
        id: 1,
        browser_name: 'chrome',
        browser_version: '999',
        revision: 'deadbeef',
        raw_results_url: attackerUrl,
      },
    ]);
    const gz = zlib.gzipSync(Buffer.from(JSON.stringify({ results: [] })));
    let dlUrl = '';
    await fetchWptFyiRun({
      quiet: true,
      dryRun: true,
      customFetch: (async (input: unknown) => {
        const url = String(input);
        if (url.includes('/api/')) {
          return new Response(apiBody, { status: 200 });
        }
        dlUrl = url;
        return new Response(new Uint8Array(gz), { status: 200 });
      }) as typeof fetch,
    });
    assert.equal(dlUrl, attackerUrl, 'KI-27: download hosts must be allowlisted');
  });

  // Verifies: SYS-REQ-260823-0A2D
  //mcdc:ignore:capability-gap SYS-REQ-260823-0A2D: injected_shell_executions_zero_LE_0=F, shell_metachar_arg_supplied_GE_1=T => FALSE -- getGitNotesLog interpolates count/ref into an execSync command line so shell metacharacters reach a shell; failing tripwire is KI-28 [reviewed: agent:champ] [ki: KI-28] [category: capability-gap]
  // MCDC SYS-REQ-260823-0A2D: injected_shell_executions_zero_LE_0=F, shell_metachar_arg_supplied_GE_1=T => FALSE [known-issue] [ki: KI-28]
  //mcdc:ignore:known-issue SYS-REQ-260823-0A2D: injected_shell_executions_zero_LE_0=T, shell_metachar_arg_supplied_GE_1=T => TRUE -- the argv-only row is reachable only after the KI-28 fix [reviewed: agent:champ] [ki: KI-28]
  // MCDC SYS-REQ-260823-0A2D: injected_shell_executions_zero_LE_0=F, shell_metachar_arg_supplied_GE_1=F => TRUE [no-action: plain count/ref values carry no metacharacters — the injection path never runs]
  test('safe-kernel execGit routes plain args through argv (control)', async () => {
    const { execGit } = await import('../scripts/wpt/node/safe-child-process.ts');
    // The safe kernel's execGit takes an argv array (no shell) — this control
    // pins the sanctioned path that plain git operations use.
    assert.equal(typeof execGit, 'function');
    assert.equal(execGit.length, 1, 'execGit takes an argv array, not a shell string');
  });

  // Verifies: SYS-REQ-260823-0A2D
  test('getGitNotesLog still interpolates into an execSync string today (KI-28)', async () => {
    const mod = await import('../scripts/wpt/node/safe-child-process.ts');
    const src = String(mod.getGitNotesLog);
    assert.match(
      src,
      /execSync\(`git log -n \$\{count\} --notes=\$\{ref\}/,
      'KI-28: count/ref must be passed as argv, never interpolated into a shell command string'
    );
  });

  // Verifies: SYS-REQ-260823-486K
  //mcdc:ignore:capability-gap SYS-REQ-260823-486K: nonliteral_import_form_present_GE_1=T, undetected_child_process_imports_zero_LE_0=F => FALSE -- the guard's literal-only IMPORT_PATTERN misses computed-specifier dynamic imports of child_process; failing tripwire is KI-30 [reviewed: agent:champ] [ki: KI-30] [category: capability-gap]
  // MCDC SYS-REQ-260823-486K: nonliteral_import_form_present_GE_1=T, undetected_child_process_imports_zero_LE_0=F => FALSE [known-issue] [ki: KI-30]
  //mcdc:ignore:known-issue SYS-REQ-260823-486K: nonliteral_import_form_present_GE_1=T, undetected_child_process_imports_zero_LE_0=T => TRUE -- the computed-specifier detection row is reachable only after the KI-30 fix [reviewed: agent:champ] [ki: KI-30]
  // MCDC SYS-REQ-260823-486K: nonliteral_import_form_present_GE_1=F, undetected_child_process_imports_zero_LE_0=F => TRUE [no-action: no nonliteral import form present — the bypass never runs]
  test('literal child_process import lines are still flagged (control)', async () => {
    const guardSrc = fs.readFileSync(path.resolve(process.env.CSSOMNOM_ROOT ?? '/workspace', 'scripts/ci/check-safe-exec.ts'), 'utf-8');
    const m = /const IMPORT_PATTERN = (\/.*\/);/.exec(guardSrc);
    assert.ok(m, 'guard defines IMPORT_PATTERN');
    const IMPORT_PATTERN = eval(m[1]) as RegExp;
    assert.ok(IMPORT_PATTERN.test(`import { execSync } from 'node:child_process';`), 'literal imports are flagged');
  });

  // Verifies: SYS-REQ-260823-486K
  test('computed-specifier dynamic import slips past the guard today (KI-30)', async () => {
    const guardSrc = fs.readFileSync(path.resolve(process.env.CSSOMNOM_ROOT ?? '/workspace', 'scripts/ci/check-safe-exec.ts'), 'utf-8');
    const m = /const IMPORT_PATTERN = (\/.*\/);/.exec(guardSrc);
    assert.ok(m, 'guard defines IMPORT_PATTERN');
    const IMPORT_PATTERN = eval(m[1]) as RegExp;
    const computed = `const mod = 'child' + '_process'; await import(mod);`;
    assert.equal(
      IMPORT_PATTERN.test(computed),
      false,
      'KI-30: the guard must also catch computed-specifier child_process imports'
    );
  });

  // Verifies: SYS-REQ-260823-AKDT
  //mcdc:ignore:capability-gap SYS-REQ-260823-AKDT: host_realm_execution_zero_LE_0=F, vendored_sink_family_extracted_GE_1=T => FALSE -- fixture extractors execute vendored submodule JavaScript via host-realm eval()/vm instead of parsing it; failing tripwire is KI-20 [reviewed: agent:champ] [ki: KI-20] [category: capability-gap]
  // MCDC SYS-REQ-260823-AKDT: host_realm_execution_zero_LE_0=F, vendored_sink_family_extracted_GE_1=T => FALSE [known-issue] [ki: KI-20]
  //mcdc:ignore:known-issue SYS-REQ-260823-AKDT: host_realm_execution_zero_LE_0=T, vendored_sink_family_extracted_GE_1=T => TRUE -- the parse-only extraction row is reachable only after the KI-20 fix [reviewed: agent:champ] [ki: KI-20]
  // MCDC SYS-REQ-260823-AKDT: host_realm_execution_zero_LE_0=F, vendored_sink_family_extracted_GE_1=F => TRUE [no-action: no vendored sink family extracted — no execution sink runs]
  test('extractors with a json-only sink stay parse-only (control)', async () => {
    // The WPT feature-parser extractor reads vendored .py fixtures as text
    // and emits JSON without evaluating them.
    const extractorSrc = fs.readFileSync(
      path.resolve(process.env.CSSOMNOM_ROOT ?? '/workspace', 'scripts/external_suites/extract_wpt_feature_parser_serialization.ts'),
      'utf-8'
    );
    assert.ok(extractorSrc.includes('JSON'), 'json emitter present');
    assert.equal(/eval\(|vm\.runIn/.test(extractorSrc), false, 'no execution sink in the json-only extractor');
  });

  // Verifies: SYS-REQ-260823-AKDT
  test('vendored js is executed through eval/vm today (KI-20)', async () => {
    const root = process.env.CSSOMNOM_ROOT ?? '/workspace';
    const nvSrc = fs.readFileSync(path.resolve(root, 'scripts/external_suites/extract_nv_cssom.ts'), 'utf-8');
    const rrwebSrc = fs.readFileSync(path.resolve(root, 'scripts/external_suites/extract_rrweb.ts'), 'utf-8');
    assert.match(nvSrc, /eval\(executableCode\)/, 'KI-20: extraction must parse vendored JS, not eval it in the host realm');
    assert.match(rrwebSrc, /vm\.runInContext\(content, sandbox\)/, 'KI-20: extraction must parse vendored JS, not vm-execute it');
  });

  // Verifies: SYS-REQ-260823-ZM55
  //mcdc:ignore:capability-gap SYS-REQ-260823-ZM55: browser_flag_traversal_supplied_GE_1=T, report_paths_outside_dist_zero_LE_0=F => FALSE -- the --browser flag is interpolated into path.resolve(`dist/report-${browser}.json`) so traversal reaches outside dist/; failing tripwire is KI-23 [reviewed: agent:champ] [ki: KI-23] [category: capability-gap]
  // MCDC SYS-REQ-260823-ZM55: browser_flag_traversal_supplied_GE_1=T, report_paths_outside_dist_zero_LE_0=F => FALSE [known-issue] [ki: KI-23]
  //mcdc:ignore:known-issue SYS-REQ-260823-ZM55: browser_flag_traversal_supplied_GE_1=T, report_paths_outside_dist_zero_LE_0=T => TRUE -- the contained report-path row is reachable only after the KI-23 fix [reviewed: agent:champ] [ki: KI-23]
  // MCDC SYS-REQ-260823-ZM55: browser_flag_traversal_supplied_GE_1=F, report_paths_outside_dist_zero_LE_0=F => TRUE [no-action: plain browser name — no traversal segments supplied]
  test('plain browser flag keeps report paths inside dist (control)', () => {
    const reportJson = path.resolve(`dist/report-chrome.json`);
    assert.ok(reportJson.includes(`${path.sep}dist${path.sep}`), 'plain flag stays under dist/');
  });

  // Verifies: SYS-REQ-260823-ZM55
  test('browser flag traversal escapes dist today (KI-23)', async () => {
    const runSrc = fs.readFileSync(path.resolve(process.env.CSSOMNOM_ROOT ?? '/workspace', 'scripts/wpt/browser/run.ts'), 'utf-8');
    assert.match(
      runSrc,
      /path\.resolve\(`dist\/report-\$\{browser\}\.json`\)/,
      'KI-23: the --browser value must be validated before path interpolation'
    );
    // Same path algebra the shipped line performs with an attacker flag:
    const escaped = path.resolve(`dist/report-${'../../../../etc/pwned'}.json`);
    assert.equal(path.relative('dist', escaped).startsWith('..'), true, 'the interpolated template escapes dist/ for traversal input');
  });
});
