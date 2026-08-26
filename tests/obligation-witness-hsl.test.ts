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
// Obligation witnesses for the cascade HSL hue-sector and arity family
// (variable-model-cleanup batch): triple-form tags that were deferred while
// tests/** was frozen. Driven only through the public cascade surface
// (getCascadedStyle over parsed stylesheets), mirroring the untagged
// sector/arity rows cited in the SYS requirement rationales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parseStyleSheet } from '../src/parser.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';

function box(css: string): CSSStyleDeclaration {
  const { document } = parseHTML('<html><body><div class="t"></div></body></html>');
  const el = document.querySelector('.t');
  assert.ok(el, 'missing .t');
  const style = getCascadedStyle(el, parseStyleSheet(css));
  assert.ok(style instanceof CSSStyleDeclaration);
  return style;
}

// SYS-REQ-260824-4RGN:nominal:nominal
// SW-REQ-260824-JS91:nominal:nominal
test('hsl hue in [60,180) assigns chroma to green (SYS-REQ-260824-4RGN)', () => {
  // hue 120, s=100%, l=50% -> pure green: chroma lands on the green channel.
  const deg = box('.t { color: hsl(120, 100%, 50%); }');
  assert.equal(deg.getPropertyValue('color'), 'rgb(0, 255, 0)');
  // Same sector through the modern space-separated syntax (3 components).
  const space = box('.t { color: hsl(120 100% 50%); }');
  assert.equal(space.getPropertyValue('color'), 'rgb(0, 255, 0)');
  // Lower sector boundary (inclusive) and explicit deg unit stay in-sector.
  const lower = box('.t { color: hsl(60 100% 50%); }');
  assert.equal(lower.getPropertyValue('color'), 'rgb(255, 255, 0)');
  const degUnit = box('.t { color: hsl(120deg 100% 50%); }');
  assert.equal(degUnit.getPropertyValue('color'), 'rgb(0, 255, 0)');
});

// SYS-REQ-260824-BRYV:nominal:nominal
// SW-REQ-260824-23WT:nominal:nominal
test('hsl hue in [180,300) assigns chroma to blue (SYS-REQ-260824-BRYV)', () => {
  const cyan = box('.t { color: hsl(180 100% 50%); }');
  assert.equal(cyan.getPropertyValue('color'), 'rgb(0, 255, 255)');
  const azure = box('.t { color: hsl(210 100% 50%); }');
  assert.equal(azure.getPropertyValue('color'), 'rgb(0, 128, 255)');
  const navy = box('.t { color: hsl(240 100% 50%); }');
  assert.equal(navy.getPropertyValue('color'), 'rgb(0, 0, 255)');
});

// SYS-REQ-260824-DAS2:nominal:nominal
// SW-REQ-260824-CAHE:nominal:nominal
// SW-REQ-260824-CAHE:malformed_input:negative
test('hsl() parses at 3-4 components and rejects other arities (SYS-REQ-260824-DAS2)', () => {
  // 4-component slash form parses and reaches the HSL converter.
  const slash = box('.t { color: hsl(120 100% 50% / 0.4); }');
  assert.equal(slash.getPropertyValue('color'), 'rgba(0, 255, 0, 0.4)');
  // 3-component legacy hsla() comma form parses.
  const hsla = box('.t { color: hsla(120, 100%, 50%, 0.2); }');
  assert.equal(hsla.getPropertyValue('color'), 'rgba(0, 255, 0, 0.2)');
  // Arity gate: 2-part and 5-part hsl() lists fall through unparsed.
  const two = box('.t { color: hsl(0, 100%); }');
  assert.equal(two.getPropertyValue('color'), 'hsl(0, 100%)');
  const five = box('.t { color: hsl(1, 2, 3, 4, 5); }');
  assert.equal(five.getPropertyValue('color'), 'hsl(1, 2, 3, 4, 5)');
});

// SYS-REQ-260824-DAS2:nominal:nominal
// SW-REQ-260824-CAHE:overflow_safety:nominal
test('hsl saturation and hue magnitude wrap stay inside the conversion domain', () => {
  // parsePct saturates [0,1]: 200% saturation behaves as 100%.
  const saturated = box('.t { color: hsl(120 200% 50%); }');
  assert.equal(saturated.getPropertyValue('color'), 'rgb(0, 255, 0)');
  // css-color-4 modulo-360 normalization: 480deg and -240 wrap to 120.
  const wrapHigh = box('.t { color: hsl(480deg 100% 50%); }');
  assert.equal(wrapHigh.getPropertyValue('color'), 'rgb(0, 255, 0)');
  const wrapNeg = box('.t { color: hsl(-240 100% 50%); }');
  assert.equal(wrapNeg.getPropertyValue('color'), 'rgb(0, 255, 0)');
});
