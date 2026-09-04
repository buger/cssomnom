/**
 * Reproducer for CRS-0020/C05, C06, C07 (src/SelectorParser.ts
 * consumeAttributeSelector). selectors-4 #attribute-selector requires a value
 * after every <attr-matcher> and allows an <attr-modifier> only after that
 * value; <attr-matcher> is exactly [ '~' | '|' | '^' | '$' | '*' ]? '='.
 * '[attr=]', '[foo i]', and '[attr==x]' are therefore invalid selectors, but
 * the parser accepts all three (any delim becomes an operator; 'i' is stored
 * even with no matcher).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matches } from '../../src/matcher.ts';
import { tokenize } from '../../src/tokenizer.ts';
import { Parser } from '../../src/parser.ts';
import { SelectorParser } from '../../src/SelectorParser.ts';

const el = (props: Record<string, unknown>) => ({ nodeType: 1, children: [], ...props });

const mustReject = (selector: string) => {
  const tokens = tokenize(selector);
  const componentValues = new Parser(tokens).parseComponentValues();
  assert.throws(
    () => new SelectorParser(componentValues, { allowRelative: false, forgiving: false }).parse(),
    undefined,
    `selectors-4 #attribute-selector: ${JSON.stringify(selector)} must not parse`
  );
};

test('CRS-0020/C05: "[attr=]" (matcher without value) is rejected', () => {
  mustReject('[attr=]');
});

test('CRS-0020/C06: "[foo i]" (modifier without matcher) is rejected', () => {
  mustReject('[foo i]');
});

test('CRS-0020/C07: non-matcher delims like "==" and lone "~" are rejected', () => {
  mustReject('[attr==x]');
  mustReject('[attr~x]');
});

test('CRS-0020/C05+C06 matcher-level: bad attribute selectors yield the empty match', () => {
  const emptyAttr = el({
    localName: 'div',
    hasAttribute: (n: string) => n === 'attr',
    getAttribute: () => '',
  });
  assert.equal(matches(emptyAttr, '[attr=]'), false, 'matcher without value must not match empty attribute values');
  const flagged = el({
    localName: 'div',
    hasAttribute: (n: string) => n === 'foo',
    getAttribute: () => 'x',
  });
  assert.equal(matches(flagged, '[foo i]'), false, 'a bare modifier must not degrade to a presence test');
});

test('control: valid attribute selectors still parse and match', () => {
  const node = el({
    localName: 'div',
    hasAttribute: (n: string) => n === 'class',
    getAttribute: () => 'foo bar',
  });
  assert.equal(matches(node, '[class~=bar]'), true);
  assert.equal(matches(node, '[class="foo bar"]'), true);
  assert.equal(matches(node, '[class="FOO BAR" i]'), true);
});
