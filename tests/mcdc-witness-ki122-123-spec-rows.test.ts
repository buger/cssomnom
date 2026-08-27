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
// Spec-side MC/DC witnesses for the cssom typed-value range and
// reification-class guarantees (css-typed-om-1 #create-an-internal-
// representation and #reify-as-a-cssstylevalue). Rows 2 of each table are
// the live KI-122 / KI-123 defects; the tests pin today's observable
// behavior so the suite stays green at HEAD and the annotations disclose
// the debt until the fixes land.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { CSSStyleValue, CSSUnitValue, CSSMathSum, StylePropertyMap } from '../src/typed-om.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';

function freshMap(): { map: StylePropertyMap; style: CSSStyleDeclaration } {
  const style = new CSSStyleDeclaration();
  const map = new StylePropertyMap(style);
  return { map, style };
}

describe('MC/DC witness: typed-om range wrapping and reification class', () => {
  // Verifies: SYS-REQ-260824-QGJE
  // MCDC SYS-REQ-260824-QGJE: typed_out_of_range_unit_set=F, unwrapped_out_of_range_reads_LE_0=F => TRUE [no-action: in-range flex-grow read reifies a bare CSSUnitValue, so the out-of-range wrap path never runs]
  //mcdc:ignore:capability-gap SYS-REQ-260824-QGJE: typed_out_of_range_unit_set=T, unwrapped_out_of_range_reads_LE_0=F => FALSE -- the out-of-range part re-reads as a bare CSSUnitValue instead of a wrapping CSSMathSum; failing public-API tripwire is KI-122 [reviewed: agent:champ] [ki: KI-122] [category: capability-gap]
  // MCDC SYS-REQ-260824-QGJE: typed_out_of_range_unit_set=T, unwrapped_out_of_range_reads_LE_0=F => FALSE [known-issue] [ki: KI-122]
  //mcdc:ignore:known-issue SYS-REQ-260824-QGJE: typed_out_of_range_unit_set=T, unwrapped_out_of_range_reads_LE_0=T => TRUE -- the wrapped read row is reachable only after the KI-122 fix [reviewed: agent:champ] [ki: KI-122]
  test('out-of-range unit part re-reads unwrapped (KI-122) with in-range control', () => {
    // Control (row 1): an in-range number stores and re-reads bare.
    const control = freshMap();
    control.map.set('flex-grow', new CSSUnitValue(1.5, 'number'));
    const controlBack = control.map.get('flex-grow');
    assert.ok(controlBack instanceof CSSUnitValue);
    assert.equal(String(controlBack), '1.5');
    assert.equal(control.style.getPropertyValue('flex-grow'), '1.5');

    // Defect leg (row 2): -3.14 against <number [0,∞]> must wrap in a fresh
    // CSSMathSum per css-typed-om-1 #create-an-internal-representation; the
    // current build reifies the bare unit value (KI-122).
    const defect = freshMap();
    defect.map.set('flex-grow', new CSSUnitValue(-3.14, 'number'));
    const back = defect.map.get('flex-grow')!;
    assert.equal(back.constructor.name, 'CSSUnitValue');
    assert.ok(!(back instanceof CSSMathSum));
    assert.equal(defect.style.getPropertyValue('flex-grow'), '-3.14');
  });

  // Verifies: SYS-REQ-260824-XE59
  // MCDC SYS-REQ-260824-XE59: base_only_property_value_read=F, subclass_boxed_base_reads_LE_0=F => TRUE [no-action: currentcolor reifies through the keyword subclass path, so no base-only read runs]
  //mcdc:ignore:capability-gap SYS-REQ-260824-XE59: base_only_property_value_read=T, subclass_boxed_base_reads_LE_0=F => FALSE -- the unrepresentable color value rejects with a TypeError instead of reifying a direct CSSStyleValue; failing public-API tripwire is KI-123 [reviewed: agent:champ] [ki: KI-123] [category: capability-gap]
  // MCDC SYS-REQ-260824-XE59: base_only_property_value_read=T, subclass_boxed_base_reads_LE_0=F => FALSE [known-issue] [ki: KI-123]
  //mcdc:ignore:known-issue SYS-REQ-260824-XE59: base_only_property_value_read=T, subclass_boxed_base_reads_LE_0=T => TRUE -- the direct-CSSStyleValue row is reachable only after the KI-123 fix [reviewed: agent:champ] [ki: KI-123]
  test('unrepresentable color rejects instead of base reifying (KI-123) with supported control', () => {
    // Control (row 1): a representable color reifies through its subclass.
    const ok = CSSStyleValue.parse('border-top-color', 'currentcolor');
    assert.equal(ok.constructor.name, 'CSSKeywordValue');

    // Defect leg (row 2): the unsupported multi-value must reify as a direct
    // CSSStyleValue per css-typed-om-1 #reify-as-a-cssstylevalue; the current
    // build throws (KI-123).
    assert.throws(
      () => CSSStyleValue.parse('border-top-color', 'red|#bbff00|rgb(255, 255, 128)|transparent'),
      TypeError
    );
  });
});
