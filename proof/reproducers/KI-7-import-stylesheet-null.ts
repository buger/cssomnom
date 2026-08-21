/**
 * Overlay reproducer for KI-7. Not a product-suite test.
 * Import parser first so ParseHooks inject. Asserts the full CSSOM
 * contract (CSSImportRule.styleSheet is the associated loaded stylesheet,
 * not null) so this command FAILS while the offline-parser hole is present.
 *
 * Reproduces: KI-7
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { parse } from '../../src/parser.ts';
import { CSSImportRule } from '../../src/CSSOM.ts';

function ki7Contract(): { setupOk: boolean; holds: boolean; message: string } {
  const sheet = parse('@import url("sheet.css"); body { color: red; }');
  const rule = [...sheet.cssRules].find((r) => r instanceof CSSImportRule) as CSSImportRule | undefined;
  if (!rule) {
    return {
      setupOk: false,
      holds: false,
      message: 'setup failed: expected CSSImportRule from @import url("sheet.css")',
    };
  }

  // Full CSSOM contract: CSSImportRule.styleSheet is the associated loaded stylesheet (not null).
  const associated = rule.styleSheet;
  if (associated === null) {
    return {
      setupOk: true,
      holds: false,
      message: 'KI-7: CSSImportRule.styleSheet is null; @import never fetches',
    };
  }
  // README documents null. HEAD getter currently builds an empty internal
  // sheet instead. That is still not a loaded imported stylesheet.
  if (associated.cssRules.length === 0) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-7: CSSImportRule.styleSheet is an empty never-fetched placeholder (cssRules.length=${associated.cssRules.length}); @import never fetches`,
    };
  }
  return {
    setupOk: true,
    holds: true,
    message: 'KI-7 contract holds: CSSImportRule.styleSheet is the associated loaded stylesheet',
  };
}

// Reproduces: KI-7
// Verifies: SYS-REQ-260821-H3BD
// MCDC SYS-REQ-260821-H3BD: external_sheet_fetched=T => FALSE [known-issue] [ki: KI-7]
// Verifies: SW-REQ-260821-5W6X
// MCDC SW-REQ-260821-5W6X: css_import_rule_constructed=F, import_url_present=T => FALSE [known-issue] [ki: KI-7]
test('KI-7: CSSImportRule.styleSheet is the associated loaded stylesheet', () => {
  const outcome = ki7Contract();
  assert.equal(outcome.setupOk, true, outcome.message);
  assert.equal(outcome.holds, true, outcome.message);
});
