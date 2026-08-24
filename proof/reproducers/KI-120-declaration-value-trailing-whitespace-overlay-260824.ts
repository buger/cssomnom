/**
 * Overlay reproducer for KI-120.  This file intentionally stays red until
 * declaration values no longer retain insignificant trailing whitespace
 * tokens when stored, so getPropertyValue() returns the canonical value.
 *
 * Reproduces: KI-120
 * Verifies: SYS-REQ-260824-BJTQ
 *
 * Spec anchors:
 * - css-syntax-3 § "Consume a declaration" (#consume-declaration,
 *   submodules/csswg-drafts/css-syntax-3/Overview.bs ~line 2962), step after
 *   the !important check: "While the last item in |decl|'s value is a
 *   <<whitespace-token>>, [=list/remove=] that token."  Storing a value whose
 *   last token is whitespace violates this normative trimming step.
 * - cssom-1 § "serialize a CSS declaration" (#serialize-a-css-declaration,
 *   ~line 2504) appends the stored |value| verbatim between ": " and ";", so
 *   a whitespace-polluted stored value leaks into every serialized surface.
 *
 * Observed defect at HEAD via public API:
 *   parse('a{color:red ;}').cssRules[0].style.getPropertyValue('color')
 *     === 'red '    // canonical: 'red'
 *   parse('a{color: calc(1px) ;}')... .getPropertyValue('color')
 *     === 'calc(1px) '
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/index.ts';
import type { CSSStyleRule } from '../../src/index.ts';

// Verifies: SYS-REQ-260824-BJTQ (KI-120 reproducer helper: declaration-block style probe)
function styleOf(declarations: string) {
  const sheet = parse(declarations);
  return (sheet.cssRules[0] as CSSStyleRule).style;
}

// Positive control (green today): without trailing whitespace before the
// semicolon the value round-trips canonically.
// Verifies: SYS-REQ-260824-BJTQ (clean-declaration control)
test('KI-120 control: clean declaration serializes without stray whitespace', () => {
  const style = styleOf('.c{color:red;}');
  assert.equal(style.getPropertyValue('color'), 'red');
});

// css-syntax-3 #consume-declaration requires trailing <whitespace-token>s to
// be removed from the declaration value before it is stored.
// Reproduces: KI-120
// Verifies: SYS-REQ-260824-BJTQ (ident-value trimming leg)
test('KI-120: single-token value drops trailing whitespace (color:red ;)', () => {
  const style = styleOf('.a{color:red ;}');
  assert.equal(
    style.getPropertyValue('color'),
    'red',
    'stored value must have trailing <whitespace-token> removed per css-syntax-3 #consume-declaration',
  );
});

// Reproduces: KI-120
// Verifies: SYS-REQ-260824-BJTQ (function-value trimming leg)
test('KI-120: function value drops trailing whitespace', () => {
  const style = styleOf('.b{color: calc(1px) ;}');
  assert.equal(
    style.getPropertyValue('color'),
    'calc(1px)',
    'trailing whitespace after the function must not survive into the stored value',
  );
});

// Reproduces: KI-120
// Verifies: SYS-REQ-260824-BJTQ (url-value trimming leg)
test('KI-120: url() value drops trailing whitespace', () => {
  const style = styleOf('.d{background-image:url(x) ;}');
  const value = style.getPropertyValue('background-image');
  assert.equal(
    value,
    'url("x")',
    `trailing whitespace leaked into the stored url() value; got ${JSON.stringify(value)}`,
  );
});
