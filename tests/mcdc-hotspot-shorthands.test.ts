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
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { SHORTHANDS, FONT_LONGHANDS } from '../src/shorthands.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import type { ComponentValue } from '../src/types.ts';

function comps(css: string): ComponentValue[] {
  return ParseHooks.parseComponentValues(tokenize(css));
}

function expandFont(css: string): Record<string, ComponentValue[]> | null {
  return SHORTHANDS['font'].expand(comps(css));
}

function serializeLh(expanded: Record<string, ComponentValue[]> | null, name: string): string {
  assert.ok(expanded, `expected font expansion for longhand ${name}`);
  const tokens = expanded[name];
  assert.ok(tokens, `missing longhand ${name}`);
  return tokens.map((t) => {
    if (t.type === 'function') {
      const fn = t as { name?: string; value: ComponentValue[] };
      return `${fn.name}(${serializeLh({ x: fn.value }, 'x')})`;
    }
    if (t.type === 'ident' || t.type === 'string' || t.type === 'url') {
      return String(t.value);
    }
    if (t.type === 'dimension') {
      return `${t.value}${t.unit ?? ''}`;
    }
    if (t.type === 'percentage') {
      return `${t.value}%`;
    }
    if (t.type === 'number') {
      return String(t.value);
    }
    if (t.type === 'whitespace') {
      return ' ';
    }
    if (t.type === 'comma') {
      return ',';
    }
    return String(t.value ?? '');
  }).join('').replace(/\s+/g, ' ').trim();
}

describe('MC/DC hotspot: expandFont', () => {
  test('empty and whitespace-only values reject', () => {
    assert.equal(expandFont(''), null);
    assert.equal(expandFont('   '), null);
    assert.equal(expandFont('/* comment */'), null);
  });

  test('css-wide keywords copy onto every font longhand', () => {
    for (const kw of ['initial', 'inherit', 'unset', 'revert', 'revert-layer']) {
      const expanded = expandFont(kw);
      assert.ok(expanded);
      for (const lh of FONT_LONGHANDS) {
        assert.equal(serializeLh(expanded, lh), kw);
      }
    }
  });

  test('system font keywords copy onto every font longhand', () => {
    for (const kw of ['caption', 'icon', 'menu', 'message-box', 'small-caption', 'status-bar']) {
      const expanded = expandFont(kw);
      assert.ok(expanded);
      for (const lh of FONT_LONGHANDS) {
        assert.equal(serializeLh(expanded, lh), kw);
      }
    }
  });

  test('italic / oblique set font-style and leave other prefixes normal', () => {
    const italic = expandFont('italic 16px serif');
    assert.equal(serializeLh(italic, 'font-style'), 'italic');
    assert.equal(serializeLh(italic, 'font-size'), '16px');
    assert.equal(serializeLh(italic, 'font-family'), 'serif');
    assert.equal(serializeLh(italic, 'font-weight'), 'normal');

    const oblique = expandFont('oblique 12pt sans-serif');
    assert.equal(serializeLh(oblique, 'font-style'), 'oblique');
    assert.equal(serializeLh(oblique, 'font-size'), '12pt');
  });

  test('small-caps sets font-variant-caps', () => {
    const expanded = expandFont('small-caps 16px Georgia');
    assert.equal(serializeLh(expanded, 'font-variant-caps'), 'small-caps');
    assert.equal(serializeLh(expanded, 'font-size'), '16px');
  });

  test('bold / bolder / lighter set font-weight', () => {
    assert.equal(serializeLh(expandFont('bold 16px serif'), 'font-weight'), 'bold');
    assert.equal(serializeLh(expandFont('bolder 16px serif'), 'font-weight'), 'bolder');
    assert.equal(serializeLh(expandFont('lighter 16px serif'), 'font-weight'), 'lighter');
  });

  test('numeric font-weight in 1..1000 inclusive', () => {
    assert.equal(serializeLh(expandFont('1 16px serif'), 'font-weight'), '1');
    assert.equal(serializeLh(expandFont('400 16px serif'), 'font-weight'), '400');
    assert.equal(serializeLh(expandFont('700 16px serif'), 'font-weight'), '700');
    assert.equal(serializeLh(expandFont('1000 16px serif'), 'font-weight'), '1000');
  });

  test('stretch keywords set font-stretch', () => {
    const stretches = [
      'ultra-condensed', 'extra-condensed', 'condensed', 'semi-condensed',
      'semi-expanded', 'expanded', 'extra-expanded', 'ultra-expanded',
    ];
    for (const stretch of stretches) {
      assert.equal(serializeLh(expandFont(`${stretch} 16px serif`), 'font-stretch'), stretch);
    }
  });

  test('normal prefix is skipped so later size/family still parse', () => {
    const expanded = expandFont('normal normal 16px serif');
    assert.equal(serializeLh(expanded, 'font-style'), 'normal');
    assert.equal(serializeLh(expanded, 'font-weight'), 'normal');
    assert.equal(serializeLh(expanded, 'font-size'), '16px');
    assert.equal(serializeLh(expanded, 'font-family'), 'serif');
  });

  test('size as dimension, percentage, 0, keyword, or math function', () => {
    assert.equal(serializeLh(expandFont('2em serif'), 'font-size'), '2em');
    assert.equal(serializeLh(expandFont('150% serif'), 'font-size'), '150%');
    assert.equal(serializeLh(expandFont('0 serif'), 'font-size'), '0');
    for (const kw of ['xx-small', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large', 'xxx-large', 'smaller', 'larger']) {
      assert.equal(serializeLh(expandFont(`${kw} serif`), 'font-size'), kw);
    }
    const calc = expandFont('calc(1em + 2px) serif');
    assert.equal(serializeLh(calc, 'font-size').startsWith('calc('), true);
    assert.equal(serializeLh(expandFont('min(12px, 2em) serif'), 'font-size').startsWith('min('), true);
    assert.equal(serializeLh(expandFont('max(12px, 2em) serif'), 'font-size').startsWith('max('), true);
    assert.equal(serializeLh(expandFont('clamp(10px, 2vw, 20px) serif'), 'font-size').startsWith('clamp('), true);
  });

  test('line-height after slash: number, dimension, percentage, normal, math', () => {
    assert.equal(serializeLh(expandFont('16px / 1.5 serif'), 'line-height'), '1.5');
    assert.equal(serializeLh(expandFont('16px / 20px serif'), 'line-height'), '20px');
    assert.equal(serializeLh(expandFont('16px / 120% serif'), 'line-height'), '120%');
    assert.equal(serializeLh(expandFont('16px / normal serif'), 'line-height'), 'normal');
    assert.equal(serializeLh(expandFont('16px / calc(1em + 2px) serif'), 'line-height').startsWith('calc('), true);
    assert.equal(serializeLh(expandFont('16px / min(1, 2) serif'), 'line-height').startsWith('min('), true);
    assert.equal(serializeLh(expandFont('16px / max(1, 2) serif'), 'line-height').startsWith('max('), true);
    assert.equal(serializeLh(expandFont('16px / clamp(1, 2, 3) serif'), 'line-height').startsWith('clamp('), true);
  });

  test('slash with no line-height token rejects', () => {
    assert.equal(expandFont('16px /'), null);
    assert.equal(expandFont('16px / '), null);
  });

  test('slash with invalid line-height token rejects', () => {
    assert.equal(expandFont('16px / serif'), null);
    assert.equal(expandFont('16px / italic serif'), null);
    assert.equal(expandFont('16px / url(x) serif'), null);
  });

  test('missing size or family rejects', () => {
    assert.equal(expandFont('italic'), null);
    assert.equal(expandFont('bold condensed'), null);
    assert.equal(expandFont('16px'), null);
    assert.equal(expandFont('bold 16px'), null);
    assert.equal(expandFont('16px / 1.2'), null);
  });

  test('number outside 1..1000 is not a weight and is not a size unless 0', () => {
    assert.equal(expandFont('1001 serif'), null);
    assert.equal(expandFont('0.5 serif'), null);
    assert.equal(expandFont('-1 serif'), null);
    const zero = expandFont('0 serif');
    assert.ok(zero);
    assert.equal(serializeLh(zero, 'font-size'), '0');
  });

  test('combined prefixes, quoted family list, and comments after line-height', () => {
    const expanded = expandFont('italic small-caps bold condensed 16px / 1.5 "Helvetica Neue", sans-serif');
    assert.equal(serializeLh(expanded, 'font-style'), 'italic');
    assert.equal(serializeLh(expanded, 'font-variant-caps'), 'small-caps');
    assert.equal(serializeLh(expanded, 'font-weight'), 'bold');
    assert.equal(serializeLh(expanded, 'font-stretch'), 'condensed');
    assert.equal(serializeLh(expanded, 'font-size'), '16px');
    assert.equal(serializeLh(expanded, 'line-height'), '1.5');
    assert.equal(serializeLh(expanded, 'font-family').includes('Helvetica Neue'), true);
    assert.equal(serializeLh(expanded, 'font-family').includes('sans-serif'), true);

    const commented = expandFont('16px / 1.2 /* family */ serif');
    assert.ok(commented);
    assert.equal(serializeLh(commented, 'font-family'), 'serif');
  });

  test('CSSStyleDeclaration setProperty expands font and invalid font is a no-op', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('font-size', '20px');
    style.setProperty('font', 'italic 700 16px / 1.4 serif');
    assert.equal(style.getPropertyValue('font-style'), 'italic');
    assert.equal(style.getPropertyValue('font-weight'), '700');
    assert.equal(style.getPropertyValue('font-size'), '16px');
    assert.equal(style.getPropertyValue('line-height'), '1.4');
    assert.equal(style.getPropertyValue('font-family'), 'serif');
    assert.equal(style.getPropertyValue('font').includes('16px'), true);

    style.setProperty('font', 'not-a-font');
    assert.equal(style.getPropertyValue('font-size'), '16px');
    assert.equal(style.getPropertyValue('font-family'), 'serif');

    style.setProperty('font', 'caption');
    assert.equal(style.getPropertyValue('font-size'), 'caption');
    assert.equal(style.getPropertyValue('font-family'), 'caption');
  });
});

function bgLonghands(overrides: Record<string, string> = {}): Record<string, ComponentValue[]> {
  const defaults: Record<string, string> = {
    'background-image': 'none',
    'background-position': '0% 0%',
    'background-size': 'auto',
    'background-repeat': 'repeat',
    'background-attachment': 'scroll',
    'background-origin': 'padding-box',
    'background-clip': 'border-box',
    'background-color': 'transparent',
  };
  const merged = { ...defaults, ...overrides };
  const out: Record<string, ComponentValue[]> = {};
  for (const [name, value] of Object.entries(merged)) {
    out[name] = comps(value);
  }
  return out;
}

function contractBackground(overrides: Record<string, string> = {}): string | null {
  return SHORTHANDS['background'].contract(bgLonghands(overrides));
}

describe('MC/DC hotspot: contractBackground', () => {
  test('missing any required longhand returns null', () => {
    const names = [
      'background-image',
      'background-position',
      'background-size',
      'background-repeat',
      'background-attachment',
      'background-origin',
      'background-clip',
      'background-color',
    ];
    for (const missing of names) {
      const longhands = bgLonghands();
      delete longhands[missing];
      assert.equal(SHORTHANDS['background'].contract(longhands), null, `missing ${missing} should not contract`);
    }
  });

  test('layer-count mismatch across longhands returns null', () => {
    const mismatched = bgLonghands({
      'background-image': 'url(a.png), url(b.png)',
      'background-position': '0% 0%',
    });
    assert.equal(SHORTHANDS['background'].contract(mismatched), null);

    const style = new CSSStyleDeclaration();
    style.setProperty('background-image', 'url(a.png), url(b.png)');
    style.setProperty('background-position', '0% 0%');
    style.setProperty('background-size', 'auto');
    style.setProperty('background-repeat', 'repeat');
    style.setProperty('background-attachment', 'scroll');
    style.setProperty('background-origin', 'padding-box');
    style.setProperty('background-clip', 'border-box');
    style.setProperty('background-color', 'red');
    assert.equal(style.getPropertyValue('background'), '');
  });

  test('all-initial longhands contract to none', () => {
    assert.equal(contractBackground(), 'none');
  });

  test('non-none image is serialized', () => {
    const result = contractBackground({ 'background-image': 'url(a.png)' });
    assert.ok(result);
    assert.equal(result.includes('url('), true);
    assert.equal(result.includes('a.png'), true);
  });

  test('initial position/size omitted; non-initial size uses slash; non-initial position kept', () => {
    assert.equal(contractBackground({
      'background-position': '0% 0%',
      'background-size': 'auto',
    }), 'none');

    assert.equal(contractBackground({
      'background-position': 'left top',
      'background-size': 'auto auto',
    }), 'none');

    const sized = contractBackground({
      'background-position': '0% 0%',
      'background-size': 'cover',
    });
    assert.ok(sized);
    assert.equal(sized.includes('/'), true);
    assert.equal(sized.includes('cover'), true);

    const posOnly = contractBackground({
      'background-position': 'center center',
      'background-size': 'auto',
    });
    assert.ok(posOnly);
    assert.equal(posOnly.includes('center'), true);
    assert.equal(posOnly.includes('/'), false);

    const leftCenter = contractBackground({
      'background-position': '0% center',
      'background-size': 'auto',
    });
    assert.equal(leftCenter, 'none');

    const centerLeft = contractBackground({
      'background-position': 'center left',
      'background-size': 'auto',
    });
    assert.equal(centerLeft, 'none');

    const leftCenterKw = contractBackground({
      'background-position': 'left center',
      'background-size': 'auto',
    });
    assert.equal(leftCenterKw, 'none');
  });

  test('repeat contraction: omit initial, map repeat-x/y, collapse identical, keep mixed', () => {
    assert.equal(contractBackground({ 'background-repeat': 'repeat' }), 'none');
    assert.equal(contractBackground({ 'background-repeat': 'repeat repeat' }), 'none');

    assert.equal(contractBackground({ 'background-repeat': 'repeat no-repeat' }), 'repeat-x');
    assert.equal(contractBackground({ 'background-repeat': 'no-repeat repeat' }), 'repeat-y');
    assert.equal(contractBackground({ 'background-repeat': 'space space' }), 'space');
    assert.equal(contractBackground({ 'background-repeat': 'round space' }), 'round space');
    assert.equal(contractBackground({ 'background-repeat': 'no-repeat' }), 'no-repeat');
  });

  test('attachment omitted when scroll and kept otherwise', () => {
    assert.equal(contractBackground({ 'background-attachment': 'scroll' }), 'none');
    assert.equal(contractBackground({ 'background-attachment': 'fixed' }), 'fixed');
    assert.equal(contractBackground({ 'background-attachment': 'local' }), 'local');
  });

  test('origin/clip: defaults omitted, clip-only text/border-area, same box, mixed boxes', () => {
    assert.equal(contractBackground({
      'background-origin': 'padding-box',
      'background-clip': 'border-box',
    }), 'none');

    const textClip = contractBackground({
      'background-origin': 'border-box',
      'background-clip': 'text',
    });
    assert.equal(textClip, 'text');

    const textClipNonDefault = contractBackground({
      'background-origin': 'content-box',
      'background-clip': 'text',
    });
    assert.equal(textClipNonDefault, 'content-box text');

    const borderArea = contractBackground({
      'background-origin': 'border-box',
      'background-clip': 'border-area',
    });
    assert.equal(borderArea, 'border-area');

    const sameBox = contractBackground({
      'background-origin': 'content-box',
      'background-clip': 'content-box',
    });
    assert.equal(sameBox, 'content-box');

    const mixedBox = contractBackground({
      'background-origin': 'content-box',
      'background-clip': 'padding-box',
    });
    assert.equal(mixedBox, 'content-box padding-box');
  });

  test('final-layer color is appended unless transparent', () => {
    assert.equal(contractBackground({ 'background-color': 'transparent' }), 'none');
    assert.equal(contractBackground({ 'background-color': 'red' }), 'red');
    assert.equal(contractBackground({ 'background-color': '#00ff00' })?.toLowerCase().includes('0'), true);
  });

  test('multi-layer contraction puts color only on the last layer', () => {
    const result = contractBackground({
      'background-image': 'url(a.png), url(b.png)',
      'background-position': '0% 0%, center center',
      'background-size': 'auto, cover',
      'background-repeat': 'repeat, no-repeat',
      'background-attachment': 'scroll, fixed',
      'background-origin': 'padding-box, padding-box',
      'background-clip': 'border-box, border-box',
      'background-color': 'blue',
    });
    assert.ok(result);
    const layers = result.split(',').map((s) => s.trim());
    assert.equal(layers.length, 2);
    assert.equal(layers[0].includes('blue'), false);
    assert.equal(layers[1].includes('blue'), true);
    assert.equal(layers[1].includes('cover'), true);
    assert.equal(layers[1].includes('fixed'), true);
    assert.equal(layers[1].includes('no-repeat'), true);
  });

  test('CSSStyleDeclaration getPropertyValue contracts background longhands', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('background-image', 'url("/favicon.ico")');
    style.setProperty('background-position', 'center center');
    style.setProperty('background-size', 'cover');
    style.setProperty('background-repeat', 'no-repeat');
    style.setProperty('background-attachment', 'fixed');
    style.setProperty('background-origin', 'content-box');
    style.setProperty('background-clip', 'content-box');
    style.setProperty('background-color', 'yellow');
    const shorthand = style.getPropertyValue('background');
    assert.equal(shorthand.includes('url('), true);
    assert.equal(shorthand.includes('center'), true);
    assert.equal(shorthand.includes('cover'), true);
    assert.equal(shorthand.includes('no-repeat'), true);
    assert.equal(shorthand.includes('fixed'), true);
    assert.equal(shorthand.includes('content-box'), true);
    assert.equal(shorthand.includes('yellow'), true);
  });
});
