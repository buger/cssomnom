/**
 * Reproducer for CRS-0020/C19 (src/matcher.ts matchAttributeSelector).
 * selectors-4 #attrnmsp: "[*|attr]" matches an attribute named attr in ANY
 * namespace (including none); "[ns|attr]" matches the attribute in the
 * namespace the prefix ns is declared to be. The matcher only special-cases
 * namespace '' (null namespace) and otherwise calls the un-namespaced
 * hasAttribute(), so [*|href] misses attributes that exist only in a real
 * namespace and the parsed prefix is never resolved at all.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matches } from '../../src/matcher.ts';

const XLINK = 'http://www.w3.org/1999/xlink';

const el = (props: Record<string, unknown>) => ({ nodeType: 1, children: [], ...props });

const svgAnchor = el({
  localName: 'a',
  namespaceURI: 'http://www.w3.org/2000/svg',
  hasAttribute: (n: string) => n === 'role',
  hasAttributeNS: (ns: string | null, n: string) => n === 'href' && ns === XLINK,
  getAttribute: (n: string) => (n === 'role' ? 'link' : null),
  getAttributeNS: (ns: string | null, n: string) => (n === 'href' && ns === XLINK ? 't' : null),
});

test('CRS-0020/C19: [*|href] matches a namespaced-only attribute', () => {
  assert.equal(
    matches(svgAnchor, '[*|href]'),
    true,
    'selectors-4 #attrnmsp: the any-namespace form must see the xlink:href attribute'
  );
});

test('CRS-0020/C19: [href] does not match the namespaced-only attribute', () => {
  assert.equal(matches(svgAnchor, '[href]'), false, 'the default-namespace form sees no un-namespaced href');
});

test('CRS-0020/C19: [*|role] still matches the un-namespaced attribute', () => {
  assert.equal(matches(svgAnchor, '[*|role]'), true);
});

test('control: value comparisons through the namespace form work', () => {
  assert.equal(matches(svgAnchor, '[*|href=t]'), true);
  assert.equal(matches(svgAnchor, '[*|href=u]'), false);
});
