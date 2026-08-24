/**
 * Overlay reproducer for KI-10. Not a product-suite test.
 * html #concept-fieldset-disabled: a fieldset is disabled if it has disabled
 * or is a descendant of another disabled fieldset and is not a descendant of
 * that fieldset's first legend child. First-legend exemption also applies to
 * form controls (#concept-fe-disabled).
 * Asserts :disabled is false for #nested-in-legend so this command FAILS
 * while walking up hits the ancestor's own disabled attribute.
 *
 * Reproduces: KI-10
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { matches } from '../../src/matcher.ts';

function ki10Contract(): { setupOk: boolean; holds: boolean; message: string } {
  const { document } = parseHTML(`
    <fieldset id="fs" disabled>
      <legend>
        <input id="in-legend">
        <fieldset id="nested-in-legend">
          <input id="nested-legend-input">
        </fieldset>
        <fieldset id="nested-in-legend-own-disabled" disabled></fieldset>
      </legend>
      <legend>
        <fieldset id="nested-in-second-legend"></fieldset>
      </legend>
      <input id="in-fs">
      <fieldset id="nested-outside"></fieldset>
    </fieldset>
  `);
  const nested = document.getElementById('nested-in-legend');
  const inLegend = document.getElementById('in-legend');
  const inFs = document.getElementById('in-fs');
  const fs = document.getElementById('fs');
  if (!nested || !inLegend || !inFs || !fs) {
    return { setupOk: false, holds: false, message: 'setup failed: expected fieldset fixture ids' };
  }
  if (matches(fs, ':disabled') !== true || matches(inFs, ':disabled') !== true) {
    return {
      setupOk: false,
      holds: false,
      message: 'setup failed: fieldset[disabled] and input outside first legend must match :disabled',
    };
  }
  const nestedDisabled = matches(nested, ':disabled');
  const inLegendDisabled = matches(inLegend, ':disabled');
  const nestedInput = matches(document.getElementById('nested-legend-input')!, ':disabled');
  if (nestedDisabled !== false || inLegendDisabled !== false || nestedInput !== false) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-10: first-legend exemption failed (nested=${nestedDisabled} inLegend=${inLegendDisabled} nestedInput=${nestedInput}); intended all false`,
    };
  }
  const own = matches(document.getElementById('nested-in-legend-own-disabled')!, ':disabled');
  const second = matches(document.getElementById('nested-in-second-legend')!, ':disabled');
  const outside = matches(document.getElementById('nested-outside')!, ':disabled');
  if (own !== true || second !== true || outside !== true) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-10: own-disabled/second-legend/outside expected true, got own=${own} second=${second} outside=${outside}`,
    };
  }
  return { setupOk: true, holds: true, message: 'KI-10 contract holds: first-legend nested fieldset is not :disabled' };
}

// Reproduces: KI-10
// Verifies: SW-REQ-260821-6D9T
// Verifies: SYS-REQ-260821-PJ76
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
test('fieldset inside first legend of disabled ancestor is not :disabled', () => {
  const outcome = ki10Contract();
  assert.equal(outcome.setupOk, true, outcome.message);
  assert.equal(outcome.holds, true, outcome.message);
});
