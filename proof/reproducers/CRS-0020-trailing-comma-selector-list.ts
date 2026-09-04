/**
 * Reproducer for CRS-0020/C09 (src/SelectorParser.ts SelectorParser.parse).
 * selectors-4 #grouping: a selector list is invalid if any selector in it is
 * invalid; the empty selector after a trailing comma invalidates the list
 * (document.querySelector('div,') throws SyntaxError). parse() pushes the
 * selector before the trailing comma and exits the loop without noticing the
 * dangling separator, so matches()/querySelectorAll() return the preceding
 * selectors instead of the empty match. Sibling of KI-172, which pins the
 * same acceptance on the stylesheet rule path (normalizeNestedSelector).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matches, querySelectorAll } from '../../src/matcher.ts';
import { tokenize } from '../../src/tokenizer.ts';
import { Parser } from '../../src/parser.ts';
import { SelectorParser } from '../../src/SelectorParser.ts';

const el = (props: Record<string, unknown>) => ({ nodeType: 1, children: [], ...props });
const div = el({ localName: 'div' });
const span = el({ localName: 'span' });
const doc = { nodeType: 9, children: [div, span] };

test('CRS-0020/C09: SelectorParser.parse rejects a trailing comma', () => {
  const tokens = tokenize('div,');
  const componentValues = new Parser(tokens).parseComponentValues();
  assert.throws(
    () => new SelectorParser(componentValues, { allowRelative: false, forgiving: false }).parse(),
    undefined,
    'selectors-4 #grouping: the empty selector after the comma invalidates the list'
  );
});

test('CRS-0020/C09: matches() returns false for "div,"', () => {
  assert.equal(matches(div, 'div,'), false);
});

test('CRS-0020/C09: querySelectorAll returns empty for "a, b,"', () => {
  assert.equal(querySelectorAll(doc, 'a, b,').length, 0, 'empty_match for the invalid list');
});

test('control: a proper selector list still matches', () => {
  assert.equal(querySelectorAll(doc, 'div, span').length, 2);
  assert.equal(matches(div, 'div, span'), true);
});
