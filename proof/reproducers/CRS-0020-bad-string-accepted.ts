/**
 * Reproducer for CRS-0020/C08, C21 (src/SelectorParser.ts isStringToken).
 * css-syntax-3 #consume-a-string-token emits a <bad-string-token> for an
 * unterminated string; a bad-string is not a <string-token>, so selectors-4
 * grammars that require <string-token> ('[attr="..."]', :lang() string
 * arguments) must fail to parse. isStringToken accepts type 'bad-string'
 * explicitly, so '[attr="unclosed]' and ':lang("en)' parse.
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
    `css-syntax-3: an unterminated string is a <bad-string-token>, so ${JSON.stringify(selector)} must not parse`
  );
};

test('CRS-0020/C08: "[attr=\"unclosed]" is rejected (bad-string value)', () => {
  mustReject('[attr="unclosed]');
});

test('CRS-0020/C21: ":lang(\"en)" is rejected (bad-string argument)', () => {
  mustReject(':lang("en)');
});

test('matcher-level: bad-string selectors yield the empty match', () => {
  const node = el({
    localName: 'div',
    hasAttribute: (n: string) => n === 'attr',
    getAttribute: () => 'unclosed',
  });
  assert.equal(matches(node, '[attr="unclosed]'), false, 'a bad-string selector must not match');
});

test('control: closed strings parse and match', () => {
  const node = el({
    localName: 'div',
    hasAttribute: (n: string) => n === 'attr',
    getAttribute: () => 'unclosed',
  });
  assert.equal(matches(node, '[attr="unclosed"]'), true);
});
