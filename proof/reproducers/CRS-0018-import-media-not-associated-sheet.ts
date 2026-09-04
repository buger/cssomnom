/**
 * Reproducer for CRS-0018/C07 (src/CSSOM.ts CSSImportRule.media / styleSheet).
 * cssom-1 #dom-cssimportrule-media: "The media attribute must return the value
 * of the media attribute of the associated CSS style sheet." The implementation
 * builds a private MediaList in the constructor and never syncs it with the
 * associated sheet, so the two lists diverge and are distinct objects.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import type {} from '../../src/CSSOM.ts';

test('CRS-0018/C07: import rule media mirrors the associated sheet media', () => {
  const sheet = parse('@import url("a.css") print;') as unknown as {
    cssRules: {
      media: { mediaText: string };
      styleSheet: { media: { mediaText: string } };
    }[];
  };
  const rule = sheet.cssRules[0];
  assert.ok(rule, 'the @import rule must parse');
  assert.equal(
    rule.styleSheet.media.mediaText,
    'print',
    'cssom-1: CSSImportRule.media must return the associated sheet media, so both must read "print"'
  );
});

test('CRS-0018/C07: rule.media is the associated sheet media object ([SameObject])', () => {
  const sheet = parse('@import url("a.css") screen;') as unknown as {
    cssRules: {
      media: unknown;
      styleSheet: { media: unknown };
    }[];
  };
  const rule = sheet.cssRules[0];
  assert.ok(rule, 'the @import rule must parse');
  assert.ok(
    rule.media === rule.styleSheet.media,
    'cssom-1: CSSImportRule.media must be the associated sheet media, not a second list'
  );
});

test('control: valid import parses with media on the rule', () => {
  const sheet = parse('@import url("a.css") print;') as unknown as {
    cssRules: { href: string; media: { mediaText: string } }[];
  };
  assert.equal(sheet.cssRules[0].href, 'a.css');
  assert.equal(sheet.cssRules[0].media.mediaText, 'print');
});
