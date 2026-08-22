# Next-agent playbook (credit-aware)

Read this before spawning Champs. Scan source (completed 2026-08-21, target SHA `264c2ea` / origin/main-era):  
`/home/dev/.codex/state/plugins/codex-security/scans/workspace/codex-security-workspace-TCbtjG/`  
(`findings.json`, per-finding `findings/<slug>/`, PoCs under `findings/<slug>/poc/`).

Proof recapture binary: `/tmp/proof-dx/proof` (DX-042 JS `//mcdc:ignore` honor, clone `/tmp/probe-labs/reqproof` `6d41cc0`).  
PATH: `/tmp/node-v24.11.1-linux-x64/bin` then `/opt/node24/bin`. Node 24 `node --test`, never `npx tsx`.

Git: path-scoped `git add -- <files>` only. Never `reset` / `restore` / `checkout --` / `revert` / `clean` / `git add .`.  
Orchestrator does not write `src/` or spec YAML. Champ implements. LOOP Reviewer+Grizz after every product/overlay commit.  
No `proof waive`. No `proof workflow`. No mass `proof approve` of the 82-req set. Floors stay 100/100/100.  
**We do not require product-fixing issues.** Live holes stay open KIs with failing public e2e. `status: fixed` is historical, not a mandate.

---

## Why this file exists (last action)

Credits are exhausted. The highest-leverage close is **not** another 2-minute remasure. It is a playbook so the next agent does not:

1. Re-discover 16 Codex security findings already PoC’d.
2. File them as `:defensive` or skip them because `security_surface_covered` is disabled.
3. Repeat LOOP-rejected greenwash (lying unique-cause, nested-if splits, parent-copy FRETish).
4. Treat KI-1..14 `fixed` as “we required class-fixes.”

---

## Gate snapshot (do not trust PLAN.md header blindly — recapture)

Last **full** `proof audit --fail-level warn` at HEAD `cf47be2` (2026-08-22T11:08Z):

| Plane | Result |
|---|---|
| Full audit | **Errors: 1, Warnings: 16** |
| Code MC/DC | **93.5% D / 94.9% C** (3398/3633 D, 4846/5109 C; **Ignored 53**; incomplete **235**) |
| Spec MC/DC | 322 rows, **8 uncovered / 5 stale** at that recapture |
| Catalog | **82** reqs (was 66) |

Later commits **not** in that recapture:

- `d1b0c3d` — 7R6Z refines YQQZ (`consume_token_loop_runs`, hex-6 stays on parent); 30ZA idle comments `consume=F`. Isolated mcdc still **red honestly** (7 uncovered / 7 stale — auditor SAT empty worlds).
- `a815df8` — REVIEW-39 dropped leftover `6` numeral. Isolated `spec_lint_spec_conformance_review_grounded` **0e/0w**. **First recapture after this should drop the 1 error.**

Dirty / uncommitted that must not be lost:

- `tests/mcdc-font-feature-values-comment-public-unique-cause.test.ts` — LOOP Reviewer reject of `cf47be2`: public parse never emits comment tokens (`consumeComments`). File on disk already retargets unique-cause to whitespace T vs compact F; **comment T is MUTE**. Champ died (402) before commit. Next agent: run the file twice, path-scoped commit if green.

KI-7 **open**, `ship_with_known_issue`, extra e2e `proof/reproducers/KI-7-import-url-token.ts` + `KI-7-import-stylesheet-null.ts` both **exit 1**. No fetch.

---

## Codex security scan vs KI library

**None of the 16 scan findings are in `proof/known-issues/`.** KI-1..14 are CSSOM/Typed OM **correctness** holes (setProperty `all`, replace timing, position parse, media not-all, parser-api type 0, import href, streaming peek, :disabled, at-rule case, keyframe adapter). KI-7 is documented offline `@import`. They do not overlap CWE-400/22/94/918/78.

That is **not** because the findings are fake. It is because this overlay never ran a security KI campaign:

1. `proof.yaml` **disables** `security_surface_covered` with a comment that a 2026-08-21 hunt only found `scripts/wpt/node/run.ts` egress, not CSS `url()` in `src/**`. The scan shows that hunt was **narrow**: it did not file library DoS or path-join as KIs.
2. `denial_of_service_resistant` is already on SYS-7521 / SYS-SBJ7 / SW-7M07 / SW-HHVE / SW-QV2H, backed by css-fuzz crash-freedom. **Crash-freedom ≠ resource budget.** Deep nesting, cartesian `toSum`, exponential `var()`, unbounded `:has()` **do not throw** until the stack/heap dies. Fuzz “no panics” is the wrong obligation cell.
3. Tooling (`scripts/wpt/**`, extractors, fetch-wptfyi) is **out of** `production_include` (`src/**` only). Overlay treated it as “not the library,” so path/SSRF/eval never got a KI. User-facing hole for **CI/maintainers** is still a capability-gap if operators run those scripts.
4. Could we have found these **without** the scan?  
   - **Library DoS (parser/math/var/toSum/:has):** yes, if FRETish named a bound (`nesting_depth <= N`, `expansion_bytes <= N`) and a **failing** tripwire asserted “parse of depth N+1 rejects/throws instead of RangeError.” Spec was **not good enough**: DoS obligation existed, **no numeric domain, no failing e2e**. Missing obligation shape, not missing class.  
   - **Hash serialize without `serializeIdentifier`:** yes, from cssom-1 serialize algorithms + WPT serialize fixtures. Spec/table gap: serialize vars are bool, no “identifier escaped” output.  
   - **WPT path/fetch/eval/gunzip/shell:** **no**, not from CSS FRETish. These are tooling trust-boundary bugs. Finding them required reading `scripts/` as a product, enabling `security_surface_covered`, or this scan. Overlay explicitly scoped them out.

**Disposition rule (user):** KI + **failing public e2e** (more than overlay yaml). Do not implement class-fix just to green. Copy/adapt scan PoCs into `proof/reproducers/KI-NN-*.ts` so they **fail twice** on HEAD. If the hole is tooling-only, still a KI (`affected_api` = the CLI), not `:defensive`.

### The 16 findings (file as KIs unless you prove the PoC does not hold on HEAD)

Scan target was `264c2ea`. **Re-run each PoC on current HEAD** before filing. If a class-fix landed after the scan, yaml `status: fixed` + passing SAT; if still live, `open` + failing tripwire.

| # | Sev | Title | Code | Scan PoC | Overlay question |
|---|---|---|---|---|---|
| 1 | **high** | WPT runner `script src` path join then `vm.Script` | `scripts/wpt/node/run.ts` | `findings/wpt-getscriptcontent-no-containment/poc/` | Spec never modeled WPT_ROOT containment. Obligation: path_contained / no_eval_untrusted. |
| 2 | med | `:has()`/combinator no match budget | `src/matcher.ts` | `has-combinator-no-match-budget/poc/` | DoS obligation on selectors exists? If not, **missing obligation**. FRETish needs `match_steps <= N`. |
| 3 | med | Acyclic `var()`/`env()` exponential expand | `src/cascade/variable-resolver.ts` | `var-env-exponential-expansion/poc/` | Cycle check ≠ size budget. SW-QV2H fuzz is the wrong cell. |
| 4 | med | Parser nested rules no depth budget | `src/parser.ts` | `parser-unbounded-nesting-recursion/poc/` | SYS-7521 DoS is crash-freedom. Add `nesting_depth` range + tripwire RangeError vs bounded reject. |
| 5 | med | `to`/`toSum` cartesian no term cap | `src/typed-om/numeric/numeric-methods.ts` | `numeric-tosum-cartesian-expansion/poc/` | Typed OM reqs have no MAX_TERMS. Spec gap. |
| 6 | med | Fixture extractors `eval`/`vm` submodule JS | `scripts/external_suites/extract_*.ts` | `fixture-extractors-eval-vm-submodule-js/poc/` | Tooling. Integrity-gate or stop eval. |
| 7 | med | Hash serialize skips `serializeIdentifier` | `src/serializer.ts` | `serializer-hash-omits-identifier-escape/poc/` | cssom-1 serialize. Should have been a serialize FRETish output. **Spec not good enough.** |
| 8 | med | Math parse/simplify no depth budget | `src/math-parser.ts` | `math-parser-unbounded-recursion/poc/` | Same as (4) for calc trees. |
| 9 | med | `--browser` interpolates into paths | `scripts/wpt/browser/run.ts` | `wpt-browser-flag-path-escape/poc/` | Tooling path allowlist. |
| 10 | med | `/interfaces/` fetch no root contain | `scripts/wpt/node/run.ts` | `wpt-interfaces-join-no-containment/poc/` | Same family as (1). |
| 11 | med | `sandbox.fetch` falls through to host fetch | `scripts/wpt/node/run.ts` | `wpt-sandbox-fetch-host-fallthrough/poc/` | SSRF. `security_surface_covered` would have named this. |
| 12 | med | `--cache-path` unconstrained write | `scripts/wpt/browser/fetch-wptfyi.ts` | `wptfyi-cachepath-resolve-write/poc/` | Tooling. |
| 13 | med | `results_url` download no host allowlist | same | `wptfyi-downloadurl-no-allowlist/poc/` | SSRF. |
| 14 | med | `getGitNotesLog` shell interpolates count/ref | `scripts/wpt/node/safe-child-process.ts` | `getgitnoteslog-execsync-interpolation/poc/` | Ironic: safe-exec helper has a shell sink. Signal/eslint not enough. |
| 15 | med | `gunzipSync` no maxOutputLength | `fetch-wptfyi.ts` | `wptfyi-gunzipsync-no-output-cap/poc/` | DoS on CI. |
| 16 | **low** | `check-safe-exec` only literal imports | `scripts/ci/check-safe-exec.ts` | `check-safe-exec-literal-import-only/poc/` | Control gap, not a sink. Raise the check, don’t pretend it is RCE. |

Hardening notes (not implemented): `hardening/hardening.md` + `proposals/`. Do **not** implement those as product class-fixes unless the user asks. File KIs + failing PoC first.

Suggested KI IDs: KI-15..KI-30 (or `KI-SEC-01..`). Each yaml: `reproducer_command` = Node 24 `node --experimental-strip-types proof/reproducers/KI-….ts`, evidence via `proof evidence capture`, `// MCDC … => FALSE [known-issue] [ki:]` on the tripwire, capability-gap on the passing witness. Run PoC **twice**, exit 1.

---

## Historical class-fixed bugs → DEFECT + “would proof have caught it?”

DEFECT yaml already exists for several KI class-fixes (`proof/problem-reports/`, Crockford ids). That is **not** the user request. The request is: every **shipped bugfix in git history** gets a DEFECT **only after** the class is closed, plus evidence that the **class** cannot recur.

Playbook (Champ batches, path-scoped commits):

```
git log origin/main --oneline -- src/ tests/ | rg -i 'fix|bug|correct|throw|null'
```

For each fix commit:

1. Write a **failing** public tripwire against `origin/main` / the parent tree **or** document why it cannot be reproduced (then it is not a DEFECT).
2. Confirm HEAD **passes** that tripwire (class-fix already shipped).
3. Ask: **could ReqProof have found this without the commit?**
   - **Yes** if a FRETish row / obligation / signal already named the behavior → attach `verified_by` + `:negative` triple. No new req.
   - **No because spec bool-only / no bound / no serialize-escape output** → add the missing var/range/mutex/table **and** the tripwire. That is the point of the history swipe.
   - **No because dead code / unexported** → KI capability-gap, not `:defensive`.
4. `proof problem-report new` **after** class-fix evidence. `covered_by_requirement`. `proof approve --role spec-conformance --motivation-kind defect` **only** those reqs.
5. Code signal if the class is a sink (eval, shell, path.join, unbounded recursion): add a signal rule, do not only write a test.

KI-1..3,5,6,8–14 already have class-fixes in `src/` + DEFECTs. Still ask (3) for each: several were found by MC/DC unique-cause, **not** by FRETish. That means the parent guarantee was too coarse. History swipe is incomplete until those parents gain the child var that would have SAT-failed.

Do **not** implement fetch for KI-7. Do **not** class-fix security findings in the same breath as filing them.

---

## Proof 0/0 leftover (after security/history, or in parallel)

Warning IDs from `cf47be2` full audit (16w + 1e). `a815df8` should kill the error.

Still red (honest):

- `code_mcdc_coverage` 93.5%/94.9%, 235 incomplete, 53 ignores. Next unique-cause through **public APIs only**. Theater BAN: getter-flip, ParseHooks override, Reflect, `keep=N`, `constructor.name`. Do **not** split `_parseAll` `A \|\| (B && C)` into nested ifs (LOOP Grizz reject `a381e92`; restored `0e36b1f`).
- `mcdc_coverage` leftover empty auditor SAT on 7R6Z/30ZA — **leave red** or retune FRETish; do **not** restore lying TRUE comments (`7ff8011` / `c4e3dae` LOOP).
- `gaps_clean` / `verify_passes` 13 unconstrained outputs; `variable_orphans_clean` 13 declared-unused (often table outputs dropped from FRETish).
- `spec_lint_status_vs_review` **46** — real reviews, not mass-stamp. Next checklist step `spec-review-1`.
- `spec_lint_ac_inverse_coverage` 5, `decomposition_adds_refinement` 5, `formalization_quality` 5.
- `property_based_test_coverage` 53 gaps — real PBT or honest `:skip` (≥16 char reason), not mass-skip.
- `ambiguity_reviewed` 20; `consistency_pair_coverage` 2 components; `obligation_decomposition_complete` 8; `process_checklist` (variables rewound); `suspect_clean` 10; `under_modeled_requirements_clean` 29.

Cleared already: `nonbool_inputs_constrained`, `obligation_enforcement_backed`, `obligation_evidence_complete`, `known_issue_complete`, `documentation_coverage` 82/82, `authored_delta_expected` (after `430b490`).

---

## LOOP landmines (do not repeat)

| Hash | Verdict | Lesson |
|---|---|---|
| `7bbb4ae` | REJECT | Citations must match **current .bs section numbers** (`4dcb7c0` ACCEPT: consume-at-rule § 5.5.2, unicode-range § 4.3.14, `#parse-a-cssstylevalue`, css-box-3 `#propdef-margin`). |
| `7ff8011` | REJECT | Do not put `reifies=T` on a throw to green `mcdc_coverage`. |
| `f6fcaaa` then `b387f2f` | reject then ACCEPT | Do not ignore a whole `A && B` if one conjunct is pairable. |
| `a381e92` | Grizz REJECT | Nested-if split to hang ignores = product logic change. |
| `c4e3dae` | Grizz ACCEPT / Reviewer reject | Empty-world FRETish drop OK; child must not copy parent (7R6Z). |
| `cf47be2` | Reviewer reject / Grizz ACCEPT | Comment tokens are not public. |

---

## Immediate next DAG (priority)

1. Commit dirty font-feature unique-cause retarget if tests pass.
2. Recapture full audit (expect **0 errors** after `a815df8`).
3. **Security KI batch:** copy scan PoCs → `proof/reproducers/`, `proof known-issue new`, evidence capture, capability-gap + `[known-issue]`. Library DoS first (user-facing `src/`), then tooling. Do not class-fix.
4. **History-swipe DEFECT campaign** as above.
5. Then remaining 16 warnings / 235 incomplete decisions.

Scratch: `/tmp/grok-goal-47e8a9f6b740/implementer/` (`audit-now.md`, LOOP reviews `review-*.md` / `grizz-*.md`).
