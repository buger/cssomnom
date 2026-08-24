/**
 * Overlay reproducer for KI-121.  This file intentionally stays red until
 * attr() values serialize with their namespaced attribute name preserved,
 * instead of silently dropping the namespace prefix (data loss on reparse).
 *
 * Reproduces: KI-121
 * Verifies: <draft requirement owned by this batch — see KI yaml>
 *
 * Spec anchors:
 * - Local WPT fixture css/cssom/serialize-values.html (cssom-1
 *   #serializing-css-values), `attr()` value rows (~line 99):
 *       {actual: "attr(|bar)",  serialized: "attr(|bar)"}
 *       {actual: "attr( |bar )", serialized: "attr( |bar )"}
 *     and the fallback rows (~line 106):
 *       {actual: 'attr(|bar, "fallback")', serialized: 'attr(|bar, "fallback")'}
 *   The harness sets the IDL style property and asserts the read-back
 *   serialization, so the namespaced spelling must survive a set/get cycle.
 * - css-values-5 § attr() (#attr, Overview.bs ~line 1980):
 *       attr() = attr( <<attr-name>> <<attr-type>>? , <<declaration-value>>? )
 *       <<attr-name>> = [ <<ident-token>>? '|' ]? <<ident-token>>
 *   The optional namespace prefix and '|' are part of the grammar; dropping
 *   them changes which attribute the function references.
 *
 * Data-loss framing: parse -> serialize -> reparse changes semantics:
 *   'attr(|bar)' serializes to 'attr(bar)', which no longer carries the
 *   empty/default-namespace qualification of the attribute reference.
 *
 * Observed defect at HEAD via public API:
 *   style.setProperty('content', 'attr(|bar)')
 *   style.getPropertyValue('content') === 'attr(bar)'   // expected 'attr(|bar)'
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, CSSStyleDeclaration } from '../../src/index.ts';
import type { CSSStyleRule } from '../../src/index.ts';

// Mirrors the WPT harness contract: set through the declaration API, read the
// serialization back.
function roundtripViaSetProperty(input: string): string {
  const style = new CSSStyleDeclaration();
  style.setProperty('content', input);
  return style.getPropertyValue('content');
}

// Positive control (green today): plain attribute references and an explicit
// empty-string fallback already round-trip verbatim (WPT row
// {actual: 'attr(foo, "")', serialized: 'attr(foo, "")'}).
test('KI-121 control: attr(foo, "") round-trips verbatim', () => {
  assert.equal(roundtripViaSetProperty('attr(foo, "")'), 'attr(foo, "")');
});

// WPT serialize-values.html rows with a namespaced <<attr-name>>.
// Verifies: draft requirement "namespaced attr() serialization" (see KI-121).
test('KI-121: attr(|bar) keeps its namespace pipe', () => {
  assert.equal(
    roundtripViaSetProperty('attr(|bar)'),
    'attr(|bar)',
    'WPT serialize-values.html expects attr(|bar) to serialize as attr(|bar)',
  );
});

test('KI-121: attr( |bar ) keeps its internal spacing', () => {
  assert.equal(
    roundtripViaSetProperty('attr( |bar )'),
    'attr( |bar )',
    'WPT serialize-values.html expects attr( |bar ) to serialize verbatim',
  );
});

test('KI-121: namespaced attr() with fallback keeps namespace and fallback', () => {
  assert.equal(
    roundtripViaSetProperty('attr(|bar, "fallback")'),
    'attr(|bar, "fallback")',
    'WPT serialize-values.html expects attr(|bar, "fallback") verbatim',
  );
});

// Stylesheet parse path must agree with the setter path.
test('KI-121: stylesheet-parsed content:attr(|bar) serializes losslessly', () => {
  const sheet = parse('.z{content:attr(|bar);}');
  const style = (sheet.cssRules[0] as CSSStyleRule).style;
  const serialized = style.getPropertyValue('content');
  assert.equal(serialized, 'attr(|bar)');
  // Reparse data-loss witness: the serialization must not have changed shape.
  const reparsed = parse(`.z{content:${serialized};}`).cssRules[0] as CSSStyleRule;
  assert.equal(reparsed.style.getPropertyValue('content'), 'attr(|bar)');
});
