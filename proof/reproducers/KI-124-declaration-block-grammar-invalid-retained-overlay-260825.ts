/**
 * Overlay reproducer for KI-124.  This file stays red until declaration-block
 * parsing validates values against property grammars and drops the failures.
 *
 * Reproduces: KI-124
 * Verifies: SYS-REQ-260825-4R9S
 *
 * Spec anchors:
 * - cssom-1 § "parse a CSS declaration block"
 *   submodules/csswg-drafts/cssom-1/Overview.bs#parse-a-css-declaration-block
 *   (~line 2497), step 3.1: parse each declaration "according to the
 *   appropriate CSS specifications, dropping parts that are said to be
 *   ignored".  css-syntax-3 #consume-a-declaration makes a value that fails
 *   the property grammar a parse error whose declaration is ignored, so a
 *   grammar-invalid declaration must yield getPropertyValue(prop) === ''.
 * - Property grammars probed (one per distinct value type):
 *     width: <length-percentage> | auto | min-content | max-content | ...
 *       (css-sizing-3) — 'red' is an invalid <length-percentage>.
 *     color: <color> (css-color-4) — '10px' is an invalid <color>.
 *     animation-timing-function: <easing-function># (css-easing-1) —
 *       'bogus()' names no known easing function.
 *     margin-left: <length-percentage> | auto (css-box-3 / css-logical) —
 *       'solid' is a border-style keyword, invalid here.
 * - Evidence base: fuzz/oracles/invalid-superset.ts reports 6627 retained
 *   grammar-invalid instances across 811 properties at seed 260825 on HEAD.
 *
 * Filed instance KIs covering narrow slices of this generic root:
 * KI-113 (font shorthand), KI-117 (relative colors), KI-105 (display),
 * KI-104 (keyframes).  None of their probed properties appears here.
 *
 * Observed defect at HEAD via public API:
 *   parse('.o{width:red}').cssRules[0].style.getPropertyValue('width')
 *     === 'red'   (and three more mismatches below)
 *   instead of '' (declaration dropped per cssom-1 step 3.1).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/index.ts';
import type { CSSStyleRule } from '../../src/index.ts';

// Verifies: SYS-REQ-260825-4R9S (KI-124 reproducer helper: declaration probe)
// reqproof:proptest:skip trivial accessor handing back a live declaration object for the enclosing overlay scenario; comparable only through that scenario's own assertions
function styleOf(declarations: string) {
  const sheet = parse(`.k{${declarations}}`);
  return (sheet.cssRules[0] as CSSStyleRule).style;
}

test('control: grammar-valid neighbors of every probed type survive', () => {
  const style = styleOf(
    'width: 10px; color: red; animation-timing-function: linear; margin-left: auto;',
  );
  assert.equal(style.length, 4);
  assert.equal(style.getPropertyValue('width'), '10px');
  assert.equal(style.getPropertyValue('color'), 'red');
  assert.equal(style.getPropertyValue('animation-timing-function'), 'linear');
  assert.equal(style.getPropertyValue('margin-left'), 'auto');
});

test('control: css-syntax declaration splitting still works', () => {
  // The tokenizer splits declarations fine; only grammar validation is absent,
  // so this pins that the defect legs below are retention-of-invalid and not
  // blanket parse failure.
  const style = styleOf('width: red; color: blue;');
  assert.equal(style.length, 2);
});

test('defect: width rejects ident red per css-sizing length-percentage grammar', () => {
  const style = styleOf('width: red;');
  assert.equal(style.getPropertyValue('width'), '', 'grammar-invalid width must be dropped');
  assert.equal(style.length, 0, 'no declaration may remain after the drop');
});

test('defect: color rejects dimension 10px per css-color grammar', () => {
  const style = styleOf('color: 10px;');
  assert.equal(style.getPropertyValue('color'), '', 'grammar-invalid color must be dropped');
  assert.equal(style.length, 0);
});

test('defect: animation-timing-function rejects unknown function bogus()', () => {
  const style = styleOf('animation-timing-function: bogus();');
  assert.equal(
    style.getPropertyValue('animation-timing-function'),
    '',
    'unknown easing function must be dropped',
  );
  assert.equal(style.length, 0);
});

test('defect: margin-left rejects keyword solid per box grammar', () => {
  const style = styleOf('margin-left: solid;');
  assert.equal(style.getPropertyValue('margin-left'), '', 'grammar-invalid margin-left must be dropped');
  assert.equal(style.length, 0);
});
