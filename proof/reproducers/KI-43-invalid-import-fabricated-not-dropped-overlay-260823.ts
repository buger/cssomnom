/**
 * Overlay reproducer for KI-43: parse('@import url(a b)x.css;') fabricates a
 * CSSImportRule with href:'' and mediaText:'not all' instead of dropping the
 * grammar-invalid @import.
 *
 * Reproduces: KI-43
 * Verifies: SYS-REQ-260823-DRP5 (grammar-invalid @import rules are dropped)
 *
 * Spec anchors:
 * - css-cascade-5 § 2 #at-import (submodules/csswg-drafts/css-cascade-5/
 *   Overview.bs ~148-160): the @import grammar is
 *     @import [ <url> | <string> ] [ layer | layer(<layer-name>) ]?
 *             <import-conditions> ;
 *   'url(a b)' is a <bad-url-token> (css-syntax-3 ~2013-2016 marks it an
 *   always-parse-error), so the prelude cannot match <url>|<string>: the rule
 *   is invalid as a whole. cssom-1 parse a stylesheet / CSSOM handling of
 *   unrecognized rules then drops it — exactly as the tokenizer path already
 *   drops such keyframe selectors (parser.ts drops '0x10%' blocks) rather than
 *   fabricating an object.
 *
 * Observed defect (src/parser.ts handleImportRule ~759-827): the bad-url
 * prelude matches none of the href branches, so href stays '', the leftover
 * tokens collapse into an empty media list that MediaList normalizes to
 * 'not all', and a fabricated CSSImportRule({href:'', mediaText:'not all'})
 * silently enters cssRules.
 *
 * Controls: valid unquoted imports keep round-tripping byte-exactly
 * ('@import url(x.css);' → href 'x.css'); layered imports survive too.
 *
 * Precision note vs related engine behavior: constructed sheets drop ALL
 * imports by policy ("not allowed in constructed stylesheets") and insertRule
 * throws HierarchyRequestError there — neither path covers document-style
 * parse(), which is where this fabrication happens.
 *
 * Distinctness: KI-7 is the documented styleSheet=null offline deviation;
 * KI-8 was the missing unquoted <url-token> branch for VALID urls (fixed).
 * This issue is about INVALID import preludes fabricating rules.
 *
 * Reproducer constants mirrored in
 * specs/system/variables/import-grammar-budget.vars.yaml:
 * const FABRICATED_IMPORT_RULE_BUDGET = 0;
 * const VALID_IMPORT_HREF_ROUNDTRIPS_MIN = 1;
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSImportRule } from '../../src/index.ts';
import { parse } from '../../src/parser.ts';

// Reproducer constants mirrored in specs/system/variables/import-grammar-budget.vars.yaml:
const FABRICATED_IMPORT_RULE_BUDGET = 0; // zero fabricated rules allowed for invalid imports
const VALID_IMPORT_HREF_ROUNDTRIPS_MIN = 1; // control leg count

// Verifies: SYS-REQ-260823-DRP5 (KI-43 reproducer suite: invalid @import dropped, valid kept)
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
describe('KI-43 grammar-invalid @import does not fabricate a CSSImportRule', () => {
  // Control leg (green today): css-cascade-5 #at-import valid forms keep parsing.
  // Verifies: SYS-REQ-260823-DRP5
  test(`control: valid unquoted import keeps its href (${VALID_IMPORT_HREF_ROUNDTRIPS_MIN} round-trip required)`, () => {
    const sheet = parse('@import url(x.css);');
    const imp = Array.from(sheet.cssRules).find((r): r is CSSImportRule => r instanceof CSSImportRule);
    assert.ok(imp, 'valid import must still parse to a CSSImportRule');
    assert.equal(imp.href, 'x.css');
  });

  // css-cascade-5 #at-import grammar: url(a b)x.css cannot match <url>|<string>,
  // so no CSSImportRule may enter cssRules for this input.
  // Verifies: SYS-REQ-260823-DRP5
  test(`bad-url @import is dropped, not fabricated (${FABRICATED_IMPORT_RULE_BUDGET} fabrications allowed)`, () => {
    const sheet = parse('@import url(a b)x.css;');
    const fabricated = Array.from(sheet.cssRules).filter((r) => r instanceof CSSImportRule);
    assert.equal(
      fabricated.length,
      0,
      `KI-43: fabricated ${fabricated.length} CSSImportRule(s) from a grammar-invalid @import ` +
        `(href=${JSON.stringify((fabricated[0] as CSSImportRule | undefined)?.href)}, ` +
        `mediaText=${JSON.stringify((fabricated[0] as CSSImportRule | undefined)?.media.mediaText)})`,
    );
  });
});
