# Orchestration Goal: CSSOM Conformance and Proof Dogfood

## Objective

Use this session as the orchestrator for synchronized research and audit work on cssomnom. Continue until the repository contains at least 50 distinct, fair, confirmed bugs logged as known issues.

Research and document:

- how the project is structured;
- what the project implements and its documented deviations;
- how to use the repository's custom Proof CLI to test and audit it;
- honest specification, test, WPT, requirement, MC/DC, and coverage analysis for bug hunting.

## Model and orchestration policy

- Use `gpt-5.6-luna` with x-high reasoning for delegated research, code research, bug hunting, specification validation, and similar work.
- Follow `AGENTS.md`, `LOOP.md`, and applicable repository skills.
- The root agent remains an orchestrator. Code or test implementation is delegated through the developer-reviewer-gatekeeper loop.
- Treat the worktree as concurrently owned by another agent. Do not reset, overwrite, delete, or broadly stage files. New test and reproducer files must use collision-resistant names; staging must be path-scoped.

## Honest bug bar

A bug counts toward 50 only when all of the following are true:

1. It is a distinct root-cause defect, not another assertion or symptom of an already counted defect.
2. It violates an authoritative local specification anchor or an explicit in-scope project contract.
3. It is not an intentional deviation documented by the project.
4. It has a minimal public-API reproducer with explicit expected and actual behavior.
5. The reproducer has been run on the supported Node version and fails for the asserted reason.
6. An independent Bikeshed-only scrutineer validates the finding when it is a specification claim.
7. The logged known issue and evidence survive independent Reviewer and hostile Grizz review.

Historical fixed defects may count only when their evidence still establishes a distinct fair bug. Withdrawn findings, duplicate problem reports, raw WPT assertion counts, cached baselines, harness defects, and unverified audit findings do not count.

## Proof-as-case-study policy

cssomnom is also a dogfood case study for Proof. Use the custom Proof fork developed in this workspace rather than assuming `/tools/bin/proof` is authoritative.

For every confirmed cssomnom bug, record a Proof escape analysis:

- what Proof evidence or check should have exposed the bug;
- why Proof missed it: missing/weak requirement, incomplete acceptance criteria, missing test/fixture, stale evidence or cache, weak spec MC/DC model, code-MC/DC limitation, classifier/check defect, or unsupported surface;
- whether the corrective action belongs in cssomnom's Proof model or the Proof engine;
- the Proof regression or dogfood check required when the engine is at fault.

The user authorizes fixing genuine defects in the custom Proof fork. Such changes must have their own reproducer/regression evidence and pass the repository's mandated review gates.

## Current evidence baseline (2026-08-22)

- The honest historical inventory is 13 distinct fair bug classes: 12 fixed and one open; `KI-4` is withdrawn and does not count.
- Therefore at least 37 additional distinct confirmed bugs are required to reach 50.
- The local CSSWG, Houdini, and WPT submodules have been initialized for authoritative audit work.
- Initial Luna x-high hunting produced 24 candidates. These remain provisional until scrutineer validation, deduplication, reproducer logging, and review gates complete.
- Confirmed Proof-state concerns already observed include stale known-issue evidence, a stale MC/DC audit cache versus fresh queues, and code MC/DC below the configured 100% thresholds. These are audit findings, not automatically product bugs.

## Execution loop

1. Audit current worktree and custom Proof fork state.
2. Hunt candidates in independent domain waves.
3. Validate every candidate against local authoritative specifications and rerun it on Node 24.
4. Deduplicate by root cause and reject scope/deviation/harness findings.
5. Create collision-resistant reproducers, known-issue records, evidence, and Proof escape analyses through a delegated developer.
6. Run Reviewer and Grizz concurrently; return rejected work to the developer.
7. Repeat until at least 50 issues pass the honest bug bar.
8. Run fresh, no-cache Proof audits; spec and code MC/DC checks; targeted/full tests; WPT/parity reconciliation; preflight; coherence audit; and a requirement-by-requirement completion audit.
9. Update `PLAN.md` and only mark the persistent goal complete when current evidence proves every requirement above.
