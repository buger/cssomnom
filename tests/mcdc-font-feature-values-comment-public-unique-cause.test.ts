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
// parseStyleSheet / CSSStyleSheet.replaceSync.
// css-fonts-4 § 8 #cssfontfeaturevaluesrule-interface / #om-fontfeaturevalues,
// css-syntax-3 § 4.1.8 #comment-diagram / § 5.5.9 #consume-simple-block.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, parseStyleSheet } from '../src/parser.ts';
import { CSSFontFeatureValuesRule, CSSStyleSheet } from '../src/CSSOM.ts';

function featureRule(css: string): CSSFontFeatureValuesRule {
  const sheet = parse(css);
  assert.equal(sheet.cssRules.length, 1, css);
  const rule = sheet.cssRules[0];
  assert.ok(rule instanceof CSSFontFeatureValuesRule, css);
  return rule;
}

describe('MC/DC public unique-cause: handleFontFeatureValuesRule comment skip', () => {
  test('body skip unique-cause of comment T vs whitespace T vs neither', () => {
    // Unique-cause: token.type === 'comment' T, whitespace F (no ws after `{`).
    const commentFirst = featureRule('@font-feature-values Fancy {/*c*/@swash { foo: 1; }}');
    assert.deepEqual(commentFirst.swash.get('foo'), [1]);

    // Unique-cause: whitespace T, comment F.
    const wsFirst = featureRule('@font-feature-values Fancy { @swash { foo: 1; } }');
    assert.deepEqual(wsFirst.swash.get('foo'), [1]);

    // Unique-cause: both F (at-keyword immediately after `{`).
    const compact = featureRule('@font-feature-values Fancy {@swash{foo:1;}}');
    assert.deepEqual(compact.swash.get('foo'), [1]);

    const twoComments = featureRule(
      '@font-feature-values Fancy {/*c1*//*c2*/@swash { foo: 1; }/*c3*/@stylistic { bar: 2; }}',
    );
    assert.deepEqual(twoComments.swash.get('foo'), [1]);
    assert.deepEqual(twoComments.stylistic.get('bar'), [2]);
  });

  test('comment between @-name and block unique-cause of L664 skip', () => {
    // Unique-cause: after at-keyword, comment T before `{`.
    const commentThenBlock = featureRule('@font-feature-values Fancy {@swash/*c*/{ foo: 1; }}');
    assert.deepEqual(commentThenBlock.swash.get('foo'), [1]);

    const wsThenBlock = featureRule('@font-feature-values Fancy {@swash { foo: 1; }}');
    assert.deepEqual(wsThenBlock.swash.get('foo'), [1]);

    const commentWs = featureRule('@font-feature-values Fancy { @swash /*c*/ { foo: 1; } }');
    assert.deepEqual(commentWs.swash.get('foo'), [1]);

    const noSkip = featureRule('@font-feature-values Fancy {@swash{foo:1;}}');
    assert.deepEqual(noSkip.swash.get('foo'), [1]);
  });

  test('parseStyleSheet and replaceSync preserve maps through comments and junk', () => {
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
