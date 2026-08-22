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
// Verifies: SYS-REQ-260821-NGJH, SYS-REQ-260821-KA02, SW-REQ-260821-MZ8P, SW-REQ-260821-2Z0N, INT-REQ-260821-WTPD
// Leftover unique-cause cases for src/parser-api.ts toParserRule not covered by
// tests/parser-api.test.ts. Drive CSS.parseStylesheetSync / CSS.parseRule for
// remaining at-rules and style rules, duck-typed type 0, empty prelude.
// cssom-1 § 6.4 #the-cssrule-interface (UNKNOWN_RULE type 0).
// css-syntax-3 § 5.5.2 #consume-at-rule / § 5.5.3 #consume-a-qualified-rule.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CSS,
  CSSParserAtRule,
  CSSParserDeclaration,
  CSSParserQualifiedRule,
  CSSParserRule,
  toParserRule,
} from '../src/index.ts';

function preludeText(rule: CSSParserAtRule | CSSParserQualifiedRule): string {
  return rule.prelude.map((t) => t.toString()).join('');
}

function asAt(rule: CSSParserRule | null): CSSParserAtRule {
  assert.ok(rule instanceof CSSParserAtRule);
  return rule;
}

function asQualified(rule: CSSParserRule | null): CSSParserQualifiedRule {
  assert.ok(rule instanceof CSSParserQualifiedRule);
  return rule;
}

function isRawParserRule(rule: CSSParserRule): boolean {
  return (
    rule instanceof CSSParserRule &&
    !(rule instanceof CSSParserAtRule) &&
    !(rule instanceof CSSParserQualifiedRule) &&
    !(rule instanceof CSSParserDeclaration)
  );
}

function styleBag(props: Record<string, string>): {
  [Symbol.iterator](): Iterator<string>;
  getPropertyValue(name: string): string;
} {
  return {
    *[Symbol.iterator](): Iterator<string> {
      yield* Object.keys(props);
    },
    getPropertyValue(name: string): string {
      return props[name] ?? '';
    },
  };
}

type BodyKind = 'null' | 'empty' | 'qualified' | 'unknown-at' | 'margin';

const remainingAtRules: { css: string; name: string; prelude: string; body: BodyKind }[] = [
  { css: '@supports (display: grid) { .x { color: red } }', name: 'supports', prelude: '(display: grid)', body: 'qualified' },
  { css: '@starting-style { .x { opacity: 0 } }', name: 'starting-style', prelude: '', body: 'qualified' },
  { css: '@layer { .x { color: red } }', name: 'layer', prelude: '', body: 'qualified' },
  { css: '@layer;', name: 'layer', prelude: '', body: 'null' },
  { css: '@scope { .x { color: red } }', name: 'scope', prelude: '', body: 'qualified' },
  { css: '@scope (.a) to (.b) { .x { color: red } }', name: 'scope', prelude: '(.a) to (.b)', body: 'qualified' },
  { css: '@scope to (.b) { .x { color: red } }', name: 'scope', prelude: 'to (.b)', body: 'qualified' },
  { css: '@media { .x { color: red } }', name: 'media', prelude: '', body: 'qualified' },
  { css: '@container { .x { color: red } }', name: 'container', prelude: '', body: 'qualified' },
  { css: '@import "x.css";', name: 'import', prelude: 'url("x.css")', body: 'null' },
  { css: '@namespace "http://www.w3.org/1999/xhtml";', name: 'namespace', prelude: 'url("http://www.w3.org/1999/xhtml")', body: 'null' },
  { css: '@font-face { font-family: x; src: url(x); }', name: 'font-face', prelude: '', body: 'empty' },
  { css: '@page { margin: 1cm }', name: 'page', prelude: '', body: 'empty' },
  { css: '@page { @top-left { content: "a"; } }', name: 'page', prelude: '', body: 'margin' },
  { css: '@property --x { syntax: "*"; inherits: false }', name: 'property', prelude: '--x', body: 'empty' },
  { css: '@counter-style thumbs { system: cyclic; symbols: "*"; }', name: 'counter-style', prelude: 'thumbs', body: 'empty' },
  { css: '@font-feature-values Font { @styleset { nice: 1 } }', name: 'font-feature-values', prelude: 'Font', body: 'empty' },
  { css: '@custom-media --narrow (max-width: 30em);', name: 'custom-media', prelude: '--narrow(max-width: 30em)', body: 'null' },
  { css: '@view-transition { navigation: auto; }', name: 'view-transition', prelude: '', body: 'empty' },
  { css: '@foo;', name: 'foo', prelude: '', body: 'null' },
  { css: '@foo { color: red }', name: 'foo', prelude: '', body: 'empty' },
  { css: '@keyframes spin { from { color: red } to { color: blue } }', name: 'keyframes', prelude: 'spin', body: 'unknown-at' },
];

function assertBody(at: CSSParserAtRule, body: BodyKind): void {
  if (body === 'null') {
    assert.equal(at.body, null);
    return;
  }
  assert.ok(Array.isArray(at.body));
  if (body === 'empty') {
    assert.equal(at.body.length, 0);
    return;
  }
  if (body === 'qualified') {
    assert.ok(at.body.length >= 1);
    assert.ok(at.body[0] instanceof CSSParserQualifiedRule);
    return;
  }
  if (body === 'margin') {
    assert.equal(at.body.length, 1);
    const margin = asAt(at.body[0]);
    assert.equal(margin.name, 'top-left');
    return;
  }
  assert.ok(at.body.length >= 2);
  for (const child of at.body) {
    const unknownAt = asAt(child);
    assert.equal(unknownAt.name, 'unknown');
    assert.equal(unknownAt.body, null);
  }
}

describe('MC/DC leftover: toParserRule remaining at-rules via parseStylesheetSync/parseRule', () => {
  for (const { css, name, prelude, body } of remainingAtRules) {
    test(`parseStylesheetSync maps ${name} (${css.slice(0, 48)})`, () => {
      const rules = CSS.parseStylesheetSync(css);
      assert.equal(rules.length, 1);
      const at = asAt(rules[0]);
      assert.equal(at.name, name);
      assert.equal(preludeText(at), prelude);
      assertBody(at, body);
    });

    test(`parseRule maps ${name} (${css.slice(0, 48)})`, () => {
      const rule = CSS.parseRule(css);
      const at = asAt(rule);
      assert.equal(at.name, name);
      assert.equal(preludeText(at), prelude);
      assertBody(at, body);
    });
  }
});

describe('MC/DC leftover: toParserRule empty prelude', () => {
  const emptyPrelude = [
    '@layer { .x { color: red } }',
    '@layer;',
    '@starting-style { .x { opacity: 0 } }',
    '@scope { .x { color: red } }',
    '@media { .x { color: red } }',
    '@container { .x { color: red } }',
    '@font-face { font-family: x; src: url(x); }',
    '@page { margin: 1cm }',
    '@view-transition { navigation: auto; }',
    '@foo;',
    '@foo { color: red }',
  ];

  test('parseStylesheetSync empty-prelude at-rules keep prelude []', () => {
    for (const css of emptyPrelude) {
      const at = asAt(CSS.parseStylesheetSync(css)[0]);
      assert.equal(at.prelude.length, 0, css);
      assert.equal(preludeText(at), '', css);
    }
  });

  test('parseRule empty-prelude at-rules keep prelude []', () => {
    for (const css of emptyPrelude) {
      const at = asAt(CSS.parseRule(css));
      assert.equal(at.prelude.length, 0, css);
      assert.equal(preludeText(at), '', css);
    }
  });
});

describe('MC/DC leftover: toParserRule style rules via parseStylesheetSync/parseRule', () => {
  test('top-level style rule maps to CSSParserQualifiedRule', () => {
    const sheet = CSS.parseStylesheetSync('.x { color: red }');
    assert.equal(sheet.length, 1);
    const qr = asQualified(sheet[0]);
    assert.equal(preludeText(qr), '.x');
    // cssom-1 § 6.4.1 #the-cssstylerule-interface: nested cssRules is the body,
    // not the element's own style declarations.
    assert.deepEqual(qr.body, []);

    const viaRule = asQualified(CSS.parseRule('.x { color: red }'));
    assert.equal(preludeText(viaRule), '.x');
    assert.deepEqual(viaRule.body, []);
  });

  test('nested style rule maps child CSSParserQualifiedRule', () => {
    const css = '.parent { .child { color: blue } }';
    const sheet = CSS.parseStylesheetSync(css);
    const parent = asQualified(sheet[0]);
    assert.equal(preludeText(parent), '.parent');
    assert.equal(parent.body.length, 1);
    const child = asQualified(parent.body[0]);
    assert.ok(preludeText(child).includes('.child'));

    const viaRule = asQualified(CSS.parseRule(css));
    assert.equal(viaRule.body.length, 1);
    assert.ok(viaRule.body[0] instanceof CSSParserQualifiedRule);
  });

  test('trailing nested declarations after a nested style rule become a raw parser rule', () => {
    // css-nesting-1 § 4.1 #the-cssnesteddeclarations-interface: decls after a
    // nested rule wrap in CSSNestedDeclarations (type 0, cssText is not an at-rule).
    const css = '.x { color: red; .y { color: blue } color: green; }';
    const parent = asQualified(CSS.parseStylesheetSync(css)[0]);
    assert.equal(parent.body.length, 2);
    assert.ok(parent.body[0] instanceof CSSParserQualifiedRule);
    assert.equal(isRawParserRule(parent.body[1]), true);

    const viaRule = asQualified(CSS.parseRule(css));
    assert.equal(viaRule.body.length, 2);
    assert.ok(viaRule.body[0] instanceof CSSParserQualifiedRule);
    assert.equal(isRawParserRule(viaRule.body[1]), true);
  });
});

describe('MC/DC leftover: toParserRule duck-typed type 0', () => {
  test('empty prelude block cssText is CSSParserAtRule with prelude [] and empty body', () => {
    const duck = { type: 0, cssText: '@layer { .x { color: red } }' };
    const at = asAt(toParserRule(duck));
    assert.equal(at.name, 'layer');
    assert.equal(at.prelude.length, 0);
    assert.deepEqual(at.body, []);
  });

  test('empty prelude starting-style cssText does not take CSSStartingStyleRule instanceof', () => {
    const duck = { type: 0, cssText: '@starting-style { .x { opacity: 0 } }' };
    const at = asAt(toParserRule(duck));
    assert.equal(at.name, 'starting-style');
    assert.equal(preludeText(at), '');
    assert.deepEqual(at.body, []);
  });

  test('empty prelude statement cssText maps body null', () => {
    const duck = { type: 0, cssText: '@layer;' };
    const at = asAt(toParserRule(duck));
    assert.equal(at.name, 'layer');
    assert.equal(at.prelude.length, 0);
    assert.equal(at.body, null);
  });

  test('empty prelude with cssRules maps nested style rules as body', () => {
    const duck = {
      type: 0,
      cssText: '@media { }',
      cssRules: [{ type: 1, selectorText: '.x' }],
    };
    const at = asAt(toParserRule(duck));
    assert.equal(at.name, 'media');
    assert.equal(at.prelude.length, 0);
    assert.equal(at.body?.length, 1);
    assert.ok(at.body?.[0] instanceof CSSParserQualifiedRule);
    assert.equal(preludeText(at.body[0] as CSSParserQualifiedRule), '.x');
  });

  test('leading whitespace and comments before the at-keyword are skipped', () => {
    const ws = asAt(toParserRule({ type: 0, cssText: '  @foo bar;' }));
    assert.equal(ws.name, 'foo');
    assert.equal(preludeText(ws), 'bar');
    assert.equal(ws.body, null);

    const comment = asAt(toParserRule({ type: 0, cssText: '/*c*/ @foo;' }));
    assert.equal(comment.name, 'foo');
    assert.equal(comment.prelude.length, 0);
    assert.equal(comment.body, null);
  });

  test('missing, empty, or non-at-rule cssText falls through to a raw parser rule', () => {
    assert.equal(isRawParserRule(toParserRule({ type: 0 })), true);
    assert.equal(isRawParserRule(toParserRule({ type: 0, cssText: '' })), true);
    assert.equal(isRawParserRule(toParserRule({ type: 0, cssText: 'div { color: red }' })), true);
    assert.equal(isRawParserRule(toParserRule({ type: 0, cssText: 'color: red;' })), true);
    assert.equal(isRawParserRule(toParserRule({ type: 0, cssText: 123 })), true);
  });
});

describe('MC/DC leftover: toParserRule AST at-rule and CSSOM fallback ducks', () => {
  test('AST at-rule with empty prelude and mixed block children', () => {
    const duck = {
      type: 'at-rule',
      name: 'foo',
      prelude: [],
      block: {
        type: 'simple-block',
        associatedToken: { type: '{', value: '{' },
        value: [
          { type: 'declaration', name: 'color', value: [{ type: 'ident', value: 'red' }] },
          { type: 'at-rule', name: 'media', prelude: [], childRules: [] },
          { type: 'whitespace' },
        ],
      },
    };
    const at = asAt(toParserRule(duck));
    assert.equal(at.name, 'foo');
    assert.equal(at.prelude.length, 0);
    assert.equal(at.body?.length, 2);
    assert.ok(at.body?.[0] instanceof CSSParserDeclaration);
    assert.equal((at.body[0] as CSSParserDeclaration).name, 'color');
    const nested = asAt(at.body[1]);
    assert.equal(nested.name, 'media');
  });

  test('AST at-rule with empty prelude and no block is a statement', () => {
    const at = asAt(toParserRule({ type: 'at-rule', name: 'foo', prelude: [] }));
    assert.equal(at.name, 'foo');
    assert.equal(at.prelude.length, 0);
    assert.equal(at.body, null);
  });

  test('duck-typed numeric types without instanceof use name/media/prelude fallbacks', () => {
    const media = asAt(toParserRule({ type: 4, media: { mediaText: 'all' }, cssRules: [] }));
    assert.equal(media.name, 'media');
    assert.equal(preludeText(media), 'all');
    assert.deepEqual(media.body, []);

    const named = asAt(toParserRule({ type: 7, name: 'spin' }));
    assert.equal(named.name, 'spin');
    assert.equal(named.body, null);

    const imported = asAt(toParserRule({ type: 3, prelude: 'url(x.css)' }));
    assert.equal(imported.name, 'import');
    assert.equal(preludeText(imported), 'url(x.css)');
    assert.equal(imported.body, null);

    const unknown = asAt(toParserRule({ type: 5 }));
    assert.equal(unknown.name, 'unknown');
    assert.equal(unknown.prelude.length, 0);
    assert.equal(unknown.body, null);

    const keyframe = asAt(toParserRule({ type: 8, cssText: 'from { color: red }' }));
    assert.equal(keyframe.name, 'unknown');
    assert.equal(keyframe.body, null);

    const preludeTokens = asAt(toParserRule({
      type: 7,
      prelude: [{ type: 'ident', value: 'spin' }, { type: 'whitespace' }],
    }));
    assert.equal(preludeTokens.name, 'keyframes');
    assert.equal(preludeText(preludeTokens), 'spin');
  });

  test('duck-typed style rules use selectorText, style, or prelude', () => {
    const fromStyle = asQualified(toParserRule({
      type: 1,
      selectorText: '.x',
      style: styleBag({ color: 'red' }),
    }));
    assert.equal(preludeText(fromStyle), '.x');
    assert.equal(fromStyle.body.length, 1);
    assert.ok(fromStyle.body[0] instanceof CSSParserDeclaration);
    assert.equal((fromStyle.body[0] as CSSParserDeclaration).name, 'color');

    const fromAst = asQualified(toParserRule({
      type: 'style-rule',
      prelude: [{ type: 'ident', value: 'div' }],
    }));
    assert.equal(preludeText(fromAst), 'div');
    assert.deepEqual(fromAst.body, []);

    const fromSelector = asQualified(toParserRule({ selectorText: '.z' }));
    assert.equal(preludeText(fromSelector), '.z');
  });
});
