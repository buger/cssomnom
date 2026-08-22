// Documents: SYS-REQ-260821-H3BD, SYS-REQ-260821-7521, SW-REQ-260821-7M07, SW-REQ-260821-QV2H, SW-REQ-260821-HHVE
# Next-agent playbook (credit-aware)

Workspace: `/workspace`  
Branch: `CSSOmNom/Audit`  
This file: `/workspace/docs/proof-next-agent.md`

Read this before spawning Champs.

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
| proof config | `/workspace/proof.yaml` (`security_surface_covered` commented disabled ~L102) |
| Recapture logs | `/tmp/grok-goal-47e8a9f6b740/implementer/audit-now.md`, `audit-full.log`, `audit-code-mcdc.log`, `mcdc-hotspots-now.txt` |
| LOOP reviews | `/tmp/grok-goal-47e8a9f6b740/implementer/review-<hash>.md`, `grizz-<hash>.md` |
| ReqProof clone | `/tmp/probe-labs/reqproof` (DX-042 commit `6d41cc0`) |
| Codex scan (completed 2026-08-21) | `/home/dev/.codex/state/plugins/codex-security/scans/workspace/codex-security-workspace-TCbtjG/` |
| Scan findings JSON | `…/findings.json` |
| Scan PoCs | `…/findings/<slug>/poc/` |
| Scan hardening (not implemented) | `…/hardening/hardening.md` |
| Scan target SHA | `264c2ea5544795e366f2132a9683a2ec1b5476d1` (`origin/main`-era). **Re-run PoCs on current HEAD.** |

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
| **G3** | Bug hunt is honest | Every live user-facing hole is an **open KI** + failing public e2e **run twice** (exit 1) under `proof/reproducers/`. Capability-gap, not `:defensive`. Tooling holes count if operators run those scripts. |
| **G4** | Codex scan ingested | All 16 findings below are either (a) open KI + failing overlay PoC on **current HEAD**, or (b) written disposition: PoC no longer holds, with the command+output in the KI history / a `docs/` note. **Zero silent drops.** |
| **G5** | History class-proof | Every shipped `src/` bugfix that is a real defect has a DEFECT **after** class-fix + a tripwire that fails on the parent commit and passes on HEAD, **and** an answer to “would FRETish/obligation/signal have caught this without the fix commit?” If no → add the missing var/obligation/signal. |
| **G6** | KI-7 stays red | `node --experimental-strip-types --test proof/reproducers/KI-7-import-stylesheet-null.ts` **and** `…/KI-7-import-url-token.ts` both exit **1**. No fetch I/O. `status: open`, `release_disposition: ship_with_known_issue`. |

**Priority if credits are tight:** G4 (file security KIs from existing PoCs) then G5, then recapture G0. Do not spend a turn on unique-cause theater.

---

## Gate snapshot (recapture, not PLAN.md header)

Last **full** `$proof audit --fail-level warn` at `cf47be2` (2026-08-22T11:08Z), log `/tmp/grok-goal-47e8a9f6b740/implementer/audit-full.log`:

| Plane | Result |
|---|---|
| Full audit | **Errors: 1, Warnings: 16** |
| Code MC/DC | **93.5% D / 94.9% C** (3398/3633 D, 4846/5109 C; **Ignored 53**; incomplete **235**) |
| Spec MC/DC | 322 rows, **8 uncovered / 5 stale** at that recapture |
| Catalog | **82** reqs (was 66) |

Later commits **not** in that recapture:

- `d1b0c3d` — 7R6Z refines YQQZ (`consume_token_loop_runs`; hex-6 on parent only); 30ZA idle `consume=F`. Isolated mcdc still **red honestly** (7 uncovered / 7 stale).
- `a815df8` — REVIEW-39 dropped leftover `6`. Isolated `spec_lint_spec_conformance_review_grounded` **0e/0w**. **Next full recapture should drop the 1 error.**
- `34751fa` / `1153d85` — this playbook.

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

---

## Codex security scan vs KI library

**None of the 16 scan findings are in `/workspace/proof/known-issues/`.** KI-1..14 are CSSOM/Typed OM **correctness** holes. KI-7 is documented offline `@import`. They do not overlap CWE-400/22/94/918/78.

That is a **campaign gap**, not a clean bill of health:

1. `/workspace/proof.yaml` **disables** `security_surface_covered` (~L102) because a 2026-08-21 hunt only found WPT runner egress, not CSS `url()` in `src/**`. That hunt did not file library DoS or path-join as KIs.
2. `denial_of_service_resistant` is on `SYS-REQ-260821-7521`, `SYS-REQ-260821-SBJ7`, `SW-REQ-260821-7M07`, `SW-REQ-260821-HHVE`, `SW-REQ-260821-QV2H`, backed by css-fuzz **crash-freedom**. Crash-freedom ≠ resource budget. Deep nesting / cartesian `toSum` / exponential `var()` / unbounded `:has()` often **do not throw** until stack/heap death.
3. `verification_scope.completeness.production_include` is `src/**` only. `scripts/wpt/**` never got a KI even though operators/CI run those CLIs.
4. Could we have found these **without** the scan?
   - **Library DoS + hash serialize:** **yes**, if FRETish named a bound and a failing tripwire existed. **Spec was not good enough** (DoS obligation present, no numeric domain, no e2e). Missing obligation **shape**, not missing class.
   - **WPT/wpt.fyi/extractors:** **no**. Tooling trust-boundary. Needed this scan or treating `scripts/` as product / enabling `security_surface_covered`.

**Disposition (user):** open KI + failing public e2e **more than yaml**. Copy/adapt scan PoCs into `/workspace/proof/reproducers/`. Do not class-fix just to green. Tooling hole → KI with `affected_api` = the CLI, not `:defensive`.

### How to file one KI (template)

```bash
export PATH="/tmp/proof-dx:/tmp/node-v24.11.1-linux-x64/bin:/opt/node24/bin:$PATH"
# 1) Re-run scan PoC on HEAD (example: parser nesting)
node /home/dev/.codex/state/plugins/codex-security/scans/workspace/codex-security-workspace-TCbtjG/findings/parser-unbounded-nesting-recursion/poc/nest-dos.mjs
# 2) Copy/adapt into proof/reproducers/KI-15-parser-nesting-depth.ts
#    Pattern: proof/reproducers/KI-7-import-stylesheet-null.ts
#    Must assert the SAFE contract (bounded reject / escaped ident / contained path)
#    and FAIL while the hole is present. Import src/parser.ts first if ParseHooks needed.
# 3) Run twice, both exit 1
node --experimental-strip-types --test proof/reproducers/KI-15-parser-nesting-depth.ts
# 4) proof known-issue new  (follow `proof help known-issue`)
#    affected_requirements: the DoS/serialize/tooling req you attach or create
#    reproducer_command: node --experimental-strip-types --test proof/reproducers/KI-15-….ts
# 5) proof evidence capture KI-15
# 6) On the tripwire, immediately above test():
#    // Reproduces: KI-15
#    // MCDC <REQ>: <assignment> => FALSE [known-issue] [ki: KI-15]
#    On the passing witness: //mcdc:ignore:capability-gap … [ki: KI-15] [category: capability-gap]
```

Suggested IDs **KI-15..KI-30** (do not reuse 1–14).

### The 16 findings — absolute PoC paths

`SCAN=/home/dev/.codex/state/plugins/codex-security/scans/workspace/codex-security-workspace-TCbtjG`

| ID | Sev | Title | Product path | Re-run on HEAD |
|---|---|---|---|---|
| KI-15 | **high** | WPT `script src` → `vm.Script` outside WPT root | `/workspace/scripts/wpt/node/run.ts` | `$SCAN/findings/wpt-getscriptcontent-no-containment/poc/exploit.mjs` |
| KI-16 | med | `:has()`/combinator no match budget | `/workspace/src/matcher.ts` | `$SCAN/findings/has-combinator-no-match-budget/poc/poc.mjs` |
| KI-17 | med | Acyclic `var()`/`env()` exponential expand | `/workspace/src/cascade/variable-resolver.ts` | `$SCAN/findings/var-env-exponential-expansion/poc/exploit.mjs` |
| KI-18 | med | Parser nested rules no depth budget | `/workspace/src/parser.ts` | `$SCAN/findings/parser-unbounded-nesting-recursion/poc/nest-dos.mjs` |
| KI-19 | med | `to`/`toSum` cartesian no term cap | `/workspace/src/typed-om/numeric/numeric-methods.ts` | `$SCAN/findings/numeric-tosum-cartesian-expansion/poc/exploit.mjs` |
| KI-20 | med | Fixture extractors `eval`/`vm` | `/workspace/scripts/external_suites/extract_{nv_cssom,rrweb,wpt}.ts` | `$SCAN/findings/fixture-extractors-eval-vm-submodule-js/poc/exploit.mjs` |
| KI-21 | med | Hash serialize skips `serializeIdentifier` | `/workspace/src/serializer.ts` | `$SCAN/findings/serializer-hash-omits-identifier-escape/poc/poc.mjs` |
| KI-22 | med | Math parse/simplify no depth budget | `/workspace/src/math-parser.ts` | `$SCAN/findings/math-parser-unbounded-recursion/poc/math-recursion-dos.mjs` |
| KI-23 | med | `--browser` interpolates into paths | `/workspace/scripts/wpt/browser/run.ts` | `$SCAN/findings/wpt-browser-flag-path-escape/poc/probe.mjs` |
| KI-24 | med | `/interfaces/` fetch no root contain | `/workspace/scripts/wpt/node/run.ts` | `$SCAN/findings/wpt-interfaces-join-no-containment/poc/exploit.mjs` |
| KI-25 | med | `sandbox.fetch` → host fetch | `/workspace/scripts/wpt/node/run.ts` | `$SCAN/findings/wpt-sandbox-fetch-host-fallthrough/poc/demonstrate_fetch_fallthrough.mjs` |
| KI-26 | med | `--cache-path` unconstrained write | `/workspace/scripts/wpt/browser/fetch-wptfyi.ts` | `$SCAN/findings/wptfyi-cachepath-resolve-write/poc/exploit.mjs` |
| KI-27 | med | `results_url` no host allowlist | same | `$SCAN/findings/wptfyi-downloadurl-no-allowlist/poc/poc.mjs` (also `poc_real_module.mjs`) |
| KI-28 | med | `getGitNotesLog` shell interpolation | `/workspace/scripts/wpt/node/safe-child-process.ts` | `$SCAN/findings/getgitnoteslog-execsync-interpolation/poc/poc.mjs` |
| KI-29 | med | `gunzipSync` no maxOutputLength | `fetch-wptfyi.ts` | `$SCAN/findings/wptfyi-gunzipsync-no-output-cap/poc/gzip-bomb-demo.js` |
| KI-30 | **low** | `check-safe-exec` only literal imports | `/workspace/scripts/ci/check-safe-exec.ts` | `$SCAN/findings/check-safe-exec-literal-import-only/poc/end-to-end.mjs` |

Writeups: `$SCAN/findings/<slug>/<slug>.md`. Finding objects: `$SCAN/findings.json`. Hardening proposals (do **not** implement unless asked): `$SCAN/hardening/proposals/`.

Library DoS first (KI-16..19, 21, 22) — user-facing `src/`. Then tooling (KI-15, 20, 23–30).

For each, ask before filing:

- Does a FRETish row already name this? If yes, attach KI to that req.
- If no: is the spec missing a bound/var (DoS depth, escaped ident, path_contained) → **add DRAFT req/var**, then KI. Do not skip because `production_include` is `src/**`.
- Is the obligation the wrong cell (crash-freedom vs budget)? → new evidence class / tripwire, not more fuzz.

---

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
4. If the class is a sink (eval, shell, `path.join`, unbounded recursion): add a **code signal** rule, not only a test.

KI-1..3,5,6,8–14 already have class-fixes in `src/` + some DEFECTs. Several were found by MC/DC unique-cause, **not** FRETish — parent guarantees were too coarse. Do not fetch for KI-7. Do not class-fix security findings in the same breath as filing them.

---

## Proof 0/0 leftover

Warning IDs from `cf47be2` full audit. `a815df8` should kill the error.

Still red (honest):

- `code_mcdc_coverage` 93.5%/94.9%, 235 incomplete, 53 ignores. Public-API unique-cause only. Theater BAN: getter-flip, ParseHooks override, Reflect, `keep=N`, `constructor.name`. Do **not** split `_parseAll` `A || (B && C)` (`a381e92` REJECT / `0e36b1f` restore).
- `mcdc_coverage` empty auditor SAT on 7R6Z/30ZA — leave red or retune; never restore lying TRUE comments (`7ff8011` / `c4e3dae`).
- `gaps_clean` / `verify_passes` 13 unconstrained outputs; `variable_orphans_clean` 13 declared-unused.
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

1. Commit dirty font-feature test if the command in Gate snapshot passes twice.
2. Full recapture (expect **0 errors** after `a815df8`).
3. **G4 Security KI batch** using the table above. Library DoS first. Do not class-fix.
4. **G5 History-swipe DEFECT campaign**.
5. Then G0 leftover warnings / G2 235 incomplete decisions.

If you can only do one thing: **G4** — the PoCs already exist; the overlay has zero of them as KIs.
