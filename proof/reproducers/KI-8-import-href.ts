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
/**
 * Overlay reproducer for KI-8. Not a product-suite test.
 * css-syntax-3 § 4.3.6 #consume-url-token emits a <url-token> for
 * url(foo.css). cssom-1 § 6.4.4 #dom-cssimportrule-href returns that URL.
 * Asserts href === 'foo.css' and cssText does not emit url("") url("foo.css")
 * Regression tripwire after the KI-8 class-fix copies the <url-token> value
 * into href (leftover <url-token> must not become mediaText).
 *
 * Reproduces: KI-8
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSSImportRule } from '../../src/CSSOM.ts';

function ki8Contract(): { setupOk: boolean; holds: boolean; message: string } {
  const sheet = parse('@import url(foo.css);');
  const rule = sheet.cssRules[0] as CSSImportRule | undefined;
  if (!rule || !(rule instanceof CSSImportRule)) {
    return {
      setupOk: false,
      holds: false,
      message: `setup failed: expected CSSImportRule, got ${sheet.cssRules[0]?.constructor?.name}`,
    };
  }
  const hrefOk = rule.href === 'foo.css';
  const cssText = rule.cssText;
  const cssTextOk = !cssText.includes('url("")') && cssText.includes('foo.css');
  if (!hrefOk || !cssTextOk) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-8: unquoted url(foo.css) href was ${JSON.stringify(rule.href)} cssText=${JSON.stringify(cssText)}; intended href foo.css and cssText without url("")`,
    };
  }
  return { setupOk: true, holds: true, message: 'KI-8 contract holds: url-token href is foo.css' };
}

// Reproduces: KI-8
// Verifies: SW-REQ-260821-5W6X
// Verifies: SYS-REQ-260821-7521
// MCDC leftover handleImportRule url-token href+cssText
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
test('parse(@import url(foo.css);).cssRules[0].href is foo.css', () => {
  const outcome = ki8Contract();
  assert.equal(outcome.setupOk, true, outcome.message);
  assert.equal(outcome.holds, true, outcome.message);
});
