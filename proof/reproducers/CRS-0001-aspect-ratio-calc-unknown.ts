/**
 * Reproducer for CRS-0001/C05 (requirement SW-REQ-260822-QKE9, src/MediaParser.ts).
 * isValidRatioOperand admits math functions with a number type as ratio
 * operands, but parseRatio only accepts number tokens, so
 * (aspect-ratio: calc(4) / calc(3)) evaluates unknown instead of comparing.
 * WPT css/mediaqueries/mq-calc-008.html requires calc() ratio operands to
 * evaluate (aspect-ratio > calc(...) / calc(...)).
 * Asserts the intended contract so this command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { MediaParser } from '../../src/MediaParser.ts';

test('CRS-0001/C05: calc() ratio operands in aspect-ratio evaluate (WPT mq-calc-008)', () => {
  // Default environment 800x600 is the ratio 4/3, so calc(4) / calc(3) matches.
  assert.equal(
    MediaParser.evaluate('(aspect-ratio: calc(4) / calc(3))'),
    true,
    'calc(4)/calc(3) must equal the 800/600 viewport ratio',
  );
  assert.equal(
    MediaParser.evaluate('(min-aspect-ratio: calc(4) / calc(3))'),
    true,
    'min-aspect-ratio must compare the calc ratio as 4/3',
  );
  assert.equal(
    MediaParser.evaluate('(aspect-ratio: calc(16) / calc(9))'),
    false,
    'calc(16)/calc(9) must not equal the 800/600 viewport ratio',
  );
});
