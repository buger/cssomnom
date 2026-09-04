/**
 * Reproducer for CRS-0014/C14 (requirement SW-REQ-260821-2Z0N session packet
 * src/parser-api.ts sourceToString).
 *
 * sourceToString takes a reader from the incoming ReadableStream and never
 * releases it (no try/finally, no releaseLock, no cancel). When a read()
 * rejects, the stream stays locked, so a later getReader() on the same stream
 * throws "Invalid state: ReadableStream is locked". Streams spec 4.3.4
 * (releaseLock) and the general reader contract require the consumer to
 * release the lock once it stops reading.
 *
 * Asserts the intended contract, so this command FAILS while the hole exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStylesheet } from '../../src/parser-api.ts';

function failingStream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('div {'));
      controller.error(new Error('boom'));
    },
  });
}

test('CRS-0014/C14: a failed stream read releases the reader lock', async () => {
  const stream = failingStream();
  await assert.rejects(() => parseStylesheet(stream), /boom/);
  assert.doesNotThrow(() => stream.getReader(), 'the reader lock must be released when sourceToString stops reading');
});

// control: a healthy stream still parses end to end.
test('control: a healthy stream parses', async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode('a { color: red }'));
      c.close();
    },
  });
  const rules = await parseStylesheet(stream);
  assert.ok(Array.isArray(rules));
  assert.equal(rules.length, 1);
});
