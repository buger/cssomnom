/**
 * Reproducer for CRS-0010/C15 (requirement INT-REQ-260821-ZMZR,
 * src/parser.ts Parser.parseRule instance method).
 *
 * The instance method Parser.parseRule (parser.ts:195-211) builds
 * `new Parser(tokens)` without forwarding this.options, so the
 * constructor's atRuleTypes map is dropped. parseStyleSheet() on the same
 * instance honors options.atRules, and parser-api parseRuleSync forwards
 * options too. A Parser constructed with { atRules: { foo: 'rule' } } loses
 * the custom at-rule classification only on the instance parseRule path.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Parser } from '../../src/parser.ts';
import { tokenize } from '../../src/tokenizer.ts';
import { CSSAtRule } from '../../src/CSSOM.ts';

// Reproduces: pending KI (CRS-0010/C15)
test('CRS-0010/C15: instance parseRule honors this.options.atRules like the rest of the parser', () => {
  const p = new Parser(tokenize('@foo { a {} }'), { atRules: { foo: 'rule' } });
  const viaInstance = p.parseRule('@foo { a {} }') as { type: string; childRules?: unknown[] };
  // consumeRule on the same instance classifies @foo as a custom 'rule'
  // at-rule (type 'at-rule' with childRules). The instance parseRule must
  // not silently drop the configured at-rule types.
  const viaConsume = p.consumeRule() as { type: string; childRules?: unknown[] };
  assert.equal(viaConsume.type, 'at-rule');
  assert.ok(Array.isArray(viaConsume.childRules) && viaConsume.childRules.length > 0,
    'control: consumeRule on this instance applies the atRules option');
  assert.equal(viaInstance.type, 'at-rule');
  assert.ok(Array.isArray(viaInstance.childRules) && viaInstance.childRules.length > 0,
    'instance parseRule must apply this.options.atRules the same way');
});
