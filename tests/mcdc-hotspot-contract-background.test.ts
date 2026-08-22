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
// Verifies: SYS-REQ-260821-8TGB, SW-REQ-260821-HNRG, SYS-REQ-260821-KV30, SW-REQ-260821-YTV6
// Leftover unique-cause for src/shorthands.ts contractBackground, driven only
// through CSSStyleDeclaration.cssText after setProperty of background longhands.
// cssom-1 § 6.7.2 #serialize-a-css-declaration-block / css-backgrounds-3
// § 3.10 #the-background / § 3.4 #the-background-repeat. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';

const BG_INITIAL: Record<string, string> = {
  'background-image': 'none',
  'background-position': '0% 0%',
  'background-size': 'auto',
  'background-repeat': 'repeat',
  'background-attachment': 'scroll',
  'background-origin': 'padding-box',
  'background-clip': 'border-box',
  'background-color': 'transparent',
};

const TWO_LAYER: Record<string, string> = {
  'background-image': 'url(a.png), url(b.png)',
  'background-position': '0% 0%, 0% 0%',
  'background-size': 'auto, auto',
  'background-repeat': 'repeat, repeat',
  'background-attachment': 'scroll, scroll',
  'background-origin': 'padding-box, padding-box',
  'background-clip': 'border-box, border-box',
  'background-color': 'red',
};

const TWO_LAYER_ONE: Record<string, string> = {
  'background-image': 'url(a.png)',
  'background-position': '0% 0%',
  'background-size': 'auto',
  'background-repeat': 'repeat',
  'background-attachment': 'scroll',
  'background-origin': 'padding-box',
  'background-clip': 'border-box',
};

function setBgLonghands(
  overrides: Record<string, string> = {},
  important = false,
): CSSStyleDeclaration {
  const style = new CSSStyleDeclaration();
  const merged = { ...BG_INITIAL, ...overrides };
  const priority = important ? 'important' : '';
  for (const [name, value] of Object.entries(merged)) {
    style.setProperty(name, value, priority);
  }
  return style;
}

function bgCssText(overrides: Record<string, string> = {}, important = false): string {
  return setBgLonghands(overrides, important).cssText;
}

describe('MC/DC leftover: contractBackground via cssText (cssom-1 #serialize-a-css-declaration-block)', () => {
  test('all-initial longhands contract to background: none', () => {
    assert.equal(bgCssText(), 'background: none;');
  });

  test('color, image, and attachment unique-cause combinations', () => {
    assert.equal(bgCssText({ 'background-color': 'red' }), 'background: red;');
    assert.equal(bgCssText({ 'background-color': 'transparent' }), 'background: none;');
    assert.equal(bgCssText({ 'background-color': 'TRANSPARENT' }), 'background: none;');
    assert.equal(bgCssText({ 'background-color': 'currentcolor' }), 'background: currentcolor;');
    assert.equal(bgCssText({ 'background-color': '#00ff00' }), 'background: #00ff00;');
    assert.equal(bgCssText({ 'background-color': 'rgb(1, 2, 3)' }), 'background: rgb(1, 2, 3);');

    assert.equal(bgCssText({ 'background-image': 'url(a.png)' }), 'background: url("a.png");');
    assert.equal(
      bgCssText({ 'background-image': 'linear-gradient(red, blue)' }),
      'background: linear-gradient(red, blue);',
    );
    // imgVal !== 'none' is case-sensitive; NONE is treated as a non-none image.
    assert.equal(bgCssText({ 'background-image': 'NONE' }), 'background: NONE;');
    assert.equal(bgCssText({ 'background-image': 'none none' }), 'background: none none;');

    assert.equal(bgCssText({ 'background-attachment': 'scroll' }), 'background: none;');
    assert.equal(bgCssText({ 'background-attachment': 'Scroll' }), 'background: none;');
    assert.equal(bgCssText({ 'background-attachment': 'fixed' }), 'background: fixed;');
    assert.equal(bgCssText({ 'background-attachment': 'local' }), 'background: local;');

    assert.equal(
      bgCssText({
        'background-image': 'url(a.png)',
        'background-color': 'yellow',
        'background-attachment': 'fixed',
      }),
      'background: url("a.png") fixed yellow;',
    );
  });

  test('position/size unique-cause: omit initial, slash size, position-only', () => {
    // css-backgrounds-3 § 3.6 #the-background-position / § 3.9 #the-background-size
    for (const position of ['0% 0%', 'left top', '0% center', 'center left', 'left center', 'LEFT TOP']) {
      assert.equal(bgCssText({ 'background-position': position }), 'background: none;', position);
    }
    assert.equal(bgCssText({ 'background-size': 'auto' }), 'background: none;');
    assert.equal(bgCssText({ 'background-size': 'auto auto' }), 'background: none;');
    assert.equal(bgCssText({ 'background-size': 'AUTO AUTO' }), 'background: none;');
    assert.equal(
      bgCssText({ 'background-position': 'left top', 'background-size': 'auto auto' }),
      'background: none;',
    );

    assert.equal(
      bgCssText({ 'background-position': '0% 0%', 'background-size': 'cover' }),
      'background: 0% 0% / cover;',
    );
    assert.equal(
      bgCssText({ 'background-position': 'center center', 'background-size': 'contain' }),
      'background: center center / contain;',
    );
    assert.equal(
      bgCssText({ 'background-size': '10px 20px' }),
      'background: 0% 0% / 10px 20px;',
    );
    assert.equal(
      bgCssText({ 'background-size': 'auto 10px' }),
      'background: 0% 0% / auto 10px;',
    );

    assert.equal(
      bgCssText({ 'background-position': 'center center', 'background-size': 'auto' }),
      'background: center center;',
    );
    assert.equal(
      bgCssText({ 'background-position': '10px 20px' }),
      'background: 10px 20px;',
    );
    assert.equal(
      bgCssText({ 'background-position': 'top right' }),
      'background: top right;',
    );
  });

  test('repeat-x/y, collapse identical, mixed, 1-token, 3-token', () => {
    // css-backgrounds-3 § 3.4 #the-background-repeat — repeat-x = repeat no-repeat
    assert.equal(bgCssText({ 'background-repeat': 'repeat' }), 'background: none;');
    assert.equal(bgCssText({ 'background-repeat': 'repeat repeat' }), 'background: none;');
    assert.equal(bgCssText({ 'background-repeat': 'REPEAT REPEAT' }), 'background: none;');

    assert.equal(bgCssText({ 'background-repeat': 'repeat no-repeat' }), 'background: repeat-x;');
    assert.equal(bgCssText({ 'background-repeat': 'no-repeat repeat' }), 'background: repeat-y;');
    assert.equal(bgCssText({ 'background-repeat': 'repeat-x' }), 'background: repeat-x;');
    assert.equal(bgCssText({ 'background-repeat': 'repeat-y' }), 'background: repeat-y;');

    assert.equal(bgCssText({ 'background-repeat': 'space space' }), 'background: space;');
    assert.equal(bgCssText({ 'background-repeat': 'round round' }), 'background: round;');
    assert.equal(bgCssText({ 'background-repeat': 'no-repeat no-repeat' }), 'background: no-repeat;');
    assert.equal(bgCssText({ 'background-repeat': 'round space' }), 'background: round space;');
    assert.equal(bgCssText({ 'background-repeat': 'space round' }), 'background: space round;');
    assert.equal(bgCssText({ 'background-repeat': 'no-repeat' }), 'background: no-repeat;');
    assert.equal(bgCssText({ 'background-repeat': 'space' }), 'background: space;');
    assert.equal(
      bgCssText({ 'background-repeat': 'repeat no-repeat space' }),
      'background: repeat no-repeat space;',
    );
    assert.equal(
      bgCssText({ 'background-repeat': 'repeat-x no-repeat' }),
      'background: repeat-x no-repeat;',
    );
  });

  test('origin/clip unique-cause: defaults, XOR padding-box/border-box, clip-only, same/mixed, substring includes', () => {
    // css-backgrounds-3 § 3.7 #the-background-origin / § 3.8 #the-background-clip
    // css-backgrounds-4 clip-only `text` / `border-area`
    assert.equal(
      bgCssText({ 'background-origin': 'padding-box', 'background-clip': 'border-box' }),
      'background: none;',
    );

    // origVal !== padding-box, clipVal === border-box
    assert.equal(
      bgCssText({ 'background-origin': 'content-box', 'background-clip': 'border-box' }),
      'background: content-box border-box;',
    );
    assert.equal(
      bgCssText({ 'background-origin': 'border-box', 'background-clip': 'border-box' }),
      'background: border-box;',
    );

    // origVal === padding-box, clipVal !== border-box
    assert.equal(
      bgCssText({ 'background-origin': 'padding-box', 'background-clip': 'padding-box' }),
      'background: padding-box;',
    );
    assert.equal(
      bgCssText({ 'background-origin': 'padding-box', 'background-clip': 'content-box' }),
      'background: padding-box content-box;',
    );

    assert.equal(
      bgCssText({ 'background-origin': 'content-box', 'background-clip': 'content-box' }),
      'background: content-box;',
    );
    assert.equal(
      bgCssText({ 'background-origin': 'content-box', 'background-clip': 'padding-box' }),
      'background: content-box padding-box;',
    );
    assert.equal(
      bgCssText({ 'background-origin': 'CONTENT-BOX', 'background-clip': 'content-box' }),
      'background: CONTENT-BOX;',
    );

    assert.equal(
      bgCssText({ 'background-origin': 'border-box', 'background-clip': 'text' }),
      'background: text;',
    );
    assert.equal(
      bgCssText({ 'background-origin': 'content-box', 'background-clip': 'text' }),
      'background: content-box text;',
    );
    assert.equal(
      bgCssText({ 'background-origin': 'padding-box', 'background-clip': 'text' }),
      'background: padding-box text;',
    );
    assert.equal(
      bgCssText({ 'background-origin': 'border-box', 'background-clip': 'border-area' }),
      'background: border-area;',
    );
    assert.equal(
      bgCssText({ 'background-origin': 'padding-box', 'background-clip': 'border-area' }),
      'background: padding-box border-area;',
    );

    // isClipOnly via includes('text') / includes('border-area') without exact keyword match
    assert.equal(
      bgCssText({ 'background-origin': 'border-box', 'background-clip': 'text extra' }),
      'background: text extra;',
    );
    assert.equal(
      bgCssText({ 'background-origin': 'padding-box', 'background-clip': 'text extra' }),
      'background: padding-box text extra;',
    );
    assert.equal(
      bgCssText({ 'background-origin': 'padding-box', 'background-clip': 'extra text' }),
      'background: padding-box extra text;',
    );
    assert.equal(
      bgCssText({ 'background-origin': 'border-box', 'background-clip': 'border-area extra' }),
      'background: border-area extra;',
    );
    assert.equal(
      bgCssText({ 'background-origin': 'padding-box', 'background-clip': 'extra border-area' }),
      'background: padding-box extra border-area;',
    );
    assert.equal(
      bgCssText({ 'background-clip': 'text border-area' }),
      'background: padding-box text border-area;',
    );
    assert.equal(
      bgCssText({ 'background-clip': 'padding-box extra' }),
      'background: padding-box padding-box extra;',
    );
  });

  test('layer-count unique-cause mismatch for each longhand returns uncontracted cssText', () => {
    assert.equal(bgCssText(TWO_LAYER), 'background: url("a.png"), url("b.png") red;');

    const mismatches: Array<[string, string]> = [
      [
        'background-image',
        'background-image: url("a.png"); background-position: 0% 0%, 0% 0%; background-size: auto, auto; background-repeat: repeat, repeat; background-attachment: scroll, scroll; background-origin: padding-box, padding-box; background-clip: border-box, border-box; background-color: red;',
      ],
      [
        'background-position',
        'background-image: url("a.png"), url("b.png"); background-position: 0% 0%; background-size: auto, auto; background-repeat: repeat, repeat; background-attachment: scroll, scroll; background-origin: padding-box, padding-box; background-clip: border-box, border-box; background-color: red;',
      ],
      [
        'background-size',
        'background-image: url("a.png"), url("b.png"); background-position: 0% 0%, 0% 0%; background-size: auto; background-repeat: repeat, repeat; background-attachment: scroll, scroll; background-origin: padding-box, padding-box; background-clip: border-box, border-box; background-color: red;',
      ],
      [
        'background-repeat',
        'background-image: url("a.png"), url("b.png"); background-position: 0% 0%, 0% 0%; background-size: auto, auto; background-repeat: repeat; background-attachment: scroll, scroll; background-origin: padding-box, padding-box; background-clip: border-box, border-box; background-color: red;',
      ],
      [
        'background-attachment',
        'background-image: url("a.png"), url("b.png"); background-position: 0% 0%, 0% 0%; background-size: auto, auto; background-repeat: repeat, repeat; background-attachment: scroll; background-origin: padding-box, padding-box; background-clip: border-box, border-box; background-color: red;',
      ],
      [
        'background-origin',
        'background-image: url("a.png"), url("b.png"); background-position: 0% 0%, 0% 0%; background-size: auto, auto; background-repeat: repeat, repeat; background-attachment: scroll, scroll; background-origin: padding-box; background-clip: border-box, border-box; background-color: red;',
      ],
      [
        'background-clip',
        'background-image: url("a.png"), url("b.png"); background-position: 0% 0%, 0% 0%; background-size: auto, auto; background-repeat: repeat, repeat; background-attachment: scroll, scroll; background-origin: padding-box, padding-box; background-clip: border-box; background-color: red;',
      ],
    ];

    for (const [name, expected] of mismatches) {
      const overrides = { ...TWO_LAYER, [name]: TWO_LAYER_ONE[name] };
      assert.equal(bgCssText(overrides), expected, `unique-cause mismatch of ${name}`);
      assert.equal(bgCssText(overrides).startsWith('background:'), false, `${name} must not contract`);
    }
  });

  test('empty last/first layer unique-cause via trailing/leading commas still contracts', () => {
    const twoNonInitial: Record<string, string> = {
      'background-image': 'url(a.png), url(b.png)',
      'background-position': '10px 10px, 20px 20px',
      'background-size': 'cover, contain',
      'background-repeat': 'no-repeat, space',
      'background-attachment': 'fixed, local',
      'background-origin': 'content-box, border-box',
      'background-clip': 'content-box, padding-box',
      'background-color': 'red',
    };
    assert.equal(
      bgCssText(twoNonInitial),
      'background: url("a.png") 10px 10px / cover no-repeat fixed content-box, url("b.png") 20px 20px / contain space local border-box padding-box red;',
    );

    // posVal === '' XOR sizeVal === '' skips the position/size arm (AND unique-cause).
    assert.equal(
      bgCssText({ ...twoNonInitial, 'background-position': '10px 10px,' }),
      'background: url("a.png") 10px 10px / cover no-repeat fixed content-box, url("b.png") space local border-box padding-box red;',
    );
    assert.equal(
      bgCssText({ ...twoNonInitial, 'background-size': 'cover,' }),
      'background: url("a.png") 10px 10px / cover no-repeat fixed content-box, url("b.png") space local border-box padding-box red;',
    );
    assert.equal(
      bgCssText({
        ...twoNonInitial,
        'background-position': '10px 10px,',
        'background-size': 'cover,',
      }),
      'background: url("a.png") 10px 10px / cover no-repeat fixed content-box, url("b.png") space local border-box padding-box red;',
    );

    assert.equal(
      bgCssText({ ...twoNonInitial, 'background-repeat': 'no-repeat,' }),
      'background: url("a.png") 10px 10px / cover no-repeat fixed content-box, url("b.png") 20px 20px / contain local border-box padding-box red;',
    );
    assert.equal(
      bgCssText({ ...twoNonInitial, 'background-attachment': 'fixed,' }),
      'background: url("a.png") 10px 10px / cover no-repeat fixed content-box, url("b.png") 20px 20px / contain space border-box padding-box red;',
    );

    // origVal === '' XOR clipVal === '' skips the origin/clip arm.
    assert.equal(
      bgCssText({ ...twoNonInitial, 'background-origin': 'content-box,' }),
      'background: url("a.png") 10px 10px / cover no-repeat fixed content-box, url("b.png") 20px 20px / contain space local red;',
    );
    assert.equal(
      bgCssText({ ...twoNonInitial, 'background-clip': 'content-box,' }),
      'background: url("a.png") 10px 10px / cover no-repeat fixed content-box, url("b.png") 20px 20px / contain space local red;',
    );

    // imgVal === '' on the last layer omits the image (hasImage unique-cause).
    assert.equal(
      bgCssText({ ...twoNonInitial, 'background-image': 'url(a.png),' }),
      'background: url("a.png") 10px 10px / cover no-repeat fixed content-box, 20px 20px / contain space local border-box padding-box red;',
    );

    assert.equal(
      bgCssText({
        'background-image': 'url(a.png), url(b.png),',
        'background-position': '0% 0%, 0% 0%,',
        'background-size': 'auto, auto,',
        'background-repeat': 'repeat, repeat,',
        'background-attachment': 'scroll, scroll,',
        'background-origin': 'padding-box, padding-box,',
        'background-clip': 'border-box, border-box,',
        'background-color': 'red',
      }),
      'background: url("a.png"), url("b.png"), red;',
    );
    assert.equal(
      bgCssText({
        'background-image': 'url(a.png), url(b.png),',
        'background-position': '0% 0%, 0% 0%,',
        'background-size': 'auto, auto,',
        'background-repeat': 'repeat, repeat,',
        'background-attachment': 'scroll, scroll,',
        'background-origin': 'padding-box, padding-box,',
        'background-clip': 'border-box, border-box,',
        'background-color': 'transparent',
      }),
      'background: url("a.png"), url("b.png"), none;',
    );

    assert.equal(
      bgCssText({ ...twoNonInitial, 'background-position': ', 20px 20px' }),
      'background: url("a.png") no-repeat fixed content-box, url("b.png") 20px 20px / contain space local border-box padding-box red;',
    );
    assert.equal(
      bgCssText({ ...twoNonInitial, 'background-image': ', url(b.png)' }),
      'background: 10px 10px / cover no-repeat fixed content-box, url("b.png") 20px 20px / contain space local border-box padding-box red;',
    );
  });

  test('multi-layer color only on last layer; first-layer color omitted', () => {
    assert.equal(
      bgCssText({
        'background-image': 'url(a.png), none, url(c.png)',
        'background-position': '10px 10px, 0% 0%, center',
        'background-size': 'cover, auto, contain',
        'background-repeat': 'no-repeat, repeat, repeat no-repeat',
        'background-attachment': 'fixed, scroll, local',
        'background-origin': 'content-box, padding-box, border-box',
        'background-clip': 'content-box, border-box, text',
        'background-color': 'navy',
      }),
      'background: url("a.png") 10px 10px / cover no-repeat fixed content-box, none, url("c.png") center / contain repeat-x local text navy;',
    );
    assert.equal(
      bgCssText({
        'background-image': 'none, url(a.png)',
        'background-position': 'center, 0% 0%',
        'background-size': 'cover, auto',
        'background-repeat': 'no-repeat, repeat no-repeat',
        'background-attachment': 'fixed, scroll',
        'background-origin': 'content-box, padding-box',
        'background-clip': 'content-box, border-box',
        'background-color': 'yellow',
      }),
      'background: center / cover no-repeat fixed content-box, url("a.png") repeat-x yellow;',
    );
  });

  test('full longhand combination and !important contract through cssText', () => {
    assert.equal(
      bgCssText({
        'background-image': 'url(a.png)',
        'background-position': 'center',
        'background-size': 'cover',
        'background-repeat': 'repeat-x',
        'background-attachment': 'fixed',
        'background-origin': 'content-box',
        'background-clip': 'padding-box',
        'background-color': 'yellow',
      }),
      'background: url("a.png") center / cover repeat-x fixed content-box padding-box yellow;',
    );

    assert.equal(
      bgCssText({ 'background-color': 'red' }, true),
      'background: red !important;',
    );
  });
});
