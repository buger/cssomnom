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

// Reject-combination composition witnesses for the origin-clean access partition.
//
// spec_lint_reject_combination_composition_witnessed requires an exclusivity
// obligation (obligation_checklist class `access_denied`) to be witnessed by a
// test that constructs >= 3 members of the mode set, including at least one
// plain/neutral baseline member. Pairwise-only witnesses cannot demonstrate a
// mutually exclusive mode partition (real bug class: mixed-mode reset where a
// [partitioned, plain, per_api] combination bypassed a pairwise-guarded check).
//
// The mode set here is the CSSStyleSheet origin-clean partition
// (cssom-1 #the-cssstylesheet-interface: "The origin-clean flag is exposed
// through the cssRules accessor... throw a SecurityError"):
//
//   1. plain          — origin-clean sheet: cssRules readable, mutations allowed.
//   2. tainted-read   — tainted sheet: cssRules getter throws SecurityError.
//   3. tainted-write  — same tainted sheet: insertRule throws SecurityError.
//   4. tainted-delete — same tainted sheet: deleteRule throws SecurityError.
//
// Members 2-4 share one flag but exercise distinct API surfaces, so a fix that
// guards only one accessor while leaving the others open still fails this file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRule } from '../src/parser.ts';
import { CSSStyleSheet } from '../src/CSSOM.ts';

function throwsSecurityError(fn: () => unknown): void {
  assert.throws(
    fn,
    (err: unknown) => err instanceof DOMException && err.name === 'SecurityError'
  );
}

// Verifies: SYS-REQ-260821-X3KX:access_denied:nominal
// Verifies: SYS-REQ-260821-X3KX:access_denied:negative
// Verifies: SYS-REQ-260821-X3KX:access_denied:boundary
// Verifies: SW-REQ-260821-6951:access_denied:nominal
// Verifies: SW-REQ-260821-6951:access_denied:negative
// Verifies: SW-REQ-260821-6951:access_denied:boundary
test('origin-clean partition separates plain sheet from tainted read and write access', () => {
  // Member 1 (plain baseline): an origin-clean sheet serves cssRules and both
  // mutation surfaces without any SecurityError.
  const clean = CSSStyleSheet.createInternal([], parseRule, true);
  assert.doesNotThrow(() => clean.cssRules);
  assert.doesNotThrow(() => clean.insertRule('div { color: red; }'));
  assert.doesNotThrow(() => clean.deleteRule(0));

  const tainted = CSSStyleSheet.createInternal([], parseRule, false);

  // Member 2 (tainted-read): reading cssRules on the tainted member is denied.
  throwsSecurityError(() => tainted.cssRules);

  // Member 3 (tainted-write): inserting a rule on the tainted member is denied
  // on its own surface, not only through the cssRules getter.
  throwsSecurityError(() => tainted.insertRule('div { color: red; }'));

  // Member 4 (tainted-delete): deleting a rule on the tainted member is denied
  // as well; guarding one accessor must not silently unlock another.
  throwsSecurityError(() => tainted.deleteRule(0));
});
