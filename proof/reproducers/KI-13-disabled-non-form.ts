/**
 * Overlay reproducer for KI-13. Not a product-suite test.
 * html #selector-disabled matches actually-disabled form controls / fieldsets
 * / form-associated custom elements only. html #concept-fe-disabled does not
 * apply to a <div disabled> or a <p> descendant of fieldset[disabled].
 * Asserts those are false so this command FAILS while isElementDisabled
 * treats any disabled attribute / any fieldset descendant as disabled.
 * Distinct from KI-10 (first-legend exemption).
 *
 * Reproduces: KI-13
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { matches } from '../../src/matcher.ts';

function ki13Contract(): { setupOk: boolean; holds: boolean; message: string } {
  const { document } = parseHTML(`
    <div id="d" disabled></div>
    <p id="plain-p" disabled></p>
    <fieldset id="fs" disabled>
      <p id="p">x</p>
      <span id="span">y</span>
      <input id="in-fs">
    </fieldset>
    <input id="own" disabled>
    <button id="btn" disabled></button>
  `);
  const own = document.getElementById('own');
  const btn = document.getElementById('btn');
  const fs = document.getElementById('fs');
  const inFs = document.getElementById('in-fs');
  const d = document.getElementById('d');
  const p = document.getElementById('p');
  const span = document.getElementById('span');
  const plainP = document.getElementById('plain-p');
  if (!own || !btn || !fs || !inFs || !d || !p || !span || !plainP) {
    return { setupOk: false, holds: false, message: 'setup failed: expected :disabled fixture ids' };
  }
  if (
    matches(own, ':disabled') !== true ||
    matches(btn, ':disabled') !== true ||
    matches(fs, ':disabled') !== true ||
    matches(inFs, ':disabled') !== true
  ) {
    return {
      setupOk: false,
      holds: false,
      message: 'setup failed: listed form controls / fieldset[disabled] must match :disabled',
    };
  }

  const divDisabled = matches(d, ':disabled');
  const pDisabled = matches(p, ':disabled');
  const spanDisabled = matches(span, ':disabled');
  const plainPDisabled = matches(plainP, ':disabled');
  if (divDisabled !== false || pDisabled !== false || spanDisabled !== false || plainPDisabled !== false) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-13: non-form :disabled overmatch (div=${divDisabled} p=${pDisabled} span=${spanDisabled} plainP=${plainPDisabled}); intended all false`,
    };
  }
  return { setupOk: true, holds: true, message: 'KI-13 contract holds: :disabled is only listed form controls / fieldsets' };
}

// Reproduces: KI-13
// Verifies: SW-REQ-260821-6D9T
// Verifies: SYS-REQ-260821-PJ76
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
test(':disabled does not match div[disabled] or p inside fieldset[disabled]', () => {
  const outcome = ki13Contract();
  assert.equal(outcome.setupOk, true, outcome.message);
  assert.equal(outcome.holds, true, outcome.message);
});
