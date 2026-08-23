/**
 * Overlay reproducer for KI-34: :lang() wildcard language ranges never match.
 *
 * selectors-4 § 11 "The :lang() Pseudo-class" (#lang-pseudo,
 * submodules/csswg-drafts/selectors-4/Overview.bs:2635-2676): each language
 * range in :lang() is an RFC4647 § 2.2 *extended language range* and "the
 * element's content language matches a language range if its content language
 * ... matches the given language range in an extended filtering operation per
 * [RFC4647] section 3.3.2" (:2661-2667). Extended filtering treats each
 * asterisk as a wildcard subtag: the range '*-US' matches any primary tag with
 * region US (e.g. 'en-US'), and '*-CA' matches 'fr-CA'. Ranges containing
 * asterisks may be escaped or quoted (:2643-2645), so ':lang("*-US")' and
 * ':lang(\*-US)' are both legal.
 *
 * WPT fixtures corroborating wildcard matching (submodules/web-platform-tests):
 *   css/selectors/selectors-4/lang-007.html  :lang("*-CH")
 *   css/selectors/selectors-4/lang-008.html  :lang("*-Latn")
 *   css/selectors/selectors-4/lang-010.html  :lang("*-FR")
 *   css/selectors/selectors-4/lang-015.html  :lang(\*-FR)
 *   css/selectors/selectors-4/lang-018.html  :lang("*-x-foobar")
 *   css/selectors/selectors-4/lang-021.html  :lang("*-gb")
 *
 * The engine implements only exact or dash-prefix comparison in matcher.ts's
 * lang arm (~L598-606), so a leading '*' range matches nothing.
 *
 * Asserts the SAFE contract: wildcard language ranges match per RFC4647
 * extended filtering.
 *
 * Reproduces: KI-34
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { matches } from '/workspace/src/matcher.ts';

// Reproducer constants mirrored in specs/system/variables/selectors-matching-budget.vars.yaml:
const WILDCARD_LANG_RANGES = 3; // "*-US", "*-CA", escaped \*-US
const MISSED_WILDCARD_MATCH_BUDGET = 0;

const HTML_NS = 'http://www.w3.org/1999/xhtml';

function el(langValue: string | null, parent?: ReturnType<typeof el>) {
  return {
    nodeType: 1,
    localName: 'p',
    tagName: 'p',
    namespaceURI: HTML_NS,
    getAttribute: (name: string) => (name === 'lang' ? langValue : null),
    hasAttribute: (name: string) => name === 'lang' && langValue !== null,
    attributes: langValue === null ? [] : [{ name: 'lang', value: langValue }],
    parentElement: parent ?? null,
  };
}

describe('KI-34 :lang() wildcard ranges match via RFC4647 extended filtering', () => {
  test('positive control: exact language tag matches', () => {
    assert.equal(matches(el('en-US'), ':lang("en-US")'), true);
  });

  test('positive control: non-wildcard prefix range en matches en-US', () => {
    assert.equal(matches(el('en-US'), ':lang("en")'), true);
  });

  test('negative control: wildcard range for another region does not match', () => {
    assert.equal(matches(el('en-US'), ':lang("*-XX")'), false);
  });

  // Reproduces: KI-34
  test(`${WILDCARD_LANG_RANGES} wildcard-range legs all match`, () => {
    let missed = 0;
    // Leg 1: quoted "*-US" vs own lang="en-US"
    if (!matches(el('en-US'), ':lang("*-US")')) missed++;
    // Leg 2: inherited language — ancestor div lang="fr-CA", child p, "*-CA"
    const child = el(null, el('fr-CA'));
    if (!matches(child, ':lang("*-CA")')) missed++;
    // Leg 3: escaped ident form \*-US (selectors-4 #lang-pseudo allows escaping; WPT lang-015)
    if (!matches(el('en-US'), ':lang(\\*-US)')) missed++;
    assert.equal(
      missed,
      MISSED_WILDCARD_MATCH_BUDGET,
      `KI-34: ${missed}/${WILDCARD_LANG_RANGES} wildcard :lang() ranges failed to match; asterisk subtags must filter per RFC4647 extended filtering (selectors-4 #lang-pseudo)`,
    );
  });
});
