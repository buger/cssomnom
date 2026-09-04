/**
 * Reproducer for CRS-0001/C14 (requirement SW-REQ-260822-QKE9, src/MediaParser.ts).
 * parseResolutionToDpi (and parseLengthToPx) return null whenever simplify()
 * does not produce a CSSUnitValue. A calc containing sign() never simplifies
 * to a CSSUnitValue, so every sign()-bearing media feature value evaluates
 * unknown. WPT css/mediaqueries/mq-calc-sign-function-001/002.html require
 * (width > calc(... sign ...)) to evaluate. The claim's mixed-unit examples
 * (calc(1x + 1dppx)) fold correctly; sign() products are the live form of the
 * claimed mechanism.
 * Asserts the intended contract so this command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { MediaParser } from '../../src/MediaParser.ts';

test('CRS-0001/C14: sign()-bearing calc in feature values simplifies and evaluates (WPT mq-calc-sign-function)', () => {
  // sign(16px - 1rem) is sign(0) = 0, so the bound is 1px and width 800 matches.
  assert.equal(
    MediaParser.evaluate('(width > calc(1px * (1 + sign(16px - 1rem))))'),
    true,
    'WPT mq-calc-sign-function-001 expects this query to match',
  );
  // sign(15px - 1rem) is sign(-1px) = -1, so the bound is 1px and width 800 matches.
  assert.equal(
    MediaParser.evaluate('(width > calc(-1px * sign(15px - 1rem)))'),
    true,
    'WPT mq-calc-sign-function-002 expects this query to match',
  );
  // sign(17px - 1rem) is 1, so 0.5x is 48dpi and env 96dpi satisfies min-resolution.
  assert.equal(
    MediaParser.evaluate('(min-resolution: calc(sign(17px - 1rem) * 0.5x))'),
    true,
    'sign product must simplify to 48dpi and satisfy min-resolution against env 96dpi',
  );
});
