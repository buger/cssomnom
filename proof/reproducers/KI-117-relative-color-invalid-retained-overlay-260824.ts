/**
 * Overlay reproducer for KI-117.  This file intentionally stays red until
 * declaration-block parsing drops color declarations whose values fail the
 * css-color grammar, including the WPT-invalid relative color spellings.
 *
 * Reproduces: KI-117
 * Verifies: SYS-REQ-260824-CFQG
 *
 * Spec anchors:
 * - cssom-1 § "parse a CSS declaration block"
 *   submodules/csswg-drafts/cssom-1/Overview.bs#parse-a-css-declaration-block
 *   (~line 2500), step 3.1: declarations are parsed "according to the
 *   appropriate CSS specifications, dropping parts that are said to be
 *   ignored".  Dropping is licensed ONLY for grammar-failing values and is
 *   REQUIRED for them.
 * - css-color-5 § "Relative Colors" (#relative-colors, ~line 962): a relative
 *   color must name an origin color and then per-channel components drawn
 *   from the origin color's channel keywords; e.g. rgb() channels accept
 *   <<number>>/<<percentage>>/channel keywords, never <<angle>>.
 * - Local WPT fixture css/css-color/parsing/color-invalid-relative-color.html
 *   asserts via test_invalid_value(`color`, ...) that these spellings fail to
 *   parse, e.g. `rgb(from rebeccapurple r 10deg 10)` and
 *   `rgb(from rebeccapurple red g b)`.
 *
 * Ledger-audit correction (honest scoping): the audited cluster claimed valid
 * relative colors DROP whole rules.  Investigation shows the opposite: valid
 * relative colors round-trip fine (positive control below; bare-value
 * stylesheets yielding zero rules is css-syntax-correct), while GRAMMAR-
 * INVALID relative colors are silently RETAINED.  This file pins the verified
 * direction.  The ~226 lightning baseline rows additionally expect computed
 * absolute colors, which is a separate whole-subsystem gap queued in
 * docs/proof-escape-ki-117-121.md.
 *
 * Observed defect at HEAD via public API:
 *   parse('.k{color:rgb(from rebeccapurple r 10deg 10);}').cssRules[0].style
 *     .getPropertyValue('color') === 'rgb(from rebeccapurple r 10deg 10)'
 *   instead of '' (declaration dropped per cssom-1 step 3.1).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/index.ts';
import type { CSSStyleRule } from '../../src/index.ts';

// Verifies: SYS-REQ-260824-CFQG (KI-117 reproducer helper: declaration-block style probe)
// reqproof:proptest:skip trivial accessor handing back a live declaration object for the enclosing overlay scenario; comparable only through that scenario's own assertions
function styleOf(declarations: string) {
  const sheet = parse(`.k{${declarations}}`);
  return (sheet.cssRules[0] as CSSStyleRule).style;
}

// Positive control (green today): a grammar-valid relative color survives
// parse() intact — the defect under test is NOT blanket rejection of the
// relative-color syntax.
test('KI-117 control: valid relative color lch(from orchid l 30 h) is retained', () => {
  const value = styleOf('color:lch(from orchid l 30 h);').getPropertyValue('color');
  assert.equal(value, 'lch(from orchid l 30 h)');
});

// WPT color-invalid-relative-color.html test_invalid_value rows: each of
// these fails the css-color grammar, so cssom-1 #parse-a-css-declaration-block
// step 3.1 requires the declaration to be dropped -> getPropertyValue returns
// the empty string.
// Verifies: SYS-REQ-260824-CFQG (10 WPT color-invalid-relative-color.html rows)
const INVALID_RELATIVE_COLORS = [
  // Testing invalid values (angle where number/percentage required)
  'rgb(from rebeccapurple r 10deg 10)',
  'rgb(from rebeccapurple r 10 10deg)',
  'rgb(from rebeccapurple 10deg g b)',
  // Testing invalid component names (not channel keywords of rgb())
  'rgb(from rebeccapurple red g b)',
  'rgb(from rebeccapurple l g b)',
  // hsl invalid component names
  'hsl(from rebeccapurple hue s l)',
  'hsl(from rebeccapurple x s l)',
  // hwb invalid hue position / angle misuse
  'hwb(from rebeccapurple h x 40deg)',
  // lab/oklch channel-type mismatches
  'lab(from rebeccapurple 10deg 0 0)',
  'oklch(from rebeccapurple l 10deg h)',
] as const;

// Reproduces: KI-117
for (const value of INVALID_RELATIVE_COLORS) {
  test(`KI-117: color-declaring ${value} is dropped (WPT invalid row)`, () => {
    const style = styleOf(`color:${value};`);
    assert.equal(
      style.getPropertyValue('color'),
      '',
      'grammar-invalid declaration must be dropped per cssom-1 #parse-a-css-declaration-block step 3.1',
    );
    assert.equal(
      style.length,
      0,
      'no declaration may remain in the block after dropping the invalid one',
    );
  });
}

// Dropping must not disturb neighboring VALID declarations
// (cssom-1 #parse-a-css-declaration-block processes each item independently).
// Reproduces: KI-117
// Verifies: SYS-REQ-260824-CFQG (neighbor-preservation leg)
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
test('KI-117: dropping an invalid relative color preserves valid neighbors', () => {
  const style = styleOf('margin:1px;color:hsl(from rebeccapurple hue s l);padding:2px;');
  assert.equal(style.length, 2, 'only the two valid declarations survive');
  assert.equal(style.item(0), 'margin');
  assert.equal(style.item(1), 'padding');
});
