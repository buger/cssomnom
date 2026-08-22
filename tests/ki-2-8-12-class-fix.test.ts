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
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.ts';
import {
  CSSStyleSheet,
  CSSImportRule,
  CSSAtRule,
  CSSMediaRule,
  CSSMarginRule,
  CSSPageRule,
  CSSKeyframesRule,
  CSSSupportsRule,
  CSSLayerStatementRule,
  CSSFontFaceRule,
} from '../src/CSSOM.ts';
import { CSS, CSSParserAtRule, CSSParserQualifiedRule } from '../src/index.ts';

describe('KI-2 CSSStyleSheet.replace sync parse', () => {
  // Verifies: SW-REQ-260821-PAKB
  // Verifies: SYS-REQ-260821-GR67
  // MCDC SW-REQ-260821-PAKB: deviation_applies=T, documented_deviation_honored=T, replace_sync_parse_runs=T => TRUE
  // MCDC SYS-REQ-260821-GR67: deviation_applies=T, documented_deviation_honored=T => TRUE
  test('replace() runs replaceSync then Promise.resolve so cssRules is populated before await', async () => {
    // cssom-1 § 6.5.1 #dom-cssstylesheet-replace parses "in parallel";
    // README deviation: replaceSync (#synchronously-replace-the-rules-of-a-cssstylesheet)
    // then Promise.resolve(this).
    const sheet = new CSSStyleSheet();
    const pending = sheet.replace('div { color: red; }');
    assert.ok(pending instanceof Promise);
    assert.equal(sheet.cssRules.length, 1);
    assert.equal(sheet.cssRules[0].cssText, 'div { color: red; }');
    const resolved = await pending;
    assert.equal(resolved, sheet);
    // No in-flight disallow-modification lock after the sync parse.
    sheet.replaceSync('p { color: green; }');
    assert.equal(sheet.cssRules.length, 1);
    assert.equal(sheet.cssRules[0].cssText, 'p { color: green; }');
  });

  test('replace() on a non-constructed sheet rejects without parsing', async () => {
    const parsed = parse('div { color: red; }');
    await assert.rejects(
      () => parsed.replace('p { color: blue; }'),
      (err: unknown) => err instanceof DOMException && err.name === 'NotAllowedError',
    );
    assert.equal(parsed.cssRules.length, 1);
  });
});

describe('KI-8 CSSImportRule href from url-token', () => {
  // Verifies: SW-REQ-260821-5W6X
  // Verifies: SYS-REQ-260821-7521
  test('unquoted url(foo.css) copies <url-token> into href and cssText', () => {
    // css-syntax-3 § 4.3.6 #consume-url-token: unquoted url(foo.css) is a <url-token>.
    // cssom-1 § 6.4.4 #dom-cssimportrule-href: href is the URL specified by the @import prelude.
    const sheet = parse('@import url(foo.css);');
    const rule = sheet.cssRules[0] as CSSImportRule;
    assert.ok(rule instanceof CSSImportRule);
    assert.equal(rule.href, 'foo.css');
    assert.equal(rule.cssText.includes('url("")'), false);
    assert.equal(rule.cssText.includes('foo.css'), true);
    // KI-7 remains open: do not fetch; do not assert styleSheet is a loaded sheet.
  });

  test('quoted string and quoted url() still copy href', () => {
    assert.equal((parse('@import "bar.css";').cssRules[0] as CSSImportRule).href, 'bar.css');
    assert.equal((parse('@import url("baz.css");').cssRules[0] as CSSImportRule).href, 'baz.css');
  });
});

describe('KI-12 at-rule ASCII-case dispatch', () => {
  // Verifies: INT-REQ-260821-ZMZR
  // Verifies: SYS-REQ-260821-7521
  // Verifies: INT-REQ-260821-WTPD
  test('@MEDIA / @KEYFRAMES / @Import dispatch to typed handlers', () => {
    // css-values-4 § 4.1 #keywords / infra #ascii-case-insensitive
    const sheet = parse(`
      @MEDIA all { p { color: red; } }
      @SUPPORTS (display: grid) { p { color: blue; } }
      @Import "x.css";
      @KEYFRAMES spin { from { opacity: 0; } }
      @Layer a, b;
      @Font-Face { font-family: X; src: url(x); }
    `);
    assert.ok(sheet.cssRules[0] instanceof CSSMediaRule);
    assert.ok(sheet.cssRules[1] instanceof CSSSupportsRule);
    assert.ok(sheet.cssRules[2] instanceof CSSImportRule);
    assert.ok(sheet.cssRules[3] instanceof CSSKeyframesRule);
    assert.ok(sheet.cssRules[4] instanceof CSSLayerStatementRule);
    assert.ok(sheet.cssRules[5] instanceof CSSFontFaceRule);
  });

  test('@TOP-LEFT stores ASCII-lowercase CSSMarginRule.name', () => {
    const sheet = parse('@page { @TOP-LEFT { margin: 1px; } @Top-Center { margin: 2px; } }');
    const page = sheet.cssRules[0] as CSSPageRule;
    assert.ok(page instanceof CSSPageRule);
    const margins = [...page.cssRules].filter((r) => r instanceof CSSMarginRule) as CSSMarginRule[];
    assert.equal(margins.length, 2);
    assert.equal(margins[0].name, 'top-left');
    assert.equal(margins[1].name, 'top-center');
    assert.equal(margins[0].cssText.startsWith('@top-left'), true);
    assert.equal(margins[1].cssText.includes('Top-Center'), false);
  });

  test('options.atRules keys fold ASCII-case-insensitively', () => {
    const folded = CSS.parseStylesheetSync('@FOO { div { color: red; } }', { atRules: { foo: 'rule' } });
    assert.equal(folded.length, 1);
    assert.ok(folded[0] instanceof CSSParserAtRule);
    assert.ok((folded[0] as CSSParserAtRule).body?.some((r) => r instanceof CSSParserQualifiedRule));
  });

  test('@__proto__ / @constructor / @toString do not throw and stay CSSAtRule', () => {
    let sheet: ReturnType<typeof parse> | undefined;
    assert.doesNotThrow(() => {
      sheet = parse('@__proto__ { } @constructor { } @toString;');
    });
    assert.ok(sheet);
    for (const rule of sheet.cssRules) {
      assert.ok(rule instanceof CSSAtRule);
    }
  });
});
