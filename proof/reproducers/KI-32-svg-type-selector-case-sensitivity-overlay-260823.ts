/**
 * Overlay reproducer for KI-32: SVG (and MathML) element names are matched
 * ASCII-case-insensitively by type selectors.
 *
 * selectors-4 § 3.7 "Characters and case sensitivity" (#case-sensitive,
 * submodules/csswg-drafts/selectors-4/Overview.bs:1293; normative text at
 * :1309-1318): "When matching Selectors to names and values defined by the
 * document, by default this is done using the string/identical to operation
 * (aka 'case sensitive') ... This includes element names, class names, IDs,
 * attribute names, and attribute values." The only relaxation is a host
 * language one: HTML "has some mildly complex rules about matching certain
 * names on HTML elements" (Overview.bs:1318-1322 -> html#case-sensitivity-of-selectors),
 * scoped to elements in the HTML namespace. SVG camelCase element names such
 * as textPath and foreignObject must therefore match their type selector
 * case-sensitively; selector 'textpath' must NOT match <textPath>.
 *
 * The engine lowercases both sides unconditionally in matchSimpleSelector's
 * type-selector arm (src/matcher.ts ~L300-303), so 'textpath' wrongly matches.
 *
 * Asserts the SAFE contract: non-HTML-namespace element names match their
 * type selector case-sensitively.
 *
 * Reproduces: KI-32
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { matches } from '../../src/matcher.ts';

// Reproducer constants mirrored in specs/system/variables/selectors-matching-budget.vars.yaml:
const CASED_NON_HTML_ELEMENTS = 2; // textPath, foreignObject (camelCase SVG names)
const CASE_INSENSITIVE_FALSE_MATCH_BUDGET = 0; // zero wrong matches allowed

const SVG_NS = 'http://www.w3.org/2000/svg';
const HTML_NS = 'http://www.w3.org/1999/xhtml';

function el(localName: string, namespaceURI: string) {
  return {
    nodeType: 1,
    localName,
    tagName: localName,
    namespaceURI,
    getAttribute: () => null,
    parentElement: null,
  };
}

describe('KI-32 type-selector case sensitivity outside the HTML namespace', () => {
  test('positive control: exact-case svg type selector matches', () => {
    assert.equal(matches(el('textPath', SVG_NS), 'svg|textPath') || matches(el('textPath', SVG_NS), 'textPath'), true);
  });

  test('positive control: html-namespace element may match ascii-case-insensitively', () => {
    assert.equal(matches(el('div', HTML_NS), 'DIV'), true);
  });

  // Reproduces: KI-32
  test(`lowercased 'textpath' does not match svg textPath (${CASED_NON_HTML_ELEMENTS} cased legs)`, () => {
    let falseMatches = 0;
    if (matches(el('textPath', SVG_NS), 'textpath')) falseMatches++;
    if (matches(el('foreignObject', SVG_NS), 'foreignobject')) falseMatches++;
    assert.equal(
      falseMatches,
      CASE_INSENSITIVE_FALSE_MATCH_BUDGET,
      `KI-32: ${falseMatches}/${CASED_NON_HTML_ELEMENTS} lowercased type selectors matched camelCase SVG element names; matching outside the HTML namespace must be case-sensitive (selectors-4 #case-sensitive)`,
    );
  });
});
