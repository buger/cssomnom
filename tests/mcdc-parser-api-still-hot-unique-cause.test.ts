/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Verifies: SYS-REQ-260821-NGJH, SYS-REQ-260821-KA02, SYS-REQ-260821-SMW6, SYS-REQ-260821-RAAM, SW-REQ-260821-MZ8P, SW-REQ-260821-2Z0N, SW-REQ-260821-HW77, SW-REQ-260821-3553, INT-REQ-260821-WTPD, INT-REQ-260821-ZP03
// Still-hot unique-cause for src/parser-api.ts leftovers that
// tests/parser-api.test.ts, tests/mcdc-parser-api-toparser.test.ts, and
// tests/mcdc-witness-parser-api.test.ts do not isolate:
// evaluateSupportsDeclaration / evalSupportsInParens /
// evalSupportsConditionValues / hasVarFunction, toParserValue commas and
// blocks, atRulePartsFromCssText skip, toParserRule type 17 / Array.isArray /
// typeof object, cssomAtRuleFromFields conditionText / childRules,
// parseCommaValueListSync whitespace, parseDeclarationSync /
// parseComponentValueSync empty, CSSParserBlock/AtRule toString,
// sourceToString ReadableStream.
// Drive CSS.supports / CSS.parse* / toParserRule.
// css-conditional-3 § 3 #at-supports / § 6 #dom-css-supports,
// css-syntax-3 § 5.4.10 #parse-comma-separated-list-of-component-values /
// § 5.5.8 #consume-a-component-value / § 5.4.5 #consume-a-declaration,
// cssom-1 § 6.4 #the-cssrule-interface, WICG css-parser-api.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CSS,
  CSSParserAtRule,
  CSSParserBlock,
  CSSParserDeclaration,
  CSSParserFunction,
  CSSParserQualifiedRule,
  CSSParserRule,
  CSSParserToken,
  parseCommaValueListSync,
  parseComponentValue,
  parseDeclaration,
  parseDeclarationList,
  parseRuleListSync,
  toParserRule,
} from '../src/parser-api.ts';
import { parseRule } from '../src/parser.ts';
import { CSSAtRule, CSSStyleRule, CSSSupportsRule } from '../src/CSSOM.ts';

function asAt(rule: CSSParserRule | null): CSSParserAtRule {
  assert.ok(rule instanceof CSSParserAtRule);
  return rule;
}

function asDecl(rule: CSSParserRule | null): CSSParserDeclaration {
  assert.ok(rule instanceof CSSParserDeclaration);
  return rule;
}

function asFn(value: unknown): CSSParserFunction {
  assert.ok(value instanceof CSSParserFunction);
  return value;
}

function asBlock(value: unknown): CSSParserBlock {
  assert.ok(value instanceof CSSParserBlock);
  return value;
}

function isRawParserRule(rule: CSSParserRule): boolean {
  return (
    rule instanceof CSSParserRule &&
    !(rule instanceof CSSParserAtRule) &&
    !(rule instanceof CSSParserQualifiedRule) &&
    !(rule instanceof CSSParserDeclaration)
  );
}

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function streamOf(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

describe('MC/DC still-hot unique-cause: evaluateSupportsDeclaration (CSS.supports two-arg)', () => {
  test('property === "" vs "--" vs dashed-ident vs unicode-range vs unsupported', () => {
    // css-conditional-3 § 6 #dom-css-supports two-arg form.
    // L527 property === '' T (-- F) vs '' F / '--' T vs both F.
    assert.equal(CSS.supports('', 'red'), false);
    assert.equal(CSS.supports('  ', 'red'), false);
    assert.equal(CSS.supports('--', '1'), false);
    // L530 !isValidDashedIdent T: whitespace in a --name (css-variables-1 #defining-variables).
    assert.equal(CSS.supports('--foo bar', '1'), false);
    assert.equal(CSS.supports('--ok', '1'), true);
    // L537 prop === 'unicode-range' T vs F. Mixed-case lowercases first.
    assert.equal(CSS.supports('unicode-range', 'U+0-7F'), false);
    assert.equal(CSS.supports('UNICODE-RANGE', 'U+0-7F'), false);
    assert.equal(CSS.supports('not-a-prop', '1'), false);
    assert.equal(CSS.supports('color', 'red'), true);
  });

  test('bad-string / bad-url vs var() vs css-wide ident vs syntax vs shorthand vs no-syntax', () => {
    // L543 tokens.some(bad-string|bad-url) T: css-syntax-3 #consume-string-token / #consume-url-token.
    assert.equal(CSS.supports('content', '"foo\nbar"'), false);
    assert.equal(CSS.supports('background-image', 'url(foo"bar)'), false);
    assert.equal(CSS.supports('background-image', 'url(a b)'), false);
    // L549 hasVarFunction T vs F (css-variables-1 #using-variables).
    assert.equal(CSS.supports('color', 'var(--x)'), true);
    assert.equal(CSS.supports('color', 'rgb(var(--x), 0, 0)'), true);
    assert.equal(CSS.supports('color', 'rgb(1, 2, 3)'), true);
    // L553 nonWs.length === 1 && type ident unique-cause, L555 includes css-wide.
    assert.equal(CSS.supports('color', 'inherit'), true);
    assert.equal(CSS.supports('color', 'initial'), true);
    assert.equal(CSS.supports('color', 'unset'), true);
    assert.equal(CSS.supports('color', 'revert'), true);
    assert.equal(CSS.supports('color', 'revert-layer'), true);
    assert.equal(CSS.supports('color', 'REVERT-RULE'), true);
    assert.equal(CSS.supports('color', 'red'), true);
    assert.equal(CSS.supports('color', 'red blue'), false);
    assert.equal(CSS.supports('color', '1px'), false);
    assert.equal(CSS.supports('color', ''), false);
    assert.equal(CSS.supports('color', '   '), false);
    // L561 shorthand T expand success vs null; F falls through to syntax.
    assert.equal(CSS.supports('margin', '1px'), true);
    assert.equal(CSS.supports('MARGIN', 'nope'), false);
    // L566 syntax T (generated <color>) vs F: -webkit-box-align is SUPPORTED_PROPERTIES
    // with no STANDARD_PROPERTIES_SYNTAX entry → return true even for garbage values
    // a real matcher would reject.
    assert.equal(CSS.supports('-webkit-box-align', 'not-a-real-value'), true);
    assert.equal(CSS.supports('-webkit-box-flex', 'garbage-xyz'), true);
    assert.equal(CSS.supports('color', 'notacolor'), false);
  });
});

describe('MC/DC still-hot unique-cause: hasVarFunction via CSS.supports', () => {
  test('function var T vs nested var vs function-not-var vs simple-block var vs ident', () => {
    // L509 v.type === 'function' T/F; L510 name === 'var' T/F; L513 recurse;
    // L517 simple-block && recurse unique-cause.
    assert.equal(CSS.supports('color', 'var(--x)'), true);
    assert.equal(CSS.supports('color', 'VAR(--x)'), true);
    assert.equal(CSS.supports('color', 'var(--x, red)'), true);
    assert.equal(CSS.supports('width', 'calc(var(--x) + 1px)'), true);
    assert.equal(CSS.supports('color', '(var(--x))'), true);
    assert.equal(CSS.supports('color', 'rgb(1, 2, 3)'), true);
    assert.equal(CSS.supports('width', 'calc(1px + 2px)'), true);
    assert.equal(CSS.supports('color', '(red)'), false);
    assert.equal(CSS.supports('color', 'red'), true);
  });
});

describe('MC/DC still-hot unique-cause: evalSupportsInParens / evalSupportsConditionValues', () => {
  test('selector() unique-cause of function name, empty, comma, valid, invalid, non-selector fn', () => {
    // css-conditional-4 #at-ruledef-supports selector() feature.
    // L574 type === function T / name === 'selector' T vs F; L577 empty; L578 comma.
    assert.equal(CSS.supports('selector(div)'), true);
    assert.equal(CSS.supports('SELECTOR(div)'), true);
    assert.equal(CSS.supports('selector(.foo > #bar)'), true);
    assert.equal(CSS.supports('selector()'), false);
    assert.equal(CSS.supports('selector(div, span)'), false);
    assert.equal(CSS.supports('foo(div)'), false);
    assert.equal(CSS.supports('calc(1)'), false);
    // L582 length !== 1 / invalid-selector: strictSupports parse throws (caught)
    // rather than returning a 0/2-selector list; comma is filtered before parse.
    assert.equal(CSS.supports('selector(::bogus)'), false);
    assert.equal(CSS.supports('selector(:is(::before))'), false);
  });

  test('paren-block unique-cause of associatedToken "(", nested block, hasTopLevelOp, colon/prop', () => {
    // L589 simple-block && value === '(' T vs square/curly F vs ident F.
    assert.equal(CSS.supports('(color: red)'), true);
    assert.equal(CSS.supports('[color: red]'), false);
    assert.equal(CSS.supports('{color: red}'), false);
    assert.equal(CSS.supports('color'), false);
    // L595 hasTopLevelOp T vs nested simple-block T vs length-1 ident F.
    assert.equal(CSS.supports('(not (color: red))'), false);
    assert.equal(CSS.supports('(not (color: nope))'), true);
    assert.equal(CSS.supports('((color: red))'), true);
    assert.equal(CSS.supports('(red)'), false);
    // L600 colonIdx > 0 T vs 0 / -1; L602 propValues length/ident unique-cause.
    assert.equal(CSS.supports('(: red)'), false);
    assert.equal(CSS.supports('(color red)'), false);
    assert.equal(CSS.supports('(color background: red)'), false);
    assert.equal(CSS.supports('(1px: red)'), false);
    assert.equal(CSS.supports('( /*c*/ color: red )'), true);
  });

  test('condition list unique-cause of empty, not, length 1/2, even, and/or/xor, mixed ops', () => {
    // css-conditional-3 § 3 #at-supports general-enclosed / condition grammar.
    // L617 items.length === 0: comment-only is non-empty after trim but filters to [].
    assert.equal(CSS.supports('/*c*/'), false);
    assert.equal(CSS.supports(''), false);
    assert.equal(CSS.supports('   '), false);
    // L619 ident && === 'not' unique-cause; L620 length === 2 T vs F.
    assert.equal(CSS.supports('not (color: red)'), false);
    assert.equal(CSS.supports('NOT (color: nope)'), true);
    assert.equal(CSS.supports('not'), false);
    assert.equal(CSS.supports('not (color: red) (color: blue)'), false);
    assert.equal(CSS.supports('and (color: red)'), false);
    // L626 length === 1 T: single in-parens. F falls through to and/or.
    assert.equal(CSS.supports('(color: red)'), true);
    assert.equal(CSS.supports('foo'), false);
    // L630 length % 2 === 0 T: two tokens that are not `not <in-parens>`.
    assert.equal(CSS.supports('foo bar'), false);
    assert.equal(CSS.supports('(color: red) and'), false);
    // L633 firstOp !== and && !== or: xor T,T; and F,*; or T,F.
    assert.equal(CSS.supports('(color: red) xor (display: grid)'), false);
    assert.equal(CSS.supports('(color: red) AND (display: grid)'), true);
    assert.equal(CSS.supports('(color: red) OR (color: nope)'), true);
    // L637 op !== firstOp T mixed vs F consistent; L645 firstOp === 'and' T vs F.
    assert.equal(CSS.supports('(color: red) and (display: grid) or (color: blue)'), false);
    assert.equal(CSS.supports('(color: red) and (display: grid) and (width: 1px)'), true);
    assert.equal(CSS.supports('(color: nope) and (color: red)'), false);
    assert.equal(CSS.supports('(color: nope) or (color: red)'), true);
    assert.equal(CSS.supports('(color: nope) or (display: nope) or (width: nope)'), false);
  });

  test('one-arg colon-declaration unique-cause of prop && val and declRes fall-through', () => {
    // L658 condition === '' after trim; L664 prop && val; L666 declRes T return vs F tokenize.
    assert.equal(CSS.supports('color: red'), true);
    assert.equal(CSS.supports('color: inherit'), true);
    assert.equal(CSS.supports(': red'), false);
    assert.equal(CSS.supports('color:'), false);
    assert.equal(CSS.supports('color:  '), false);
    assert.equal(CSS.supports(' : red'), false);
    assert.equal(CSS.supports('color: nope'), false);
  });
});

describe('MC/DC still-hot unique-cause: toParserValue / CSSParserBlock toString', () => {
  test('[] / {} / () blocks and nested function/block unique-cause of bracket ternary', () => {
    // L168 bracket === '[' / '{' / else; CSSParserBlock toString L82/L83 matching names.
    const square = asBlock(parseComponentValue('[a]'));
    assert.equal(square.name, '[]');
    assert.equal(square.toString(), '[a]');
    const curly = asBlock(parseComponentValue('{a}'));
    assert.equal(curly.name, '{}');
    assert.equal(curly.toString(), '{a}');
    const paren = asBlock(parseComponentValue('(a)'));
    assert.equal(paren.name, '()');
    assert.equal(paren.toString(), '(a)');
    // Nested block/function: toParserValue typeof res === 'string' F.
    const nestedBlock = asBlock(parseComponentValue('([a])'));
    assert.equal(nestedBlock.toString(), '([a])');
    const nestedFn = asBlock(parseComponentValue('(rgb(1))'));
    assert.equal(nestedFn.toString(), '(rgb(1))');
    assert.ok(nestedFn.body[0] instanceof CSSParserFunction);
  });

  test('function comma split unique-cause of "type" in v && type === comma', () => {
    // L180 public path: comma T splits args; comma F stays in the current group.
    const rgb = asFn(parseComponentValue('rgb(1, 2, 3)'));
    assert.equal(rgb.name, 'rgb');
    assert.equal(rgb.args.length, 3);
    assert.equal(asFn(parseComponentValue('rgb(1 2)')).args.length, 1);
    assert.equal(asFn(parseComponentValue('rgb()')).args.length, 1);
    assert.equal(asFn(parseComponentValue('rgb(1,)')).args.length, 2);
    assert.equal(asFn(parseComponentValue('rgb(,1)')).args.length, 2);
    // Declaration map L341 typeof res === 'string' T ident vs F function.
    assert.equal(asDecl(parseDeclaration('color: red')).body[0] instanceof CSSParserToken, true);
    assert.equal(asDecl(parseDeclaration('color: rgb(1, 2, 3)')).body[0] instanceof CSSParserFunction, true);
    assert.equal(asDecl(parseDeclaration('color: (red)')).body[0] instanceof CSSParserBlock, true);
    // Duck: "type" in v F (typeless object is not a comma) then a real comma.
    const duck = asDecl(toParserRule({
      type: 'declaration',
      name: 'color',
      value: [{
        type: 'function',
        name: 'rgb',
        value: [{ foo: 1 }, { type: 'comma' }, { type: 'ident', value: 'red' }],
      }],
    }));
    const duckFn = asFn(duck.body[0]);
    assert.equal(duckFn.args.length, 2);
    assert.equal(duck.toString(), 'color: rgb(, red);');
  });
});

describe('MC/DC still-hot unique-cause: parseCommaValueList / parseDeclaration / parseComponentValue empty', () => {
  test('comma-list unique-cause of start < length and end >= start whitespace walks', () => {
    // css-syntax-3 § 5.4.10. L479 leading ws; L481 trailing ws; empty segments.
    const trimmed = parseCommaValueListSync(' red , green ');
    assert.equal(trimmed.length, 2);
    assert.equal(trimmed[0].map(String).join(''), 'red');
    assert.equal(trimmed[1].map(String).join(''), 'green');
    const noWs = parseCommaValueListSync('red,green');
    assert.equal(noWs.length, 2);
    assert.equal(noWs[0][0].toString(), 'red');
    const trailing = parseCommaValueListSync('red,');
    assert.equal(trailing.length, 2);
    assert.deepEqual(trailing[1], []);
    const leading = parseCommaValueListSync(',red');
    assert.equal(leading.length, 2);
    assert.deepEqual(leading[0], []);
    const emptyMid = parseCommaValueListSync('red,   ,green');
    assert.equal(emptyMid.length, 3);
    assert.deepEqual(emptyMid[1], []);
    assert.equal(CSS.parseCommaValueList('red, green, blue').length, 3);
  });

  test('parseDeclaration / parseComponentValue unique-cause of empty vs one vs extra', () => {
    // L452 list.length > 0 F → null; T → first declaration.
    assert.equal(parseDeclaration(''), null);
    assert.equal(parseDeclaration('   '), null);
    assert.equal(parseDeclaration('/*c*/'), null);
    assert.equal(parseDeclaration(';'), null);
    assert.equal(asDecl(parseDeclaration('color: red')).name, 'color');
    assert.deepEqual(parseDeclarationList('').map(String), []);
    assert.deepEqual(parseDeclarationList('   ').map(String), []);
    const two = parseDeclarationList('color: red; width: 1px');
    assert.equal(two.length, 2);
    assert.equal(asDecl(two[0]).name, 'color');
    assert.equal(asDecl(two[1]).name, 'width');
    // L493 nonWsValues.length === 0 T → null; F then length > 1 throws.
    assert.equal(parseComponentValue(''), null);
    assert.equal(parseComponentValue('   '), null);
    assert.equal(parseComponentValue('/*c*/'), null);
    assert.equal(parseComponentValue('red')?.toString(), 'red');
    assert.throws(
      () => parseComponentValue('red blue'),
      (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError',
    );
  });
});

describe('MC/DC still-hot unique-cause: atRulePartsFromCssText leftover skip', () => {
  test('whitespace/comment skip unique-cause of i < length, comment vs ident, exhausted input', () => {
    // L218 while skip: whitespace T, comment T (whitespace F), both F stop;
    // i < length F after consuming all-ws / comment-only → L219 i >= length T → raw.
    assert.equal(isRawParserRule(toParserRule({ type: 0, cssText: '   ' })), true);
    assert.equal(isRawParserRule(toParserRule({ type: 0, cssText: '/*c*/' })), true);
    const commentOnly = asAt(toParserRule({ type: 0, cssText: '/*c*/@foo bar;' }));
    assert.equal(commentOnly.name, 'foo');
    assert.equal(commentOnly.prelude.map(String).join(''), 'bar');
    assert.equal(commentOnly.body, null);
    const wsThenComment = asAt(toParserRule({ type: 0, cssText: '  /*c*/ @foo;' }));
    assert.equal(wsThenComment.name, 'foo');
    const commentThenWs = asAt(toParserRule({ type: 0, cssText: '/*c*/  @foo;' }));
    assert.equal(commentThenWs.name, 'foo');
    // L224 for i < length F: @foo with no prelude/semi/block vs T prelude vs block.
    const noRest = asAt(toParserRule({ type: 0, cssText: '@foo' }));
    assert.equal(noRest.name, 'foo');
    assert.equal(noRest.body, null);
    const prelude = asAt(toParserRule({ type: 0, cssText: '@foo bar baz' }));
    // tokensToPrelude drops whitespace/comment, so the two idents concatenate.
    assert.equal(prelude.prelude.map(String).join(''), 'barbaz');
    assert.equal(prelude.body, null);
    const block = asAt(toParserRule({ type: 0, cssText: '@foo { .x { color: red } }' }));
    assert.ok(Array.isArray(block.body));
  });
});

describe('MC/DC still-hot unique-cause: toParserRule type 17 / Array.isArray / typeof object', () => {
  test('numeric type !== 17 F skips at-rule path; selectorText still qualifies', () => {
    // L315 typeof number T, type !== 1 T, type !== 17 F: no CSSRule subclass uses 17.
    assert.equal(isRawParserRule(toParserRule({ type: 17 })), true);
    const withText = asAt(toParserRule({ type: 18, cssText: '@property --x { syntax: "*"; inherits: false }' }));
    assert.equal(withText.name, 'property');
    // After skipping at-rule, L347 type === 1 F / style-rule F / object && selectorText T.
    const asStyle = toParserRule({ type: 17, selectorText: '.x' });
    assert.ok(asStyle instanceof CSSParserQualifiedRule);
    assert.equal((asStyle as CSSParserQualifiedRule).prelude.map(String).join(''), '.x');
  });

  test('typeof object F, Array.isArray T vs F fallback serialize', () => {
    // L347 typeof r === 'object' F: number/string are not objects (null throws on r.type).
    assert.equal(isRawParserRule(toParserRule(42)), true);
    assert.equal(isRawParserRule(toParserRule('div')), true);
    assert.equal(isRawParserRule(toParserRule({ foo: 1 })), true);
    // L359 Array.isArray T serializes the token list; F wraps a single component value.
    const fromArray = toParserRule([
      { type: 'ident', value: 'blue' },
      { type: 'whitespace', value: ' ' },
      { type: 'ident', value: 'red' },
    ]);
    assert.equal(fromArray.toString(), 'blue red');
    const fromIdent = toParserRule({ type: 'ident', value: 'blue' });
    assert.equal(fromIdent.toString(), 'blue');
  });
});

describe('MC/DC still-hot unique-cause: cssomAtRuleFromFields conditionText / childRules', () => {
  test('CSSSupportsRule empty vs filled conditionText; CSSAtRule childRules vs block vs statement', () => {
    // L270 r.conditionText F → prelude []; T → token.
    const empty = asAt(toParserRule(new CSSSupportsRule('', [], parseRule)));
    assert.equal(empty.name, 'supports');
    assert.equal(empty.prelude.length, 0);
    assert.ok(Array.isArray(empty.body));
    const filled = asAt(toParserRule(new CSSSupportsRule('(display: grid)', [], parseRule)));
    assert.equal(filled.prelude.map(String).join(''), '(display: grid)');
    // L276 r.childRules T maps nested rules; F with block → empty body; F no block → null.
    const nestedStyle = parseRule('.x { color: red }');
    assert.ok(nestedStyle instanceof CSSStyleRule);
    const withChildren = asAt(toParserRule(
      new CSSAtRule('foo', [], undefined, [nestedStyle]),
    ));
    assert.equal(withChildren.body?.length, 1);
    assert.ok(withChildren.body?.[0] instanceof CSSParserQualifiedRule);
    const withBlock = asAt(toParserRule(new CSSAtRule('foo', [], {
      type: 'simple-block',
      associatedToken: { type: '{', value: '{' },
      value: [],
    })));
    assert.deepEqual(withBlock.body, []);
    const statement = asAt(toParserRule(new CSSAtRule('foo', [])));
    assert.equal(statement.body, null);
    assert.equal(statement.toString(), '@foo;');
  });

  test('CSSParserAtRule / qualified / declaration toString unique-cause of body === null', () => {
    // L121 body === null → `@name;`; else `{body}`.
    const stmt = asAt(CSS.parseStylesheetSync('@layer;')[0]);
    assert.equal(stmt.body, null);
    assert.equal(stmt.toString(), '@layer;');
    const block = asAt(CSS.parseStylesheetSync('@layer {}')[0]);
    assert.ok(Array.isArray(block.body));
    assert.equal(block.toString(), '@layer{}');
    const style = CSS.parseStylesheetSync('.x { color: red }')[0];
    assert.ok(style instanceof CSSParserQualifiedRule);
    assert.equal(style.toString(), '.x{}');
    assert.equal(asDecl(parseDeclaration('color: red')).toString(), 'color: red;');
    const viaRule = asAt(CSS.parseRule('@media all { .x { color: red } }'));
    assert.equal(viaRule.name, 'media');
    assert.ok(Array.isArray(viaRule.body));
    assert.equal(viaRule.body.length, 1);
    assert.ok(viaRule.body[0] instanceof CSSParserQualifiedRule);
    assert.equal(viaRule.body[0].toString(), '.x{}');
    assert.equal(viaRule.toString(), '@mediaall{.x{}}');
  });
});

describe('MC/DC still-hot unique-cause: sourceToString ReadableStream / parseRuleList', () => {
  test('string vs empty stream vs multi-chunk vs empty-then-data', async () => {
    // L374 typeof source === 'string' T; F walks getReader until done.
    // while (true) F is structurally unpairable (not ignored).
    const fromString = await CSS.parseStylesheet('.x { color: red }');
    assert.equal(fromString.length, 1);
    const empty = await CSS.parseStylesheet(streamOf());
    assert.equal(empty.length, 0);
    const emptyRl = await CSS.parseRuleList(streamOf());
    assert.equal(emptyRl.length, 0);
    const multi = await CSS.parseStylesheet(streamOf(
      encode('.a { color: '),
      encode('red } .b { color: blue }'),
    ));
    assert.equal(multi.length, 2);
    assert.ok(multi[0] instanceof CSSParserQualifiedRule);
    assert.ok(multi[1] instanceof CSSParserQualifiedRule);
    const emptyThenData = await CSS.parseRuleList(streamOf(
      new Uint8Array(),
      encode('@media all { .x { color: red } }'),
    ));
    assert.equal(emptyThenData.length, 1);
    assert.equal(asAt(emptyThenData[0]).name, 'media');
    const syncList = parseRuleListSync('.z { color: green }');
    assert.equal(syncList.length, 1);
    assert.ok(syncList[0] instanceof CSSParserQualifiedRule);
  });
});
