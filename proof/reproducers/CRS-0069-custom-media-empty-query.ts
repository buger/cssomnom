/**
 * Reproducer for CRS-0069/C40: @custom-media with no query fabricates a
 * rule carrying an empty MediaList.
 *
 * mediaqueries-5 § 2.3 #custom-mq defines
 * '@custom-media = @custom-media <extension-name> [ <media-query-list> | true | false ] ;'
 * — the query alternative is mandatory. handleCustomMediaRule's empty arm
 * builds MediaList('') directly (src/parser.ts:892-893), bypassing the
 * validation the non-empty arm performs. '@custom-media --foo;' must be
 * dropped like any invalid at-rule.
 *
 * Reproduces: CRS-0069 @custom-media empty query
 * Verifies: SYS-REQ-260821-7521
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSSStyleSheet } from '../../src/CSSOM.ts';

test('control: @custom-media with a real query list is kept', () => {
  const sheet = parse('@custom-media --wide screen and (min-width: 100px);') as CSSStyleSheet;
  assert.equal(sheet.cssRules.length, 1);
});

test('control: @custom-media with true is kept', () => {
  const sheet = parse('@custom-media --ok true;') as CSSStyleSheet;
  assert.equal(sheet.cssRules.length, 1);
});

test('CRS-0069/C40: @custom-media with no query is dropped, not fabricated', () => {
  const sheet = parse('@custom-media --foo;') as CSSStyleSheet;
  assert.equal(
    sheet.cssRules.length,
    0,
    `mediaqueries-5 #custom-mq requires the query alternative; got ${sheet.cssRules.length} rule(s) with mediaText ${JSON.stringify((sheet.cssRules[0] as unknown as { media?: { mediaText: string } } | undefined)?.media?.mediaText ?? '""')}`,
  );
});
