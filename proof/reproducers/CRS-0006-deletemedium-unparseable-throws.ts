/**
 * Reproducer for CRS-0006/C09 (requirement INT-REQ-260821-MZW3, src/CSSOM.ts
 * MediaList.deleteMedium). cssom-1 #dom-medialist-deletemedium runs:
 * "Let m be the result of parsing the given value. If m is null, then return.
 * Remove any media query ... for which comparing ... returns true. If nothing
 * was removed, throw a NotFoundError DOMException."
 * deleteMedium parses its argument with the media query LIST parser
 * (MediaParser.parse) and throws NotFoundError whenever the list length is
 * not 1, before ever comparing. An argument that cannot parse as a single
 * <media-query> (empty string, comma-separated list) yields m = null, so the
 * method must return silently. It currently throws NotFoundError.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { MediaList } from '../../src/CSSOM.ts';

test('CRS-0006/C09: deleteMedium with a comma-separated list returns silently', () => {
  const media = new MediaList('screen');
  media.deleteMedium('screen, print');
  assert.equal(media.length, 1, 'a null parse must not throw nor mutate');
  assert.equal(media.mediaText, 'screen');
});

test('CRS-0006/C09: deleteMedium with an empty string returns silently', () => {
  const media = new MediaList('screen');
  media.deleteMedium('');
  assert.equal(media.length, 1, "'' parses to null, not to a comparable medium");
  assert.equal(media.mediaText, 'screen');
});

test('control: deleteMedium still throws NotFoundError for a parseable, absent medium', () => {
  const media = new MediaList('screen');
  assert.throws(() => media.deleteMedium('print'), (e: Error) => (e as DOMException).name === 'NotFoundError');
  assert.equal(media.mediaText, 'screen');
});

test('control: deleteMedium still removes a present medium', () => {
  const media = new MediaList('screen, print');
  media.deleteMedium('print');
  assert.equal(media.mediaText, 'screen');
});
