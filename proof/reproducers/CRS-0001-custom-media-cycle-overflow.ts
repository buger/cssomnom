/**
 * Reproducer for CRS-0001/C19 (requirement SW-REQ-260822-QKE9, src/MediaParser.ts).
 * evaluateMediaFeature re-parses custom media string values and re-evaluates
 * them against the same environment without a visited set, so a custom media
 * entry that references itself (or a mutual pair) recurses until the JS stack
 * overflows and a raw RangeError escapes MediaParser.evaluate.
 * mediaqueries-5 #custom-mq requires loops to fail to be defined, so the
 * feature must evaluate unknown and the query must not match, without throwing.
 * Asserts the intended contract so this command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { MediaParser } from '../../src/MediaParser.ts';

test('CRS-0001/C19: custom media cycles fail closed without recursion', () => {
  const selfLoop = { customMedia: new Map([['--loop', '(--loop)']]) };
  assert.equal(
    MediaParser.evaluate('(--loop)', selfLoop),
    false,
    'a self-referencing custom media query must be undefined, so the query must not match',
  );
  const mutual = { customMedia: new Map([['--a', '(--b)'], ['--b', '(--a)']]) };
  assert.equal(
    MediaParser.evaluate('(--a)', mutual),
    false,
    'a mutual custom media cycle must be undefined, so the query must not match',
  );
});
