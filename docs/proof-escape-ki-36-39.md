# Proof escape analysis: KI-36, KI-37, KI-38 and KI-39 (shorthand table gap, comment descendant drop, cascade registry dead, calc fixpoint)

This is the Proof escape companion for the confirmed four-defect batch:

- **KI-36** — 122 of the 165 generated shorthands in `src/data/gen/shorthands.ts`
  are absent from the runtime expansion table `SHORTHANDS` (`src/shorthands.ts`
  ~L1943, 44 hand-written entries), so `setProperty('gap','10px')` never expands;
  longhand reads return `''` and persisted cssText keeps stale unexpanded
  shorthands beside their overrides (`row-gap` first then `gap` leaves
  `"row-gap: 30px; gap: 10px;"` with row-gap still reading `30px`).
- **KI-37** — a preserved comment in the descendant-combinator position drops the
  entire qualified rule: `parse('div/**/x{a:b}').cssRules.length === 0`, while
  `'div x'`, `'div > /**/ p'` and `'/**/div'` all parse. Root:
  `SelectorParser.skipWhitespace` (`src/SelectorParser.ts:102-106`) skips only
  whitespace tokens.
- **KI-38** — the cascade computed-value path never consults PropertyRegistry:
  unset registered `var()` yields no initial substitution, `inherits:false` leaks
  parent values into children, and `<length>`-invalid values (`--len:red`) pass
  through as `width:'red'`. Parser's own `#resolveVarFunction`
  (`src/parser.ts:1793-1826`) enforces all three — two resolvers disagree.
- **KI-39** — math serialization is not fixpoint-stable: a degenerate
  single-child Sum inside a Product serializes parenthesized
  (`calc((1px + 2px)` parsed → `.mul(3)` → `'calc((3px) * 3)'`; direct
  construction → `'calc(3 * (3px))'`), and its own output re-parses to a
  different tree (`'calc(9px)'`). All WPT cssMathValue serialization rows pass,
  so the hole is only reachable through typed-OM arithmetic on folded values.

All findings remain open and unfixed in `src/**`; each overlay reproducer asserts
the spec-honest contract and is expected to stay red until the product is repaired.

## Per-KI escape analysis

### KI-36 (generated shorthand table incomplete)

- **Proof check/gate that should have caught it**: the codegen pipeline already
  emits the complete table (`scripts/codegen/generate_shorthands.ts` →
  `src/data/gen/shorthands.ts`, 165 keys). A generated-data completeness lint —
  "every exported key of a `@generated` data module must be consumed by at least
  one runtime structure" (or an import-graph check that gen modules have ≥1
  non-test importer reading ALL keys) — would have flagged 122 dead keys on the
  first `pnpm run codegen` run.
- **Why it escaped**: codegen-vs-runtime divergence is never cross-checked by any
  audit check. The codegen gate validates that generation SUCCEEDS; nothing
  verifies the generated artifact is fully WIRED INTO the runtime. AGENTS.md's
  "Automation Over Hardcoding" contract is enforced socially, not mechanically.
- **Overlay vs engine correction**: this batch files overlay reproducers only;
  the engine correction is to drive `SHORTHANDS` from `SHORTHANDS_DATA` with
  generic two-/four-value expanders for families lacking bespoke expanders.
- **Engine regression idea**: after wiring, add a suite test asserting
  `Object.keys(SHORTHANDS_DATA).every(k => k in SHORTHANDS)` plus one
  expansion probe per shorthand family; wire it to fail when a future codegen
  run adds keys without runtime consumption.

### KI-37 (comment in descendant-combinator position)

- **Proof check/gate that should have caught it**: css-syntax-3 makes comments
  parse-inert ("preserved information must have no effect on the parsing step").
  A differential oracle — "parse(S) must equal parse(S with comments removed)"
  over a corpus of selector shapes — is exactly the kind of invariant the fuzz
  oracles already encode for other layers; none covers trivia-equivalence in
  selector parsing today.
- **Why it escaped**: existing selector fixtures use whitespace-only combinators;
  WPT selector parsing tests embed comments rarely, and our fixture extraction
  kept only rows whose inputs contain no comments between compound selectors.
  The implicit-descendant adjacency check is a hand-written fast path that no
  conformance row exercises with trivia.
- **Overlay vs engine correction**: engine fix is to treat `comment` tokens as
  ignorable trivia wherever `skipWhitespace` gates implicit-descendant handling.
- **Engine regression idea**: add a round-trip/trivia-sweep fuzz oracle that
  injects comments at every token boundary of a selector corpus and asserts
  rule-count and selector equivalence.

### KI-38 (cascade path ignores PropertyRegistry)

- **Proof check/gate that should have caught it**: the defect class is
  dual-resolver disagreement — the same registration honored by
  `Parser.#resolveVarFunction` but ignored by `resolveCustomProperties`. A
  consistency check asserting "for every registered custom property P and every
  declaration shape, parser-level substitution and cascade-level resolution
  agree" (a property-based cross-check over both entry points) would have caught
  it immediately; the acceptance suite tests each resolver separately and never
  cross-compares them.
- **Why it escaped**: dual-resolver disagreement is unmodeled — Proof tracks
  requirement coverage per component (cascade vs parser_api) but has no check
  that two implementations of ONE spec function stay behaviorally identical.
  Registration-time validation was tested (KI-111/KI-35 territory), creating the
  illusion that registry semantics were covered end-to-end.
- **Overlay vs engine correction**: engine fix routes cascade-path custom
  property resolution through the same registry-aware logic (initial value,
  inherits gating, syntax validation, invalid-at-computed-value-time mapping).
- **Engine regression idea**: golden cross-resolver test — for each registered
  probe property, assert `getCascadedStyle` result equals parser-path
  substitution result across unset/inherit/invalid legs.

### KI-39 (calc serialization not fixpoint-stable)

- **Proof check/gate that should have caught it**: serializer fixpoint is a
  standard algebraic property: `String(v) === String(parse(String(v)))`. The
  roundtrip-sweep fuzz oracle (`fuzz/oracles/roundtrip-sweep.ts`) exists but
  sweeps the plain parse()/cssText layer, which keeps calc() verbatim; the Typed
  OM math-value layer (where folding actually happens) has no fixpoint sweep.
  WPT cssMathValue serialization rows all pass because browsers serialize from
  canonical trees, not because our arithmetic path is checked.
- **Why it escaped**: the serializer-fixpoint property is asserted only where
  folding does NOT occur; the one layer that rewrites trees (typed OM
  simplification + degenerate-Sum wrapping in `style-value-factory.ts:44-46`)
  is exactly the layer no fixpoint property covers. Simplification tests assert
  VALUES (`9px`), never RE-SERIALIZABILITY of intermediate structures.
- **Overlay vs engine correction**: engine fix collapses single-child Sum/Product
  nodes during serialization or stops wrapping folded units in degenerate Sums.
- **Engine regression idea**: extend roundtrip-sweep to typed-OM math values —
  generate random calculation trees, assert `isFixpoint(v)` and that arithmetic
  results serialize to strings that re-parse to equal trees.

## Batch-level notes

- All four KIs were re-verified twice by independent processes before filing;
  every reproducer exited 1 twice pre-filing with positive controls green, plus
  once more under `proof evidence capture`.
- Citation corrections vs the research brief (verified against submodule .bs
  files): css-syntax-3 comment-preservation spans :3701-3704 (brief said
  :3701-3703); selectors-4 descendant-combinator definition is at :4281-4283
  (brief said :4284); css-properties-values-api #calculation-of-computed-values
  section starts at :202 (brief said :205-217); #initial-value-descriptor
  controlling sentence at :644-645; css-values-4 Sum node step :5306-5338 /
  Product node step :5340-5370 (brief said :5312/:5342). cssom-1
  #concept-declarations-specified-order (:2243-2245), css-gaps-1 #gap-shorthand
  (:236), css-transitions-1 (:510) and css-syntax-3 round-trip (:3710-3712)
  matched the brief exactly.
- Count correction: KI-36 headline says 121 missing in the brief; measured live
  at HEAD it is **122** (44 runtime vs 165 generated); the KI description uses
  the measured number.
- Reachability correction for KI-39: the briefed probe
  `parse('calc((1px + 2px) * 3)').toString() === 'calc(3 * (3px))'` does NOT
  reproduce verbatim at HEAD — plain parse()/cssText keeps calc() unfolded and
  stable. The defect reproduces through public Typed OM arithmetic instead
  (`CSSStyleValue.parse(...).mul(3)` → `'calc((3px) * 3)'`) and through direct
  public constructor composition (`'calc(3 * (3px))'`). Filed on the verified
  chain; the reproducer pins both shapes.

Evidence was captured with the documented custom Proof binary at `/tmp/proof-dx/proof`
and Node v24.19.0/v24.11.1. Requirements drafted: SYS-REQ-260823-SHX6,
SYS-REQ-260823-SCD7, SYS-REQ-260823-CRG8, SYS-REQ-260823-MFS9 — each with a new
registry variables file mirroring reproducer constants and tracing satisfies to
STK-REQ-260821-BQKD.
