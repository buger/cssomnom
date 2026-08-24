/**
 * Overlay reproducer for KI-6. Not a product-suite test.
 * Asserts the intended contract (parseStylesheetSync adapts @layer/@container
 * to CSSParserAtRule with nested CSSParserQualifiedRule children)
 * so this command FAILS while the hole is present.
 *
 * Reproduces: KI-6
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSS, CSSParserAtRule, CSSParserQualifiedRule } from '../../src/index.ts';

function ki6Contract(): { setupOk: boolean; holds: boolean; message: string } {
  const media = CSS.parseStylesheetSync('@media all { .x { color: red; } }');
  if (media.length !== 1 || !(media[0] instanceof CSSParserAtRule)) {
    return {
      setupOk: false,
      holds: false,
      message: `setup failed: expected @media to adapt to CSSParserAtRule, got ${media[0]?.constructor?.name}`,
    };
  }

  const layer = CSS.parseStylesheetSync('@layer foo;');
  const layerBlock = CSS.parseStylesheetSync('@layer foo { .x { color: red; } }');
  const container = CSS.parseStylesheetSync('@container (min-width: 1px) { .x { color: red; } }');

  const layerOk = layer.length === 1 && layer[0] instanceof CSSParserAtRule;
  const layerBlockRule = layerBlock[0] as CSSParserAtRule | undefined;
  const containerRule = container[0] as CSSParserAtRule | undefined;
  const layerBlockOk =
    layerBlock.length === 1 &&
    layerBlock[0] instanceof CSSParserAtRule &&
    layerBlockRule?.body?.[0] instanceof CSSParserQualifiedRule;
  const containerOk =
    container.length === 1 &&
    container[0] instanceof CSSParserAtRule &&
    containerRule?.body?.[0] instanceof CSSParserQualifiedRule;

  if (!layerOk || !layerBlockOk || !containerOk) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-6: type-0 at-rules were not adapted to CSSParserAtRule (layer=${layer[0]?.constructor?.name}, layerBlock=${layerBlock[0]?.constructor?.name}, container=${container[0]?.constructor?.name})`,
    };
  }
  return { setupOk: true, holds: true, message: 'KI-6 contract holds: type-0 at-rules adapted to CSSParserAtRule' };
}

// Reproduces: KI-6
// Verifies: INT-REQ-260821-WTPD
// MCDC INT-REQ-260821-WTPD: parse_stylesheet_sync_called=T, parser_ast_adapted=T => TRUE
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
test('KI-6: type-0 at-rules adapt to CSSParserAtRule', () => {
  const outcome = ki6Contract();
  assert.equal(outcome.setupOk, true, outcome.message);
  assert.equal(outcome.holds, true, outcome.message);
});
