/**
 * Reproducer for CRS-0020/C03, C04, C16, C22 (src/SelectorParser.ts
 * consumeClassSelector, src/matcher.ts matchSimpleSelector/matches).
 * selectors-4 #class-selector: <class-selector> = '.' <ident-token>, so '.'
 * without an ident invalidates the whole selector list. The parser returns an
 * empty-name class selector and consumes the following token, so '.' matches
 * every element (split fallback includes ''), '.>' matches everything after
 * swallowing the combinator, and a real DOMTokenList makes matches() throw
 * SyntaxError from contains('') instead of returning the empty match.
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
    `selectors-4: ${JSON.stringify(selector)} must not parse (class selector needs an ident)`
  );
};

test('CRS-0020/C03: "." does not parse as an empty-name class selector', () => {
  mustReject('.');
});

test('CRS-0020/C16: ".>" and ".#" do not parse', () => {
  mustReject('.>');
  mustReject('.#');
});

test('CRS-0020/C04+C22: matches() returns false for "." instead of matching or throwing', () => {
  const plain = el({ localName: 'div' });
  assert.equal(matches(plain, '.'), false, 'an invalid selector yields the empty match');
  const viaClassAttr = el({ localName: 'div', className: ' foo' });
  assert.equal(matches(viaClassAttr, '.'), false, 'the split fallback must not include the empty token');
  const emptyClass = el({ localName: 'div', className: '' });
  assert.equal(matches(emptyClass, '.'), false);
  const withTokenList = el({
    localName: 'div',
    className: 'foo',
    classList: {
      contains(cls: string) {
        if (cls === '') throw new DOMException('The token provided must not be empty.', 'SyntaxError');
        return cls === 'foo';
      },
    },
  });
  assert.equal(matches(withTokenList, '.'), false, 'DOMTokenList.contains("") must never be reached');
});

test('control: a well-formed class selector still matches', () => {
  const node = el({ localName: 'div', className: 'foo bar' });
  assert.equal(matches(node, '.foo'), true);
  assert.equal(matches(node, '.foo.bar'), true);
});
