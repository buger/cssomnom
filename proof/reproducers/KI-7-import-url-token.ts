/**
 * Extra overlay e2e for KI-7. Not a product-suite test (not under tests/).
 * User-shaped public @import forms beyond the single KI-7-import-stylesheet-null
 * tripwire.
 *
 * SCOPE AMENDMENT (honest history): earlier revisions asserted the full fetched
 * CSSOM contract ("associated LOADED stylesheet whose cssRules come from the
 * imported file"). That encoded the banned-fetch stalemate — network/disk I/O is
 * permanently out of scope here — so the tripwire could never pass honestly.
 * User authorized closing the object-graph defect 2026-08-23: styleSheet must be
 * the real, publicly linked ASSOCIATED stylesheet (cssom-1 § 6.4.3
 * #the-cssimportrule-stylesheet), empty offline (browser pre-load state;
 * fetching stays a documented deviation). The fixtures/x.css content is now
 * supplied BY THE HOST via replaceSync(), mirroring how an embedding
 * application would feed fetched bytes into this offline parser.
 *
 * Asserted per shape:
 *   - href mirrors the @import prelude URL exactly (string / url-token /
 *     url("...") function / absolute https URL);
 *   - media mirrors the prelude media query list;
 *   - styleSheet is a non-null CSSStyleSheet with live public linkage
 *     (ownerRule === rule, parentStyleSheet === owning sheet);
 *   - offline pre-load state: cssRules empty until the host fills it;
 *   - host supply path: replaceSync(importedFileCss) populates rules matching
 *     parse(fixtures/x.css).
 *
 * cssom-1 § 6.4.3 #dom-cssimportrule-href / #dom-cssimportrule-media /
 *                #dom-cssimportrule-stylesheet
 * css-syntax-3 § 4.3.6 #consume-url-token
 *
 * Reproduces: KI-7
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../../src/parser.ts';
import { parse } from '../../src/parser.ts';
import { CSSImportRule, CSSStyleSheet } from '../../src/CSSOM.ts';

const importedFileCss = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'x.css'),
  'utf8',
);

type Shape = {
  name: string;
  css: string;
  href: string;
  media: string;
  /** Supply the fixtures/x.css content through the host replaceSync() path. */
  hostSuppliesFixture: boolean;
};

const SHAPES: Shape[] = [
  {
    name: '@import "x.css"',
    css: '@import "x.css";',
    href: 'x.css',
    media: '',
    hostSuppliesFixture: true,
  },
  {
    name: '@import url(x.css)',
    css: '@import url(x.css);',
    href: 'x.css',
    media: '',
    hostSuppliesFixture: true,
  },
  {
    name: '@import url("https://example.com/x.css")',
    css: '@import url("https://example.com/x.css");',
    href: 'https://example.com/x.css',
    media: '',
    hostSuppliesFixture: false,
  },
  {
    name: '@import url(x.css) print;',
    css: '@import url(x.css) print;',
    href: 'x.css',
    media: 'print',
    hostSuppliesFixture: true,
  },
];

function ki7AssociatedSheetContract(shape: Shape): { setupOk: boolean; holds: boolean; message: string } {
  const sheet = parse(shape.css);
  const rule = [...sheet.cssRules].find((r) => r instanceof CSSImportRule) as CSSImportRule | undefined;
  if (!rule) {
    return {
      setupOk: false,
      holds: false,
      message: `setup failed: expected CSSImportRule from ${shape.css}`,
    };
  }
  // cssom-1 § 6.4.3 #dom-cssimportrule-href: href is the URL specified by the
  // @import prelude.
  if (rule.href !== shape.href) {
    return {
      setupOk: false,
      holds: false,
      message: `href was ${JSON.stringify(rule.href)} want ${JSON.stringify(shape.href)}`,
    };
  }
  // cssom-1 § 6.4.3 #dom-cssimportrule-media: media mirrors the prelude list.
  if (rule.media.mediaText !== shape.media) {
    return {
      setupOk: false,
      holds: false,
      message: `mediaText was ${JSON.stringify(rule.media.mediaText)} want ${JSON.stringify(shape.media)}`,
    };
  }

  // cssom-1 § 6.4.3 #dom-cssimportrule-stylesheet: associated stylesheet object,
  // never null once the rule exists; empty offline (never fetched).
  const associated = rule.styleSheet;
  if (!(associated instanceof CSSStyleSheet)) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-7: ${shape.name} CSSImportRule.styleSheet is ${String(associated)}, want a CSSStyleSheet`,
    };
  }
  // Live public linkage: ownerRule is this import rule; parentStyleSheet
  // resolves through ownerRule to the owning sheet (cssom-1 § 6.4.3 notes).
  if (associated.ownerRule !== rule || associated.parentStyleSheet !== sheet) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-7: ${shape.name} associated sheet linkage broken (ownerRule=${String(associated.ownerRule !== rule)}, parentStyleSheet=${String(associated.parentStyleSheet !== sheet)})`,
    };
  }
  if (associated.cssRules.length !== 0) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-7: ${shape.name} offline associated sheet should start empty, got cssRules.length=${associated.cssRules.length}`,
    };
  }

  // Host supply path: fill the associated sheet offline via replaceSync().
  const supplyText = shape.hostSuppliesFixture ? importedFileCss : '.host { color: red; }';
  try {
    associated.replaceSync(supplyText);
  } catch (e) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-7: ${shape.name} replaceSync into associated sheet threw ${(e as Error)?.name}: ${(e as Error)?.message}`,
    };
  }

  if (!shape.hostSuppliesFixture) {
    if (associated.cssRules.length !== 1) {
      return {
        setupOk: true,
        holds: false,
        message: `KI-7: ${shape.name} host-supplied rules missing after replaceSync`,
      };
    }
    return {
      setupOk: true,
      holds: true,
      message: `KI-7 contract holds for ${shape.name}: linked offline associated sheet, host-fillable`,
    };
  }

  // Supplied rules must equal parsing fixtures/x.css directly (same object
  // graph the browser would expose after loading, minus any fetch).
  const expected = parse(importedFileCss);
  if (associated.cssRules.length !== expected.cssRules.length) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-7: ${shape.name} host-supplied cssRules.length=${associated.cssRules.length} want ${expected.cssRules.length} from fixtures/x.css`,
    };
  }
  for (let i = 0; i < expected.cssRules.length; i++) {
    const got = associated.cssRules[i].cssText;
    const want = expected.cssRules[i].cssText;
    if (got !== want) {
      return {
        setupOk: true,
        holds: false,
        message: `KI-7: ${shape.name} host-supplied rule[${i}] cssText=${JSON.stringify(got)} want ${JSON.stringify(want)} from fixtures/x.css`,
      };
    }
  }
  return {
    setupOk: true,
    holds: true,
    message: `KI-7 contract holds for ${shape.name}: linked offline sheet whose host-supplied rules match fixtures/x.css`,
  };
}

describe('KI-7 e2e user-shaped @import (associated offline sheet, host-supplied content)', () => {
  for (const shape of SHAPES) {
    // Reproduces: KI-7
    // Verifies: SYS-REQ-260821-H3BD (external_sheet_fetched=F; fetch permanently excluded)
    // Verifies: SW-REQ-260821-5W6X (css_import_rule_constructed=T, external_sheet_fetched=F, import_url_present=T => TRUE)
    test(`${shape.name}: styleSheet is the associated linked offline sheet`, () => {
      const outcome = ki7AssociatedSheetContract(shape);
      assert.equal(outcome.setupOk, true, outcome.message);
      assert.equal(outcome.holds, true, outcome.message);
    });
  }
});
