# Proof escape analysis: KI-112 and KI-113 (font-shorthand semantics batch)

This is the Proof escape companion for the confirmed font-shorthand batch,
KI-112 (valid system font keyword yields an empty shorthand serialization plus
keyword-stamped longhands) and KI-113 (the parse-a-css-declaration-block path
retains grammar-failing keyword+size/family mixes verbatim). Both findings
remain open and unfixed in `src/**`; each overlay reproducer asserts the
spec-honest contract and is expected to stay red until the product is
repaired.

Evidence was captured with the documented custom Proof binary at
`/tmp/proof-dx/proof` (0.1.0-dev, DX-042) and Node v24.11.1. Each reproducer
was run twice before filing — both runs exit 1 for the asserted reason:

```text
KI-112  run 1 exit 1   14 tests: 1 positive-control pass, 13 defect failures
KI-112  run 2 exit 1   identical counts
KI-113  run 1 exit 1    6 tests: 2 control passes (setProperty/insertRule), 4 defect failures
KI-113  run 2 exit 1   identical counts
```

`proof evidence capture` then re-executed each reproducer a third time and
stamped `proof/evidence/ki-112.yaml` / `ki-113.yaml`
(`observed_result: known_issue_reproduced`, freshness sha256 verified against
`sha256sum` of the final reproducer bytes). After a lint-driven edit to both
reproducers (removing `as any` casts; oxlint now 0 errors), both were re-run
twice-red again and re-stamped via `proof evidence refresh`.
`proof known-issue check` reports clean (43 issues checked, no findings).

Requirement anchoring: no existing requirement covers font-shorthand
serialization semantics, so three narrowly-modeled drafts were created through
`proof req new` under the fidelity-family parent `STK-REQ-260821-BQKD`:
`SYS-REQ-260823-S4DW` and `SYS-REQ-260823-YQPJ` (KI-112), `SYS-REQ-260823-0BRJ`
(KI-113). They are intentionally **informal** (prose + spec references, no
FRETish variables): formalizing them needs new cssom component variables, and
declaring them requires editing `specs/system/variables/cssom.vars.yaml`,
which this batch was not permitted to touch while it is concurrently owned.
The informality gap is recorded in each KI's notes; whoever owns the vars file
next should add e.g. `system_font_keyword_declared`,
`font_shorthand_round_trips`, `font_longhands_empty`,
`font_shorthand_grammar_violated`, `declaration_dropped` and compile the three
drafts.

## The common shape of this batch

Both escapes share one root in Proof's model: shorthand requirements model
**arity and numeric domains**, never **value-class semantics**. The corpus's
only shorthand obligations (`SW-REQ-260822-YBF2`, `SYS-REQ-260822-5V7N`,
`INT-REQ-260821-30ZA`) gate `shorthand_expanded | shorthand_rejected` on
`box_side_count <= 4 & position_token_count <= 4 & keyframe_offset_percent
<= 100 & font_weight_number <= 1000`. Their MC/DC rows distinguish how many
values arrived, not *which* keywords they contain. `font_weight_number ∈
[1,1000]` cannot tell `bold` from `icon`; no variable anywhere ranges over
keyword classes, so neither the drop-the-valid bug (KI-112) nor the keep-the-
invalid bug (KI-113) can flip any modeled row.

## KI-112 — system font keyword: valid value, empty serialization

Reproducer: `proof/reproducers/KI-112-font-system-keyword-shorthand-empty-overlay-260823.ts`
Requirements: `SYS-REQ-260823-S4DW`, `SYS-REQ-260823-YQPJ` (newly drafted)
Spec anchors: css-fonts-4 `#font-prop` (Value ends `| <<system-font-family-name>>`),
css-fonts-4 `#system` (six-keyword enumeration); cssom-1
`#parse-a-css-declaration-block` step 3.1 licenses dropping only
grammar-failing values. WPT: `css/css-fonts/parsing/font-valid.html`
(non-empty + round-trip), `css/css-fonts/system-fonts-serialization.tentative.html`
(shorthand as-is, longhands empty).

Which Proof check should have exposed it: the serializer round-trip family.
`SYS-REQ-260821-KV30` ("serializer shall emit source text") and the cssText
obligations certify output shape, but their fixtures are single benign samples
— none sets a system font keyword and reads `getPropertyValue('font')` back.
The valid-subset oracle lane in `fuzz/oracles/valid-subset.ts` *did* catch it
immediately on its first font-filtered sweep: `--filter '^font$' --per-property
40` reports `dropped (valid-value-dropped): 7` with rows exactly like
`{"expected":"icon","actual":"","sampledValue":"icon"}` (reproduced during this
filing). That lane went live only after the audit cycle that should have gated
shorthand behavior had already closed.

Why it escaped: two layers. (1) Model: no requirement expresses "a retained
declaration's shorthand must serialize back non-empty", so nothing failed when
`expandFont` stamped the keyword into all 13 longhands
(`src/shorthands.ts` ~1311-1319) and `contractFont` refused the
variant-polluted set (~1451-1454) — every arity-shaped check still saw a
well-formed expansion. (2) Lane timing: the only instrument that observes
value-level survival (valid-subset oracle) exists outside `proof.yaml` checks
and was added by the concurrent fuzz work; Proof had no wired check that would
have run it.

Correction locus: cssomnom overlay/model first — the three draft requirements
name the missing contracts; once declared, their tripwires are the KI-112
reproducer legs (non-empty round-trip; empty longhands; unpolluted cssText).
Proof engine second: the valid-subset lane needs to become a real check (see
permanent lanes below); until then a freshly generated grammar sample has no
gate to fail in.

## KI-113 — invalid mix accepted by the declaration-block parse path

Reproducer: `proof/reproducers/KI-113-font-shorthand-invalid-mix-accepted-overlay-260823.ts`
Requirement: `SYS-REQ-260823-0BRJ` (newly drafted)
Spec anchors: css-fonts-4 `#font-prop` (two alternatives only) +
`#font-prop-desc` note (~line 1990: keywords count only in initial position);
WPT `css/css-fonts/parsing/font-invalid.html` (`test_invalid_value('font',
'menu icon')`); cssom-1 `#parse-a-css-declaration-block` step 3.1 (drop).

Which Proof check should have exposed it: `SYS-REQ-260821-8TGB` already models
the ignore-invalid contract — "when set_property_called & invalid_value the
cssom shall always satisfy set_property_ignored" — and the product honors it:
setProperty() drops `menu 10px serif`, insertRule() drops it. The obligation
never fires on the parsing path because its trigger variable is
`set_property_called`. The storage invariant ("no grammar-failing declaration
is ever retained") was modeled per-entry-point instead of once at the
declarations level, so adding a new entry path silently created an unmodeled
surface. This is the same per-construct hazard narrowness documented for
KI-22 in the ki-16..22 analysis: enumeration-by-call-site always trails the
call graph.

Why it escaped: trigger-scope mismatch, plus a missing complementary oracle.
The valid-subset lane asserts valid inputs survive; nothing asserts the
*contrapositive family* — that inputs failing a supported property's grammar
do not survive. KI-113 therefore sits in a hole between two oracles: too
invalid for subset-survival to say anything, and outside 8TGB's trigger.

Correction locus: overlay/model. `SYS-REQ-260823-0BRJ` states the
storage-level rule with the parse-path surface named explicitly. Engine idea
(not implemented): an "invalid-superset" oracle beside `valid-subset.ts` that
mutates generated-valid values with grammar-breaking edits (keyword + trailing
size, doubled keywords) and asserts non-retention; wiring both lanes into
audit would have caught KI-112 and KI-113 mechanically from the same
generator.

## Proposed permanent lanes

1. Wire the valid-subset oracle into `proof.yaml` as a check (e.g. a
   `fuzz_oracle` evidence profile running `valid-subset.ts` with a fixed seed
   budget and failing on any finding). Deliberately NOT done here —
   `proof.yaml` is outside this batch's write scope, and the concurrent agent
   owns the fuzz lane's stabilization.
2. Add the invalid-superset counterpart oracle (mutation of generated-valid
   values; assert non-retention through every public entry point: parse(),
   setProperty(), insertRule(), cssText setter) so accept-invalid regressions
   have the same mechanical detection valid values now have.
3. When the cssom vars file frees up: declare the five variables named above,
   compile `SYS-REQ-260823-S4DW/YQPJ/0BRJ` from informal to FRETish, and bind
   the KI reproducers as their evidence profiles so the MC/DC rows finally
   range over keyword classes, not just arity.

## Batch-level lessons

1. Arity-shaped shorthand models are blind to keyword semantics: every
   existing shorthand row passed while both bugs shipped. Value-class domains
   (which keywords?) need their own variables or oracles.
2. Contracts modeled per entry point leak at every new entry point: 8TGB's
   setProperty trigger left the entire declaration-block parse path
   unguarded. Storage-level invariants survive call-graph growth;
   call-site-level ones do not.
3. An oracle that lives outside the audit gates detects bugs but prevents
   none: valid-subset found KI-112 on its first font sweep, yet nothing in
   `proof.yaml` would have run it. Detection tooling must be wired into the
   gate, or it is documentation.
