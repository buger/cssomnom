/**
 * Reproducer for CRS-0051 (requirement SYS-REQ-260821-5283, src/CSSOM.ts / src/MediaParser.ts).
 * mediaqueries-4 § 3.2 #error-handling: a <media-query> whose value is unknown
 * (unknown mf-name, unknown mf-value, or general-enclosed) must be replaced
 * with "not all" when the media query list is parsed. MediaParser never folds
 * unknown queries, so every CSSOM media surface leaks the original feature
 * text: MediaList.mediaText / item() / iterator / toString, the appendMedium
 * duplicate comparison, the deleteMedium lookup, CSSMediaRule.cssText and
 * conditionText, CSSImportRule.cssText, and CSSStyleSheet media.
 * Asserts the intended contract so this command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { parse } from '../../src/parser.ts';
import { MediaList, CSSStyleSheet, CSSMediaRule, CSSImportRule } from '../../src/CSSOM.ts';

test('CRS-0051: MediaList surfaces serialize an unknown feature as not all', () => {
  const ml = new MediaList('(max-weight: 3kg)');
  assert.equal(
    ml.mediaText,
    'not all',
    'mediaqueries-4 § 3.2: a query with an unknown mf-value must fold to not all',
  );
  assert.equal(String(ml), 'not all', 'the MediaList stringifier is mediaText');
  assert.equal(ml.item(0), 'not all', 'item() serializes the folded query');
  assert.deepEqual([...ml], ['not all'], 'the iterator serializes the folded query');
});

test('CRS-0051: the mediaText setter stores folded queries', () => {
  const ml = new MediaList();
  ml.mediaText = 'screen and (max-weight: 3kg) and (color), (color)';
  assert.equal(
    ml.mediaText,
    'not all, (color)',
    'the exact list example from mediaqueries-4 § 3.2 #error-handling',
  );
  ml.mediaText = '(min-orientation: portrait)';
  assert.equal(ml.mediaText, 'not all', 'an unknown mf-name query must fold to not all');
});

test('CRS-0051: general-enclosed queries fold to not all', () => {
  assert.equal(
    new MediaList('(example, all)').mediaText,
    'not all',
    'general-enclosed evaluates unknown, so the query must fold',
  );
  assert.equal(
    new MediaList('unknown()').mediaText,
    'not all',
    'a general-enclosed function form evaluates unknown',
  );
});

test('CRS-0051: appendMedium compares folded queries so two unknowns dedupe', () => {
  const ml = new MediaList();
  ml.appendMedium('(foo)');
  ml.appendMedium('(bar)');
  assert.equal(
    ml.length,
    1,
    'both parse to not all, so the second is a duplicate per cssom-1 #dom-medialist-appendmedium',
  );
  assert.equal(ml.mediaText, 'not all');
});

test('CRS-0051: deleteMedium matches a folded unknown query', () => {
  const ml = new MediaList('not all');
  ml.deleteMedium('(max-weight: 3kg)');
  assert.equal(
    ml.length,
    0,
    'parsing (max-weight: 3kg) yields not all, which compares equal to the stored query',
  );
});

test('CRS-0051: @media cssText and conditionText serialize not all', () => {
  const sheet = parse('@media (max-weight: 3kg) { a { color: red } }');
  const rule = sheet.cssRules[0] as CSSMediaRule;
  assert.equal(rule.conditionText, 'not all', 'conditionText is the serialized media condition');
  assert.ok(
    rule.cssText.startsWith('@media not all'),
    `cssText must serialize the folded condition, got ${JSON.stringify(rule.cssText)}`,
  );
});

test('CRS-0051: @import cssText serializes not all media', () => {
  const ir = new CSSImportRule('x.css', '(max-weight: 3kg)');
  assert.equal(
    ir.cssText,
    '@import url("x.css") not all;',
    'cssom-1 #serialize-a-css-rule: the media condition is the folded query list',
  );
});

test('CRS-0051: stylesheet media surfaces serialize not all', () => {
  const sheet = new CSSStyleSheet({ media: '(max-weight: 3kg)' });
  assert.equal(sheet.media.mediaText, 'not all', 'the constructed-sheet media option must fold');
  sheet.media = '(min-orientation: portrait)';
  assert.equal(sheet.media.mediaText, 'not all', 'the media setter path must fold');
});
