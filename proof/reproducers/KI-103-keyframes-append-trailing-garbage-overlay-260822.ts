/**
 * Overlay reproducer for KI-103.
 *
 * Reproduces: KI-103
 * Verifies: SYS-REQ-260822-50T6
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { parse } from '../../src/parser.ts';
import { CSSKeyframesRule } from '../../src/CSSOM.ts';

// Reproduces: KI-103
test('KI-103 valid control: appendRule appends a complete keyframe rule', () => {
  // css-animations-1 § 5.3 #interface-csskeyframesrule-appendrule: a valid
  // complete keyframe rule is always appended.
  const sheet = parse('@keyframes fade {}');
  const frames = sheet.cssRules[0] as CSSKeyframesRule;
  frames.appendRule('from { opacity: 0; }');
  assert.equal(frames.length, 1,
    'appendRule must append a complete keyframe rule');
});

// Reproduces: KI-103
test('KI-103 malformed input: appendRule rejects trailing garbage', () => {
  // css-animations-1 § 5.3 #interface-csskeyframesrule-appendrule: the
  // argument is one complete keyframe rule; CSS Syntax § 5.4.1 #parse-rule
  // requires the parsed rule input to be consumed without trailing tokens.
  const sheet = parse('@keyframes fade {}');
  const frames = sheet.cssRules[0] as CSSKeyframesRule;
  frames.appendRule('from { opacity: 0; } trailing-garbage');
  assert.equal(frames.length, 0,
    'appendRule must not append when the argument has trailing garbage');
});
