/**
 * Overlay reproducer for KI-12. Not a product-suite test.
 * css-values-4 § 4.1 #keywords / infra #ascii-case-insensitive: at-keywords
 * are ASCII case-insensitive. handleMarginRule stores lowercase name.
 * options.atRules lookup must fold. AT_RULE_HANDLERS lookup must use hasOwn
 * so @__proto__ / @constructor do not invoke Object.prototype.
 * Asserts those contracts so this command FAILS while getAtRuleHandler is unrestored.
 *
 * Reproduces: KI-12
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSSAtRule, CSSMarginRule, CSSMediaRule, CSSPageRule } from '../../src/CSSOM.ts';
import { CSS, CSSParserAtRule, CSSParserQualifiedRule } from '../../src/index.ts';

function ki12Contract(): { setupOk: boolean; holds: boolean; message: string } {
  const lowerMedia = parse('@media all { .x { color: red; } }');
  if (!(lowerMedia.cssRules[0] instanceof CSSMediaRule)) {
    return {
      setupOk: false,
      holds: false,
      message: `setup failed: lowercase @media should be CSSMediaRule, got ${lowerMedia.cssRules[0]?.constructor?.name}`,
    };
  }

  const upper = parse('@MEDIA all { .x { color: red; } }');
  if (!(upper.cssRules[0] instanceof CSSMediaRule)) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-12: @MEDIA did not dispatch to CSSMediaRule (got ${upper.cssRules[0]?.constructor?.name})`,
    };
  }

  const page = parse('@page { @TOP-LEFT { margin: 1px; } }');
  const pageRule = page.cssRules[0] as CSSPageRule | undefined;
  const margin = pageRule?.cssRules?.[0] as CSSMarginRule | undefined;
  if (!(margin instanceof CSSMarginRule) || margin.name !== 'top-left') {
    return {
      setupOk: true,
      holds: false,
      message: `KI-12: @TOP-LEFT was not CSSMarginRule name top-left (page=${pageRule?.constructor?.name} child=${margin?.constructor?.name} name=${JSON.stringify(margin?.name)} cssRules=${pageRule?.cssRules?.length})`,
    };
  }

  const folded = CSS.parseStylesheetSync('@FOO { div { color: red; } }', { atRules: { foo: 'rule' } });
  const top = folded[0] as CSSParserAtRule | undefined;
  if (!(top instanceof CSSParserAtRule) || !(top.body?.[0] instanceof CSSParserQualifiedRule)) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-12: options.atRules did not ASCII-fold @FOO (top=${top?.constructor?.name} body0=${top?.body?.[0]?.constructor?.name})`,
    };
  }

  try {
    const proto = parse('@__proto__ { } @constructor { } @toString;');
    for (const rule of proto.cssRules) {
      if (!(rule instanceof CSSAtRule)) {
        return {
          setupOk: true,
          holds: false,
          message: `KI-12: inherited-key at-rule was ${rule.constructor.name}, intended CSSAtRule`,
        };
      }
    }
  } catch (err) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-12: inherited-key at-rule threw ${err instanceof Error ? err.name + ': ' + err.message : String(err)}`,
    };
  }

  return { setupOk: true, holds: true, message: 'KI-12 contract holds: ASCII-case dispatch, margin name, atRules fold, hasOwn handlers' };
}

// Reproduces: KI-12
// Verifies: INT-REQ-260821-ZMZR
// Verifies: SYS-REQ-260821-7521
// Verifies: INT-REQ-260821-WTPD
test('at-rule dispatch is ASCII-case-insensitive and hasOwn-safe', () => {
  const outcome = ki12Contract();
  assert.equal(outcome.setupOk, true, outcome.message);
  assert.equal(outcome.holds, true, outcome.message);
});
