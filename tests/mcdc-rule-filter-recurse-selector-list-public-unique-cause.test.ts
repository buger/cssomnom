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
// Verifies: SW-REQ-260821-FWNH, INT-REQ-260821-HJVC
// Public-API unique-cause for src/cascade/rule-filter.ts recurse L723
// `simple.argument.type === "selector-list"` and L681
// `complex.type === "invalid-selector"` (css-nesting-1 § 4 #nesting-selector,
// selectors-4 § 4.2 #negation / § 4.4 #has-pseudo / § 16 #parse-a-selector,
// css-scoping-1 #selectordef-host). Drive CSS.resolveNestedSelector and
// getCascadedStyle. SelectorParser only produces undefined / SelectorList /
// ComponentValue[]; primitive argument and typed non-list argument stay
// UNREACHABLE from public CSS strings.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import '../src/parser.ts';
import { CSS } from '../src/parser-api.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';

function resolve(selector: string, parent = '.t'): string {
  return CSS.resolveNestedSelector(selector, parent);
}

function pv(html: string, prop: string): string {
  const { document } = parseHTML(html);
  const el = document.querySelector('.t');
  assert.ok(el);
  const style = getCascadedStyle(el);
  assert.ok(style instanceof CSSStyleDeclaration);
  return style.getPropertyValue(prop);
}

const nested = (inner: string) => `<html><head><style>
  .t { ${inner} }
</style></head><body><div class="t" lang="en" dir="ltr"><span></span></div></body></html>`;

describe('MC/DC public unique-cause: rule-filter recurse selector-list', { concurrency: false }, () => {
  // css-nesting-1 § 4 #nesting-selector, selectors-4 :is() / :not() / :where() / :has()
  test('selector-list argument unique-cause via :is/:not/:where/:has/:matches', () => {
    assert.equal(resolve(':is(&)'), ':is(:is(.t))');
    assert.equal(resolve(':not(&.no)'), ':not(:is(.t).no)');
    assert.equal(resolve(':where(&)'), ':where(:is(.t))');
    assert.equal(resolve('&:has(span)'), ':is(.t):has(span)');
    assert.equal(resolve(':matches(&)'), ':matches(:is(.t))');
    assert.equal(resolve('&:is(:lang(en))'), ':is(.t):is(:lang(en))');
    assert.equal(resolve('& > :is(&)'), ':is(.t) > :is(:is(.t))');
    assert.equal(resolve(':is(&)', ''), ':is(:where(:scope))');
  });

  test('nth-child of-selector and host/slotted unique-cause selector-list T', () => {
    assert.equal(resolve(':nth-child(2n of &)'), ':nth-child(2n of :is(.t))');
    assert.equal(resolve('&:nth-child(2n of &)'), ':is(.t):nth-child(2n of :is(.t))');
    assert.equal(resolve(':nth-child(odd of :is(&, span))'), ':nth-child(2n+1 of :is(:is(.t), span))');
    assert.equal(resolve(':host(&)'), ':host(:is(.t))');
    assert.equal(resolve(':host-context(&)'), ':host-context(:is(.t))');
    assert.equal(resolve('::slotted(&)'), '::slotted(:is(.t))');
    assert.equal(resolve('::slotted(span)'), '::slotted(span)');
  });

  test('argument F and token-array argument skip selector-list recurse', () => {
    assert.equal(resolve('&:hover'), ':is(.t):hover');
    assert.equal(resolve('&:lang(en)'), ':is(.t):lang(en)');
    assert.equal(resolve('&:nth-child(1)'), ':is(.t):nth-child(1)');
    assert.equal(resolve('&:dir(ltr)'), ':is(.t):dir(ltr)');
    assert.equal(resolve('::part(foo)'), '::part(foo)');
    assert.equal(resolve(':is()'), ':is()');
  });

  test('invalid-selector unique-cause inside forgiving :is/:where list', () => {
    // L681 T: forgiving parse keeps ### as invalid-selector, recurse continues
    // and still rewrites the sibling nesting-selector.
    assert.equal(resolve(':is(###, &)'), ':is(###, :is(.t))');
    assert.equal(resolve(':is(&, ###)'), ':is(:is(.t), ###)');
    assert.equal(resolve(':where(###, &)'), ':where(###, :is(.t))');
    assert.equal(resolve(':is(###)'), ':is(###)');
  });

  test('getCascadedStyle nested :is(###, &) matches after recurse rewrite', () => {
    assert.equal(
      pv(nested(':is(###, &) { z-index: 11; }'), 'z-index'),
      '11',
      'invalid sibling does not drop the rewritten &',
    );
    assert.equal(pv(nested(':is(&) { order: 12; }'), 'order'), '12');
    assert.equal(pv(nested(':is(###) { z-index: 8; }'), 'z-index'), '', ':is(###) does not match');
    assert.equal(pv(nested(':nth-child(1 of &) { flex-grow: 4; }'), 'flex-grow'), '4');
    assert.equal(pv(nested('&:hover { order: 99; }'), 'order'), '');
    assert.equal(pv(nested('&:nth-child(1) { flex-shrink: 5; }'), 'flex-shrink'), '5');
  });
});
