/**
 * Reproducer for CRS-0046/C19 (src/matcher.ts getElementLanguage).
 * selectors-4 § 22.2 #the-lang-pseudo: :lang() matches an element's content
 * language, and the document language defines it; XML languages use the
 * xml:lang attribute. html#case-sensitivity-of-selectors does not restrict
 * :lang to the HTML lang attribute. getElementLanguage reads only
 * getAttribute('lang'), so an element whose language comes from xml:lang
 * matches nothing. An xml:lang="fr" element must therefore match :lang(fr).
 * Asserts the correct behavior so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matches } from '../../src/matcher.ts';

const XML_NS = 'http://www.w3.org/XML/1998/namespace';

test('CRS-0046/C19: xml:lang="fr" matches :lang(fr)', () => {
  const el = {
    localName: 'p',
    nodeType: 1,
    getAttribute: () => null,
    getAttributeNS: (ns: string | null, n: string) => (ns === XML_NS && n === 'lang' ? 'fr' : null),
  };
  assert.equal(matches(el, ':lang(fr)'), true);
});

test('control: an HTML lang="fr" element still matches :lang(fr)', () => {
  const el = { localName: 'p', nodeType: 1, getAttribute: (n: string) => (n === 'lang' ? 'fr' : null) };
  assert.equal(matches(el, ':lang(fr)'), true);
});
