# ReqProof remaining work — cssomnom overlay audit

Campaign artifact (not a product defect tracker). Auditor: overlay-only. No `proof approve`, no `proof workflow`, no `proof waive`, no DEFECT for live unfixed bugs.

Date: 2026-08-21. Tool: `proof` 0.1.0-dev. Catalog 1.9.1. PATH for this run: Node 24 (`/tmp/node-v24.11.1-linux-x64/bin`) + probe (`/home/dev/.proof/tools/probe/0.6.0-rc330`) + `/tools/bin`. Coordinator: `PROOF_ACTOR=agent:grok-4.6`.

**Do not treat `onboard_v1` 15/15 as a 0/0 full audit.** `process_checklist` reports `onboard_v1 complete (12 confirmed, 0 skipped, 3 not-applicable)`. That is campaign-spine completion. The prior full `--fail-level warn` audit was **1 error / 23 warnings**. Coordinator did **not** re-run the full corpus. Targeted 12-check re-audit after first autolink is **0 errors / 2 warnings** (exit 2). Still red in that set: `cross_component_clean`, `interface_coverage`. **Second autolink pass** (after theater rewrite): 1 link added; 8-check re-audit is **0 errors / 1 warning** (`autolink_clean`). Full audit is still **not** 0/0.

---

## Totals

| Run | Command | Result |
|-----|---------|--------|
| Full audit (prior, pre-autolink of overlay tests) | `proof audit --fail-level warn` | **Errors: 1, Warnings: 23** (JSON: 158 pass / 14 skip / 23 warn / 1 error; 196 check_done). Table and JSON agree. `tests_pass` **pass** on this PATH (`pnpm test:node`, 7607 ms). **Not re-run** by coordinator. |
| Coordinator autolink | `proof trace autolink` (`PROOF_ACTOR=agent:grok-4.6`, no `--changed-by`) | 252 files scanned, 366 annotations, **601 links added** (0 skipped). `by_relation`: **implemented_by 403 / verified_by 95 / documented_by 103**. FlipFixture error: `tests/fixtures/selectors.json` (DX-024, unmarshal array). **`reqproof SYS-REQ-1274`: 0** (not treated as a cssomnom req). Dual-export triples attached: `tests/dual-export-nominal.test.ts` `verified_by` on SW-REQ-260821-1E5K and SYS-REQ-260821-V7V0. INT triples attached: all 10 INT-REQs `verified_by` `tests/integration-int-req.test.ts`. |
| Coordinator targeted re-audit | `--fail-level warn` on the 12 checks listed below | **Errors: 0, Warnings: 2** (exit 2). Pass 10 / warn 2 / fail 0. Still red: `cross_component_clean` (4 uncovered components), `interface_coverage` (6 gaps). |
| Second coordinator autolink (after theater rewrite) | `proof trace autolink` (`PROOF_ACTOR=agent:grok-4.6`, no `--changed-by`) | 252 files scanned, 364 annotations, **1 link added** (757 skipped). `by_relation`: **verified_by 1**. New link: SYS-REQ-260821-RAAM `verified_by` `tests/dual-export-nominal.test.ts:17`. FlipFixture error: `tests/fixtures/selectors.json` (DX-024). Autolink error: `reqproof SYS-REQ-1274` cited in this file without the `reqproof` prefix (not a local req). Dual-export + INT overlay tests already linked; RAAM was the remaining triple after theater rewrite. |
| Second targeted re-audit | `--fail-level warn` on 8 checks (obligation_evidence_complete, integration_evidence_witnessed, coverage_met, annotation_validity, known_issue_template_transfer, poc_quality_checked, autolink_clean, spec_lint_fretish_bare_response) | **Errors: 0, Warnings: 1** (exit 2). Pass 7 / warn 1 / fail 0. Still red in this set: `autolink_clean` (1). `interface_coverage` / `cross_component_clean` were **not** in this 8-check; leftover from first 12-check. |
| Pipeline router exit | `--check documentation_coverage --check changed_requirements_reviewed --check mcdc_coverage --check obligation_evidence_complete --check problem_reports_reviewed --check approvals_current --check suspect_clean --check authored_delta_expected --fail-level warn` | Prior **Errors: 0, Warnings: 4**. `obligation_evidence_complete` now **pass** on targeted re-audit; the other three pipeline warns (`mcdc_coverage`, `suspect_clean`, `authored_delta_expected`) were **not re-run**. Projected remaining: 3w if those hold. |
| Coverage role exit | `--check mcdc_coverage --check code_mcdc_coverage --check obligation_evidence_complete --check code_signal_obligations_reviewed --check mcdc_ignore_classified --fail-level warn` | Prior **Errors: 0, Warnings: 3**. `obligation_evidence_complete` now **pass**. `mcdc_coverage` and `code_signal_obligations_reviewed` **not re-run**. `code_mcdc_coverage` skip (no enabled targets). |
| Debt-review exit | `--check obligation_evidence_complete --check acceptance_criteria_witnessed --check known_issues_reviewed --check accepted_risks_reviewed --check waivers_reviewed --check assumptions_status --check residual_kill_hygiene --check known_issue_template_transfer --check unresearched_p0_vectors --check vector_campaign_hygiene --fail-level warn` | Prior **Errors: 0, Warnings: 2**. Targeted re-audit: `obligation_evidence_complete` **pass**, `known_issue_template_transfer` **pass**. Debt bundle not re-run as a whole. |
| INT witness | `--check integration_evidence_witnessed --fail-level warn` | **Pass** (was warn). 10/10 INT-REQs witnessed via direct integration test. |

`documentation_coverage` is 66/66 (pass). `changed_requirements_reviewed` pass (66 beyond draft). `approvals_current` pass because **approval policy is disabled** (`project.approval.agent_autonomous_for.all: true`) — that is not a human approval of 66 reqs. `problem_reports_reviewed` pass on an empty corpus.

Acceptance is already witnessed: 15/15 direct `:acceptance` tests. Debt empty-corpus passes (`waivers`, `assumptions`, `residuals`, `vectors`) are honest no-ops, not closed hunts.

### Coordinator targeted 12-check scoreboard (post-autolink)

Command: `proof audit --fail-level warn` with only these `--check` IDs. One command. Exit 2.

| Check | Status | New numbers |
|-------|--------|-------------|
| `obligation_evidence_complete` | **pass** | 73 evidence requirement(s) on 56 parent(s) covered. Does **not** name 1E5K/V7V0. Autolink attached `verified_by` + `:nominal:nominal` from `tests/dual-export-nominal.test.ts`. |
| `obligation_enforcement_backed` | **pass** | all 56 cataloged obligation checklist item(s) have signal-rule or evidence backing. |
| `integration_evidence_witnessed` | **pass** | 10 active INT-REQs witnessed (10 via direct integration test). Autolink attached `verified_by` from `tests/integration-int-req.test.ts`. |
| `coverage_met` | **pass** | **100% (66/66)** (was 86.4% 57/66). |
| `spec_lint_ac_subset_of_satisfies` | **pass** | no issues found. |
| `spec_lint_fretish_bare_response` | **pass** | no issues found (V7V0/RAAM `when` landed). |
| `known_issue_template_transfer` | **pass** | 1 open KI meets template-transfer hygiene. |
| `poc_quality_checked` | **pass** | 1 in-scope KI carries a clean 11-rule PoC quality review. |
| `autolink_clean` | **pass** | 0 autolink errors. `reqproof SYS-REQ-1274` not a local req. FlipFixture scan error on `tests/fixtures/selectors.json` did **not** fail this check. |
| `annotation_validity` | **pass** | all referenced IDs and obligation annotations match current spec files. |
| `cross_component_clean` | **warn** | **4 uncovered components** (was 10 INT-REQs missing `traces.components`). HJVC: selectors, media, parser_api; ZP03: cssom. |
| `interface_coverage` | **warn** | **6 gaps** (2 components without interfaces, 4 interfaces without reqs, 0 broken refs). Was 38 gaps (12 without `interface{}`, 26 broken refs). |

Optional Node 24 tests: `node --test --test-reporter=dot tests/dual-export-nominal.test.ts tests/integration-int-req.test.ts` — **pass** (11 tests, exit 0).

### Second autolink pass + 8-check scoreboard (post theater rewrite)

Command: `proof audit --fail-level warn` with only these eight `--check` IDs. One command. Exit 2.

| Check | Status | This pass |
|-------|--------|-----------|
| `obligation_evidence_complete` | **pass** | 73 evidence requirement(s) on 56 parent(s) covered. |
| `integration_evidence_witnessed` | **pass** | 10/10 INT-REQs witnessed via direct integration test. |
| `coverage_met` | **pass** | 100% (66/66). |
| `annotation_validity` | **pass** | all referenced IDs and obligation annotations match current spec files. |
| `known_issue_template_transfer` | **pass** | 1 open KI meets template-transfer hygiene. |
| `poc_quality_checked` | **pass** | 1 in-scope KI carries a clean 11-rule PoC quality review. |
| `spec_lint_fretish_bare_response` | **pass** | no issues found. |
| `autolink_clean` | **warn** | 1 autolink error: this file cites `reqproof SYS-REQ-1274` without the `reqproof` prefix (not a cssomnom req). FlipFixture `tests/fixtures/selectors.json` is still a scan error (DX-024). |

Node 24 (this pass): `/tmp/node-v24.11.1-linux-x64/bin/node --test --test-reporter=dot tests/dual-export-nominal.test.ts tests/integration-int-req.test.ts` — **pass** (11 tests, exit 0).

This 8-check did **not** re-measure `interface_coverage`, `cross_component_clean`, `mcdc_coverage`, `suspect_clean`, `verify_passes`, or `authored_delta_expected`. Those leftovers remain open from the prior full / 12-check.

---

## Debt objects

### Known issues (`proof/known-issues/`)

| ID | Status | Severity | Reqs | Title |
|----|--------|----------|------|-------|
| KI-1 | **fixed** | medium (correctness) | SW-REQ-260821-HNRG, SYS-REQ-260821-8TGB | `setProperty('all')` deleted existing `all` before `expandAll`; failed expand dropped prior `all` |

Reproducer: `proof/reproducers/KI-1-setproperty-all.ts` now **SAT TRUE** (invalid `all` is a no-op; stored `all: var(--x)` remains). Class-closure `DEFECT-260822-NQVB`. Do **not** treat this as a live hole. Do **not** use `//mcdc:ignore:capability-gap … [ki: KI-1]`.

Gaps on KI-1 overlay hygiene (pre-fix): filled `isomorphic_sites` and an 11-rule `poc_quality`. Product class-fix landed; KI status `fixed`.

### Problem reports (`proof/problem-reports/`)

Empty. `proof problem-report list` returns no rows. Correct: live unfixed bugs stay as KnownIssues.

---

## Every non-pass check

Class keys: **overlay-closeable** (proof.yaml / annotations / specs YAML / docs), **env-blocked**, **needs-product-fix**, **needs-human-approval**, **proof-tool-limitation**.

### Error (1) — not in this 12-check set; **not re-run**

| Check | Summary | Class | Notes |
|-------|---------|-------|-------|
| `verify_passes` | realize: 28 components failed; gaps: 63 unconstrained outputs | overlay-closeable + proof-tool-limitation | `proof verify` realizability/gaps, not `tests_pass`. `solver_modeling_opportunity` already pass (bool-only gate). Adding fake Z3 domains to silence realize is greenwash. Honest path: domain tables / `verification.not_modeled` on the actual algorithm, or leave realize red until models exist. |

### Warnings still red after coordinator targeted re-audit (2 of the 12)

These two still **warn**. Do not claim INT YAML work closed them.

| Check | Summary | Class | Close path |
|-------|---------|-------|------------|
| `cross_component_clean` | **4 uncovered components** (was 10 INT-REQs missing `traces.components`) | overlay-closeable | INT YAMLs now have `traces.components`, but HJVC lists selectors/media/parser_api without child INTs covering them; ZP03 lists cssom without a child. Drop extras from `traces.components` or add child reqs (`proof req new <spec> --component … --parent …`). |
| `interface_coverage` | **6 gaps** (2 components without interfaces, 4 interfaces without reqs, 0 broken refs). Was 38 (12 + 26 broken). | overlay-closeable + proof-tool-limitation | Remaining: component `serializer` and `library` have reqs but no INT `interface:`; pairs cascade→selectors, cascade→media, cascade→parser_api, parser_api→cssom have no covering INT. HJVC/ZP03 `interface.caller/callee` are cascade→cssom and parser_api→property_registry, which does not cover those extra pairs. |

### Closed on targeted re-audit (were in the prior 23)

| Check | Now | Notes |
|-------|-----|-------|
| `spec_lint_ac_subset_of_satisfies` | **pass** | SBJ7 `traces.satisfies` includes DKBQ. |
| `spec_lint_fretish_bare_response` | **pass** | V7V0/RAAM have `when` triggers. |
| `obligation_enforcement_backed` | **pass** | 56/56 backed. 1E5K/V7V0 `:nominal:nominal` on `tests/dual-export-nominal.test.ts`. |
| `autolink_clean` | **pass** | 0 autolink errors. `reqproof SYS-REQ-1274` not a local ID. FlipFixture on `tests/fixtures/selectors.json` is still a **scan** error (DX-024) but this check is 0. |
| `coverage_met` | **pass** | 66/66. |
| `obligation_evidence_complete` | **pass** | 73/56. Does not name 1E5K/V7V0. |
| `integration_evidence_witnessed` | **pass** | 10/10 direct integration tests. |
| `known_issue_template_transfer` | **pass** | KI-1 `isomorphic_sites` filled. |
| `poc_quality_checked` | **pass** | KI-1 11-rule `poc_quality` with honest N/A. |
| `annotation_validity` | **pass** | (was already pass on prior full audit; reconfirmed). |

### Warnings not in the 12-check set (still open from prior full audit; **not re-run**)

#### Specification (remainder)

| Check | Summary | Class | Close path |
|-------|---------|-------|------------|
| `verification_scope_complete` | Prior: `tests/` (170), `dist/` (80), `scripts/` (48) omitted from `completeness.production_include` | overlay-closeable | Overlay landed `completeness.rationale` in `proof.yaml` (production is `src/**`; tests/docs are verification-scope include for autolink; dist/scripts not production). **Not in this 12-check re-audit.** Do not add `tests/` to production_include. |
| `spec_lint_status_vs_review` | 66 `verification.review.status` pending vs `status: review` | overlay-closeable + needs-human-approval | Mass-stamping `verification.review` to match lifecycle is theater. Real spec-conformance reviews exist for SW (REVIEW-1..31); the lint wants the **req YAML** review field, not ReviewRecords. |
| `code_predicates_modeled` | 281 unmodeled predicates / 37 FRETish reqs | overlay-closeable + proof-tool-limitation | File-level `Implements:` on tokenizer/parser makes Probe inherit `cp <= 0xDFFF` onto INT-REQs. Prefer `verification.not_modeled` for Unicode/hex helpers, not 281 new FRETish vars. |
| `nonbool_inputs_constrained` | 429 of **0** non-bool vars across 11 components | overlay-closeable + proof-tool-limitation | Same inheritance: numeric compares in code, zero ranged vars declared. |

#### Implementation (remainder; not re-run except `autolink_clean`)

| Check | Summary | Class | Close path |
|-------|---------|-------|------------|
| `authored_delta_expected` | 43 traced production files lack current no-authored-change review | overlay-closeable + needs-human-approval | Pipeline exit check. Shared files (`src/CSSOM.ts` 13 reqs, `CSSStyleDeclaration.ts` 8) need explicit impact reviews. Do not rubber-stamp. **Not re-run.** |
| `property_based_test_coverage` | 65 functions pending; 1 malformed target `src/typed-om.ts:{` | overlay-closeable + proof-tool-limitation | Suggested tests are Go `func Test…`. Malformed `{` is `export type { CSSUnit }` parsed as a symbol (DX). Optional: annotate a few property tests; do not invent 65 Go tests. **Not re-run.** |

#### Verification (remainder; closed items removed)

| Check | Summary | Class | Close path |
|-------|---------|-------|------------|
| `suspect_clean` | 560 suspect links (prior full audit; autolink added 601 more links this run so the count may have grown) | overlay-closeable + needs-human-approval | First autolink on a new corpus. `proof trace suspect` then `proof trace review --suspect` only for stale owners. Rubber-stamp is greenwash. **Not re-run.** |
| `decomposition_reviewed` | 4 incomplete parents (20/24) | overlay-closeable | Children do not constrain parent vars (`invalid_rule_consumed`, `ordinary_invalid_css`, `rule_dropped`, `stylesheet_returned`, `set_property_ignored`, +1 truncated). Align child FRETish or record a gaps review with a real reason. **Not re-run.** |
| `code_signal_obligations_reviewed` | TS in scope (131 files), no scanner/pack | proof-tool-limitation | Coverage-role exit. 0 signals ≠ 0 risk. Do not disable the check to pass. Needs a TS signal pack (ReqProof DX) or an explicit project pack. **Not re-run.** |
| `code_signal_unbindable` | same TS scanner gap | proof-tool-limitation | Same as above. **Not re-run.** |
| `mcdc_coverage` | 61 reqs, **211/211 rows uncovered** (prior: 9 no verifying tests, 52 missing row witnesses). Coverage_met 9 should shrink now that 1E5K/V7V0 + 7 INTs have Verifies; **not re-measured**. | overlay-closeable | Queue: `proof mcdc spec queue`. 52 have Verifies but **zero** `// MCDC REQ: … => TRUE\|FALSE` lines in this dump. HNRG row 2 is **not** a live KI-1 hole (KI-1 fixed; SAT TRUE `declaration_unchanged=T, value_validation_fails=T => TRUE`). Do not recommend `capability-gap [ki: KI-1]`. |
| `consistency_pair_coverage` | 18/18 components, 0 checkable pairs, 0 attestations | overlay-closeable | Share outputs, mutex, or `independence: {declared: true, reason: "…"}` on vars YAML. Skip reason is `cross-component` on every pair. **Not re-run.** |

### Skips that are not a pass (not in the 23)

| Check | Summary | Class |
|-------|---------|-------|
| `code_mcdc_measure` / `code_mcdc_coverage` | no enabled targets; `project.checks.code_mcdc.languages` is `{go:{}}` | proof-tool-limitation (DX-036). Coverage-role skip. **Not** 100% statement MC/DC. |
| `slow_tests_clean` | enabled but no test-results artifact | overlay-closeable (wire artifact) or leave |
| `lemma_branch_coverage` | no lemma coverage data | overlay-closeable / N/A for TS (DX-020: no `// reqproof:lemma`) |
| `documented_claim_verified` | no `documented_behaviors` | opt-in skip |
| `build_matrix_complete` / `dual_path_guards_equivalent` | not declared | opt-in skip |
| Four DeFi-ish spec lints | disabled by project.checks policy | leave disabled |

### Vacuous / advisory passes (do not celebrate)

- `approvals_current`: policy disabled.
- `surface_coverage`: 0 surfaces extracted (DX-027). Empty OK, not a security matrix.
- `spec_lint_hazard_consequence` / `hazard_review_current`: 66 **advisory notices**, status pass.
- `obligation_witness_grounded`: 74 static-grounded / 10 JS coverage-unavailable / 15 N/A. Real, not DX-034 zero-grounded.
- `tests_pass`: pass **on this PATH**. Default sandbox PATH still hits DX-035 (`pnpm`/`node` missing → 1 ms fail). Class if it recurs: **env-blocked**.
- `mcdc_verifies_witnesses`: enforcement **disabled**.
- `orphan_code_clean` 1146/1146 and `documentation_coverage` 66/66 are real for traces/docs, not MC/DC or INT witnesses.

---

## Role-exit scoreboard (not 0/0)

Role-exit *bundles* were not re-run as a set. Below: prior numbers plus what the 12-check re-audit actually proved.

### Pipeline (prior 0e / 4w)

Pass (prior): `documentation_coverage` 66/66, `changed_requirements_reviewed`, `problem_reports_reviewed` (empty), `approvals_current` (policy off).

Now also pass (targeted): `obligation_evidence_complete`.

Still open (not re-run): `mcdc_coverage`, `suspect_clean` (560 prior; autolink added 601 links), `authored_delta_expected` (43 files).

### Coverage (prior 0e / 3w + 1 skip)

Now also pass (targeted): `obligation_evidence_complete` (no longer 1E5K/V7V0).

Still open (not re-run): `mcdc_coverage` (211/211 prior), `code_signal_obligations_reviewed` (no TS pack).

Skip: `code_mcdc_coverage` — languages.go only. Pass: `mcdc_ignore_classified` (zero ignores; not a coverage win).

### Debt-review (prior 0e / 2w)

Targeted: `obligation_evidence_complete` **pass**, `known_issue_template_transfer` **pass**. Bundle not re-run. Empty residuals/vectors remain honest no-ops.

Pass (many empty, prior): AC 15/15, KI-1 visible, no waivers/assumptions/residuals/vectors.

### INT (prior 0e / 1w → targeted **pass**)

`integration_evidence_witnessed` **pass**: 10/10 via `tests/integration-int-req.test.ts`. Still red on INT *spec* hygiene: `cross_component_clean` 4, `interface_coverage` 6. Those are not the INT role-exit check.

---

## Ranked next work (overlay agents)

Highest leverage first. Stay out of `src/**` product behavior. KI-1 is **fixed** — do not resurrect `capability-gap [ki: KI-1]`. Do not `proof approve` / `proof workflow` / `proof waive`.

1. **Dual-export evidence — DONE.** Overlay test `tests/dual-export-nominal.test.ts` (`// Verifies:` + `// SW-REQ-260821-1E5K:nominal:nominal` / `// SYS-REQ-260821-V7V0:nominal:nominal`). Coordinator autolink attached `verified_by` for both. Targeted: `obligation_evidence_complete` **pass** (73/56, does not name 1E5K/V7V0), `obligation_enforcement_backed` **pass** (56/56). Node 24 tests pass.

2. **INT layer — PARTIAL / still-open on spec hygiene.** (c) boundary tests **done**: `tests/integration-int-req.test.ts` has `:integration:integration` for all 10; `integration_evidence_witnessed` **pass** (10/10). (a)(b) YAML was authored but checks still **warn**: `cross_component_clean` **4 uncovered components** (HJVC: selectors, media, parser_api; ZP03: cssom); `interface_coverage` **6 gaps** (serializer + library without interfaces; cascade→selectors, cascade→media, cascade→parser_api, parser_api→cssom without covering reqs). Narrow `traces.components` to the actual caller/callee or add child INTs; do not claim 0/0 INT hygiene.

3. **Verifies on the 7 INTs — DONE.** Autolink `verified_by` from `tests/integration-int-req.test.ts` for 9SGA, HJVC, JTY2, N2VE, WQX9, WTPD, ZMZR (and the other 3). `coverage_met` **pass 66/66** (was 86.4% 57/66).

4. **MC/DC row witnesses on the 52 reqs that already have Verifies** — Start with SW that already have triples (`HNRG`, `TF5T`, `HHVE`, …). Copy exact assignments from `proof mcdc show <ID>`. HNRG SAT TRUE (`declaration_unchanged=T, value_validation_fails=T => TRUE`) is already witnessed; KI-1 is **fixed**. Do **not** use `//mcdc:ignore:capability-gap … [ki: KI-1]` as a live hole. Unreachable `declaration_unchanged=F` FALSE rows are `//mcdc:ignore:defensive`. Overlay-closeable. **Not re-run**.

5. **STK DKBQ AC-001 vs SBJ7 satisfies — DONE.** Overlay: SBJ7 `traces.satisfies` includes DKBQ. Targeted: `spec_lint_ac_subset_of_satisfies` **pass**.

6. **`verification_scope.completeness.rationale` — overlay landed; not in this 12-check set.** `proof.yaml` rationale states production is `src/**` (lint.exclude `src/data/gen/**`); tests/docs are verification-scope include for autolink; `dist/` build output; `scripts/` tooling. `verification_scope_complete` was **not** re-audited. Do not add `tests/` to `production_include`.

7. **Autolink noise — first pass treated `reqproof SYS-REQ-1274` as non-local; second pass reopened `autolink_clean`.** First coordinator autolink: count 0 when DX log used the `reqproof` prefix. Second autolink (this file existed): `autolink_clean` **warn** because this remaining-work doc cites the ID without the prefix. FlipFixture parse of `tests/fixtures/selectors.json` (DX-024) is still scan noise. Overlay-closeable: prefix remaining-work citations as `reqproof SYS-REQ-1274`. Not fixed in this pass (note-only).

8. **KI-1 hygiene (debt exit) — DONE.** Overlay filled `isomorphic_sites` and `poc_quality`. Product class-fix landed; KI-1 `status: fixed`. SAT TRUE overlay tripwire. Do not treat as a live hole.

9. **Decomposition var alignment** — Either add parent vars to child FRETish or record a real `proof gaps review` reason for 03VA / 7521 / 8TGB / the truncated fourth. Overlay-closeable.

10. **Consistency independence attestations** — 18 components, all pairs skipped as cross-component. Add `independence` reasons on vars YAML where guarantees truly do not share outputs. Overlay-closeable. Do not invent mutex groups.

11. **Suspect + authored-delta reviews** — 560 + 43. Batch by file owners; cite actual impact. **needs-human-approval** quality. Do not auto-confirm 560.

12. **`spec_lint_status_vs_review`** — Map existing REVIEW-* onto `verification.review` only where the ReviewRecord is real. Leave pending where unreviewed. **needs-human-approval**. Do not bulk-set 66 to reviewed.

13. **Code MC/DC / signal packs** — Out of honest overlay reach until ReqProof ships a TS `code_mcdc.languages` engine and a TS signal pack (DX-036, DX-016). Class: **proof-tool-limitation**. Log on `docs/proof-dx-issues.md` if not already. Do not set `languages.go` tricks or disable `code_signal_*`.

14. **`verify_passes` realize/gaps** — After (10) and honest `not_modeled` on inherited tokenizer predicates. If realize stays red on bool-only CSS FRETish, that is a **proof-tool-limitation**, not a cssomnom product bug.

15. **Product fix for KI-1 — DONE.** `src/CSSStyleDeclaration.ts` delete stored `all` only after `expandAll` succeeds. Overlay SAT TRUE. Class-closure `DEFECT-260822-NQVB`. Do not reopen as `capability-gap [ki: KI-1]`.

### Explicit non-work

- Do not resurrect KI-1 as a live `capability-gap [ki: KI-1]` hole (it is fixed).
- Do not treat `onboard_v1` confirmed as full-audit green.
- Do not `proof approve` 66 reqs because `agent_autonomous_for.all` is true.
- Do not enable `code_mcdc` Go targets on a TypeScript repo.
- Do not add `tests/` or `dist/` to `production_include`.
- Do not claim 100% MC/DC: requirement-level rows are 0/211; code-level is unconfigured.

---

## Environment note

This audit ran with Node v24.11.1 and pnpm 11.10.0 on PATH. `tests_pass` was green. A later agent without `/tmp/node-v24.11.1-linux-x64/bin` will see `tests_pass` fail in ~1 ms (DX-035, **env-blocked**). Probe must stay at `/home/dev/.proof/tools/probe/0.6.0-rc330` or lint/autolink regresses (DX-021, fixed-upstream fail-closed).
