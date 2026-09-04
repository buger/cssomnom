/**
 * Reproducer for CRS-0020/C01, C02, C25 (src/matcher.ts parseSelector,
 * matchComplexRecursive). DOM Standard matches()/querySelectorAll() parse a
 * selector, not a relative selector: a leading combinator is invalid there
 * (browsers throw SyntaxError). matcher.parseSelector constructs
 * SelectorParser with allowRelative: true, and matchComplexRecursive treats a
 * leading combinator without a scope element as an automatic match, so
 * "> div" returns non-empty results instead of the empty match this engine's
 * documented posture requires (KI-134 records silent-empty, not match-all).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matches, querySelectorAll } from '../../src/matcher.ts';

const el = (props: Record<string, unknown>) => ({ nodeType: 1, children: [], ...props });
const div = el({ localName: 'div', tagName: 'DIV' });
const span = el({ localName: 'span' });
const doc = { nodeType: 9, children: [div, span] };

test('CRS-0020/C01+C02: matches() rejects a leading combinator (empty match)', () => {
  assert.equal(matches(div, '> div'), false, 'a top-level relative selector must not match');
  assert.equal(matches(div, '+ div'), false);
  assert.equal(matches(div, '~ div'), false);
});

test('CRS-0020/C25: querySelectorAll on a document root returns empty for "> div"', () => {
  assert.equal(
    querySelectorAll(doc, '> div').length,
    0,
    'bad selector + parse_selector_rejects must yield empty_match (SW-REQ-260821-6D9T)'
  );
  assert.equal(querySelectorAll(doc, '+ .x').length, 0);
});

test('CRS-0020/C02: the leading-combinator no-scope shortcut cannot match', () => {
  // matchComplexRecursive returns true whenever items[0] is a combinator and
  // scope is undefined; assert a div NOT reachable via ">" from any scope still
  // does not match.
  const orphan = el({ localName: 'div' });
  assert.equal(matches(orphan, '> div'), false);
});

test('control: descendant/child selectors still match', () => {
  const child = el({ localName: 'div' });
  const parent = el({ localName: 'section', children: [child] });
  child.parentElement = parent;
  assert.equal(matches(child, 'section > div'), true);
  assert.equal(querySelectorAll(doc, 'div').length, 1);
});
