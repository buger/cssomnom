/**
 * Overlay reproducer for KI-29: gunzipSync without maxOutputLength expands
 * a gzip bomb.
 *
 * scripts/wpt/browser/fetch-wptfyi.ts decompressBuffer (L77-88, verified at
 * HEAD 83ce08f) checks gzip magic bytes then calls
 * `zlib.gunzipSync(buffer)` with NO maxOutputLength option, and on any error
 * silently returns the raw bytes as UTF-8. The wpt.fyi download path
 * (fetchWptFyiRun L194-196) feeds attacker-influenced API-provided bytes
 * straight into it, so a hostile or compromised baseline response can force
 * unbounded synchronous allocation inside the maintainer/CI process — a few
 * KB compressed become arbitrarily many MB/GB of heap (availability,
 * CWE-409). The remediated shape (gunzipSync with maxOutputLength) rejects
 * the same input with ERR_BUFFER_TOO_LARGE, which this reproducer grounds as
 * a contrast leg.
 *
 * Asserts the SAFE contract: decompression of an oversized member must fail
 * closed (throw ERR_BUFFER_TOO_LARGE) or cap output at budget; it must NOT
 * materialize the full expansion.
 *
 * Reproduces: KI-29
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as zlib from 'node:zlib';
import { decompressBuffer } from '../../scripts/wpt/browser/fetch-wptfyi.ts';

const EXPANSION_BYTES = 5 * 1024 * 1024; // 5 MiB zeros — scan demo ceiling is 32 MiB
const BUDGET_BYTES = 655360; // expanded/8: far below the crafted expansion

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MiB`;
}

describe('KI-29 decompression output budget', () => {
  test('positive control: small gzip member decompresses exactly', () => {
    const payload = JSON.stringify({ results: [{ test: '/css/cssom/ki29-control.html', status: 'OK' }] });
    const gz = zlib.gzipSync(Buffer.from(payload));
    assert.ok(gz.length >= 2 && gz[0] === 0x1f && gz[1] === 0x8b, 'control fixture must be gzip');
    const text = decompressBuffer(gz);
    assert.equal(text, payload);
  });

  test('contrast leg: zlib.gunzipSync(maxOutputLength) enforces the budget (remediated shape works)', () => {
    const plaintext = Buffer.alloc(EXPANSION_BYTES, 0x00);
    const bomb = zlib.gzipSync(plaintext, { level: 9 });
    assert.throws(
      () => zlib.gunzipSync(bomb, { maxOutputLength: BUDGET_BYTES }),
      (e: NodeJS.ErrnoException) => e.code === 'ERR_BUFFER_TOO_LARGE',
      'remediated shape must reject oversize output',
    );
  });

  // Reproduces: KI-29
  test('live leg: decompressBuffer must not materialize an oversized gzip expansion', () => {
    const plaintext = Buffer.alloc(EXPANSION_BYTES, 0x00);
    const bomb = zlib.gzipSync(plaintext, { level: 9 });
    const ratio = (EXPANSION_BYTES / bomb.length).toFixed(1);

    let out: string;
    let threw: unknown;
    const t0 = process.hrtime.bigint();
    try {
      out = decompressBuffer(bomb); // fetch-wptfyi.ts:81 uncapped gunzipSync
    } catch (e) {
      threw = e;
    }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;

    if (threw !== undefined) {
      const code = (threw as NodeJS.ErrnoException).code ?? '';
      assert.equal(
        code,
        'ERR_BUFFER_TOO_LARGE',
        `decompressBuffer threw ${code} but not the budgeted ERR_BUFFER_TOO_LARGE`,
      );
      return;
    }

    assert.ok(
      out!.length <= BUDGET_BYTES,
      `SAFE contract violated: uncapped gunzipSync at fetch-wptfyi.ts:81 materialized ${formatBytes(out!.length * 2)} ` +
        `(${out!.length} UTF-16 code units) from ${bomb.length} compressed bytes (${ratio}x expansion) in ${ms.toFixed(1)}ms ` +
        `— no maxOutputLength budget enforced`,
    );
  });
});
