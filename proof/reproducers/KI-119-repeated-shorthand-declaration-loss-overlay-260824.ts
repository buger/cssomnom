/**
 * Overlay reproducer for KI-119.  This file intentionally stays red until
 * declaration-block parsing retains EVERY successfully parsed declaration,
 * including a repeated property/shorthand, instead of silently replacing the
 * earlier declaration with the later one.
 *
 * Reproduces: KI-119
 * Verifies: SYS-REQ-260824-EVNP
 *
 * Spec anchors:
 * - cssom-1 § "parse a CSS declaration block"
 *   (submodules/csswg-drafts/cssom-1/Overview.bs#parse-a-css-declaration-block,
 *   ~line 2490), steps 3/3.1/3.2: for each declaration item, parse it and
 *   "If |parsed declaration| is not null, append it to |parsed declarations|".
 *   No step removes or replaces an earlier declaration with the same name.
 * - cssom-1 CSSStyleDeclaration.length (~line 2700): "must return the number
 *   of CSS declarations in the declarations" — the count of retained entries.
 * - css-cascade: which of the duplicate declarations wins is decided at
 *   computed-value time by origin/importance/order, never by mutating the
 *   declaration block at parse time.
 *
 * Ledger-dedup note: distinct from the KI-112/KI-113 font family — those pin
 * system-keyword expansion and invalid-mix acceptance; here both declarations
 * are ordinary grammar-valid font shorthands and the defect is loss of the
 * earlier one.  Also distinct from KI-36 (missing expansion table): `font`
 * IS expanded (13-longhand control below).
 *
 * Interpretation note (flagged for Scrutineer): the expected counts below
 * follow cssomnom's own expansion granularity demonstrated by the control
 * test (one font shorthand -> 13 longhand declarations).  The
 * plain-property case (`color` twice -> length 2) is independent of any
 * expansion-granularity interpretation.
 *
 * Observed defect at HEAD via public API:
 *   parse('a{color:red;color:green}').cssRules[0].style.length === 1  (exp. 2)
 *   parse('p{font:22px Helvetica; font:xxx-large system-ui}')... .length === 13
 *     (expected 26: both shorthand declarations retained)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/index.ts';
import type { CSSStyleRule } from '../../src/index.ts';

// Verifies: SYS-REQ-260824-EVNP (KI-119 reproducer helper: declaration-block style probe)
function styleOf(declarations: string) {
  const sheet = parse(declarations);
  return (sheet.cssRules[0] as CSSStyleRule).style;
}

// Positive control (green today): documents cssomnom's own expansion
// granularity — one font shorthand occupies 13 longhand declaration slots.
// Verifies: SYS-REQ-260824-EVNP (expansion-granularity control: font -> 13 slots)
test('KI-119 control: single font shorthand yields 13 declarations', () => {
  const style = styleOf('.c{font:12px serif;}');
  assert.equal(style.length, 13);
});

// cssom-1 #parse-a-css-declaration-block appends every parsed declaration;
// duplicates are retained and only arbitrated later by the cascade.
// Reproduces: KI-119
// Verifies: SYS-REQ-260824-EVNP (repeated plain-property retention leg)
test('KI-119: repeated color declarations are both retained', () => {
  const style = styleOf('.d{color:red;color:green;}');
  assert.equal(
    style.length,
    2,
    'length must count every retained declaration (cssom-1 #parse-a-css-declaration-block + length definition)',
  );
  assert.equal(style.item(0), 'color');
  assert.equal(style.item(1), 'color');
  // The cascade winner (last normal declaration) remains observable:
  assert.equal(style.getPropertyValue('color'), 'green');
});

// Reproduces: KI-119
// Verifies: SYS-REQ-260824-EVNP (repeated shorthand retention leg)
test('KI-119: repeated font shorthands keep both declaration sets', () => {
  const style = styleOf('p{font:22px Helvetica; font:xxx-large system-ui}');
  assert.equal(
    style.length,
    26,
    'both font shorthands must be retained (2 x 13 longhands per the control granularity)',
  );
  assert.equal(style.item(0), 'font-style', 'first set starts at index 0');
  assert.equal(style.item(13), 'font-style', 'second set must start at index 13');
});
