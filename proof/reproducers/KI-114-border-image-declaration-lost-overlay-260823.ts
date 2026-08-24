/**
 * Overlay reproducer for KI-114.  This file intentionally stays red until a
 * grammatically valid `border-image` declaration stops being laundered into
 * initial longhands and vanishing from the serialized declaration block.
 *
 * Reproduces: KI-114
 * Verifies: SYS-REQ-260823-1V3K (border-image declarations are retained in full
 *           and never omitted from declaration-block serialization)
 *
 * Spec anchors:
 * - cssom-1 § "serialize a CSS declaration block"
 *   submodules/csswg-drafts/cssom-1/Overview.bs#serialize-a-css-declaration-block
 *   (~line 2523): the declaration loop has NO step that permits omitting a
 *   retained declaration — every declaration either folds into a shorthand
 *   serialization or is appended individually ("Let value be the result of
 *   invoking serialize a CSS value of declaration … Append serialized
 *   declaration to list.").  This section explicitly lists the local WPT
 *   fixture css/cssom/border-shorthand-serialization.html in its <wpt> block.
 * - cssom-1 § "parse a CSS declaration block" (#parse-a-css-declaration-block)
 *   step 3.1 licenses dropping declarations ONLY when they fail their grammar.
 * - css-backgrounds-3 § "border-image" (#borderimage):
 *     Value: <'border-image-source'> || <'border-image-slice'>
 *            [ / <'border-image-width'> | / <'border-image-width'>? /
 *              <'border-image-outset> ]? || <'border-image-repeat>
 *   `url("x") 60` (quoted <<url>> + numeric slice) and `url(x) 60` are both
 *   grammatically valid; #border-image-slice accepts <<number [0,∞]>> | fill.
 * - Local WPT fixture css/cssom/border-shorthand-serialization.html
 *   (rows .a/.b/.c reproduced verbatim as green controls below); its .b row
 *   asserts `rule.style.border === ""` whenever border-image longhands are
 *   not initial ("border shorthand isn't serialized if border-image longhands
 *   are not initial").
 *
 * Observed defect (two layers, same user-visible hole):
 * 1. expandBorderImage (src/shorthands.ts ~955-1001) only recognizes
 *    token-type 'url' values as the image source.  A QUOTED url (`url("x")`)
 *    reaches the expander as a function token named "url" (css-syntax-3
 *    §4.3.6 #consume-ident-like-token parses quoted urls as function tokens),
 *    so the source silently stays `none`.  The declaration is stored as an
 *    all-initial border-image-* expansion and `getPropertyValue('border-image')`
 *    reads "none"; cssText drops the author's declaration entirely even though
 *    it is grammatically valid and parse-a-css-declaration-block licensed
 *    dropping only grammar-failing values.
 * 2. expandBorderImage additionally discards trailing components (the `60`
 *    slice) without invalidating the partial result, so even the recognized
 *    unquoted form loses the slice: `url(x) 60` stores source=url("x"),
 *    slice="100%" and re-serializes as `border-image: url("x");`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/index.ts';
import type { CSSStyleRule } from '../../src/index.ts';

// Verifies: SYS-REQ-260823-1V3K (KI-114 reproducer helper: declaration-block style probe)
// reqproof:proptest:skip trivial accessor returning the first style entry of a live rule graph for the enclosing overlay scenario; nothing comparable in isolation
function firstStyleOf(cssText: string) {
  const sheet = parse(cssText);
  return (sheet.cssRules[0] as CSSStyleRule).style;
}

// ---------------------------------------------------------------------------
// Green controls: WPT css/cssom/border-shorthand-serialization.html rows .a,
// .b and .c, asserted verbatim.  These prove the border shorthand suppression
// guard exists when border-image longhands are genuinely non-initial, and
// isolate the escape to the quoted-url / slice handling inside border-image
// expansion.
// ---------------------------------------------------------------------------

// Verifies: SYS-REQ-260823-1V3K (WPT border-shorthand-serialization.html row .a control)
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
test('KI-114 control: WPT row .a — border longhands alone do not serialize a border shorthand', () => {
  // .a { border-width: 1px; border-style: solid; border-color: black; }
  const style = firstStyleOf('.a{border-width:1px;border-style:solid;border-color:black;}');
  assert.equal(
    style.getPropertyValue('border'),
    '',
    "border shorthand isn't serialized if border-image longhands are not initial",
  );
});

// Verifies: SYS-REQ-260823-1V3K (WPT border-shorthand-serialization.html row .b control)
test('KI-114 control: WPT row .b — longhands + gradient border-image keep the declaration and suppress border', () => {
  // .b { border-width: 1px; border-style: solid; border-color: black;
  //      border-image: linear-gradient(white,black); }
  const style = firstStyleOf(
    '.b{border-width:1px;border-style:solid;border-color:black;border-image:linear-gradient(white,black);}',
  );
  assert.equal(
    style.getPropertyValue('border'),
    '',
    "border shorthand isn't serialized if border-image longhands are not initial",
  );
  assert.notEqual(style.getPropertyValue('border-image'), '', 'the gradient border-image survives');
});

// Verifies: SYS-REQ-260823-1V3K (WPT border-shorthand-serialization.html row .c control)
test('KI-114 control: WPT row .c — declared border shorthand serializes', () => {
  // .c { border: 1px solid black; }
  const style = firstStyleOf('.c{border:1px solid black;}');
  assert.notEqual(style.getPropertyValue('border'), '', 'border shorthand ');
  assert.match(style.cssText, /border: 1px solid black;/);
});

// ---------------------------------------------------------------------------
// Defect legs (red until fixed).
// ---------------------------------------------------------------------------

// WPT row .b modeled with the most common authoring form of an image source:
// a quoted url plus a numeric slice.  `url("x") 60` is grammatically valid per
// css-backgrounds-3 #borderimage, so cssom-1 #parse-a-css-declaration-block
// does NOT license dropping it, and cssom-1
// #serialize-a-css-declaration-block provides no omission step.
// Reproduces: KI-114
// Verifies: SYS-REQ-260823-1V3K leg 1 (retention).
test('KI-114: parse(.o{…;border-image:url("x") 60}) retains border-image', () => {
  const style = firstStyleOf(
    '.o{border-width:1px;border-style:solid;border-color:red;border-image:url("x") 60}',
  );
  assert.notEqual(
    style.getPropertyValue('border-image'),
    '',
    'a grammatically valid border-image declaration must be retained',
  );
  assert.equal(
    style.getPropertyValue('border-image-source'),
    'url("x")',
    'the quoted url is the border-image-source (css-backgrounds-3 #borderimage)',
  );
  assert.equal(
    style.getPropertyValue('border-image-slice'),
    '60',
    'the numeric slice component applies (#border-image-slice accepts <<number [0,∞]>>)',
  );
});

// Same defect through the border-shorthand entry path: the author set a
// non-initial border-image next to `border`, so per WPT row .b the border
// shorthand must stay suppressed and the border-image must survive.
// Reproduces: KI-114
// Verifies: SYS-REQ-260823-1V3K leg 2.
test('KI-114: parse(.o{border:1px solid red;border-image:url("x") 60}) retains border-image', () => {
  const style = firstStyleOf('.o{border:1px solid red;border-image:url("x") 60}');
  assert.notEqual(style.getPropertyValue('border-image'), '', 'border-image must survive');
  assert.equal(
    style.getPropertyValue('border'),
    '',
    "border shorthand isn't serialized if border-image longhands are not initial",
  );
});

// cssom-1 #serialize-a-css-declaration-block declaration loop appends every
// retained declaration to the output list; omitting border-image from cssText
// violates the serialization steps outright.
// Reproduces: KI-114
// Verifies: SYS-REQ-260823-1V3K leg 3 (no omission).
test('KI-114: cssText does not omit the retained border-image declaration', () => {
  const style = firstStyleOf(
    '.o{border-width:1px;border-style:solid;border-color:red;border-image:url("x") 60}',
  );
  assert.ok(
    style.cssText.includes('border-image'),
    `declaration block must serialize the set border-image declaration, got: ${JSON.stringify(style.cssText)}`,
  );
});

// Partial-application layer: with an UNQUOTED url the source is recognized,
// but the trailing `60` slice is dropped silently instead of applying (or
// invalidating the whole declaration).  Silent truncation of a valid value is
// licensed by neither css-backgrounds-3 #borderimage nor cssom-1
// #parse-a-css-declaration-block step 3.1.
// Reproduces: KI-114
// Verifies: SYS-REQ-260823-1V3K leg 4 (full-value application).
test('KI-114: parse(.o{border-image:url(x) 60}) applies the slice instead of dropping it', () => {
  const style = firstStyleOf('.o{border-image:url(x) 60}');
  assert.equal(
    style.getPropertyValue('border-image-slice'),
    '60',
    'the slice component of the valid border-image value applies',
  );
  assert.match(
    style.getPropertyValue('border-image'),
    /60/,
    'the shorthand read-back reflects the applied slice',
  );
});
