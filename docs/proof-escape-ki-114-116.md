# Proof escape analysis: KI-114, KI-115 and KI-116 (border-image loss, MQ round-trip collapse, border-image fixpoint)

This is the Proof escape companion for the confirmed three-defect batch:

- **KI-114** — quoted-url `border-image` declarations are laundered into all-initial
  longhands at first parse and then omitted from cssText entirely
  (`url("x") 60` → `border-image` reads `none`, cssText serializes only the `border`
  shorthand); a second layer silently discards trailing slice components of even
  unquoted values (`url(x) 60` re-serializes as `border-image: url("x");`, slice lost).
- **KI-115** — `@media(not (x))and (r){…}` parses correctly on pass 1 (condition
  preserved), but the serialized conditionText drops the grouping parentheses around
  the negation, so feeding the sheet's own output back through `parse()` replaces the
  query with `'not all'`.
- **KI-116** — `.o{border-image:url()}` is not fixpoint-stable: pass 1 serializes
  `border-image: url("");` (five border-image-* longhands set), pass 2 collapses to
  `border-image: none;`, while `background:url()` round-trips identically — proving
  the inconsistency is implementation-specific.

All findings remain open and unfixed in `src/**`; each overlay reproducer asserts the
spec-honest contract and is expected to stay red until the product is repaired.

## Scope corrections vs the hunt briefing (recorded honestly)

1. **The briefed "KI-116" (`url( x)` laundered into a valid url token) is REFUTED and
   was not filed.** The current css-syntax-3 editor's draft in
   `submodules/csswg-drafts/css-syntax-3/Overview.bs#consume-url-token`
   (~line 1327, submodule at 2026-07-30) consumes leading whitespace BEFORE the token
   loop ("Consume as much whitespace as possible", then the per-code-point switch),
   so `url( x)` is a **valid** <<url-token>> with value `"x"`. Only *mid*-value
   whitespace followed by non-`)` code points yields bad-url. Our tokenizer matches
   the spec on every probed case: `url( x)` → `url:"x"` ✓valid, `url(x y)` →
   `bad-url` ✓, `url(x\ny)` → `bad-url` ✓, `url(x(` → `bad-url` ✓, `url(a"b)` →
   `bad-url` ✓, `url(a\\)b)` → `url:"a\"` ✓. Do not re-file this. (HYP-B1 refuted.)
2. **The briefing's KI-115 secondary case ("bare `@media (x){}` — browsers emit not
   all") is also refuted by local WPT**: `test_media_queries.html`'s
   `expression_should_be_unknown` machinery requires unknown-but-valid features to
   stay *parseable* (`mediaText != "screen, not all"`); replacing them with
   'not all' would fail that fixture. Our `(x)` preservation is spec-correct and is
   pinned as a green control inside the KI-115 reproducer. Only the grouped-negation
   round-trip collapse is a defect.
3. **Numbering**: because the briefed KI-116 did not survive validation, the batch
   files contiguously as KI-114/KI-115/KI-116 (the briefed KI-117 became KI-116).
   No ID gap was left deliberately.
4. **KI-114 / KI-116 merge decision**: kept separate despite a shared proximate
   trigger surface (expandBorderImage failing to recognize the function-token form
   of `url(...)` that our own serializer emits). Rationale: they violate different
   contracts at different layers — KI-114 is first-parse data loss of a retained,
   grammatically valid declaration (cssom-1 #serialize-a-css-declaration-block has no
   omission step; #parse-a-css-declaration-block licenses dropping only grammar
   failures) observable without any second parse, while KI-116 is a serialization
   fixpoint violation (css-syntax-3 #serialization round-trip mandate) whose minimal
   repro never involves the `border` shorthand. One fix likely closes both; the KIs
   remain independently assertable and are cross-referenced in both yaml notes.
5. **HYP-E refuted** (per briefing, confirmed): important-whitespace normalization is
   spec-mandated by cssom-1 #serialize-a-css-declaration (single SPACE joining);
   do not re-file. **HYP-D deferred** as a cosmetic internal-oracle item, out of
   scope for this correctness batch.

Evidence was captured with the documented custom Proof binary at `/tmp/proof-dx/proof`
(0.1.0-dev, DX-042) and Node v24.11.1. Each reproducer was run twice before filing —
all six runs exited 1 for the asserted reasons:

```text
KI-114  run 1 exit 1    7 tests: 3 green controls (WPT rows .a/.b/.c verbatim), 4 defect failures
KI-114  run 2 exit 1   identical counts
KI-115  run 1 exit 1    7 tests: 5 green controls (mq-invalid-media-type rows + scope pins), 2 defect failures
KI-115  run 2 exit 1   identical counts
KI-116  run 1 exit 1    5 tests: 2 green controls (background:url() stability), 3 defect failures
KI-116  run 2 exit 1   identical counts
```

`proof evidence capture` then re-executed each reproducer a third time and stamped
`proof/evidence/ki-114.yaml` / `ki-115.yaml` / `ki-116.yaml`
(`observed_result: known_issue_reproduced`); freshness sha256 verified against
`sha256sum` of the final reproducer bytes (all three FRESH).

Requirement anchoring: no existing requirement covers these contracts, so three
narrowly-modeled informal drafts were created through `proof req new` under the
fidelity-family parent `STK-REQ-260821-BQKD`: `SYS-REQ-260823-1V3K` (KI-114),
`SYS-REQ-260823-EEQN` (KI-115), `SYS-REQ-260823-BNDX` (KI-116). They are intentionally
**informal** (prose + spec references, no FRETish variables): formalizing needs new
cssom component variables, and declaring them requires editing
`specs/system/variables/cssom.vars.yaml`, which this batch may not touch while it is
concurrently owned. Whoever owns the vars file next should add e.g.
`border_image_source_recognized`, `slice_component_applied`,
`declaration_omitted_from_serialization`, `media_condition_grouping_preserved`,
`serialization_fixpoint_stable`.

## KI-114 — quoted-url border-image laundering and silent slice drop

Reproducer: `proof/reproducers/KI-114-border-image-declaration-lost-overlay-260823.ts`
Requirement: `SYS-REQ-260823-1V3K` (newly drafted)
Spec anchors: css-backgrounds-3 `#borderimage` (`<'border-image-source'> ||
<'border-image-slice'> …` makes `url("x") 60` valid); css-syntax-3 §4.3.6
`#consume-ident-like-token` (quoted urls arrive as function tokens named `url`);
cssom-1 `#parse-a-css-declaration-block` step 3.1 (drop licensed only for grammar
failures); cssom-1 `#serialize-a-css-declaration-block` (~line 2523 — declaration
loop has no omission step; its `<wpt>` block lists
`css/cssom/border-shorthand-serialization.html`). WPT: that fixture's rows .a/.b/.c
are reproduced verbatim as green controls; the defect legs model row .b with the
quoted-url authoring form.

Root subsystem: `expandBorderImage` (`src/shorthands.ts` ~955–1001) recognizes only
token-type `url` sources and gradient functions, so the quoted function-token form
silently leaves `source = none`; trailing components (`60`) are discarded without
invalidating the partial expansion. `contractBorderImage` then legitimately reports
`none` for the all-initial stamp, and `contractBorder`'s suppression guard never
fires because the laundered longhands look initial — so `border` reconstructs while
the author's border-image vanished. Note the guard itself is correct: WPT row .b
(gradients survive) passes today, which is exactly why the escape is invisible to any
check that only samples gradient inputs.

Why it escaped: value-form blindness. The corpus's shorthand obligations gate on
arity/count variables (`box_side_count <= 4` family), and every fixture lane feeds
unquoted urls or gradients — no modeled row ranges over *token vs function form* of
an image source, and no obligation says "the serialization output must contain every
retained declaration". The valid-subset oracle lane catches dropped valid values when
it sweeps `^border-image$` with quoted-url generators, but nothing runs it in-gate
(see proposed lanes).

Correction locus: cssomnom overlay/model first (the draft names the retention +
no-omission contract; tripwires are the four red legs). Proof engine second: the
form-asymmetry class needs either a variable ranging over source token forms or an
oracle wired into the gate (below).

### Proof autonomy plan

How a fresh `proof audit` session catches this class unaided:

- **(a) Requirement + MC/DC decision rows that must exist.** Requirement:
  `SYS-REQ-260823-1V3K`. Needed spec-MC/DC rows once formalized:
  - `reconstruct_shorthand skips non-initial reset-only` — border shorthand
    reconstruction suppressed when any border-image-* longhand is non-initial
    (currently witnessed only via gradient inputs).
  - `expand_border_image recognizes function-form url source` — TRUE branch for
    function tokens named `url` (the quoted form), FALSE branch leaving none.
  - `expand_border_image applies or invalidates trailing slice` — both branches:
    slice applied to `border-image-slice`, or whole declaration invalidated;
    the current silent-drop branch must be uncovered-by-design (i.e. removed).
  - `declaration_loop omits nothing` — serialization emits every retained
    declaration (shorthand-folded or individual).
- **(b) Witness test file (named follow-up, deliberately NOT created in this
  batch):** `tests/border-image-function-source-retention-witness.test.ts` —
  after the vars file frees up, compile `SYS-REQ-260823-1V3K` to FRETish and bind
  this witness so the rows above have executing evidence.
- **(c) Harness lane + proof.yaml wiring (proposal only — proof.yaml untouched).**
  Extend the fuzz oracle lane `fuzz/oracles/valid-subset.ts` with a border-image
  generator profile that samples BOTH url forms (token `url(x)`, function
  `url("x")`) plus optional numeric slices, asserting survival + cssText
  containment; wire as a `fuzz_oracle` check entry running a fixed-seed budget
  (e.g. `--filter '^border-image$' --per-property 40`) failing on any finding.

## KI-115 — conditionText serialization breaks MQ grammar round-trip

Reproducer: `proof/reproducers/KI-115-media-condition-roundtrip-collapse-overlay-260823.ts`
Requirement: `SYS-REQ-260823-EEQN` (newly drafted)
Spec anchors: mediaqueries-4 `#mq-syntax` (`<media-not> = not S* <media-in-parens>`
is complete; cannot take an and-chain — so `not (x) and (r)` standalone is
grammar-invalid while `(not (x)) and (r)` is valid); mediaqueries-4
`#error-handling` (~line 1031, replacement with 'not all' happens during parsing);
css-syntax-3 `#serialization` (round-trip mandate). WPT:
`css/mediaqueries/mq-invalid-media-type-005.html` assertion style reused for the
pass-2 leg; `test_media_queries.html` parseability predicate pins the green scope.

Root subsystem: the MediaParser/serializer flattens the nested condition tree when
reconstructing conditionText, dropping the grouping parentheses that carried the
negation. Pass 1 is correct (valid input, merely unknown-evaluating); the serializer
is the defective half.

Why it escaped: the media lane models media queries as flat type+feature lists
(cssom-1's own legacy `#serialize-a-media-query` algorithm is flat too), so no
modeled structure ever distinguishes "grouped negation" from "negated whole query".
Round-trip obligations exist for declarations (cssText) but no requirement states
that conditionText must re-parse to an equivalent query. The fuzzer found it
(`fixpoint-unstable` on `@media(not (x))and (r)`) but no audit gate consumes that
lane.

Correction locus: overlay/model (draft `SYS-REQ-260823-EEQN` names the round-trip
contract). Engine idea (not implemented): a serialize→re-parse differential oracle
for every at-rule prelude the parser accepts, asserting semantic equality of the
second parse.

### Proof autonomy plan

- **(a) Requirement + MC/DC decision rows.** Requirement: `SYS-REQ-260823-EEQN`.
  Rows needed once formalized:
  - `serialize_media_condition preserves grouping under negation` — TRUE when a
    nested `not` term is serialized with its parens; FALSE branch (flattened
    output) must be unreachable.
  - `serialized_condition_reparse_matches_source_query` — differential row:
    parse∘serialize∘parse ≡ parse for every accepted @media prelude.
  - `grammar_invalid_query_replaced_with_not_all_during_parsing` — keeps the
    mq-invalid-media-type behavior distinct from the round-trip failure mode.
- **(b) Witness test file (follow-up, not created here):**
  `tests/media-condition-roundtrip-fixpoint-witness.test.ts`.
- **(c) Harness lane + wiring (proposal only).** Extend the fuzz grammar
  generation lane (`fuzz/oracles/valid-subset.ts` MQ profile) to emit grouped
  boolean conditions (`not (...)`, `(...) and (...)`, mixed nesting) and add a
  `fixpoint_oracle` step asserting two-cycle stability of `conditionText`/
  `media.mediaText`; wire as a `fuzz_oracle` check with a fixed seed in
  `proof.yaml` (proposal only).

## KI-116 — border-image:url() fails the one-cycle serialization fixpoint

Reproducer: `proof/reproducers/KI-116-border-image-url-fixpoint-overlay-260823.ts`
Requirement: `SYS-REQ-260823-BNDX` (newly drafted)
Spec anchors: css-syntax-3 `#serialization` ("parsing the stylesheet must produce
the same data structures as parsing, serializing, and parsing again");
css-backgrounds-3 `#borderimage` (empty <<url>> is a valid source);
cssom-1 `#serialize-a-css-declaration-block`. Property-specific control:
`background:url()` is stable across cycles, so the instability cannot be inherent
syntax ambiguity. Merge analysis vs KI-114: see Scope correction 4 above.

Root subsystem: serializer emits the quoted function form `url("")`;
`expandBorderImage` accepts only token-form sources; second parse therefore stamps
initial longhands and `contractBorderImage` reconstructs `none`. Same blindness as
KI-114, expressed through the round-trip lens instead of the first-parse lens.

Why it escaped: identical to KI-114 (no modeled row ranges over source forms) plus
no general fixpoint obligation: nothing in the model states that
parse(serialize(parse(x))) ≡ parse(x) for declaration blocks, so a shorthand that
changes meaning across cycles trips no alarm.

Correction locus: overlay/model. The draft names the fixpoint contract with
`border-image:url()` as its minimal witness.

### Proof autonomy plan

- **(a) Requirement + MC/DC decision rows.** Requirement: `SYS-REQ-260823-BNDX`.
  Rows needed once formalized:
  - `declaration_block_serialization_reaches_one_cycle_fixpoint` — TRUE when
    cssText re-parses to equal structures; FALSE branch must be unreachable for
    every accepted declaration.
  - `expand_border_image recognizes function-form url source` (shared with
    KI-114's plan; one compiled row can serve both requirements' witnesses).
- **(b) Witness test file (follow-up, not created here):**
  `tests/serialization-one-cycle-fixpoint-border-image-witness.test.ts`.
- **(c) Harness lane + wiring (proposal only).** Checked-in edge-corpus entries
  for url forms (`url()`, `url("")`, `url("x")`, `url(x) 60`, `url( x )`,
  `url(x y)` bad-url contrast) in the parser edge corpus consumed by audit, plus
  a generic `fixpoint_oracle` proposal: run every corpus sample through
  parse→serialize→parse and fail on structural divergence; wire as a
  `fuzz_oracle`-style check in `proof.yaml` (proposal only — not edited here).

## Proposed permanent lanes

1. Wire the valid-subset oracle (`fuzz/oracles/valid-subset.ts`) into `proof.yaml`
   as a fixed-seed check; today it detects these classes but gates nothing.
2. Add the two-cycle fixpoint oracle (declarations AND at-rule preludes) so
   round-trip collapses fail mechanically.
3. When the cssom vars file frees up: declare the five variables named above,
   compile the three drafts from informal to FRETish, and bind the named witness
   tests so the MC/DC rows range over value/token forms, not just arity.

## Batch-level lessons

1. Serializers and expanders must agree on token forms: anything the serializer
   emits is, by definition, an input the expander will later receive. Asymmetry
   there produces both data loss (KI-114) and instability (KI-116).
2. Flat legacy models (cssom-1's flat media-query serialization, arity-only
   shorthand gates) cannot represent nested/grouped constructs; escapes cluster
   exactly where the model's shape differs from the grammar's shape.
3. A finding that dies during validation (briefed `url( x)` laundering; bare
   `(x)` divergence) is recorded here and in yaml notes rather than filed —
   keeping the campaign count honest matters more than the raw total.
