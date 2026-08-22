/**
 * Overlay reproducer for KI-101. This deliberately stays red: the product
 * parser creates keyframe children without attaching their CSSRule links, and
 * deleteRule leaves links on a detached child.
 *
 * Reproduces: KI-101
 * Verifies: SYS-REQ-260822-YEQZ
 * Verifies: SYS-REQ-260822-FM19
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { parse } from '../../src/parser.ts';
import { CSSKeyframesRule, CSSKeyframeRule } from '../../src/CSSOM.ts';

// Reproduces: KI-101
test('KI-101: parsed keyframe children attach to and detach from CSSRule owners', () => {
  // cssom-1 § 6.4 #concept-css-rule-parent-css-rule and
  // #concept-css-rule-parent-css-style-sheet: an enclosed rule has a parent
  // rule and an attached rule has its containing stylesheet.
  const sheet = parse('@keyframes fade { from { opacity: 0; } }');
  const frames = sheet.cssRules[0] as CSSKeyframesRule;
  const parsedChild = frames.cssRules[0] as CSSKeyframeRule;
  assert.equal(parsedChild instanceof CSSKeyframeRule, true);
  assert.equal(parsedChild.parentRule === frames, true,
    'parsed keyframe child must expose its enclosing CSSKeyframesRule');
  assert.equal(parsedChild.parentStyleSheet === sheet, true,
    'parsed keyframe child must expose its containing CSSStyleSheet');
});

// Reproduces: KI-101
test('KI-101: deleting an appended keyframe child clears its owner links', () => {
  // cssom-1 § 6.4 #concept-css-rule-parent-css-rule: parent CSS rule is
  // mutable and becomes null when a child is removed from its rule list.
  const sheet = parse('@keyframes fade {}');
  const frames = sheet.cssRules[0] as CSSKeyframesRule;
  frames.appendRule('to { opacity: 1; }');
  const child = frames.cssRules[0] as CSSKeyframeRule;
  assert.equal(child.parentRule === frames, true,
    'appended keyframe child must be attached before deletion');
  frames.deleteRule('to');
  assert.equal(child.parentRule === null, true,
    'deleted keyframe child must no longer expose its former parent rule');
  assert.equal(child.parentStyleSheet === null, true,
    'deleted keyframe child must no longer expose its former stylesheet');
});
