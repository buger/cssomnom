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
// Verifies: SYS-REQ-260821-8TGB, SW-REQ-260821-HNRG
// Public-API unique-cause for src/shorthands.ts expandFlex
// `grow === null && basis === null` (css-flexbox-1 #flex-property,
// cssom-1 § 6.7.1 #set-a-css-declaration). Drive CSSStyleDeclaration
// setProperty / parse / parseStyleSheet. Both-null T at that AND is
// UNREACHABLE: empty hits filtered.length === 0; junk returns in the loop.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, parseStyleSheet } from '../src/parser.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { CSSStyleRule } from '../src/CSSOM.ts';

function setFlex(value: string): CSSStyleDeclaration {
  const style = new CSSStyleDeclaration();
  style.setProperty('flex', value);
  return style;
}

function parsedFlex(value: string): CSSStyleDeclaration {
  const sheet = parse(`.x { flex: ${value}; }`);
  const rule = sheet.cssRules[0];
  assert.ok(rule instanceof CSSStyleRule, value);
  return rule.style;
}

describe('MC/DC public unique-cause: expandFlex grow === null / basis === null', () => {
  test('one-null unique-cause of grow vs basis via setProperty', () => {
    // Unique-cause: grow === null F, basis === null T → default basis 0px.
    const growOnly = setFlex('3');
    assert.equal(growOnly.getPropertyValue('flex-grow'), '3');
    assert.equal(growOnly.getPropertyValue('flex-shrink'), '1');
    assert.equal(growOnly.getPropertyValue('flex-basis'), '0px');

    const zero = setFlex('0');
    assert.equal(zero.getPropertyValue('flex-grow'), '0');
    assert.equal(zero.getPropertyValue('flex-basis'), '0px');

    // Unique-cause: grow === null T, basis === null F → default grow 1.
    const percent = setFlex('20%');
    assert.equal(percent.getPropertyValue('flex-grow'), '1');
    assert.equal(percent.getPropertyValue('flex-shrink'), '1');
    assert.equal(percent.getPropertyValue('flex-basis'), '20%');

    const content = setFlex('content');
    assert.equal(content.getPropertyValue('flex-grow'), '1');
    assert.equal(content.getPropertyValue('flex-basis'), 'content');

    const maxContent = setFlex('max-content');
    assert.equal(maxContent.getPropertyValue('flex-basis'), 'max-content');
    const minContent = setFlex('min-content');
    assert.equal(minContent.getPropertyValue('flex-basis'), 'min-content');
    const fitContent = setFlex('fit-content');
    assert.equal(fitContent.getPropertyValue('flex-basis'), 'fit-content');
  });

  test('both present unique-cause AND F via setProperty and parse', () => {
    // Unique-cause: grow F and basis F.
    const both = setFlex('3 20%');
    assert.equal(both.getPropertyValue('flex-grow'), '3');
    assert.equal(both.getPropertyValue('flex-shrink'), '1');
    assert.equal(both.getPropertyValue('flex-basis'), '20%');

    const three = setFlex('1 2 30px');
    assert.equal(three.getPropertyValue('flex-grow'), '1');
    assert.equal(three.getPropertyValue('flex-shrink'), '2');
    assert.equal(three.getPropertyValue('flex-basis'), '30px');

    const twoNumbers = setFlex('3 2');
    assert.equal(twoNumbers.getPropertyValue('flex-grow'), '3');
    assert.equal(twoNumbers.getPropertyValue('flex-shrink'), '2');
    assert.equal(twoNumbers.getPropertyValue('flex-basis'), '0px');

    const numberAuto = setFlex('1 auto');
    assert.equal(numberAuto.getPropertyValue('flex-grow'), '1');
    assert.equal(numberAuto.getPropertyValue('flex-basis'), 'auto');

    const fromParse = parsedFlex('4 10%');
    assert.equal(fromParse.getPropertyValue('flex-grow'), '4');
    assert.equal(fromParse.getPropertyValue('flex-basis'), '10%');

    const rules = parseStyleSheet('.x { flex: 5; }');
    assert.ok(rules[0] instanceof CSSStyleRule);
    assert.equal(rules[0].style.getPropertyValue('flex-grow'), '5');
    assert.equal(rules[0].style.getPropertyValue('flex-basis'), '0px');
  });

  test('keyword none/auto skip the grow/basis AND; junk/empty never reach it', () => {
    const none = setFlex('none');
    assert.equal(none.getPropertyValue('flex-grow'), '0');
    assert.equal(none.getPropertyValue('flex-shrink'), '0');
    assert.equal(none.getPropertyValue('flex-basis'), 'auto');

    const auto = setFlex('auto');
    assert.equal(auto.getPropertyValue('flex-grow'), '1');
    assert.equal(auto.getPropertyValue('flex-basis'), 'auto');

    const inherit = setFlex('inherit');
    assert.equal(inherit.getPropertyValue('flex-grow'), 'inherit');
    assert.equal(inherit.getPropertyValue('flex-basis'), 'inherit');

    const junk = new CSSStyleDeclaration();
    junk.setProperty('flex-grow', '9');
    junk.setProperty('flex', 'solid');
    assert.equal(junk.getPropertyValue('flex-grow'), '9');

    const empty = parsedFlex('');
    assert.equal(empty.getPropertyValue('flex-grow'), '');
  });
});
