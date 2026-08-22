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
test('KI-104: keyframe rules drop animation declarations and !important', () => {
  // css-animations-1 § 3 #keyframes: animation properties are ignored in a
  // keyframe (except animation-timing-function), and !important declarations
  // are invalid and ignored.
  const sheet = parse(
    '@keyframes fade { from { animation-name: other; animation-duration: 1s; opacity: 0 !important; } }',
  );
  const frames = sheet.cssRules[0] as CSSKeyframesRule;
  const style = frames.cssRules[0].style;
  assert.equal(style.getPropertyValue('animation-name'), '',
    'animation-name must be ignored in a keyframe');
  assert.equal(style.getPropertyValue('animation-duration'), '',
    'animation-duration must be ignored in a keyframe');
  assert.equal(style.getPropertyValue('opacity'), '',
    'a !important keyframe declaration must be ignored');
});
