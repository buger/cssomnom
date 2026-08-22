/**
 * Overlay reproducer for KI-21: hash/function serialization omits
 * serializeIdentifier.
 *
 * cssom-1 #serialize-an-identifier requires identifier-context values to be
 * serialized with the escape algorithm so decoded structural code points
 * stay escaped in CSS source; #serialize-a-function likewise serializes the
 * function name as an identifier. The serializer's hash-token branch emits
 * '#' + raw decoded value and the AST function branch emits the raw name,
 * so an escaped '#\3B' or 'a\7d(' reappears as a real ';' or '}' in cssText
 * and breaks declaration/rule structure when a host re-embeds or re-parses
 * the serialized text (CSS injection contribution, CWE-116).
 *
 * Asserts the SAFE contract via public parse()/cssText: re-parsing a
 * rule's serialized cssText must preserve its structure — no new
 * declarations, no changed values. Today '#\3B ... url(...)' serializes to
 * '#;' and re-parsing yields an INJECTED background-image:url(...) host
 * declaration.
 *
 * Reproduces: KI-21
 * Verifies: SYS-REQ-260822-8HDQ
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { parse } from '../../src/parser.ts';
import { CSSStyleRule } from '../../src/CSSOM.ts';

/** Structural signature of a style rule's declarations (property=value pairs). */
function declSignature(rule: unknown): string {
  assert.ok(rule instanceof CSSStyleRule, `expected CSSStyleRule, got ${typeof rule}`);
  const style = (rule as CSSStyleRule).style;
  const decls: string[] = [];
  for (let i = 0; i < style.length; i++) {
    const prop = style[i]!;
    decls.push(prop.trim() + '=' + style.getPropertyValue(prop).trim());
  }
  return JSON.stringify(decls);
}

function firstRuleCssText(css: string): string {
  const sheet = parse(css);
  assert.equal(sheet.cssRules.length, 1, 'expected exactly one top-level rule');
  return sheet.cssRules[0]!.cssText;
}

describe('KI-21 e2e serialization identifier escaping', () => {
  test('positive control: benign hash round-trips structurally', () => {
    const once = firstRuleCssText('div { color: #fafafa }');
    const sheet2 = parse(once);
    assert.equal(sheet2.cssRules.length, 1);
    assert.equal(
      declSignature(sheet2.cssRules[0]),
      declSignature(parse('div { color: #fafafa }').cssRules[0]),
      'benign hash must survive one serialize/reparse cycle unchanged',
    );
  });

  // Reproduces: KI-21
  // Verifies: SYS-REQ-260822-8HDQ
  test('escaped semicolon hash (#\\3B) does not inject declarations on cssText re-parse', () => {
    // One original declaration whose value contains an escaped ';'.
    const src = 'div { color: #\\3B background-image:url(https://evil.example/track.png); }';
    const sheet1 = parse(src);
    const rule1 = sheet1.cssRules[0];
    const originalSig = declSignature(rule1);
    assert.equal(JSON.parse(originalSig).length, 1, 'setup: expected exactly 1 original declaration');

    const cssText = rule1!.cssText;
    assert.ok(
      !cssText.includes('#;'),
      'serialized cssText must not contain a raw "#" + ";" breakout pair',
    );

    // Host re-embeds the serialized text and re-parses it.
    const sheet2 = parse(cssText);
    assert.equal(sheet2.cssRules.length, 1, 're-parse must not change the top-level rule count');
    assert.equal(
      declSignature(sheet2.cssRules[0]),
      originalSig,
      `KI-21: cssText re-parse produced new declarations — serialized as ${JSON.stringify(cssText)}; ` +
        'hash token value was emitted without serialize-an-identifier escaping ' +
        '(SYS-REQ-260822-8HDQ round_trip_structure_preserved)',
    );
  });

  // Reproduces: KI-21
  // Verifies: SYS-REQ-260822-8HDQ
  test('escaped brace in function name (a\\7d(...)) does not break out on cssText re-parse', () => {
    const src = 'div { width: a\\7d(1) }';
    const sheet1 = parse(src);
    const rule1 = sheet1.cssRules[0];
    const originalSig = declSignature(rule1);

    const cssText = rule1!.cssText;
    const sheet2 = parse(cssText);
    assert.equal(sheet2.cssRules.length, 1, 're-parse must not change the top-level rule count');
    assert.equal(
      declSignature(sheet2.cssRules[0]),
      originalSig,
      `KI-21: function-name cssText re-parse lost structure — serialized as ${JSON.stringify(cssText)}; ` +
        'AST function names are emitted without serialize-an-identifier escaping ' +
        '(SYS-REQ-260822-8HDQ round_trip_structure_preserved)',
    );
  });
});
