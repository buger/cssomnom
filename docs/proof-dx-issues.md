# ReqProof DX issues — cssomnom case study

This file is the **case-study log** of problems found while covering
[cssomnom](https://github.com/GoogleChromeLabs/cssomnom) with the `proof`
CLI. It is **not** a product defect tracker for cssomnom.

- **Host project**: cssomnom (TypeScript CSSOM parser)
- **Tool**: ReqProof / `proof` CLI (`/tools/bin/proof`)
- **Upstream to file/fix**: [probelabs/reqproof](https://github.com/probelabs/reqproof)
  (user referred to this as “reqforge”; Probe Labs’ repo is `reqproof`)
- **Stance**: owner, `source_native`, assurance C, `onboard_v1` campaign
- **How to use**: append a row when an agent hits friction. Mark
  **Critical** if it blocks the campaign or produces a silent-wrong
  verdict. Critical items may be fixed in a clone of `probelabs/reqproof`.

Severity:

| Level | Meaning |
|-------|---------|
| Critical | Blocks a campaign step, or a check passes/fails for the wrong reason |
| High | Wrong default for this language/repo class; agents will do the wrong thing |
| Medium | Extra work, confusing help, missing CLI for a documented field |
| Low | Polish, naming, docs drift |

Status: `open` | `workaround` | `filed` | `fixed-upstream`

---

## Issue index

| ID | Severity | Status | Summary |
|----|----------|--------|---------|
| DX-001 | High | open | No JS/TS init template; Go test excludes applied to a TypeScript repo |
| DX-002 | High | workaround | `proof config set` cannot clear `project.checks.disabled` |
| DX-003 | Medium | open | Builtin checklist cannot be shown before `proof init` |
| DX-004 | Medium | open | Help search is unusable on a cold tree |
| DX-005 | High | open | Init next-steps push `proof workflow`; onboard role forbids it |
| DX-006 | High | workaround | `documentation_coverage` disabled at init but required by onboard exit |
| DX-007 | Medium | open | Onboard role leads with DeFi callback/balance enumerations |
| DX-008 | Medium | open | Opaque `{prefix}-{date}-{rand}` requirement IDs |
| DX-009 | Medium | open | `--preview` stamps `created_by: human:cli` unless `--changed-by` |
| DX-010 | High | open | `ai_generated: true` on agent-authored reqs vs `spec_lint_auto_modifier_without_human` |
| DX-011 | Low | open | `proof help asd-ste100` renders the req-authoring topic |
| DX-012 | Medium | open | `proof help process_checklist` resolved to the checklist *command* |
| DX-013 | Medium | open | `.gitignore` ignores all of `.proof/` while comments say some objects stay tracked |
| DX-014 | Medium | open | No CLI to set `acceptance_criteria[].derived_reqs` |
| DX-015 | Medium | open | INT-REQ interface metadata is inspect-only (no authoring CLI) |
| DX-016 | High | open | Formal lemma / MC/DC / catalog defaults are Go- and DeFi-shaped |
| DX-017 | Medium | open | Init `validate_passes` is vacuously green on zero requirements |
| DX-018 | Low | open | Dual `proof req add` vs `proof req new` |
| DX-019 | Medium | open | README vs code mismatches are not a first-class onboard prompt |
| DX-020 | High | open | TypeScript cannot attach `// reqproof:lemma`; unclear which verify checks to skip |
| DX-021 | Critical | fixed-upstream (PR 1028 `d629eb3`) | TS lint/autolink ignored managed Probe cache; skip-on-error → 0/0. Auto-download + fail-hard. |
| DX-022 | Medium | workaround | Generated `src/data/gen/**` cannot carry source_native `Implements:`; excluded via `lint.exclude` |
| DX-023 | High | workaround | `proof trace autolink` hard-fails `[E_PROBE_NOT_FOUND]` after finding annotations; no `--changed-by` flag |
| DX-024 | Critical | workaround | Autolink filters the annotation walk by `verification_scope.include`; `src/**` drops tests/docs so `Verifies:`/`Documents:` never link |
| DX-025 | High | open | spec-review role EXIT CHECKS omit onboard spec-review-2 gates (`spec_conformance_review_grounded`, `software_formalization_complete`) |
| DX-026 | Medium | open | spec-review-1 title is “structure and ambiguity” but does not require `ambiguity_reviewed` |
| DX-027 | High | open | `proof surfaces extract --package cssomnom` returns 0 surfaces; `surface_coverage` passes empty |
| DX-028 | Medium | open | `proof review record` does not resolve citations at write time |
| DX-029 | High | open | `proof audit --only REQ` can neutralize a failing corpus check to pass |
| DX-030 | High | open | onboard `surface-matrix` has no required_checks; verify is only `test -d proof` |
| DX-031 | Medium | open | spec_conformance comment cannot contain digits absent from FRETish |
| DX-032 | Medium | open | no CLI for `acceptance_review` stamp |
| DX-033 | High | open | ac-sweep role allows Done without witnesses; onboard required_checks do not |
| DX-034 | High | open | `obligation_witness_grounded` can pass with 0 grounded / 0 exempt |
| DX-035 | High | open | `tests_pass` runs `pnpm test:node` and fails in 1ms if pnpm/node24 missing |
| DX-036 | High | open | `code_mcdc.languages` init default is `{go:{}}` on a TypeScript repo |
| DX-032 | Medium | workaround | No CLI to stamp `acceptance_review` (`proof req edit` has no field) |
| DX-037 | Critical | filed (PR 1029) | KI vs DEFECT unclear: agents file DEFECT for live unfixed bugs and park `covered_by_known_issue` |
| DX-038 | Critical | filed (PR 1030) | `proof help mcdc:ignore` / `capability-gap` / `functionality-gap` miss the row-disposition tree |
| DX-039 | Critical | workaround (clone) | `defaults: auto` never selected `builtin:typescript/default`; language-coverage guard ignored auto packs |
| DX-040 | Critical | workaround (clone) | MC/DC residue hotspot hint pushed a product refactor; agents class-fixed src to green the meter |
| DX-041 | Critical | workaround (clone) | capability-gap could pass with KI YAML and no failing e2e tripwire; `:defensive` used as unique-cause hatch |

---

## DX-001 — No JavaScript/TypeScript init template

- **Severity**: High
- **Status**: open
- **Observed**: `proof init --name cssomnom --verification-scope 'src/**'` printed
  `Detected language: javascript` then wrote
  `verification_scope.completeness.production_exclude: ['**/*_test.go', '**/testdata/**']`.
- **Why it hurts**: cssomnom tests live under `tests/**/*.test.ts`, not `*_test.go`.
  Completeness / orphan / MC/DC scoping is Go-shaped on a TS repo. Agents will
  trust the exclude list.
- **Expected**: language-detected defaults (e.g. `**/*.test.ts`, `**/*.spec.ts`,
  `tests/**`) or an init template `javascript-package` / `typescript-package`.
- **Workaround**: none yet; `src/**` happens to exclude `tests/` by include glob.
- **Repro**:
  ```bash
  proof init --name cssomnom --verification-scope 'src/**'
  grep -n test.go proof.yaml
  ```

## DX-002 — `proof config set` cannot clear `checks.disabled`

- **Severity**: High
- **Status**: workaround
- **Observed**:
  ```
  proof config set project.checks.disabled '[]'
  # specify a full checks path such as checks.coverage_threshold.threshold
  ```
- **Why it hurts**: init disables `documentation_coverage` by listing it under
  `project.checks.disabled`. The documented way to change config is
  `proof config set`, but this array cannot be cleared. Agents must hand-edit
  YAML, which `req-authoring` tells them not to do.
- **Expected**: `proof config set project.checks.disabled '[]'` or
  `proof config unset project.checks.disabled` / a dedicated enable command.
- **Workaround**: delete the `disabled:` block in `proof.yaml`.

## DX-003 — Cannot show builtin checklist before init

- **Severity**: Medium
- **Status**: open
- **Observed**: `proof checklist show onboard_v1` → exit 73
  `no proof.yaml found in /workspace or any parent directory`
- **Why it hurts**: onboard says “read `proof help checklist` then survey the
  repo”. Agents cannot print the 15-step DAG until after init, so they cannot
  plan the campaign from a cold tree.
- **Expected**: builtin definitions (`onboard_v1`, `upstream_refresh_v1`) are
  readable without a project, same as `proof role show onboard`.

## DX-004 — Help search needs a project

- **Severity**: Medium
- **Status**: open
- **Observed**:
  - `proof help --search typescript` → deprecated, use `proof search`
  - `proof search "javascript OR typescript" --scope all` →
    `requires a proof project`
- **Why it hurts**: agent-rules say “help-search before grep”. On a cold
  TypeScript repo that is exactly when you need language-plugin docs.
- **Expected**: builtin-scope search works without `proof.yaml`.

## DX-005 — Init next-steps contradict onboard forbidden commands

- **Severity**: High
- **Status**: open
- **Observed**: `proof init` Next step 3:
  ```
  proof validate
  proof workflow init
  ```
  Onboard role GUARDRAILS: “Forbidden commands: `proof workflow`, `proof waive`.”
- **Why it hurts**: an agent following init output immediately violates the
  role it was told to wear. Two sources of “what next” (`init` footer vs
  `proof role show onboard`).
- **Expected**: init footer should branch on campaign (`onboard_v1` vs
  workflow) or say “either `proof checklist show onboard_v1` or `proof workflow init`”.

## DX-006 — `documentation_coverage` disabled vs onboard exit audit

- **Severity**: High
- **Status**: workaround
- **Observed**: init: “Documentation coverage: disabled”. Onboard EXIT
  CONDITION includes `--check documentation_coverage`.
- **Why it hurts**: first-time agents will either skip docs evidence or
  fight a check they were told was off.
- **Expected**: init should say “enable before onboard exit” or onboard
  should name the enable command. Prefer `proof config` (see DX-002).

## DX-007 — Onboard procedure leads with DeFi surface enumerations

- **Severity**: Medium
- **Status**: open
- **Observed**: `proof role show onboard --format agent` step 2 is four
  tables (callbacks, `balanceOf` deltas, setters, cross-module Solidity
  patterns) marked “mandatory for DeFi / configurable-protocol repos;
  recommended for any repo”.
- **Why it hurts**: cssomnom is a CSS parser. Agents spend a turn
  producing empty DeFi tables. The useful enumerations here are
  untrusted-CSS entry points, throw-vs-recover, and documented IDL deviations.
- **Expected**: language/domain-gated enumerations (JS parser vs Solidity
  AMM). Keep a generic “untrusted input / mutation / config” table for
  libraries.

## DX-008 — Opaque requirement IDs

- **Severity**: Medium
- **Status**: open
- **Observed**: default `id_format.pattern: '{prefix}-{date:YYMMDD}-{rand:4}'`
  → `STK-REQ-260821-556N`. Five stakeholder IDs are indistinguishable
  without opening files.
- **Expected**: optional slug (`STK-REQ-CSSOM-CONSUMER`) or
  `--id STK-REQ-CSSOM-CONSUMER` advertised in `proof req new` examples.
  `--id` exists but init/quick-start never show it.

## DX-009 — Preview/default actor is `human:cli`

- **Severity**: Medium
- **Status**: open
- **Observed**: `proof req new ... --preview --format json` set
  `history.created_by: human:cli` in this agent session until
  `--changed-by agent:grok-4.6` was passed.
- **Why it hurts**: `spec_lint_auto_modifier_without_human` and review
  history become wrong if the agent forgets the flag. Detection of “agent
  environment” did not fire here.
- **Expected**: Grok/Claude/Codex env detection, or refuse writes without
  `PROOF_ACTOR` / `--changed-by`.

## DX-010 — `verification.review.ai_generated: true` vs human-modifier lint

- **Severity**: High
- **Status**: open
- **Observed**: agent-created STK YAML has `verification.review.ai_generated: true`.
  Help for `spec_lint_auto_modifier_without_human`: promoting to `review`
  after only `auto:*` edits is a finding.
- **Why it hurts**: onboard says move the skeleton off `draft` so
  `changed_requirements_reviewed` passes. That promotion may immediately
  fail the auto-modifier lint. Agents then either stay on draft (fail
  changed_requirements) or need a human stamp they cannot get.
- **Expected**: document the allowed path (`--to review` by agent is OK
  at assurance C, or a dedicated `proof req status --to review --ai-ok`).
  Confirm during this campaign whether the lint actually fires.

## DX-011 — `proof help asd-ste100` is an alias, not a topic

- **Severity**: Low
- **Status**: open
- **Observed**: `proof help asd-ste100` returns the **Requirement Authoring**
  topic (STE100 is a section inside it). Fine content, surprising title.
- **Expected**: a short STE100 topic, or a banner “alias of req-authoring § STE100”.

## DX-012 — Check-id help collision

- **Severity**: Medium
- **Status**: open
- **Observed**: `proof help process_checklist` printed **Checklist** command
  help, not the VERIFY-stage check `process_checklist`.
- **Why it hurts**: agent-rules say `proof help <check-id>` on a failed
  check. Name collision with the command swallows the check topic.
- **Expected**: prefer the check topic, or disambiguate
  (`proof help check process_checklist`).

## DX-013 — `.proof/` gitignore vs “versionable objects stay tracked”

- **Severity**: Medium
- **Status**: open
- **Observed**: init appended:
  ```
  # ReqProof local-only state (versionable .proof/ audit objects stay tracked).
  .proof/
  ```
  The comment and the rule disagree. Entire `.proof/` is ignored.
- **Expected**: ignore only cache/index/locks (init already creates
  `.proof/.gitignore` for some of that) and track the rest, **or** change
  the comment.

## DX-014 — No CLI for AC `derived_reqs`

- **Severity**: Medium
- **Status**: open
- **Observed**: `l0_stakeholder_complete` / `spec_lint_ac_inverse_coverage`
  want `acceptance_criteria[].derived_reqs`. `proof req edit` can
  `--add-acceptance-criterion` but has no `--derived-req` / `--ac-derives`.
- **Why it hurts**: structured-CLI rule vs a field you must YAML-edit.
- **Expected**: `proof req edit STK --ac-id AC-001 --add-derived-req SYS-REQ-…`

## DX-015 — Interface metadata is inspect-only

- **Severity**: Medium
- **Status**: open
- **Observed**: `proof interface list/show` reads INT-REQ `interface:`
  blocks. `proof req new specs/integration` does not set producer,
  consumer, owner, version, compatibility_policy.
- **Expected**: flags on `proof req new` / `proof req edit` for the
  interface object, or `proof interface set`.

## DX-016 — Go/DeFi defaults on a TS library

- **Severity**: High
- **Status**: open
- **Observed**:
  - Catalog 1.9.1 is restaking/DeFi-coded (money_path, vault_exit_cei, …).
  - `proof coverage guide` recommends `npx c8` (good) but code_mcdc
    100% statement/decision/condition is on and lemma authoring is Go.
  - `property_fixtures_exist`, `flip_fixtures_exist` enabled at init.
- **Why it hurts**: first `proof audit` will drown a CSS parser in
  inapplicable DeFi/lemma/fixture checks. Agents may waive (forbidden)
  or invent obligations.
- **Expected**: language pack defaults; catalog baseline filtered by
  detected language; fixture checks off until a component is opted in.

## DX-017 — Vacuous `validate_passes` at init confirm

- **Severity**: Medium
- **Status**: open
- **Observed**: `proof checklist confirm --id init` ran
  `required_check validate_passes: pass` with **0 requirements**.
- **Why it hurts**: a green stamp on an empty corpus trains agents that
  confirm == quality.
- **Expected**: skip or WARN “no requirements yet” rather than pass.

## DX-018 — `req add` vs `req new`

- **Severity**: Low
- **Status**: open
- **Observed**: init Next step 2 still shows `proof req add`. Help says
  `proof req new` is the structured flow. `add` is “low-level shape”.
- **Expected**: init / quick-start only show `req new`.

## DX-019 — Doc vs code mismatches are not an onboard research prompt

- **Severity**: Medium
- **Status**: open
- **Observed**: research found README vs `src/CSSOM.ts` disagreements:
  - `replace()` documented as `Promise.resolve(this)` after sync parse;
    code uses `queueMicrotask`.
  - `CSSImportRule.styleSheet` documented as `null`; code returns an
    empty internal sheet.
- **Why it hurts**: onboard says “do not fabricate”; it does not say
  “when README and code disagree, file a KnownIssue / pick one SYS”.
  Agents freeze or write both.
- **Expected**: a research sub-step: “list README claims that the
  implementation does not match” → KnownIssue or SYS+KI.

## DX-020 — TypeScript lemma / verify-lemma gap

- **Severity**: High
- **Status**: open
- **Observed**: authoring help, `verify-lemma`, E_* translator errors, and
  `formal-proof` role are Go-only. cssomnom is TypeScript. `proof coverage guide`
  detects javascript and talks LCOV — a different evidence plane.
- **Why it hurts**: pipeline still routes to `formal-proof` when
  `verify_passes` / lemmas fail. Unclear whether those checks no-op or
  fail-closed on TS.
- **Expected**: language matrix in `proof help authoring` and
  `proof audit --list-checks` showing N/A vs fail for non-Go.
  Confirm empirically on this campaign (log result here).

---

## DX-021 — TypeScript orphan scan is a vacuous pass (0/0 functions)

- **Severity**: Critical
- **Status**: fixed-upstream (PR 1028, commit `d629eb3`). Installed `/tools/bin/proof` still PATH-only.
- **Observed**: After a 66-requirement skeleton and **zero** `Implements:` annotations:
  ```
  proof audit --check orphan_code_clean
  ✓ orphan_code_clean   0/0 code functions traced  (13ms)

  proof lint --check orphan_code_clean --format json
  { "status": "pass", "summary": "0 code functions have no requirement annotation" }
  ```
  `src/` has 79 `.ts` files. `proof init` detected `javascript`. `proof lint --help` claims TypeScript is supported. 13ms is not a tree-sitter walk of 79 files.
- **Why it hurts**: This is the silent-shrink failure mode `orphan_code_clean` exists to prevent. `traces-light` required_checks include `orphan_code_clean`. An agent would confirm the step on a project with **no traces**. Coverage later measures the traced set (empty).
- **Expected**: Enumerate TS `export function` / `export class` methods under `verification_scope`, report them as orphans, fail `--fail-level warn`.
- **Root cause (confirmed)**: Probe is a **managed** tool (`reqproof SYS-REQ-1274`). `proof search` already calls `toolmanager.FindOrDownloadConfigured` (path → `.proof/tools` → `~/.proof/tools` → PATH → GitHub auto-download). TypeScript **lint** and **autolink** used PATH-only `probe` / `ListSymbols` / `SearchAllPages`. This host already had `~/.proof/tools/probe/0.6.0-rc330/probe` from search; lint never looked there. Missing PATH probe made `DetectFileScopes` error; `LintProject` treated that as a **non-fatal parse skip**. Every `.ts` file dropped → vacuous 0/0 pass. Wrong first patch: tree-sitter fallback (`c42ab33`). Owner: auto-download, fail hard if download is impossible.
- **Fix**: https://github.com/probelabs/reqproof/pull/1028 commit `d629eb3`
  - `toolmanager.ResolveProbe` shared by search, lint, autolink
  - lint resolves Probe once; Probe-unavailable aborts (no skip, no 0/0)
  - `[E_PROBE_NOT_FOUND]` names managed download / `auto_download` / `REQPROOF_NO_DOWNLOAD=1`
  - Verified with `/tmp/proof-probe-managed`: isolated HOME + `REQPROOF_NO_DOWNLOAD=1` → exit 1 `E_PROBE_NOT_FOUND`; HOME with user cache and empty PATH → 644 TS functions enumerated (warn, not 0/0).
- **Update 2026-08-21 (traces-light)**: After `Implements:` annotations and widening
  `verification_scope.include` to tests/docs, `orphan_code_clean` is **no longer
  0/0**. It warns `234 code functions have no requirement annotation` (15ms,
  files such as `src/DOMMatrix.ts:multiplyArrays`). Still no denominator
  (N traced / M total). Hypothesis: the walker only enumerates functions in
  files that already participate in derived traces, or 0 annotations made the
  TS plugin short-circuit. Entry-point traces-light does not close 234 orphans;
  that is `annotations-heavy`. Do not treat this warn as a reason to skip
  autolink — traces exist.

## DX-022 — Generated `src/data/gen/**` cannot carry source_native traces

- **Severity**: Medium
- **Status**: workaround
- **Observed**: traces-light forbids annotating `src/data/gen/**` (codegen output).
  `verification_scope` is `src/**`, so generated property/unit/shorthand tables
  sit inside the production include. `orphan_code_clean` is currently vacuous
  (DX-021), but once the TS scanner enumerates functions those files would be
  untraceable orphans.
- **Why it hurts**: Agents would either hand-edit generated files (overwritten
  by `pnpm run codegen`) or treat 0/0 as coverage.
- **Expected**: language-aware generated-file excludes at init, or a first-class
  `verification_scope.completeness.generated` glob.
- **Workaround**: `project.lint.exclude: [src/data/gen/**]` in `proof.yaml`
  with this rationale. Completeness `production_exclude` still only lists
  Go test globs (DX-001).

---

## DX-023 — Autolink requires `probe` on PATH and has no `--changed-by`

- **Severity**: High
- **Status**: workaround
- **Observed**:
  ```
  proof trace autolink --changed-by agent:grok-4.6
  unknown flag: --changed-by

  proof trace autolink --dry-run
  [autolink] scanning... 50 files (59 annotations found)
  annotation scan: scanning annotations: probe source metadata: [E_PROBE_NOT_FOUND]
  ```
  Help says install `@probelabs/probe`. `npm install -g` failed (`ENOENT` mkdir `/usr/local/lib/node_modules/@probelabs/probe`). Local prefix install worked (`npm install --prefix /tmp/probe-npm @probelabs/probe`).
- **Why it hurts**: traces-light cannot materialize links without an undeclared sidecar binary. The scanner already had the annotations; probe enrichment is a hard fail, not a skip. `--changed-by` is required by onboard for proof writes but is not a flag on `trace autolink`.
- **Expected**: autolink degrades to comment-only linking when probe is missing; `--changed-by` is a global flag or a no-op on derived-state writes.
- **Workaround**: `PATH=/tmp/probe-npm/node_modules/.bin:$PATH proof trace autolink`. `PROOF_ACTOR=agent:grok-4.6` accepted.

## DX-024 — `verification_scope.include` silently drops tests and docs from autolink

- **Severity**: Critical
- **Status**: workaround
- **Observed**: After 68 `Implements:` annotations in `src/` plus `Verifies:` in `tests/*.test.ts` and `Documents:` in `README.md` / `docs/proof-*.md`, dry-run reported:
  ```
  by_relation: { implemented_by: 154 }
  files: only src/**
  ```
  Zero `verified_by` / `documented_by`. `project.documentation.sources` lists README + docs/. `isTestFile` treats `tests/` as tests. Autolink still skipped them because `scanAutolinkAnnotations` `include` is `scope.MatchesPath` against `verification_scope.include: [src/**]`. In-repo docs are not "external" so `ScanExternalDocumentationAnnotations` does not pick them up either.
  Also: `parsing tests/fixtures/selectors.json: json: cannot unmarshal array into Go value of type trace.FlipFixture` (FLIP scanner assumes every tests/ JSON is a FLIP fixture).
- **Why it hurts**: traces-light would confirm with only implemented_by coverage. Stakeholder `Documents:` and test `Verifies:` look present in git but never enter derived trace state. Same silent-shrink family as DX-021.
- **Expected**: autolink corpus = gitignore walker ∪ documentation.sources/roots, independent of production `verification_scope`. Help already claims this. Test JSON that is not FLIP should be skipped, not an error.
- **Workaround**: add `tests/**`, `README.md`, `docs/**` to `verification_scope.include` while keeping `completeness.production_include: [src/**]`.

## DX-032 — No CLI to stamp `acceptance_review`

- **Severity**: Medium
- **Status**: workaround
- **Observed**: `proof role show ac-sweep` and `proof help acceptance_review_current` require
  `acceptance_review: {reviewed_at, reviewed_by, disposition, notes}` on every
  STK with ACs. `proof req edit --help` has `--review-attest` /
  `--hazard-reviewed` but no `--acceptance-reviewed` / `--acceptance-review-*`.
  `proof req set` also lacks the field.
- **Why it hurts**: ac-sweep says use the structured editor; agents must YAML-edit
  extras, same class of friction as DX-014 (`derived_reqs`).
- **Expected**: `proof req edit STK --acceptance-reviewed --notes "…"` (mirrors
  `--hazard-reviewed`) writing `reviewed_by` from `--reviewer` / `PROOF_ACTOR`.
- **Workaround**: YAML-edit `acceptance_review` on each STK `.req.yaml`.
- **Repro**:
  ```bash
  proof req edit --help | grep -i acceptance
  # no acceptance_review flags
  ```

## DX-037 — KI vs DEFECT doctrine is not findable; agents mint live-bug DEFECTs

- **Severity**: Critical
- **Status**: filed (https://github.com/probelabs/reqproof/pull/1029, branch `docs/ki-vs-defect-class-closure`)
- **Observed**: Overlay audit of cssomnom found `setProperty('all')` still deletes the prior `all` before `expandAll` (`src/CSSStyleDeclaration.ts`, unfixed, `introduced_in: inception`). Agents filed **both** `KI-1` (correct live tracker) **and** `DEFECT-260821-1JGF` with `disposition.status: covered_by_known_issue` pointing at KI-1, because:
  1. `proof help defect` is `unknown help topic "defect"`.
  2. Onboard: "file the Y behavior as a KnownIssue / problem report"; "cells nobody can answer are candidate DEFECTS — file them as problem reports".
  3. History-mine: "for every past fix file the DEFECT it closed" plus "honest open defect beats a fake closure".
  4. `proof problem-report new` always creates an `open` stub; help lists `covered_by_known_issue` as a normal closure path ("the defect will not be fixed by a requirement right now").
  5. Residuals decision tree: "Did the defect already happen and need a fix/hardening record? YES → ProblemReport" — every live bug "already happened".
- **Why it hurts**: A DEFECT is supposed to be **post-fix evidence that the whole bug class was closed** (hardening: attached obligations, regression net, sibling/isomorphic sites). Using it as a live ticket (or a parking lot on a KI) makes `problem_reports_reviewed` look populated while the product is still broken, and teaches the next agent the wrong object. Overlay audits that cannot change product code then mint fake class-closure records.
- **Expected**:
  - Live unfixed confirmed failure → **KnownIssue only**.
  - DEFECT created **only after** the product fix lands (or is landing in the same change), and only as evidence the **class** was closed, not one call site.
  - `proof help defect` / `proof help ki-vs-defect` resolve to that decision tree.
  - Onboard / history-mine / agent-rules / `problem-report new` help match.
- **cssomnom correction**: deleted `proof/problem-reports/DEFECT-260821-1JGF.yaml`; kept `KI-1` open. No product-code fix in this engagement.
- **Repro** (before the ReqProof patch):
  ```bash
  proof help defect
  # unknown help topic "defect"
  proof help problem-reports | head -20
  # "drive it to a verifiable closure — covered by a requirement, a known issue, ..."
  proof role show onboard | grep -n "problem report"
  ```

## DX-038 — MC/DC ignore / KnownIssue / capability-gap disposition is not findable

- **Severity**: Critical
- **Status**: filed (https://github.com/probelabs/reqproof/pull/1030, branch `docs/mcdc-row-disposition`)
- **Observed**: Overlay coverage of cssomnom left guarantee-violation rows mute because agents could not discover the official leftover path. Lookups:
  ```
  proof help mcdc:ignore        # unknown; did you mean mcdc-ignores? (inventory COMMAND)
  proof help mcdc-ignore        # same
  proof help capability-gap     # unknown help topic
  proof help functionality-gap  # unknown help topic
  proof help known-issue        # KI object, not MC/DC row disposition
  ```
  The decision tree (witness vs `//mcdc:ignore:defensive` vs `capability-gap`+`[ki:]` vs `[known-issue]` reachability witness) lives only as a buried section of `proof help mcdc_coverage`. Two grammars exist (requirement-row ignore vs code-level `//mcdc:ignore:<category>` prefix) without a topic that names either.
- **Why it hurts**: Agents either leave rows red (silent gaps) or invent bare ignores / skip classified leftover. Coverage role and `mcdc_ignore_classified` already know the taxonomy; help search does not.
- **Expected**: `proof help mcdc:ignore`, `proof help capability-gap`, and `proof help functionality-gap` resolve to one decision-tree topic (same class of findability fix as DX-037 `proof help defect`).
- **Repro**:
  ```bash
  proof help mcdc:ignore
  proof help capability-gap
  proof help functionality-gap
  ```

---

## DX-039 — TypeScript pack never entered the effective signal path

- **Severity**: Critical
- **Status**: workaround (patched clone `/tmp/probe-labs/reqproof`; binary `/tmp/proof-dx/proof`)
- **Observed**: cssomnom `proof.yaml` has `project.signals.defaults: auto` and 82 production `.ts` files. Full audit warned:
  - `code_signal_obligations_reviewed` — language typescript in scope (82 files) but no signal scanner or rule pack covers it
  - `code_signal_unbindable` — same message
- **Why it hurts**: The guard is about a missing scanner *path*, not about 0 hits. A CSS parser with no `postMessage` listeners is honest 0-risk for that pack, but the check treated “no path” as uncovered. Agents would invent TS rules or disable the check.
- **Root cause**:
  1. `detectSignalDefaultPacks` only looked at `.go`/`.rs`/`.sol`/`.py`, so auto never selected the shipped `builtin:typescript/default` pack.
  2. `codeSignalConfiguredRulePackLanguages` only read explicit `project.signals.rule_packs`, ignoring `defaults: auto`.
- **Expected**: `.ts`/`.tsx`/`.js`/`.jsx` in detection paths append `builtin:typescript/default`. Language-coverage treats effective packs (`defaults: auto` + explicit `rule_packs`) the same way `signalDefaultRulePacks` does.
- **Fix (clone)**: shared `pkg/signalpacks` default-pack detection; coverage reads `EffectiveRulePacks`. Existing `data/typescript/security.yaml` is enough; no extra low-confidence rules.
- **Repro (stock binary, red)**:
  ```bash
  proof audit --check code_signal_obligations_reviewed --check code_signal_unbindable --fail-level warn
  ```
- **Recapture (patched)**:
  ```bash
  export PATH="/tmp/node-v24.11.1-linux-x64/bin:/opt/node24/bin:/tmp/proof-dx:$PATH"
  proof audit --check code_signal_obligations_reviewed --check code_signal_unbindable --fail-level warn
  ```

## DX-040 — MC/DC residue hint pushed a product refactor, not a KnownIssue

- **Severity**: Critical
- **Status**: workaround (clone `/tmp/probe-labs/reqproof` commit `9948171`; binary `/tmp/proof-dx/proof`)
- **Observed**: Overlay agents covering cssomnom with 100% code MC/DC **class-fixed product bugs** to raise coverage because `proof mcdc report --view hotspots` printed:

  ```
  the remaining gaps are structurally unpairable or blocked by unproven effects
  (calls, mutation, aliasing); inspect the per-condition feasibility reasons and
  consider a reviewed feasibility declaration or a refactor before adding tests
  ```

  (`pkg/mcdccode/report.go` `feasibilityResidueHint`, unknown+unpairable return).
  `proof help code_mcdc_coverage` / `proof help mcdc-report` described 100% floors
  as tests-or-refactor, not KI-first.
- **Why it hurts**: The user had to say “do not fix product to green MC/DC; log a
  KnownIssue”. Proof must say that. A live hole is KI-debt with a failing
  tripwire (`capability-gap` + `[ki:]`). A DEFECT is only after a later
  class-fix. Rewriting `src/` to close raw residue launders the meter.
- **Expected**: Residue next actions, in order: (1) unique-cause test if a pair
  is still coverable; (2) live logic hole → KnownIssue + failing tripwire — do
  **not** class-fix product just to raise MC/DC; (3) truly unreachable and the
  positive path already witnessed → `//mcdc:ignore:defensive`; (4) a reviewed
  feasibility declaration records proven coupling, not a license to rewrite
  the unit. 100% floors are not a rewrite mandate.
- **Fix (clone)**: both `feasibilityResidueHint` strings; help for
  `code_mcdc_coverage` and `mcdc-report` (plus feasibility topic so the old
  chain does not still say “Refactor (preferred)”); snapshot tests. Did not
  lower cssomnom floors. Did not `proof waive`. Did not edit cssomnom `src/**`.
- **Repro (stock wording)**:
  ```bash
  proof mcdc report --view hotspots | grep -F 'refactor before adding tests'
  proof help code_mcdc_coverage | grep -F '100% floors are not a rewrite mandate'
  ```
- **Recapture (patched)**:
  ```bash
  export PATH="/tmp/proof-dx:$PATH"
  proof help code_mcdc_coverage
  proof help mcdc-report
  proof mcdc report --view hotspots --page-size 1
  ```

---

## DX-041 — capability-gap needs e2e; defensive is not a unique-cause hatch

- **Severity**: Critical
- **Status**: workaround (clone `/tmp/probe-labs/reqproof` commit `ce32956`; binary `/tmp/proof-dx/proof`)
- **Observed**: Overlay agents covering cssomnom treated a capability-gap as
  closed once a KnownIssue YAML existed, often with a single tripwire (or none),
  and parked hard unique-cause leftovers as `//mcdc:ignore:defensive`. Residue
  hints after DX-040 still next-actioned a unique-cause test without forbidding
  synthetic harnesses (getters, ParseHooks override, Reflect private, `keep=N`,
  `constructor.name` spoof). `mcdc_ignore_classified` passed a capability-gap
  whose `[ki:]` resolved to `id: slug` with no `reproducer_command`.
- **Why it hurts**: A live product hole is not coverage bookkeeping. Tripwire-only
  does not prove the hole is user-reachable. A supposed feature no public API
  reaches is a capability bug, not structural unreachability. Defensive as a
  leftover-pair hatch launders the meter the same way DX-040's product refactor
  did.
- **Expected**: capability-gap MUST have an **open KnownIssue**, a **failing e2e
  public-API tripwire run twice**, **and additional e2e tests** on user-shaped
  public APIs (not Reflect/private). Tripwire-only is not enough. Defensive is
  only JS `&&` skip / `while (true)` F / tokenizer always sets `value` where the
  positive path is already witnessed. Do not next-action a product refactor
  (DX-040) **or** a synthetic unique-cause.
- **Fix (clone)**: `mcdc_ignore_classified` finding `capability-gap-no-tripwire`;
  help for `mcdc-row-disposition`, `mcdc_ignore_classified`, `code_mcdc_coverage`,
  `mcdc-report`, `known_issue_complete`, `known_issue_reproducer_present_and_resolves`,
  `mcdc_known_issue_disposition_stale`; residue hints; snapshot tests. Did not
  edit cssomnom `src/**`. Did not `proof waive`.
- **Repro (stock wording)**:
  ```bash
  proof help mcdc-row-disposition | grep -F 'Tripwire-only is **not** enough'
  proof help mcdc_ignore_classified | grep -F 'capability-gap-no-tripwire'
  ```
- **Recapture (patched)**:
  ```bash
  export PATH="/tmp/proof-dx:$PATH"
  proof help mcdc-row-disposition
  proof help mcdc_ignore_classified
  proof help code_mcdc_coverage
  proof audit --check mcdc_ignore_classified
  ```

---

## Critical-fix protocol

If an item is **Critical** and blocks the campaign:

1. Clone `git@github.com:probelabs/reqproof.git` (or HTTPS) into a sibling
   worktree, not into cssomnom `src/`.
2. Reproduce with a failing test in reqproof.
3. Fix, run reqproof preflight.
4. Do **not** vendor the fix into cssomnom. Link the PR from this file.
5. Continue the cssomnom campaign with a workaround until the fix lands.

Non-critical items stay in this log. Optionally file
`gh issue create --repo probelabs/reqproof --label dx-feedback,dogfood,cli`.

---

## Session log

| When (UTC) | Note |
|------------|------|
| 2026-08-21 | Campaign start. Init + research complete. DX-001–DX-020 logged from onboard. Skeleton authoring in progress via subagent. |
| 2026-08-21 | Skeleton complete: 66 reqs in `review`. Independent audit of structural checks: 0/0. DX-014 confirmed: agent had to YAML-edit `derived_reqs` so `l0_stakeholder_complete` would pass. DX-010 did not fire on `--to review` for this check set (still open — may fire on full spec-stage audit). Cloned `probelabs/reqproof` at `/tmp/probe-labs/reqproof` for critical-fix protocol. |
| 2026-08-21 | traces-light: added source_native Implements/Documents/Verifies on entry points. `lint.exclude: src/data/gen/**` (DX-022). DX-021 still open — do not treat orphan 0/0 as coverage. |
| 2026-08-21 | Autolink: E_PROBE_NOT_FOUND (DX-023); verification_scope src/** dropped tests/docs (DX-024). Widened include; probe via /tmp/probe-npm. |
| 2026-08-21 | DX-021 root cause: TS lint requires `probe symbols`; missing probe → skip file → 0/0. Fix: tree-sitter fallback. PR https://github.com/probelabs/reqproof/pull/1028 (`c42ab33`). With probe installed, cssomnom reports 234 remaining unannotated functions (light traces on entry points). |
| 2026-08-21 | After autolink, `orphan_code_clean` reports 234 unannotated functions (was 0/0). Scanner is no longer vacuous; traces-light did not annotate every TS function. |
| 2026-08-21 | Owner rejected PR 1028 tree-sitter fallback. Product: Probe is a managed tool (`reqproof SYS-REQ-1274`); lint/autolink auto-download and fail closed. Follow-up commit `d629eb3` on PR https://github.com/probelabs/reqproof/pull/1028. |
| 2026-08-21 | traces-light close-out: file-level `Implements:` on 67 non-gen `src/**/*.ts`. Autolink 554 links (403 implemented_by, 55 verified_by, 96 documented_by). `orphan_code_clean` **1146/1146**, `annotation_validity` pass, `--fail-level warn` clean. Remaining autolink errors: FlipFixture on `tests/fixtures/selectors.json` (DX-024); ReqProof requirement `reqproof SYS-REQ-1274` in this log is an upstream reqproof ID, not in cssomnom specs. |
| 2026-08-21 | ac-sweep: 15 dedicated `:acceptance` tests in `tests/acceptance-stk.test.ts`. Stamped `acceptance_review` via YAML (DX-032: no CLI). Checklist `proof/ac-sweep/checklist.yaml` 5/5 done. Did not confirm onboard ac-sweep step. |
| 2026-08-21 | DX-037: retracted misfiled `DEFECT-260821-1JGF` (live unfixed `setProperty('all')` is KI-1). DEFECT is post-fix class-closure evidence, not a live ticket. ReqProof PR https://github.com/probelabs/reqproof/pull/1029: `proof help defect` resolves; onboard/history-mine/agent-rules/CLI updated; `unfixed_bug_semantics` no longer recommends parking a live bug as `covered_by_known_issue`. KI-1 reproducer: `all: var(--x)` then invalid set drops cssText (all:unset is observably a no-op). |
| 2026-08-21 | DX-038: `proof help mcdc:ignore` suggested the inventory command; `capability-gap`/`functionality-gap` unknown. ReqProof PR https://github.com/probelabs/reqproof/pull/1030 (`mcdc-row-disposition`). Overlay uses `//mcdc:ignore:defensive` vs capability-gap+[ki:] for KI-1..KI-6. |
| 2026-08-22 | DX-039: `defaults: auto` never selected `builtin:typescript/default`; coverage guard ignored auto packs. Clone patch + `/tmp/proof-dx/proof` rebuild. cssomnom smoke: both checks pass (0 postMessage hits). Writeup `/tmp/grok-goal-47e8a9f6b740/implementer/proof-dx-ts-pack.md`. Did not change cssomnom `proof.yaml`. |
| 2026-08-22 | DX-040: hotspot residue hint said “feasibility declaration or a refactor”. Clone `/tmp/probe-labs/reqproof` `9948171` + `/tmp/proof-dx/proof`. Help and hints are KI-first (unique-cause test → KnownIssue tripwire → defensive ignore → declaration, not rewrite). Writeup `/tmp/grok-goal-47e8a9f6b740/implementer/proof-dx-mcdc-residue-hint.md`. Did not edit cssomnom `src/**`. |
| 2026-08-22 | DX-041: capability-gap passed with KI YAML and no failing tripwire; `:defensive` used as unique-cause hatch. Clone `/tmp/probe-labs/reqproof` `ce32956` + `/tmp/proof-dx/proof`. `mcdc_ignore_classified` warns `capability-gap-no-tripwire`. Help requires open KI + failing e2e public-API tripwire run twice + additional e2e tests. Residue hints forbid synthetic unique-cause. Writeup `/tmp/grok-goal-47e8a9f6b740/implementer/proof-dx-cap-gap.md`. Did not edit cssomnom `src/**`. |
