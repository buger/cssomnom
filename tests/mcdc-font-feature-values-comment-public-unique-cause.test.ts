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
// Verifies: SYS-REQ-260821-03VA, SYS-REQ-260821-7521, SW-REQ-260821-YG9J,
// SW-REQ-260821-HHVE
// Public-API unique-cause for src/parser.ts handleFontFeatureValuesRule
// `token.type === "whitespace" || token.type === "comment"` at the body
// skip (L656) and between @-name and `{` (L664). Drive parse /
// parseStyleSheet / CSSStyleSheet.replaceSync / tokenize.
// css-fonts-4 § 8 #cssfontfeaturevaluesrule-interface / #om-fontfeaturevalues,
// css-syntax-3 § 4.3.1 #consume-token / § 4.3.2 #consume-comment /
// § 5.5.9 #consume-simple-block.
// Unique-cause is whitespace T vs compact both-F only. Comment T is MUTE
// leftover: consumeToken always consumeComments() and never emits comment
// tokens (no preserveComments). After strip, `{/*c*/@swash{foo:1;}}` and
// `{@swash/*c*/{foo:1;}}` are the compact both-F row. Do not claim comment
// T from public parse. Do not ignore a TRUE row.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, parseStyleSheet } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { CSSFontFeatureValuesRule, CSSStyleSheet } from '../src/CSSOM.ts';

function featureRule(css: string): CSSFontFeatureValuesRule {
  const sheet = parse(css);
  assert.equal(sheet.cssRules.length, 1, css);
  const rule = sheet.cssRules[0];
  assert.ok(rule instanceof CSSFontFeatureValuesRule, css);
  return rule;
}

function tokenTypes(css: string): string[] {
  return tokenize(css).map((t) => t.type);
}

describe('MC/DC public unique-cause: handleFontFeatureValuesRule whitespace skip', () => {
  test('body skip unique-cause of whitespace T vs neither', () => {
    // Unique-cause: whitespace T, comment F (space after `{`).
    const wsFirst = featureRule('@font-feature-values Fancy { @swash { foo: 1; } }');
    assert.deepEqual(wsFirst.swash.get('foo'), [1]);

    // Unique-cause: both F (at-keyword immediately after `{`).
    const compact = featureRule('@font-feature-values Fancy {@swash{foo:1;}}');
    assert.deepEqual(compact.swash.get('foo'), [1]);
  });

  test('whitespace between @-name and block unique-cause of L664 skip', () => {
    // Unique-cause: whitespace T, comment F.
    const wsThenBlock = featureRule('@font-feature-values Fancy {@swash { foo: 1; }}');
    assert.deepEqual(wsThenBlock.swash.get('foo'), [1]);

    // Unique-cause: both F (no skip).
    const noSkip = featureRule('@font-feature-values Fancy {@swash{foo:1;}}');
    assert.deepEqual(noSkip.swash.get('foo'), [1]);
  });

  test('comment T is MUTE leftover: tokenize never emits comment tokens', () => {
    // After strip these strings are the compact both-F row, not comment T.
    const bodyComment = '@font-feature-values Fancy {/*c*/@swash{foo:1;}}';
    const nameComment = '@font-feature-values Fancy {@swash/*c*/{foo:1;}}';
    const compact = '@font-feature-values Fancy {@swash{foo:1;}}';

    assert.equal(tokenize(bodyComment).some((t) => t.type === 'comment'), false);
    assert.equal(tokenize(nameComment).some((t) => t.type === 'comment'), false);
    assert.deepEqual(tokenTypes(bodyComment), tokenTypes(compact));
    assert.deepEqual(tokenTypes(nameComment), tokenTypes(compact));

    assert.deepEqual(featureRule(bodyComment).swash.get('foo'), [1]);
    assert.deepEqual(featureRule(nameComment).swash.get('foo'), [1]);
    assert.deepEqual(featureRule(compact).swash.get('foo'), [1]);
  });

  test('parseStyleSheet and replaceSync preserve maps through stripped comments and junk', () => {
    // Comments are discarded in consume-a-token; public maps match comment-free
    // CSS. Not unique-cause of comment T.
    const css = `@font-feature-values Fancy {
      /* prelude comment */
      color: red;
      @swash /* inner */ { foo: 1; }
      @unknown { dropped: 2; }
      @stylistic { bar: 3; }
    }`;
    const rules = parseStyleSheet(css);
    assert.equal(rules.length, 1);
    assert.ok(rules[0] instanceof CSSFontFeatureValuesRule);
    assert.deepEqual(rules[0].swash.get('foo'), [1]);
    assert.deepEqual(rules[0].stylistic.get('bar'), [3]);

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    const viaReplace = sheet.cssRules[0];
    assert.ok(viaReplace instanceof CSSFontFeatureValuesRule);
    assert.deepEqual(viaReplace.swash.get('foo'), [1]);
    assert.deepEqual(viaReplace.stylistic.get('bar'), [3]);
    assert.equal(viaReplace.ornaments.size, 0);
  });
});
