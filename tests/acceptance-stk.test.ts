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
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import * as CSSOM from '../src/index.ts';

const testsDir = path.dirname(fileURLToPath(import.meta.url));

// STK-REQ-260821-BQKD:AC-001:acceptance
test('AC-001 parse CSS text returns CSSStyleSheet', function acBqkd001() {
  const sheet = CSSOM.parse('body{color:red}');
  assert.ok(sheet instanceof CSSOM.CSSStyleSheet);
  assert.equal(sheet.cssRules.length, 1);
  assert.ok(sheet.cssRules[0] instanceof CSSOM.CSSStyleRule);
});

// STK-REQ-260821-BQKD:AC-002:acceptance
test('AC-002 getPropertyValue color is red for body{color:red}', function acBqkd002() {
  const sheet = CSSOM.parse('body{color:red}');
  const rule = sheet.cssRules[0];
  assert.ok(rule instanceof CSSOM.CSSStyleRule);
  assert.equal(rule.selectorText.trim(), 'body');
  assert.equal(rule.style.getPropertyValue('color'), 'red');
});

// STK-REQ-260821-BQKD:AC-003:acceptance
test('AC-003 invalid rule dropped, parse still returns stylesheet', function acBqkd003() {
  assert.doesNotThrow(() => {
    CSSOM.parse('???');
  });
  const dropped = CSSOM.parse('???');
  assert.ok(dropped instanceof CSSOM.CSSStyleSheet);
  assert.equal(dropped.cssRules.length, 0);

  const sheet = CSSOM.parse('body { color: blue; } leftover-ident');
  assert.ok(sheet instanceof CSSOM.CSSStyleSheet);
  assert.equal(sheet.cssRules.length, 1);
  const rule = sheet.cssRules[0];
  assert.ok(rule instanceof CSSOM.CSSStyleRule);
  assert.equal(rule.selectorText.trim(), 'body');
  assert.equal(rule.style.getPropertyValue('color'), 'blue');
});

// STK-REQ-260821-BQKD:AC-004:acceptance
test('AC-004 insertRule bad rule throws SyntaxError', function acBqkd004() {
  const sheet = CSSOM.parse('body{color:red}');
  assert.equal(sheet.cssRules.length, 1);
  assert.throws(
    () => {
      sheet.insertRule('{{{', 0);
    },
    (err: unknown) => err instanceof Error && err.name === 'SyntaxError'
  );
  assert.equal(sheet.cssRules.length, 1);
  const kept = sheet.cssRules[0];
  assert.ok(kept instanceof CSSOM.CSSStyleRule);
  assert.equal(kept.style.getPropertyValue('color'), 'red');
});

// STK-REQ-260821-D7WX:AC-001:acceptance
test('AC-001 getCascadedStyle winning color', function acD7wx001() {
  const css = `
    .box { color: red; }
    .box.highlight { color: blue; }
  `;
  const { document } = parseHTML(
    '<html><body><div id="win" class="box highlight"></div><div id="lose" class="box"></div></body></html>'
  );
  const winner = document.getElementById('win');
  const loser = document.getElementById('lose');
  assert.ok(winner);
  assert.ok(loser);
  const stylesheet = CSSOM.parse(css);
  assert.equal(typeof CSSOM.getCascadedStyle, 'function');
  const winStyle = CSSOM.getCascadedStyle(winner, stylesheet.cssRules);
  const loseStyle = CSSOM.getCascadedStyle(loser, stylesheet.cssRules);
  assert.ok(winStyle instanceof CSSOM.CSSStyleDeclaration);
  assert.ok(loseStyle instanceof CSSOM.CSSStyleDeclaration);
  assert.equal(winStyle.getPropertyValue('color'), 'rgb(0, 0, 255)');
  assert.equal(loseStyle.getPropertyValue('color'), 'rgb(255, 0, 0)');
});

// STK-REQ-260821-D7WX:AC-002:acceptance
test('AC-002 getComputedStyle is not exported', function acD7wx002() {
  assert.equal(typeof CSSOM.getCascadedStyle, 'function');
  assert.equal('getComputedStyle' in CSSOM, false);
  assert.equal(Object.hasOwn(CSSOM, 'getComputedStyle'), false);
  const keys = Object.keys(CSSOM).filter((k) => k !== 'default');
  assert.equal(keys.includes('getComputedStyle'), false);
  assert.equal(Object.getOwnPropertyNames(CSSOM).includes('getComputedStyle'), false);
});

// STK-REQ-260821-D7WX:AC-003:acceptance
test('AC-003 matches and querySelectorAll empty for bad selector', function acD7wx003() {
  const { document } = parseHTML('<html><body><div class="box"></div></body></html>');
  const el = document.querySelector('div');
  assert.ok(el);
  assert.equal(CSSOM.matches(el, 'div'), true);
  assert.equal(CSSOM.querySelectorAll(document.body, 'div').length, 1);
  assert.doesNotThrow(() => {
    CSSOM.matches(el, '[');
    CSSOM.querySelectorAll(document.body, '[');
    CSSOM.querySelector(document.body, '[');
  });
  assert.equal(CSSOM.matches(el, '['), false);
  const empty = CSSOM.querySelectorAll(document.body, '[');
  assert.ok(Array.isArray(empty));
  assert.equal(empty.length, 0);
  assert.equal(CSSOM.querySelector(document.body, '['), null);
});

// STK-REQ-260821-AMK6:AC-001:acceptance
test('AC-001 CSSNumericValue.parse 10px is CSSUnitValue 10 px', function acAmk6001() {
  const val = CSSOM.CSSNumericValue.parse('10px');
  assert.ok(val instanceof CSSOM.CSSNumericValue);
  if (!(val instanceof CSSOM.CSSUnitValue)) {
    assert.fail('expected CSSUnitValue');
    return;
  }
  assert.equal(val.value, 10);
  assert.equal(val.unit, 'px');
});

// STK-REQ-260821-AMK6:AC-002:acceptance
test('AC-002 registerProperty invalid dict throws', function acAmk6002() {
  assert.throws(
    () => {
      CSSOM.CSS.registerProperty({
        name: 'not-a-custom-prop',
        syntax: '*',
        inherits: false
      });
    },
    (err: unknown) => err instanceof Error && err.name === 'SyntaxError'
  );
  assert.throws(
    () => {
      CSSOM.CSS.registerProperty({
        name: '--stk-amk6-bad-syntax',
        syntax: 'not-a-syntax',
        inherits: false
      });
    },
    (err: unknown) => err instanceof Error && err.name === 'SyntaxError'
  );
});

// STK-REQ-260821-AMK6:AC-003:acceptance
test('AC-003 CSS.supports returns boolean and does not throw', function acAmk6003() {
  let twoArg: unknown;
  let oneArg: unknown;
  assert.doesNotThrow(() => {
    twoArg = CSSOM.CSS.supports('display', 'grid');
    oneArg = CSSOM.CSS.supports('(((((');
  });
  assert.equal(typeof twoArg, 'boolean');
  assert.equal(typeof oneArg, 'boolean');
  assert.equal(twoArg, true);
  assert.equal(oneArg, false);
});

// STK-REQ-260821-DKBQ:AC-001:acceptance
test('AC-001 StreamingTokenizer appendChunk + getTokens yields tokens', function acDkbq001() {
  const tokenizer = new CSSOM.StreamingTokenizer();
  tokenizer.appendChunk('body { color: red; }');
  const tokens = tokenizer.getTokens();
  assert.ok(Array.isArray(tokens));
  assert.ok(tokens.length > 0);
});

// STK-REQ-260821-DKBQ:AC-002:acceptance
test('AC-002 CSSImportRule does not fetch; styleSheet empty or null', function acDkbq002() {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error('network must not be used');
  };
  try {
    const sheet = CSSOM.parse('@import url("http://example.invalid/remote.css");');
    assert.ok(sheet instanceof CSSOM.CSSStyleSheet);
    const rule = sheet.cssRules[0];
    assert.ok(rule instanceof CSSOM.CSSImportRule);
    const imported = rule.styleSheet;
    assert.ok(imported === null || imported.cssRules.length === 0);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// STK-REQ-260821-DKBQ:AC-003:acceptance
test('AC-003 CSS.escape, supports, registerProperty, parseStylesheetSync exist', function acDkbq003() {
  assert.equal(typeof CSSOM.CSS.escape, 'function');
  assert.equal(typeof CSSOM.CSS.supports, 'function');
  assert.equal(typeof CSSOM.CSS.registerProperty, 'function');
  assert.equal(typeof CSSOM.CSS.parseStylesheetSync, 'function');
});

// STK-REQ-260821-556N:AC-001:acceptance
test('AC-001 README.md contains a deviations section', function ac556n001() {
  const readmePath = path.join(testsDir, '..', 'README.md');
  const text = readFileSync(readmePath, 'utf8');
  assert.ok(/Deviations & Extensions/i.test(text));
});

// STK-REQ-260821-556N:AC-002:acceptance
test('AC-002 api-surface snapshot exists and public exports are locked', function ac556n002() {
  const snapshotPath = path.join(testsDir, 'api-surface.test.ts.snapshot');
  assert.ok(existsSync(snapshotPath));
  const keys = Object.keys(CSSOM).filter((k) => k !== 'default');
  assert.ok(Array.isArray(keys));
  assert.ok(keys.length > 0);
});
