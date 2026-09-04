/**
 * Reproducer for CRS-0020/C23 (src/matcher.ts isHTMLCaseInsensitiveAttribute).
 * html #case-sensitivity-of-selectors requires attribute selectors on HTML
 * elements to compare values ASCII case-insensitively for 45 listed
 * attributes (accept, align, bgcolor, checked, dir, disabled, lang, media,
 * method, rel, target, type, valign, ...). The helper returns true only for
 * input[type], so [method=get] misses form method="GET" and similar pairs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matches } from '../../src/matcher.ts';

const el = (props: Record<string, unknown>) => ({ nodeType: 1, children: [], ...props });

const form = el({
  localName: 'form',
  hasAttribute: (n: string) => n === 'method',
  getAttribute: () => 'GET',
});

const link = el({
  localName: 'a',
  hasAttribute: (n: string) => n === 'hreflang',
  getAttribute: () => 'EN',
});

const table = el({
  localName: 'td',
  hasAttribute: (n: string) => n === 'valign',
  getAttribute: () => 'TOP',
});

test('CRS-0020/C23: [method=get] matches form method="GET"', () => {
  assert.equal(matches(form, '[method=get]'), true, 'html lists method as an ASCII case-insensitive value');
});

test('CRS-0020/C23: [hreflang=en] matches hreflang="EN"', () => {
  assert.equal(matches(link, '[hreflang=en]'), true);
});

test('CRS-0020/C23: [valign=top] matches valign="TOP"', () => {
  assert.equal(matches(table, '[valign=top]'), true);
});

test('control: input[type] stays case-insensitive and the s flag stays sensitive', () => {
  const input = el({
    localName: 'input',
    hasAttribute: (n: string) => n === 'type',
    getAttribute: () => 'CHECKBOX',
  });
  assert.equal(matches(input, '[type=checkbox]'), true);
  assert.equal(matches(input, '[type=checkbox s]'), false);
});

test('control: unlisted attributes stay case-sensitive', () => {
  const div = el({
    localName: 'div',
    hasAttribute: (n: string) => n === 'data-x',
    getAttribute: () => 'Foo',
  });
  assert.equal(matches(div, '[data-x=foo]'), false);
});
