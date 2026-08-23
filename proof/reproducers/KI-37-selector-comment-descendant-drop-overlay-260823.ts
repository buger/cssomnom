/**
 * Overlay reproducer for KI-37: a comment in the descendant-combinator
 * position drops the entire qualified rule.
 *
 * css-syntax-3 § 4.3.2 "Comment tokens" / serialization preamble (#serialization,
 * submodules/csswg-drafts/css-syntax-3/Overview.bs:3701-3704) is load-bearing:
 *
 *   The tokenizer described in this specification does not produce tokens for
 *   comments, or otherwise preserve them in any way. Implementations may
 *   preserve the contents of comments and their location in the token stream.
 *   If they do, this preserved information must have no effect on the parsing
 *   step.
 *
 * selectors-4 § 13 "Combinators" (#descendant-combinators,
 * submodules/csswg-drafts/selectors-4/Overview.bs:4281-4283) defines:
 *
 *   The descendant combinator expresses such a relationship.
 *   A descendant combinator is whitespace that separates two compound
 *   selectors.
 *
 * The selector tokenizer used by parse() surfaces preserved comments as
 * 'comment' ComponentValues; SelectorParser.skipWhitespace
 * (src/SelectorParser.ts:102-106) skips only 'whitespace' tokens, so when a
 * comment sits where the implicit descendant combinator belongs (the shape
 * tested below as 'div' + comment + 'x'), the parser fails to recognize two
 * adjacent compound selectors separated by ignorable trivia and drops the
 * ENTIRE qualified rule - cssRules.length === 0 - instead of parsing the
 * equivalent of "div x". Preserved comments therefore have an effect on
 * parsing, violating the css-syntax-3 requirement above. Explicit-combinator
 * positions ("div > " + comment + " p") and leading comments are unaffected,
 * which localizes the fault to the implicit-descendant handling.
 *
 * Distinctness from KI-31 (media condition paren dropping): different layer
 * (selector parsing vs media serialization); from comment-in-value issues:
 * this is a selector-level structural drop.
 *
 * Asserts the SAFE contract: a comment between compound selectors is
 * equivalent to whitespace; the rule parses with the descendant relationship
 * intact.
 *
 * Reproduces: KI-37
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

// Reproducer constants mirrored in specs/system/variables/selectors-parser-budget.vars.yaml:
const COMMENT_DESCENDANT_PROBE_COUNT = 4; // selector shapes probed: div/**/x, a/**/b, div. /**/a, *. /**/b
const RULES_LOST_BUDGET = 0; // zero qualified rules may be dropped by comments

function ruleCount(source: string): number {
  return parse(source).cssRules.length;
}

describe('KI-37 comment in descendant-combinator position', () => {
  test('positive control: whitespace descendant combinator parses one rule', () => {
    const sheet = parse('div x{a:b}');
    assert.equal(sheet.cssRules.length, 1);
    const rule = sheet.cssRules[0] as unknown as { selectorText?: string };
    assert.equal(rule.selectorText?.replace(/\/\*.*?\*\//g, '').trim().replace(/\s+/g, ' '), 'div x');
  });

  test('positive controls: explicit combinator and leading comment keep their rules', () => {
    assert.equal(ruleCount('div > /**/ p{a:b}'), 1);
    assert.equal(ruleCount('/**/div{a:b}'), 1);
  });

  // Reproduces: KI-37
  test(`comments between compound selectors never drop rules (${COMMENT_DESCENDANT_PROBE_COUNT} shapes, ${RULES_LOST_BUDGET} allowed)`, () => {
    const shapes = ['div/**/x{a:b}', 'a/**/b{a:b}', 'div. /**/a{a:b}', '*. /**/b{a:b}'];
    let lost = 0;
    for (const shape of shapes) {
      if (ruleCount(shape) !== 1) lost++;
    }
    assert.equal(
      lost,
      RULES_LOST_BUDGET,
      `KI-37: ${lost}/${shapes.length} selector shapes dropped their entire rule when a comment sat in the descendant-combinator position (${JSON.stringify(shapes.filter((s) => ruleCount(s) !== 1))}); css-syntax-3 #serialization requires preserved comments to have no effect on parsing and selectors-4 #descendant-combinators defines the combinator as whitespace separating compound selectors`,
    );
  });

  // Reproduces: KI-37
  test("parse('div/**/x{a:b}') yields exactly one rule equivalent to 'div x'", () => {
    const sheet = parse('div/**/x{a:b}');
    assert.equal(
      sheet.cssRules.length,
      1,
      `KI-37: parse('div/**/x{a:b}').cssRules.length === ${sheet.cssRules.length}; the comment must act as the descendant combinator`,
    );
    const rule = sheet.cssRules[0] as unknown as { selectorText?: string };
    const normalized = rule.selectorText?.replace(/\/\*.*?\*\//g, '').trim().replace(/\s+/g, ' ');
    assert.equal(normalized, 'div x');
  });
});
