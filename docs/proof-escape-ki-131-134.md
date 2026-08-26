// Documents: SYS-REQ-260826-D5W2, SYS-REQ-260826-XS91, SYS-REQ-260826-0MVR, SYS-REQ-260826-J4NJ
# Proof escape analysis: KI-131…KI-134 (nag-queue hunt wave N1 — vector-closure conversion)

This is the Proof escape companion for the N1 wave that converted the
`vector_campaign_closure` nag list (12 unowned vectors) into filed, owned KIs.
Four filings plus one sanctioned reconciliation note:

- **KI-131** — MediaParser condition descent overflows the JS stack on deeply
  nested `@media` prelude parentheses (~2200 levels); raw `RangeError` escapes
  both `parse()` and `insertRule()`. Owns **V-DOS-PARSE**.
- **KI-132** — A `@media` rule whose prelude ends inside an unclosed
  parenthesis block is deleted from the sheet at ingest, where MQ4
  #error-handling requires retention as `not all`; insertRule throws for the
  same recovered-valid text. Owns **V-CROSS-SURFACE-POSTURE-TRIAGE**
  (secondary: V-MALFORMED-RECOVER).
- **KI-133** — Eight grammatically invalid `@supports` conditions are retained
  as rules instead of being ignored with all contents (css-conditional-3
  #supports-syntax; WPT at-supports-019…026). Owns **V-MALFORMED-RECOVER**.
- **KI-134** — `matches()`/`querySelectorAll()`/`querySelector()` swallow
  invalid selectors (`false`/`[]`) where the DOM contract throws SyntaxError;
  `:is()`/`:where()` forgiving semantics stay correct. Owns
  **V-SELECTOR-FORGIVENESS-DIVERGENCE**.
- **KI-18** gained an `--append-note` entry naming **V-RECURSION-DEPTH**, so the
  closure nag for that vector clears through existing ownership (no new filing,
  per wave instruction).

## Research-first dedup map (prior coverage consulted before hunting)

Read before any probe: docs/proof-escape-ki-124-126.md, ki-127-130.md,
ki-117-121.md appendices; all 64 KI titles + kill_domains. Territory excluded up
front: KI-16 (:has budget), KI-17 (var/env exponential), KI-18 (block/at-rule
consume recursion), KI-19 (to() cartesian), KI-22 (calc recursion), KI-36
(122 missing shorthands), KI-38 (cascade ignores registry), KI-42/43 (bad-url /
fabricated @import), KI-105/113/117/124 (grammar-invalid retention family),
KI-107 (CSS.supports malformed var()), KI-31/5 (media condition serialization),
KI-4 (JS/CSS registration precedence — Scrutineer-settled).

## Cross-surface posture matrix (priority-1 triage deliverable)

40 malformed inputs × 9 surfaces classified at HEAD (parse / insertRule /
cssText-setter / setProperty / selectorText-setter / matches / qSA / TypedOM
parse / parseRuleSync+parseDeclarationListSync). Verdicts consistent with the
documented posture table (docs/threat-surface.md §1) except where filed:

| Same malformed text | ingest | insertRule | verdict |
|---|---|---|---|
| `@media ((width){a{color:red}}` | rule deleted silently | SyntaxError throw | KI-132 (both wrong; MQ4 recovers to not-all) |
| deep media parens | RangeError crash | RangeError crash | KI-131 |
| `@supports [margin:0]{…}` | retained | SyntaxError | KI-133 (ingest must ignore) |
| `span,:pseudoclass` on span | — | — | silent false vs DOM SyntaxError → KI-134 |

Triage notes recorded honestly (compliant postures, NOT filed): selectorText
setter ignoring invalid assignments matches cssom-1 setter semantics;
EOF auto-close of strings makes `[a="b]` a legal (auto-closed) attribute
selector, so its acceptance is tokenizer-correct; insertRule HierarchyRequestError
for @import on constructed sheets is DOM-specified; `(min-width:)`,
`(width <=)`, `(monochrome: rgb)` retention is grammar-compliant via the
general-enclosed fallback (mq-syntax "must only be chosen if…" rule) or valid
mf-plain; NUL/lone-surrogate U+FFFD substitution is spec-correct.

## Null-hunt results (honestly-remaining vectors)

- **V-SERIALIZATION-FIXPOINT** — residual sites CLEAN: 156-file grammar-driven
  corpus over font/@supports/@namespace/unicode-range/@counter-style/var-chains
  through `fuzz/oracles/roundtrip-sweep.ts`: inputs 302, findings 0. Manual
  fixpoint probes (var() chains, @supports condition text, namespace prefixes,
  unicode-range forms, font contraction ordering) all STABLE. One false DRIFT
  was caught and corrected during probing (re-parsed probe labels, not CSS).
- **V-REGISTRY-SEQUENCE-CONTAMINATION** — 10 sequence probes clean: top-level
  @property registers (spec-correct), nested-in-@media does not, invalid
  @property drops AND leaves no registry zombie, css-over-css last-wins, js/js
  IME per KI-4, clear()/wrong-origin-unregister behave as designed,
  setProperty accepting mismatched custom-prop values is correct
  (invalid-at-computed-value-time). KI-38 already owns the cascade-side gap.
- **V-SHORTHAND-EXPANSION-EQUIVALENCE** — expansion/contraction/removeProperty
  contracts hold for table-backed shorthands incl. slash-form border-radius,
  flex, background with position/size, inset, logical shorthands; non-expansion
  of place-items/place-content/grid-area/gap/transition is KI-36-owned.
  No novel mechanism.
- **V-SELECTOR-BACKTRACKING-COST** — bounded probes (descendant chains to depth
  800, wide-sibling backtracking) show flat cost; no super-linear growth found.
- **V-ACCESS-DENIED** — origin-clean guards EXIST and fire at three sites
  (src/CSSOM.ts:242, 409, 483), but `_originCleanFlag = false` is unreachable
  from any public API (only `createInternal(..., originClean)` sets it and the
  sole call passes the default true). No public-surface defect to file; CORS-
  driven flag flips are browser-host concerns outside the Node library surface.
- **V-ERROR-HANDLING** — insertRule guard chain verified working (IndexSize/
  SyntaxError/HierarchyRequest); no new error-handling defect surfaced beyond
  the filings above.

These six vectors stay open in proof/vectors/ with their hunt results recorded
here; status transitions (`proof vector campaign … closed-null/closed-ki`) are
orchestrator follow-up per wave constraints (vector yamls untouched).

## Twice-red evidence record

Node v24.11.1 (`/opt/node24/bin/node`), Proof binary `/tmp/proof-dx/proof`
0.1.0-dev. Every reproducer ran twice BEFORE filing and twice again after the
final byte-level edit (KI-132 oxlint fix), all runs exit 1 with green controls:

```text
KI-131  exit 1 ×2   tests 5 = 3 controls green (tokenize iterative 20k, balanced 100, insertRule 50) + 2 defect legs (parse RangeError, insertRule RangeError)
KI-132  exit 1 ×2   tests 6 = 2 controls green (balanced nesting; dangling-or→not-all WITH child kept) + 4 defect legs (3 deletion shapes + insertRule rejection)
KI-133  exit 1 ×2   tests 10 = 1 control green (valid condition retained) + 8 defect legs (WPT at-supports-019/020/022/023/025/026 shapes + operand-less not + dangling and)
KI-134  exit 1 ×2   tests 5 = 2 controls green (valid match/query; :is/:where forgiving semantics preserved) + 3 defect legs (silent false ×2, mixed plain list)
```

Evidence captured via genuine `proof evidence capture` runs, attached, then
`proof evidence refresh`; freshness sha256 verified equal to final reproducer
bytes for all four manifests after the last edit.

## Requirement anchoring

Four informal-prose drafts created through `proof req new` under the
fidelity-family parent `STK-REQ-260821-BQKD`, FRETish-modeled over freshly
declared variables (`proof var add`, paying formalization debt immediately
rather than deferring):

| Requirement | Variable pair (input → output) | Owns |
|---|---|---|
| SYS-REQ-260826-D5W2 | deep_media_paren_nesting → uncaught_rangeerror_count ≤ 0 | KI-131 |
| SYS-REQ-260826-XS91 | media_prelude_unclosed_parenthesis → deleted_grouping_rule_count ≤ 0 | KI-132 |
| SYS-REQ-260826-0MVR | supports_condition_fails_grammar → retained_invalid_supports_rule_count ≤ 0 | KI-133 |
| SYS-REQ-260826-J4NJ | top_level_selector_parse_fails → silent_false_or_empty_results ≤ 0 | KI-134 |

All four promoted to review with author approval stamps; satisfies traces to
STK-REQ-260821-BQKD registered; AC fan-out into AC-001/003/004/008 derived_reqs
added via the DX-014-documented path (no CLI exists for that field; PLAN.md
4878 precedent). Spec stage went from 4 FAILs (my draft reqs) to 0 FAILs /
0 warnings.

## Why each finding is NOT its nearest neighbor

- KI-131 vs KI-18/KI-22: three distinct recursive subsystems (consume
  algorithms vs math parser vs media-condition descent); dedup_armor on KI-131
  records the split; ACC-08 still surfaces one informational similarity note.
- KI-132 vs KI-5: KI-5 fixed serializeMediaQuery emitting `(())`; this defect
  is whole-RULE DELETION during CSSOM ingestion on top of that fix — the media
  layer recovers correctly and the ingest layer discards its output.
- KI-133 vs KI-107: boolean-evaluation API clause vs conditional-rule ingest
  grammar; kill_domain narrowed to `conditional_rule_ingest_grammar` +
  dedup_armor paragraph.
- KI-134 vs KI-16/32/34: error POSTURE of top-level matcher APIs, not matching
  semantics or budgets.

## Proof autonomy plans

- **KI-131** — (a) MC/DC rows once formalized: condition_depth_exceeds_budget
  (T: structured SyntaxError, F: continue descent); tokenizer_iterative_guard
  stays green. (b) Witnesses: the two RangeError legs + three controls become
  regression pins. (c) Lane proposal: recursion-depth sweep lane sampling paren
  nesting across media/supports/style-rule surfaces with per-subsystem budgets.
- **KI-132** — (a) rows: unclosed_construct_in_prelude (T: retain-as-not-all,
  F: delete); child_preserved_after_condition_rewrite. (b) Witnesses: three
  deletion shapes + dangling-or control pinning the recovery path exists.
  (c) Lane: extend metamorphic M-relations with prelude-truncation transforms
  asserting rule-count conservation.
- **KI-133** — (a) rows: condition_matches_supports_grammar (T: retain,
  F: drop-with-contents); nested_invalid_inside_valid_grouping. (b) Witnesses:
  eight WPT-pinned legs + valid control. (c) Lane: promote at-supports-0xx
  fixtures into a machine-readable negative-condition profile.
- **KI-134** — (a) rows: non_forgiving_context_parse_failure (T: SyntaxError);
  forgiving_list_member_survives (must stay true). (b) Witnesses: three red
  legs + two forgiving controls. (c) Lane: selectors-4 forgiveness-boundary
  differential vs DOM expectations extracted from WPT selector fixtures.

## Gate outputs (verbatim, end of wave)

```text
$ proof known-issue check            -> exit 0
$ proof audit --check known_issue_complete --fail-level warn
    Errors: 0  Warnings: 1   (0 of 64 active KIs below quality floor; 0 total gaps;
     sole warning = informational ACC-08 similarity note KI-18<->KI-131 with
     dedup_armor differentiation recorded on the new side)
$ proof audit --check spec_lint_ki_ste100 --fail-level warn -> Errors: 0  Warnings: 0
$ proof audit --check spec_lint_req_ste100 --fail-level warn -> Errors: 0  Warnings: 0
$ pnpm exec oxlint proof/reproducers/KI-13{1,2,3,4}-*.ts
    Found 0 warnings and 0 errors. (97 rules)
$ proof workflow check --stage spec  -> 0 FAILs (was 4 after req drafts; cleared:
    l1_system_complete, system_requirements_linked, system_formalization_complete,
    variables_declared; quality_clean PASS 154 requirements)
```

Note: `audit --check vector_campaign_closure` became `unknown check id`
mid-session because the concurrently-owned proof.yaml (parallel agent lane) is
mid-reconfiguration of the threat_surface checks; the nag's own conversion
criterion — "a KnownIssue whose yaml references <vector-id>" — is satisfied and
grep-verifiable for all five targeted vectors (KI-18 note included). Vector
status transitions are left to the orchestrator.

## Created-files list (new unless noted; nothing else touched)

```text
proof/reproducers/KI-131-media-paren-depth-rangeerror-overlay-260826.ts
proof/reproducers/KI-132-media-unclosed-prelude-rule-deletion-overlay-260826.ts
proof/reproducers/KI-133-supports-invalid-rule-retained-overlay-260826.ts
proof/reproducers/KI-134-matcher-silent-forgiveness-divergence-overlay-260826.ts
proof/known-issues/KI-131.yaml
proof/known-issues/KI-132.yaml
proof/known-issues/KI-133.yaml
proof/known-issues/KI-134.yaml
proof/evidence/ki-131.yaml
proof/evidence/ki-132.yaml
proof/evidence/ki-133.yaml
proof/evidence/ki-134.yaml
specs/system/requirements/SYS-REQ-260826-D5W2.req.yaml      (via proof CLI)
specs/system/requirements/SYS-REQ-260826-XS91.req.yaml      (via proof CLI)
specs/system/requirements/SYS-REQ-260826-0MVR.req.yaml      (via proof CLI)
specs/system/requirements/SYS-REQ-260826-J4NJ.req.yaml      (via proof CLI)
specs/system/variables/cssom-budget.vars.yaml               (via proof var add ×6)
specs/system/variables/selector-matcher.vars.yaml           (via proof var add ×2)
specs/stakeholder/requirements/STK-REQ-260821-BQKD.req.yaml (AC derived_reqs fan-out only — DX-014 documented YAML-edit path)
proof/known-issues/KI-18.yaml                               (--append-note only: V-RECURSION-DEPTH reconciliation)
docs/proof-escape-ki-131-134.md                             (this file)
```
