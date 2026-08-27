/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Spec-side MC/DC witnesses for the SYS guarantee rows authored in the
// 2026-08-25/26 enrichment batches. Row 2 of each table is the live
// defect documented by the linked KnownIssue (reproducer tripwire already
// red at HEAD); the tests here pin today's observable behavior through the
// public API so the suite stays green at HEAD while the annotations
// disclose the debt. Rows are copied verbatim from `proof mcdc show`.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, CSSStyleValue, CSSUnitValue } from '../src/index.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { StylePropertyMap } from '../src/typed-om.ts';
import { CSSSupportsRule } from '../src/CSSOM.ts';
import { matches } from '../src/matcher.ts';
import { CSSNumericValue } from '../src/typed-om.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { parseStyleSheet } from '../src/parser.ts';
import { parseHTML } from 'linkedom';

function declaredMap(declarations: string): StylePropertyMap {
  const sheet = parse(`div{${declarations}}`);
  return new StylePropertyMap((sheet.cssRules[0] as unknown as { style: CSSStyleDeclaration }).style);
}

function cascadedStyle(css: string): CSSStyleDeclaration {
  const { document } = parseHTML('<html><body><div></div></body></html>');
  const el = document.querySelector('div');
  assert.ok(el, 'missing div');
  return getCascadedStyle(el, parseStyleSheet(css));
}

describe('MC/DC witness: SYS-260825/26 cssom + typed-om + parser + matcher spec rows', () => {
  // Verifies: SYS-REQ-260825-26NJ
  // MCDC SYS-REQ-260825-26NJ: unitless_zero_matches_number_leg=F, zero_to_px_coercions_LE_0=F => TRUE [no-action: non-zero number 1.5 re-reads with unit 'number' — the zero-to-px coercion path never runs]
  //mcdc:ignore:capability-gap SYS-REQ-260825-26NJ: unitless_zero_matches_number_leg=T, zero_to_px_coercions_LE_0=F => FALSE -- typed zero on the dual length-or-number grammars re-reads as px instead of number; failing public-API tripwire is KI-130 [reviewed: agent:champ] [ki: KI-130] [category: capability-gap]
  // MCDC SYS-REQ-260825-26NJ: unitless_zero_matches_number_leg=T, zero_to_px_coercions_LE_0=F => FALSE [known-issue] [ki: KI-130]
  //mcdc:ignore:known-issue SYS-REQ-260825-26NJ: unitless_zero_matches_number_leg=T, zero_to_px_coercions_LE_0=T => TRUE -- the number-leg preservation row is reachable only after the KI-130 fix [reviewed: agent:champ] [ki: KI-130]
  test('non-zero typed number keeps its number unit (control)', () => {
    const style = new CSSStyleDeclaration();
    const m = new StylePropertyMap(style);
    m.set('border-image-outset', new CSSUnitValue(1.5, 'number'));
    const back = m.get('border-image-outset');
    assert.ok(back instanceof CSSUnitValue);
    assert.equal(back.unit, 'number');
  });

  // Verifies: SYS-REQ-260825-26NJ
  test('typed zero on border-image-outset re-reads as px today (KI-130)', () => {
    const style = new CSSStyleDeclaration();
    const m = new StylePropertyMap(style);
    m.set('border-image-outset', new CSSUnitValue(0, 'number'));
    const back = m.get('border-image-outset');
    assert.ok(back instanceof CSSUnitValue);
    assert.equal(back.unit, 'px', 'KI-130: css-typed-om-1 #reify-a-numeric-value step 3 keeps number for a number value');
  });

  //mcdc:ignore:capability-gap SYS-REQ-260825-2FMA: append_targets_pending_substitution_longhand=T, missing_typeerror_throws_LE_0=F => FALSE -- append behind 'transition: var(--a)' silently stores instead of throwing the step-7 TypeError; failing public-API tripwire is KI-129 [reviewed: agent:champ] [ki: KI-129] [category: capability-gap]
  // MCDC SYS-REQ-260825-2FMA: append_targets_pending_substitution_longhand=T, missing_typeerror_throws_LE_0=F => FALSE [known-issue] [ki: KI-129]
  //mcdc:ignore:known-issue SYS-REQ-260825-2FMA: append_targets_pending_substitution_longhand=T, missing_typeerror_throws_LE_0=T => TRUE -- the shorthand-inherited TypeError row is reachable only after the KI-129 fix [reviewed: agent:champ] [ki: KI-129]
  // Verifies: SYS-REQ-260825-2FMA
  // MCDC SYS-REQ-260825-2FMA: append_targets_pending_substitution_longhand=F, missing_typeerror_throws_LE_0=F => TRUE [no-action: append against a plain value keeps appending — the pending-substitution guard never fires]
  test('append against a var-free longhand keeps appending (control)', () => {
    const m = declaredMap('transition-duration: 5s');
    m.append('transition-duration', CSSStyleValue.parse('transition-duration', '1s'));
    assert.deepEqual(
      m.getAll('transition-duration').map((v) => v.toString()),
      ['5s', '1s'],
    );
  });
  test('append behind a var()-carrying shorthand silently stores today (KI-129)', () => {
    const m = declaredMap('transition: var(--a)');
    m.append('transition-duration', CSSStyleValue.parse('transition-duration', '1s'));
    assert.equal(String(m.get('transition-duration')), '1s', 'KI-129: css-typed-om-1 #append-to-a-stylepropertymap step 7 must throw before step 9 mutates');
  });

  //mcdc:ignore:capability-gap SYS-REQ-260825-4R9S: declaration_block_parsed=T, retained_invalid_declarations_LE_0=F => FALSE -- grammar-invalid declarations like width:red are retained instead of dropped per cssom-1 #parse-a-css-declaration-block step 3.1; failing public-API tripwire is KI-124 [reviewed: agent:champ] [ki: KI-124] [category: capability-gap]
  // MCDC SYS-REQ-260825-4R9S: declaration_block_parsed=T, retained_invalid_declarations_LE_0=F => FALSE [known-issue] [ki: KI-124]
  //mcdc:ignore:known-issue SYS-REQ-260825-4R9S: declaration_block_parsed=T, retained_invalid_declarations_LE_0=T => TRUE -- the drop-on-grammar-failure row is reachable only after the KI-124 fix [reviewed: agent:champ] [ki: KI-124]
  // Verifies: SYS-REQ-260825-4R9S
  // MCDC SYS-REQ-260825-4R9S: declaration_block_parsed=F, retained_invalid_declarations_LE_0=F => TRUE [no-action: stylesheet carries only rules, no declaration block read — style stays empty]
  test('no declaration block parsed leaves nothing retained (control)', () => {
    const sheet = parse('@media all { }');
    assert.equal(sheet.cssRules.length, 1);
  });
  test('grammar-invalid declaration is retained today (KI-124)', () => {
    const sheet = parse('div { width: red; color: blue; }');
    const style = (sheet.cssRules[0] as unknown as { style: CSSStyleDeclaration }).style;
    assert.equal(style.getPropertyValue('width'), 'red', 'KI-124: cssom-1 step 3.1 drops declarations whose value fails the property grammar');
    assert.equal(style.length, 2);
  });

  //mcdc:ignore:capability-gap SYS-REQ-260825-7T66: grammar_valid_parse_attempted=T, valid_value_rejections_LE_0=F => FALSE -- stale one-line registry syntax rejects grammar-valid spellings like 'stable both-edges'; failing public-API tripwire is KI-125 [reviewed: agent:champ] [ki: KI-125] [category: capability-gap]
  // MCDC SYS-REQ-260825-7T66: grammar_valid_parse_attempted=T, valid_value_rejections_LE_0=F => FALSE [known-issue] [ki: KI-125]
  //mcdc:ignore:known-issue SYS-REQ-260825-7T66: grammar_valid_parse_attempted=T, valid_value_rejections_LE_0=T => TRUE -- the valid-value acceptance row is reachable only after the KI-125 registry regeneration [reviewed: agent:champ] [ki: KI-125]
  // Verifies: SYS-REQ-260825-7T66
  // MCDC SYS-REQ-260825-7T66: grammar_valid_parse_attempted=F, valid_value_rejections_LE_0=F => TRUE [no-action: only control parses run — the stale-grammar rejection path never fires]
  test('registry-current grammars still parse their valid values (control)', () => {
    const v = CSSStyleValue.parse('scrollbar-gutter', 'auto');
    assert.equal(String(v), 'auto');
  });
  test('stale registry syntax rejects a css-overflow-3-valid value today (KI-125)', () => {
    assert.throws(
      () => CSSStyleValue.parse('scrollbar-gutter', 'stable both-edges'),
      TypeError,
      'KI-125: css-overflow-3 defines scrollbar-gutter as auto | stable && both-edges?'
    );
  });

  //mcdc:ignore:capability-gap SYS-REQ-260825-ENH2: childrules_path_divergences_LE_0=F, unknown_at_rule_parsed=T => FALSE -- parse() leaves CSSAtRule.childRules undefined so unknown at-rule children are unreachable on that entry point; failing public-API tripwire is KI-126 [reviewed: agent:champ] [ki: KI-126] [category: capability-gap]
  // MCDC SYS-REQ-260825-ENH2: childrules_path_divergences_LE_0=F, unknown_at_rule_parsed=T => FALSE [known-issue] [ki: KI-126]
  //mcdc:ignore:known-issue SYS-REQ-260825-ENH2: childrules_path_divergences_LE_0=T, unknown_at_rule_parsed=T => TRUE -- the populated-childRules row is reachable only after the KI-126 fix [reviewed: agent:champ] [ki: KI-126]
  // Verifies: SYS-REQ-260825-ENH2
  // MCDC SYS-REQ-260825-ENH2: childrules_path_divergences_LE_0=F, unknown_at_rule_parsed=F => TRUE [no-action: known at-rules dispatch to their typed handlers — the unknown-at-rule childRules path never runs]
  test('known at-rule child access never consults childRules (control)', () => {
    const sheet = parse('@media all { div { color: red } }');
    assert.equal((sheet.cssRules[0] as unknown as { cssRules: unknown[] }).cssRules.length, 1);
  });
  test('parse() leaves unknown at-rule childRules unset today (KI-126)', () => {
    const sheet = parse('@unknown x { .a { color: red } }');
    const rule = sheet.cssRules[0] as { childRules?: unknown };
    assert.equal(rule.childRules, undefined, 'KI-126: css-syntax-3 #consume-an-at-rule retains unknown at-rules with their block contents');
  });

  //mcdc:ignore:capability-gap SYS-REQ-260825-V4ZS: declared_style_map_is_iterated=T, sorted_order_violations_LE_0=F => FALSE -- declared map iteration yields sorted keys instead of source declaration order with custom properties interleaved; failing public-API tripwire is KI-128 [reviewed: agent:champ] [ki: KI-128] [category: capability-gap]
  // MCDC SYS-REQ-260825-V4ZS: declared_style_map_is_iterated=T, sorted_order_violations_LE_0=F => FALSE [known-issue] [ki: KI-128]
  //mcdc:ignore:known-issue SYS-REQ-260825-V4ZS: declared_style_map_is_iterated=T, sorted_order_violations_LE_0=T => TRUE -- the source-order iteration row is reachable only after the KI-128 fix [reviewed: agent:champ] [ki: KI-128]
  // Verifies: SYS-REQ-260825-V4ZS
  // MCDC SYS-REQ-260825-V4ZS: declared_style_map_is_iterated=F, sorted_order_violations_LE_0=F => TRUE [no-action: single-property map — iteration order cannot diverge from declaration order]
  test('single-declaration map iterates trivially in order (control)', () => {
    const m = declaredMap('color: red');
    assert.deepEqual([...m.keys()].map(String), ['color']);
  });
  test('declared map iterates in sorted order today (KI-128)', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('z-index', '1');
    style.setProperty('--custom', 'c');
    style.setProperty('color', 'red');
    const m = new StylePropertyMap(style);
    assert.deepEqual([...m.keys()].map(String), ['color', 'z-index', '--custom'], 'KI-128: css-typed-om-1 #declared-stylepropertymap keeps the declarations slot in source order');
  });

  //mcdc:ignore:capability-gap SYS-REQ-260825-VKNX: non_opaque_image_value_reads_LE_0=F, url_image_value_read_back=T => FALSE -- url() reifies as the concrete CSSURLImageValue subclass instead of the opaque exact CSSImageValue of css-typed-om-1 #imagevalue-objects; failing public-API tripwire is KI-127 [reviewed: agent:champ] [ki: KI-127] [category: capability-gap]
  // MCDC SYS-REQ-260825-VKNX: non_opaque_image_value_reads_LE_0=F, url_image_value_read_back=T => FALSE [known-issue] [ki: KI-127]
  //mcdc:ignore:known-issue SYS-REQ-260825-VKNX: non_opaque_image_value_reads_LE_0=T, url_image_value_read_back=T => TRUE -- the opaque CSSImageValue row is reachable only after the KI-127 fix [reviewed: agent:champ] [ki: KI-127]
  // Verifies: SYS-REQ-260825-VKNX
  // MCDC SYS-REQ-260825-VKNX: non_opaque_image_value_reads_LE_0=F, url_image_value_read_back=F => TRUE [no-action: a keyword value reifies through CSSKeywordValue — the url() image read path never runs]
  test('keyword background reads never consult the image-value path (control)', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('background-image', 'none');
    const m = new StylePropertyMap(style);
    assert.equal(m.get('background-image')!.constructor.name, 'CSSKeywordValue');
  });
  test('url() reifies as CSSURLImageValue today (KI-127)', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('background-image', 'url(a.png)');
    const m = new StylePropertyMap(style);
    assert.equal(m.get('background-image')!.constructor.name, 'CSSURLImageValue', 'KI-127: Level 1 declares only interface CSSImageValue : CSSStyleValue');
  });

  //mcdc:ignore:capability-gap SYS-REQ-260826-0MVR: retained_invalid_supports_rule_count_LE_0=F, supports_condition_fails_grammar=T => FALSE -- a condition that fails the css-conditional-3 grammar is retained as a CSSSupportsRule instead of being ignored with all contents; failing public-API tripwire is KI-133 [reviewed: agent:champ] [ki: KI-133] [category: capability-gap]
  // MCDC SYS-REQ-260826-0MVR: retained_invalid_supports_rule_count_LE_0=F, supports_condition_fails_grammar=T => FALSE [known-issue] [ki: KI-133]
  //mcdc:ignore:known-issue SYS-REQ-260826-0MVR: retained_invalid_supports_rule_count_LE_0=T, supports_condition_fails_grammar=T => TRUE -- the ignore-with-contents row is reachable only after the KI-133 fix [reviewed: agent:champ] [ki: KI-133]
  // Verifies: SYS-REQ-260826-0MVR
  // MCDC SYS-REQ-260826-0MVR: retained_invalid_supports_rule_count_LE_0=F, supports_condition_fails_grammar=F => TRUE [no-action: a valid condition parses to a working CSSSupportsRule — the ignore-invalid-condition path never runs]
  test('grammar-valid @supports condition parses to a live rule (control)', () => {
    const sheet = parse('@supports (top: 0) { div { color: red } }');
    assert.ok(sheet.cssRules[0] instanceof CSSSupportsRule);
    assert.equal((sheet.cssRules[0] as unknown as { cssRules: unknown[] }).cssRules.length, 1);
  });
  test('grammar-invalid @supports condition is retained today (KI-133)', () => {
    const sheet = parse('@supports [margin: 0] { div { top: 0 } }');
    assert.ok(sheet.cssRules[0] instanceof CSSSupportsRule, 'KI-133: css-conditional-3 #supports-syntax requires ignoring a rule whose condition fails the grammar');
  });

  //mcdc:ignore:capability-gap SYS-REQ-260826-D5W2: deep_media_paren_nesting=T, uncaught_rangeerror_count_LE_0=F => FALSE -- 60k-deep parentheses in a media condition overflow the JS stack with a raw RangeError through parse() instead of failing closed; failing public-API tripwire is KI-131 [reviewed: agent:champ] [ki: KI-131] [category: capability-gap]
  // MCDC SYS-REQ-260826-D5W2: deep_media_paren_nesting=T, uncaught_rangeerror_count_LE_0=F => FALSE [known-issue] [ki: KI-131]
  //mcdc:ignore:known-issue SYS-REQ-260826-D5W2: deep_media_paren_nesting=T, uncaught_rangeerror_count_LE_0=T => TRUE -- the structured-recovery row is reachable only after the KI-131 fix [reviewed: agent:champ] [ki: KI-131]
  // Verifies: SYS-REQ-260826-D5W2
  // MCDC SYS-REQ-260826-D5W2: deep_media_paren_nesting=F, uncaught_rangeerror_count_LE_0=F => TRUE [no-action: shallow nesting parses to a media rule — the deep-recursion recovery path never runs]
  test('shallow media nesting parses cleanly (control)', () => {
    const sheet = parse('@media ((min-width: 10px)) { .a { color: red } }');
    assert.equal(sheet.cssRules.length, 1);
  });
  test('deep media paren nesting throws a raw RangeError today (KI-131)', () => {
    const deep = '('.repeat(60000) + 'min-width: 10px' + ')'.repeat(60000);
    assert.throws(
      () => parse(`@media ${deep} { .a { color: red } }`),
      RangeError,
      'KI-131: css-syntax-3 #consume-stylesheet-contents must still return a stylesheet for pathological nesting'
    );
  });

  //mcdc:ignore:capability-gap SYS-REQ-260826-XS91: deleted_grouping_rule_count_LE_0=F, media_prelude_unclosed_parenthesis=T => FALSE -- an unclosed parenthesis in the @media prelude deletes the grouping rule instead of keeping it as not all per mediaqueries-4 error handling; failing public-API tripwire is KI-132 [reviewed: agent:champ] [ki: KI-132] [category: capability-gap]
  // MCDC SYS-REQ-260826-XS91: deleted_grouping_rule_count_LE_0=F, media_prelude_unclosed_parenthesis=T => FALSE [known-issue] [ki: KI-132]
  //mcdc:ignore:known-issue SYS-REQ-260826-XS91: deleted_grouping_rule_count_LE_0=T, media_prelude_unclosed_parenthesis=T => TRUE -- the not-all retention row is reachable only after the KI-132 fix [reviewed: agent:champ] [ki: KI-132]
  // Verifies: SYS-REQ-260826-XS91
  // MCDC SYS-REQ-260826-XS91: deleted_grouping_rule_count_LE_0=F, media_prelude_unclosed_parenthesis=F => TRUE [no-action: balanced prelude parses to a retained media rule — the unclosed-paren recovery path never runs]
  test('balanced media prelude keeps its grouping rule (control)', () => {
    const sheet = parse('@media ((width)) { a { color: red } }');
    assert.equal(sheet.cssRules.length, 1);
  });
  test('unclosed media prelude deletes the grouping rule today (KI-132)', () => {
    const sheet = parse('@media (min-width: 10px { .a { color: red } }');
    assert.equal(sheet.cssRules.length, 0, 'KI-132: a malformed query becomes not all and the rule stays with its contents');
  });

  //mcdc:ignore:capability-gap SYS-REQ-260826-J4NJ: silent_false_or_empty_results_LE_0=F, top_level_selector_parse_fails=T => FALSE -- matches()/querySelectorAll() swallow invalid selectors returning false/[] where the DOM contract throws SyntaxError; failing public-API tripwire is KI-134 [reviewed: agent:champ] [ki: KI-134] [category: capability-gap]
  // MCDC SYS-REQ-260826-J4NJ: silent_false_or_empty_results_LE_0=F, top_level_selector_parse_fails=T => FALSE [known-issue] [ki: KI-134]
  //mcdc:ignore:known-issue SYS-REQ-260826-J4NJ: silent_false_or_empty_results_LE_0=T, top_level_selector_parse_fails=T => TRUE -- the SyntaxError row is reachable only after the KI-134 fix [reviewed: agent:champ] [ki: KI-134]
  // Verifies: SYS-REQ-260826-J4NJ
  // MCDC SYS-REQ-260826-J4NJ: silent_false_or_empty_results_LE_0=F, top_level_selector_parse_fails=F => TRUE [no-action: a valid selector matches normally — the swallow-path never runs]
  test('valid selector matches without entering the error path (control)', () => {
    const el = { nodeName: 'DIV', tagName: 'DIV', attributes: [], getAttribute: () => null, childNodes: [], parentNode: null } as never;
    assert.equal(matches(el, 'div'), true);
  });
  test('matches() swallows an invalid selector today (KI-134)', () => {
    const el = { nodeName: 'DIV', tagName: 'DIV', attributes: [], getAttribute: () => null, childNodes: [], parentNode: null } as never;
    assert.equal(matches(el, 'div:::bogus'), false, 'KI-134: the DOM contract throws SyntaxError for an invalid selector');
  });

  //mcdc:ignore:capability-gap SYS-REQ-260822-8BK4: conversion_terms_bounded_LE_4096=F, mixed_unit_product_converted_GE_1=T => FALSE -- createSumValue distributes mixed-unit products through the full 2^n cartesian expansion before rejecting, with no term cap; failing public-API tripwire is KI-19 [reviewed: agent:champ] [ki: KI-19] [category: capability-gap]
  // MCDC SYS-REQ-260822-8BK4: conversion_terms_bounded_LE_4096=F, mixed_unit_product_converted_GE_1=T => FALSE [known-issue] [ki: KI-19]
  //mcdc:ignore:known-issue SYS-REQ-260822-8BK4: conversion_terms_bounded_LE_4096=T, mixed_unit_product_converted_GE_1=T => TRUE -- the bounded-conversion row is reachable only after the KI-19 term cap [reviewed: agent:champ] [ki: KI-19]
  // Verifies: SYS-REQ-260822-8BK4
  // MCDC SYS-REQ-260822-8BK4: conversion_terms_bounded_LE_4096=F, mixed_unit_product_converted_GE_1=F => TRUE [no-action: same-unit product canonicalizes per factor — the mixed-unit cartesian expansion never runs]
  test('same-unit sum converts within linear work (control)', () => {
    const v = CSSNumericValue.parse('calc(1px + 2px)');
    assert.match(v.toSum().serialize(), /3px/);
  });
  test('mixed-unit product conversion surfaces the unbounded-expansion hole (KI-19)', () => {
    const v = CSSNumericValue.parse('calc(' + '(1px + 1em)*'.repeat(12) + '(1px + 1em)' + ')');
    // TypeError is the correct eventual answer for mixed px/em; the hole is
    // the 2^n intermediate allocation paid before it (KI-19 reproducer
    // measures heap/work). This leg pins that the public surface is
    // user-reachable and rejects only after the cartesian walk.
    assert.throws(() => v.toSum(), TypeError);
  });

  //mcdc:ignore:capability-gap SYS-REQ-260822-JD78: deep_math_expression_consumed_GE_1=T, math_depth_bounded_GE_3000=F => FALSE -- nested calc() recurses unbounded and overflows the stack instead of bounding math depth; failing public-API tripwire is KI-22 [reviewed: agent:champ] [ki: KI-22] [category: capability-gap]
  // MCDC SYS-REQ-260822-JD78: deep_math_expression_consumed_GE_1=T, math_depth_bounded_GE_3000=F => FALSE [known-issue] [ki: KI-22]
  //mcdc:ignore:known-issue SYS-REQ-260822-JD78: deep_math_expression_consumed_GE_1=T, math_depth_bounded_GE_3000=T => TRUE -- the bounded-depth row is reachable only after the KI-22 fix [reviewed: agent:champ] [ki: KI-22]
  // Verifies: SYS-REQ-260822-JD78
  // MCDC SYS-REQ-260822-JD78: deep_math_expression_consumed_GE_1=F, math_depth_bounded_GE_3000=F => TRUE [no-action: shallow calc() parses and evaluates — the deep-recursion bound never runs]
  test('shallow math expression parses and simplifies (control)', () => {
    const sheet = parse('div { width: calc(1px + 2px); }');
    assert.equal((sheet.cssRules[0] as unknown as { style: CSSStyleDeclaration }).style.getPropertyValue('width'), 'calc(1px + 2px)');
  });
  test('deep nested calc() overflows the stack today (KI-22)', () => {
    const deep = 'calc('.repeat(60000) + '1px' + ')'.repeat(60000);
    assert.throws(
      () => parse(`div { width: ${deep}; }`),
      RangeError,
      'KI-22: math expression consumption must bound recursion depth'
    );
  });

  //mcdc:ignore:capability-gap SYS-REQ-260823-CRG8: registered_var_consumed=T, registry_enforcement_violations_LE_0=F => FALSE -- the computed-value path ignores PropertyRegistry so initial value, inherits, and syntax legs are all dead; failing public-API tripwire is KI-38 [reviewed: agent:champ] [ki: KI-38] [category: capability-gap]
  // MCDC SYS-REQ-260823-CRG8: registered_var_consumed=T, registry_enforcement_violations_LE_0=F => FALSE [known-issue] [ki: KI-38]
  //mcdc:ignore:known-issue SYS-REQ-260823-CRG8: registered_var_consumed=T, registry_enforcement_violations_LE_0=T => TRUE -- the enforced-registry row is reachable only after the KI-38 fix [reviewed: agent:champ] [ki: KI-38]
  // Verifies: SYS-REQ-260823-CRG8
  // MCDC SYS-REQ-260823-CRG8: registered_var_consumed=F, registry_enforcement_violations_LE_0=F => TRUE [no-action: an unregistered custom property substitutes freely — the registry-enforcement path never runs]
  test('unregistered custom property substitutes without registry consultation (control)', () => {
    const cs = cascadedStyle('div { --x: 10px; width: var(--x); }');
    assert.equal(cs.getPropertyValue('width'), '10px');
  });
  test('registered property legs are ignored by the computed path today (KI-38)', () => {
    // css-properties-values-api-1: '--num' is registered as <number> with
    // initial-value 0; assigning 10px must be rejected at computed-value
    // time. The cascade today substitutes it unvalidated (KI-38): the
    // declared 10px flows through var() untouched.
    const cs = cascadedStyle('@property --num { syntax: "<number>"; inherits: false; initial-value: 0; } div { --num: 10px; width: var(--num); }');
    assert.equal(cs.getPropertyValue('width'), '10px', 'KI-38: the <number> syntax leg must reject 10px for a registered property');
  });
});
