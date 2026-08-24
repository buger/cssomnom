/**
 * Overlay reproducer for KI-7. Not a product-suite test.
 * Import parser first so ParseHooks inject.
 *
 * SCOPE AMENDMENT (honest history): the original two-leg contract here asserted
 * the full fetched-CSSOM behavior ("styleSheet is the associated LOADED sheet
 * with rules from the imported file"). That contract encoded a stalemate: the
 * same audit permanently bans network/disk fetch I/O in this library, so a
 * "loaded" sheet was unreachable by construction and the tripwire could never
 * go green without violating the ban. On 2026-08-23 the user authorized closing
 * the object-graph defect instead: CSSImportRule.styleSheet must be the real,
 * publicly linked ASSOCIATED stylesheet object per cssom-1 § 6.4.3
 * #the-cssimportrule-interface — in its browser pre-load state (empty) because
 * @import never fetches (README documented deviation, permanent).
 *
 * Amended contract asserted below (fails on pre-fix HEAD where styleSheet was
 * null / an unconstructable placeholder):
 *   (a) styleSheet is a non-null CSSStyleSheet;
 *   (b) public linkage is live: child.ownerRule === rule and
 *       child.parentStyleSheet === owning sheet (cssom-1 § 6.4.3 associated
 *       stylesheet notes resolve parentStyleSheet through ownerRule);
 *   (c) href mirrors the url() token of the prelude;
 *   (d) media mirrors the prelude media query list ("screen" case);
 *   (e) the host can supply content offline: child.replaceSync(...) populates
 *       the associated sheet and its rules are readable afterwards.
 *
 * TRIPWIRE DISCRIMINATION (2026-08-24): discrimination of the fixed object
 * graph rests primarily on leg (e) — replaceSync() enablement on the
 * associated sheet (NotAllowedError was the pre-fix symptom). Legs (a) and
 * (b) are regression guards against literal-null styleSheet and broken public
 * linkage wiring; they alone do not discriminate the fix.
 *
 * Reproduces: KI-7
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { parse } from '../../src/parser.ts';
import { CSSImportRule, CSSStyleSheet, MediaList } from '../../src/CSSOM.ts';

function ki7AssociatedSheetContract(): { setupOk: boolean; holds: boolean; message: string } {
  const sheet = parse('@import url("sheet.css") screen;\nbody { color: red; }');
  const rule = [...sheet.cssRules].find((r) => r instanceof CSSImportRule) as CSSImportRule | undefined;
  if (!rule) {
    return {
      setupOk: false,
      holds: false,
      message: 'setup failed: expected CSSImportRule from @import url("sheet.css") screen',
    };
  }

  // Leg (c): cssom-1 § 6.4.3 #dom-cssimportrule-href — href is the URL specified
  // by the @import prelude (url token value, quotes stripped).
  if (rule.href !== 'sheet.css') {
    return {
      setupOk: true,
      holds: false,
      message: `KI-7 leg (c): href was ${JSON.stringify(rule.href)}, want "sheet.css"`,
    };
  }

  // Leg (d): cssom-1 § 6.4.3 #dom-cssimportrule-media — media is the MediaList
  // parsed from the prelude media query list ("screen" case).
  if (!(rule.media instanceof MediaList) || rule.media.mediaText !== 'screen') {
    return {
      setupOk: true,
      holds: false,
      message: `KI-7 leg (d): media was ${rule.media?.constructor?.name} ${JSON.stringify(rule.media?.mediaText)}, want MediaList "screen"`,
    };
  }

  // Leg (a): cssom-1 § 6.4.3 #dom-cssimportrule-stylesheet — the associated
  // stylesheet object exists once the rule exists (never null). Offline parser
  // never fetches, so it starts empty (browser pre-load state).
  const associated = rule.styleSheet;
  if (!(associated instanceof CSSStyleSheet)) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-7 leg (a): CSSImportRule.styleSheet is ${String(associated)}, want a CSSStyleSheet`,
    };
  }
  if (associated.cssRules.length !== 0) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-7 leg (a): offline associated sheet should start empty, got cssRules.length=${associated.cssRules.length}`,
    };
  }

  // Leg (b): public linkage must be live, not private-field-only.
  // cssom-1 § 6.4.3: the associated sheet's ownerRule is this import rule, and
  // its parentStyleSheet is the owning sheet (resolved through ownerRule).
  if (associated.ownerRule !== rule) {
    return {
      setupOk: true,
      holds: false,
      message: 'KI-7 leg (b): styleSheet.ownerRule !== the import rule',
    };
  }
  if (associated.parentStyleSheet !== sheet) {
    return {
      setupOk: true,
      holds: false,
      message: 'KI-7 leg (b): styleSheet.parentStyleSheet !== the owning sheet',
    };
  }

  // Leg (e): the host can supply content offline — the associated sheet is a
  // real stylesheet, so replaceSync() works and the injected rules are readable
  // (cssom-1 § 6.5.1 #synchronously-replace-the-rules-of-a-cssstylesheet).
  try {
    associated.replaceSync('.injected { color: green; }');
  } catch (e) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-7 leg (e): replaceSync into associated sheet threw ${(e as Error)?.name}: ${(e as Error)?.message}`,
    };
  }
  if (associated.cssRules.length !== 1 || associated.cssRules[0].cssText !== '.injected { color: green; }') {
    return {
      setupOk: true,
      holds: false,
      message: `KI-7 leg (e): after replaceSync, cssRules=${[...associated.cssRules].map((r) => r.cssText).join(' | ')}`,
    };
  }
  // Unfetch discipline still holds: the association is object-graph only.
  if (typeof globalThis.fetch === 'function') {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('network must not be used');
    };
    try {
      parse('@import url("sheet.css") screen;');
      if (fetchCalled) {
        return {
          setupOk: true,
          holds: false,
          message: 'KI-7: parse of @import invoked fetch; fetching is out of scope forever',
        };
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
  return {
    setupOk: true,
    holds: true,
    message: 'KI-7 contract holds: styleSheet is the associated, publicly linked, host-fillable offline sheet',
  };
}

// Reproduces: KI-7
// Verifies: SYS-REQ-260821-H3BD (external_sheet_fetched=F; fetch permanently excluded as documented deviation)
// Verifies: SW-REQ-260821-5W6X (css_import_rule_constructed=T, external_sheet_fetched=F, import_url_present=T => TRUE)
test('KI-7: CSSImportRule.styleSheet is the associated, linked, host-fillable offline stylesheet', () => {
  const outcome = ki7AssociatedSheetContract();
  assert.equal(outcome.setupOk, true, outcome.message);
  assert.equal(outcome.holds, true, outcome.message);
});
