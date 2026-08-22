/**
 * Overlay reproducer for KI-104.
 *
 * Reproduces: KI-104
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { parse } from '../../src/parser.ts';
import { CSSKeyframesRule } from '../../src/CSSOM.ts';

// Reproduces: KI-104
test('KI-104 animation-name: keyframe rules ignore animation-name', () => {
  // css-animations-1 § 3 #keyframes: animation properties are ignored in a
  // keyframe (except animation-timing-function), and !important declarations
  // are invalid and ignored.
  const sheet = parse('@keyframes fade { from { animation-name: other; opacity: 0; } }');
  const frames = sheet.cssRules[0] as CSSKeyframesRule;
  const style = frames.cssRules[0].style;
  assert.equal(style.getPropertyValue('animation-name'), '',
    'animation-name must be ignored in a keyframe');
  assert.equal(style.getPropertyValue('opacity'), '0',
    'ordinary animatable declarations remain usable');
});

// Reproduces: KI-104
test('KI-104 animation-duration: keyframe rules ignore animation-duration', () => {
  const sheet = parse('@keyframes fade { from { animation-duration: 1s; opacity: 0; } }');
  const style = (sheet.cssRules[0] as CSSKeyframesRule).cssRules[0].style;
  assert.equal(style.getPropertyValue('animation-duration'), '',
    'animation-duration must be ignored in a keyframe');
  assert.equal(style.getPropertyValue('opacity'), '0',
    'ordinary animatable declarations remain usable');
});

// Reproduces: KI-104
test('KI-104 important: keyframe !important declarations are ignored', () => {
  const sheet = parse('@keyframes fade { from { opacity: 0 !important; } }');
  const style = (sheet.cssRules[0] as CSSKeyframesRule).cssRules[0].style;
  assert.equal(style.getPropertyValue('opacity'), '',
    'a !important keyframe declaration must be ignored');
});

// Reproduces: KI-104
test('KI-104 timing-function control: the allowed exception is retained', () => {
  const sheet = parse('@keyframes fade { from { animation-timing-function: ease-in; } }');
  const style = (sheet.cssRules[0] as CSSKeyframesRule).cssRules[0].style;
  assert.equal(style.getPropertyValue('animation-timing-function'), 'ease-in',
    'animation-timing-function is the allowed animation-property exception');
});
