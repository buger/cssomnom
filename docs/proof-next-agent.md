// Documents: SYS-REQ-260821-H3BD, SYS-REQ-260821-7521, SW-REQ-260821-7M07, SW-REQ-260821-QV2H, SW-REQ-260821-HHVE
# Next-agent playbook (credit-aware)

Workspace: `/workspace`  
Branch: `CSSOmNom/Audit`  
This file: `/workspace/docs/proof-next-agent.md`

Read this before spawning Champs.

---

## Persistent session objective (merged 2026-08-22)

This playbook is also the durable goal file for the current orchestration campaign. Use the session as an orchestrator for synchronized cssomnom and Proof work. Continue until **at least 50 distinct, fair, confirmed bugs** are logged as known issues with reproducible evidence.

The campaign must also leave an evidence-backed account of:

- how cssomnom is structured and what it implements;
- its documented intentional deviations;
- how to run the custom Proof CLI and interpret its results honestly;
- specification, WPT, unit-test, requirement, spec-MC/DC, code-MC/DC, coverage, and proof-model gaps used during bug hunting.

### Model and concurrency policy

- Use `gpt-5.6-luna` with x-high reasoning for delegated research, code research, specification validation, bug hunting, and similar work.
- Follow `AGENTS.md`, `LOOP.md`, and applicable repository skills. The root agent orchestrates; Champ implements; Reviewer and Grizz audit concurrently after each product/overlay commit.
- Another agent is working in this worktree. Treat all existing changes as concurrently owned. Never reset, restore, clean, overwrite, or broadly stage. Use collision-resistant new test/reproducer names and path-scoped staging only.
- Preserve the other agent's unfinished work recorded below. Do not mistake dirty files or subagent edits for user-authored changes.

### Honest 50-bug counting bar

A finding counts only when all seven conditions hold:

1. It is a distinct root-cause defect, not another assertion, WPT row, or symptom of an already counted defect.
2. It violates an authoritative local CSS specification anchor or an explicit in-scope cssomnom API contract.
3. It is not an intentional deviation documented in `README.md`.
4. It has a minimal public-API reproducer with explicit expected and actual behavior.
5. The reproducer runs on supported Node 24 and fails for the asserted reason; live-hole reproducers run twice.
6. A Bikeshed-only Scrutineer validates the specification claim.
7. The KI, reproducer, evidence, and root-cause uniqueness survive Reviewer and Grizz.

Historical fixed defects count only when evidence still proves a distinct fair bug. `KI-4` is withdrawn and does not count. Duplicate DEFECT reports, raw WPT/parity assertion counts, stale baselines, harness failures, and unverified audit findings do not count.

### Proof is part of the case study

Use the custom Proof fork identified in this playbook, not `/tools/bin/proof`, unless explicitly comparing versions. For **every confirmed cssomnom bug**, add a Proof escape analysis:

- Which Proof check, requirement, obligation, signal, fixture, MC/DC row, or evidence lane should have exposed it?
- Why did it escape: missing/weak requirement, incomplete AC, absent regression/fixture, stale evidence/cache, weak spec MC/DC, code-MC/DC limitation, classifier/check defect, or unsupported surface?
- Does the correction belong in cssomnom's overlay/model or in Proof itself?
- If Proof is at fault, what engine regression and dogfood check prevents recurrence?

The user authorizes fixing genuine bugs in the custom Proof fork. Reproduce them first, avoid conflating Proof-engine defects with cssomnom model gaps, and pass the applicable developer/reviewer/gatekeeper workflow.

### Current honest count and discovery state

- Confirmed historical baseline: **13 distinct fair bug classes** (12 fixed, one open). At least **37 additional** distinct confirmed bugs are required.
- Local CSSWG, Houdini, external-suite, and WPT submodules are initialized for authoritative validation.
- The Luna x-high hunt and Bikeshed audits produced **29 root-deduplicated, spec-valid correctness candidates**. They do **not** count until KI/reproducer creation, twice-run evidence, and LOOP acceptance.
- `KI-101`–`KI-105` are committed and twice-red, but their LOOP gate remains open while Proof MC/DC/profile integration is repaired. `KI-106` is withdrawn as a duplicate of `KI-105` and does not count.
- `KI-107`–`KI-111` are present in the worktree with twice-red reproducers and targeted Proof checks, but are uncommitted and not yet LOOP-reviewed; they do not count yet.
- The accepted campaign count therefore remains the historical **13** until the new batches pass both Reviewer and Grizz.
- Known Proof-state concerns include stale KI evidence, an audit cache inconsistent with fresh MC/DC queues, and code MC/DC below configured 100/100/100 floors. These are audit findings, not automatically product bugs.

---

## Environment (copy-paste)

```bash
export PATH="/tmp/proof-dx:/tmp/node-v24.11.1-linux-x64/bin:/opt/node24/bin:$PATH"
# Node 24.11.1 must win. Never npx tsx / ts-node.
which node   # expect .../node-v24.11.1-linux-x64/bin/node
node -v      # expect v24.11.1
proof=/tmp/proof-dx/proof
$proof version   # 0.1.0-dev; clone /tmp/probe-labs/reqproof @ 6d41cc0 (DX-042 JS ignore honor)
```

| Thing | Path |
|---|---|
| Product | `/workspace` |
| Overlay specs | `/workspace/specs/{stakeholder,system,software,integration}/` |
| KI yaml | `/workspace/proof/known-issues/KI-N.yaml` |
| Overlay tripwires | `/workspace/proof/reproducers/` |
| KI evidence | `/workspace/proof/evidence/ki-N.yaml` |
| DEFECT yaml | `/workspace/proof/problem-reports/` |
| proof config | `/workspace/proof.yaml` |
| Recapture logs | `/tmp/grok-goal-47e8a9f6b740/implementer/audit-now.md`, `audit-full.log`, `audit-code-mcdc.log`, `mcdc-hotspots-now.txt` |
| LOOP reviews | `/tmp/grok-goal-47e8a9f6b740/implementer/review-<hash>.md`, `grizz-<hash>.md` |
| ReqProof clone | `/tmp/probe-labs/reqproof` (DX-042 commit `6d41cc0`) |

**Git:** path-scoped `git add -- <files>` only. Never `reset` / `restore` / `checkout --` / `revert` / `clean` / `git add .`.  
**Roles:** orchestrator does not write `src/` or spec YAML. Champ implements. LOOP Reviewer+Grizz after every product/overlay commit.  
**Forbidden:** `proof waive`, `proof workflow`, mass `proof approve` of the 82-req set, lowering `proof.yaml` `code_mcdc` 100/100/100 floors, implementing fetch for KI-7, class-fixing product **just to green MC/DC**.  
**User:** we do **not** require product-fixing issues. Live holes stay **open KIs with failing public e2e**. yaml `status: fixed` is historical.

**Do not commit:** `pwned`, `tmp-probe*`, `tmp-rf2-probe*`, `scripts/wpt/node/core/{cache,config,types}.js`, untracked duplicate junk. `docs/proof-onboard-research.md` / `docs/proof-skeleton-id-map.md` / `proof/surfaces/` only if they are the stamped onboard evidence.

Tests: `node --test --test-reporter=dot tests/<file>` (or `node --experimental-strip-types --test proof/reproducers/KI-….ts`). Overlay reproducers are **not** in `pnpm test:node`.

---

## Formalized goals (measurable)

A goal is **done** only when the check in the right column is true. Do not claim 0/0 or 100% MC/DC from isolated checks.

| ID | Goal | Done when |
|---|---|---|
| **G0** | Strict overlay gate | `$proof audit --fail-level warn` → **Errors: 0, Warnings: 0**. Floors still 100/100/100. No waive. |
| **G1** | Spec MC/DC | same audit: `mcdc_coverage` 0 uncovered; stale ≤ `proof.yaml` `max_stale_witness_lines` (1). No lying TRUE comments. |
| **G2** | Code MC/DC | `code_mcdc_coverage` 100% D and 100% C on `src/**` exclude `src/data/gen/**`. Ignores only `//mcdc:ignore:defensive` on structurally unpairable decisions whose **positive path is witnessed**. Never nested-if splits to hang ignores (`0e36b1f`). |
| **G3** | Bug hunt is honest | Every live user-facing cssomnom hole is an **open KI** + failing public e2e **run twice** (exit 1) under `proof/reproducers/`. Capability-gap, not `:defensive`. Do not fix cssomnom during this audit. |
| **G4** | History class-proof | Every shipped `src/` bugfix that is a real defect has a DEFECT **after** class-fix + a tripwire that fails on the parent commit and passes on HEAD, **and** an answer to “would FRETish/obligation/signal have caught this without the fix commit?” If no → add the missing var/obligation/signal. |
| **G5** | KI-7 stays red | `node --experimental-strip-types --test proof/reproducers/KI-7-import-stylesheet-null.ts` **and** `…/KI-7-import-url-token.ts` both exit **1**. No fetch I/O. `status: open`, `release_disposition: ship_with_known_issue`. |
| **G6** | Fifty-bug campaign | At least 50 distinct issues satisfy the seven-part counting bar above; each has a KI, reproducer, evidence, root-cause deduplication, Scrutineer/contract validation, LOOP acceptance, and Proof escape analysis. |
| **G7** | Proof dogfood closure | Every confirmed bug states why Proof missed it. Genuine custom-Proof defects have failing engine regressions before fixes, passing regressions after fixes, and independent review. Model/overlay gaps are not mislabeled as engine bugs. |

**Priority if credits are tight:** validate and log already-scrutinized correctness findings, then G4 and recapture G0. Do not spend a turn on unique-cause theater.

---

## Gate snapshot (recapture, not PLAN.md header)

Latest authoritative full baseline used the documented custom binary with cache disabled on 2026-08-22:

| Plane | Result |
|---|---|
| Full audit | **Errors: 0, Warnings: 17** (`$proof audit --no-cache --fail-level warn`) |
| Ordinary tests | `tests_pass` **error** when run independently; the stale binary's shared MC/DC path can falsely report pass and is being repaired in the fork |
| Code MC/DC | **93.504% D / 94.813% C** (3397/3633 D, 4844/5109 C; **Ignored 53**; incomplete **236**) |
| Spec MC/DC | **7 uncovered / 7 stale** rows (`7R6Z`, `30ZA`, `EGCP`) |
| Catalog | **82** reqs (was 66) |

Important state after that recapture:

- `d1b0c3d` — 7R6Z refines YQQZ (`consume_token_loop_runs`; hex-6 on parent only); 30ZA idle `consume=F`. Isolated mcdc still **red honestly** (7 uncovered / 7 stale).
- `a815df8` — REVIEW-39 dropped leftover `6`; the later no-cache full audit confirmed the error count is now zero.
- `c21eb97`..`97ac2a1` — KI-101..105 overlay batch and follow-up evidence/trace repairs; still awaiting final LOOP acceptance.
- Uncommitted KI-107..111 overlay batch — twice-red and targeted checks reported clean; review still required.
- `/tmp/probe-labs/reqproof` is a heavily dirty custom Proof fork. The documented `/tmp/proof-dx/proof` binary is stale relative to it. Do not claim the fork fixes are active until rebuilt and LOOP-approved.

Recapture command:

```bash
export PATH="/tmp/proof-dx:/tmp/node-v24.11.1-linux-x64/bin:/opt/node24/bin:$PATH"
proof=/tmp/proof-dx/proof
$proof audit --check tests_pass --check code_mcdc_measure --check code_mcdc_coverage --fail-level warn
$proof mcdc report --view functions --page-size 16
$proof audit --fail-level warn
```

Dirty / uncommitted that must not be lost:

- `/workspace/tests/mcdc-font-feature-values-comment-public-unique-cause.test.ts` — LOOP Reviewer reject of `cf47be2`: `consumeToken` never emits comment tokens. Disk already retargets unique-cause to **whitespace T vs compact F**; **comment T is MUTE**. Champ died (402) before commit.

```bash
export PATH="/tmp/node-v24.11.1-linux-x64/bin:/opt/node24/bin:$PATH"
node --test --test-reporter=dot tests/mcdc-font-feature-values-comment-public-unique-cause.test.ts
# twice, then:
git add -- tests/mcdc-font-feature-values-comment-public-unique-cause.test.ts
git commit -m "drop false comment-token unique-cause on font-feature-values"
```

KI-7 **open**:

```bash
node --experimental-strip-types --test proof/reproducers/KI-7-import-stylesheet-null.ts   # expect exit 1
node --experimental-strip-types --test proof/reproducers/KI-7-import-url-token.ts         # expect exit 1
```

## Historical class-fixed bugs → DEFECT + “would proof have caught it?”

Existing DEFECTs (`/workspace/proof/problem-reports/DEFECT-260821-*.yaml`, `DEFECT-260822-*.yaml`) cover some KI class-fixes only. User asked for **every shipped bugfix**.

```bash
git log origin/main --oneline -- src/ tests/
# then filter fix-like commits; for each HASH:
git show --stat HASH
```

For each real defect:

1. Tripwire that **fails** on `HASH^` (or `origin/main` if the bug is still there) and **passes** on HEAD.
2. Ask: **could ReqProof have found this without seeing HASH?**
   - Yes (FRETish/obligation/signal already named it) → `verified_by` + `:negative` only.
   - No because bool-only spec / no bound / no serialize-escape output → add var/range/mutex/table **and** the tripwire.
   - No because unexported → KI capability-gap, not `:defensive`.
3. `proof problem-report new` **after** class-fix evidence. `covered_by_requirement`. `proof approve --role spec-conformance --motivation-kind defect` **only those reqs**.
4. If the defect class is statically detectable, add a **code signal** rule rather than relying only on a test.

KI-1..3,5,6,8–14 already have class-fixes in `src/` + some DEFECTs. Several were found by MC/DC unique-cause, **not** FRETish — parent guarantees were too coarse. Do not fetch for KI-7.

---

## Proof 0/0 leftover

Last categorized no-cache warning backlog; recapture after the custom Proof fork passes LOOP and is rebuilt.

Still red (honest):

- `code_mcdc_coverage` 93.504%/94.813%, 236 incomplete, 53 ignores. Public-API unique-cause only. Theater BAN: getter-flip, ParseHooks override, Reflect, `keep=N`, `constructor.name`. Do **not** split `_parseAll` `A || (B && C)` (`a381e92` REJECT / `0e36b1f` restore).
- `mcdc_coverage` has 7 uncovered/stale rows across 7R6Z, 30ZA, and EGCP. Leave red until real witnesses exist; never restore lying TRUE comments (`7ff8011` / `c4e3dae`).
- `gaps_clean` / `verify_passes` 13 unconstrained outputs; `variable_orphans_clean` 14 declared-unused at the last recapture.
- `spec_lint_status_vs_review` **46** — real reviews, not mass-stamp. Checklist next: `spec-review-1` (`$proof checklist show onboard_v1`).
- `spec_lint_ac_inverse_coverage` 5, `decomposition_adds_refinement` 5, `formalization_quality` 5.
- `property_based_test_coverage` 53 — real PBT or `// reqproof:proptest:skip` with ≥16-char reason.
- `ambiguity_reviewed` 20; `consistency_pair_coverage` 2; `obligation_decomposition_complete` 8; `process_checklist`; `suspect_clean` 10; `under_modeled_requirements_clean` 29.

Already green: `nonbool_inputs_constrained`, `obligation_enforcement_backed`, `obligation_evidence_complete`, `known_issue_complete`, `documentation_coverage` 82/82, `authored_delta_expected` (`430b490`).

---

## LOOP landmines (do not repeat)

Reviews on disk: `/tmp/grok-goal-47e8a9f6b740/implementer/review-<hash>.md` and `grizz-<hash>.md`.

| Hash | Verdict | Lesson |
|---|---|---|
| `7bbb4ae` | REJECT | Citations must match **current .bs** (`4dcb7c0` ACCEPT: css-syntax-3 § 5.5.2 `#consume-at-rule`, § 4.3.14 `#consume-unicode-range-token`, css-typed-om-1 `#parse-a-cssstylevalue`, css-box-3 `#propdef-margin`). |
| `7ff8011` | REJECT | Do not put `reifies=T` on a throw to green `mcdc_coverage`. |
| `f6fcaaa` → `b387f2f` | reject then ACCEPT | Do not ignore a whole `A && B` if one conjunct is pairable. |
| `a381e92` | Grizz REJECT | Nested-if split to hang ignores = product logic change. |
| `c4e3dae` | Grizz ACCEPT / Reviewer reject | Empty-world FRETish drop OK; child must not copy parent (fixed `d1b0c3d`). |
| `cf47be2` | Reviewer reject / Grizz ACCEPT | Comment tokens are not public. Dirty test on disk. |

---

## Immediate next DAG

1. Finish the KI-101..105 Proof integration: remove the retired duplicate requirement, bind honest MC/DC witnesses/obligation evidence, and pass Reviewer+Grizz. Do not fix `src/**`.
2. Review and commit the uncommitted KI-107..111 batch only after Reviewer+Grizz independently confirm its five distinct roots, twice-red reproducers, exact anchors, and zero newly introduced audit findings.
3. Finish and gate the custom Proof false-green/evidence changes in `/tmp/probe-labs/reqproof`; rebuild `/tmp/proof-dx/proof` only after both gates accept the coherent fork patch.
4. Run a fresh no-cache audit with the accepted custom binary. Treat **0 errors / 17 warnings** as the last baseline, not the target.
5. Continue collision-resistant KI batches from the remaining scrutinized catalog (`KI-112+`). Every issue needs a Proof escape analysis and twice-red public-API reproducer.
6. Repeat Luna x-high hunting/validation/logging waves until G6 reaches 50 without duplicates, scope inflation, or cssomnom fixes.
7. Resolve G0/G1/G2 warnings honestly: current spec-MC/DC rows, code-MC/DC public witnesses, requirement modeling/reviews, property evidence, ambiguity/consistency/trace findings, and checklist steps. No waive or lowered floors.
8. Run preflight, WPT/parity reconciliation, coherence audit, and a requirement-by-requirement completion audit. Update `PLAN.md`; mark the persistent goal complete only when all evidence is current and the full Proof audit is 0/0.

If you can only do one thing: take one already-scrutinized conformance batch all the way through twice-red evidence, Proof escape analysis, and both LOOP gates.
