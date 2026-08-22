/**
 * Extra overlay e2e for KI-7. Not a product-suite test (not under tests/).
 * User-shaped public @import forms beyond the single KI-7-import-stylesheet-null
 * tripwire. Asserts the full CSSOM contract: CSSImportRule.styleSheet is the
 * associated loaded stylesheet whose cssRules are those of the imported file
 * (not null, not an empty never-fetched placeholder).
 *
 * cssom-1 § 6.4.3 #dom-cssimportrule-stylesheet
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
  expectFixtureRules: boolean;
};

const SHAPES: Shape[] = [
  {
    name: '@import "x.css"',
    css: '@import "x.css";',
    href: 'x.css',
    media: '',
    expectFixtureRules: true,
  },
  {
    name: '@import url(x.css)',
    css: '@import url(x.css);',
    href: 'x.css',
    media: '',
    expectFixtureRules: true,
  },
  {
    name: '@import url("https://example.com/x.css")',
    css: '@import url("https://example.com/x.css");',
    href: 'https://example.com/x.css',
    media: '',
    expectFixtureRules: false,
  },
  {
    name: '@import url(x.css) print;',
    css: '@import url(x.css) print;',
    href: 'x.css',
    media: 'print',
    expectFixtureRules: true,
  },
];

function importedFileRulesMatch(associated: CSSStyleSheet): { holds: boolean; message: string } {
  const expected = parse(importedFileCss);
  if (associated.cssRules.length !== expected.cssRules.length) {
    return {
      holds: false,
      message: `KI-7: imported cssRules.length=${associated.cssRules.length} want ${expected.cssRules.length} from fixtures/x.css`,
    };
  }
  for (let i = 0; i < expected.cssRules.length; i++) {
    const got = associated.cssRules[i].cssText;
    const want = expected.cssRules[i].cssText;
    if (got !== want) {
      return {
        holds: false,
        message: `KI-7: imported rule[${i}] cssText=${JSON.stringify(got)} want ${JSON.stringify(want)} from fixtures/x.css`,
      };
    }
  }
  return { holds: true, message: 'imported file cssRules match fixtures/x.css' };
}

function ki7LoadedSheetContract(shape: Shape): { setupOk: boolean; holds: boolean; message: string } {
  const sheet = parse(shape.css);
  const rule = [...sheet.cssRules].find((r) => r instanceof CSSImportRule) as CSSImportRule | undefined;
  if (!rule) {
    return {
      setupOk: false,
      holds: false,
      message: `setup failed: expected CSSImportRule from ${shape.css}`,
    };
  }
  if (rule.href !== shape.href) {
    return {
      setupOk: false,
      holds: false,
      message: `setup failed: href was ${JSON.stringify(rule.href)} want ${JSON.stringify(shape.href)}`,
    };
  }
  if (rule.media.mediaText !== shape.media) {
    return {
      setupOk: false,
      holds: false,
      message: `setup failed: mediaText was ${JSON.stringify(rule.media.mediaText)} want ${JSON.stringify(shape.media)}`,
    };
  }

  // Full CSSOM contract: CSSImportRule.styleSheet is the associated loaded stylesheet.
  const associated = rule.styleSheet;
  if (associated === null) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-7: ${shape.name} CSSImportRule.styleSheet is null; @import never fetches`,
    };
  }
  if (associated.cssRules.length === 0) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-7: ${shape.name} CSSImportRule.styleSheet is an empty never-fetched placeholder (cssRules.length=0); @import never fetches`,
    };
  }
  if (shape.expectFixtureRules) {
    const match = importedFileRulesMatch(associated);
    if (!match.holds) {
      return { setupOk: true, holds: false, message: match.message };
    }
  }
  return {
    setupOk: true,
    holds: true,
    message: `KI-7 contract holds for ${shape.name}: associated loaded stylesheet with cssRules from the imported file`,
  };
}

describe('KI-7 e2e user-shaped @import (full CSSOM loaded sheet)', () => {
  for (const shape of SHAPES) {
    // Reproduces: KI-7
    // Verifies: SYS-REQ-260821-H3BD
    // Verifies: SW-REQ-260821-5W6X
    test(`${shape.name}: CSSImportRule.styleSheet is the associated loaded stylesheet`, () => {
      const outcome = ki7LoadedSheetContract(shape);
      assert.equal(outcome.setupOk, true, outcome.message);
      assert.equal(outcome.holds, true, outcome.message);
    });
  }
});
