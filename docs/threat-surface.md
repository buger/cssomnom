# Threat Surface Analysis — cssomnom

> Companion narrative for `proof/surfaces/threat-surface.yaml`.
> Method: answer the 12-question ladder against repository evidence; every
> machine-core entry anchors to a section here. Judgment lives in prose;
> accountability lives in YAML.
>
> Analysis date 2026-08-25 · fresh-onboarding pass (blind: prior hunt conclusions excluded).

## 1. Artifact posture

cssomnom is a zero-dependency, pure-TypeScript CSS parser library (`package.json`: name `cssomnom`, `type: module`, engines node ≥24.11). Its promise set, from README: **spec-compliant** CSS Syntax 3 / CSSOM-1 / Nesting / Selectors 4 / Media Queries 4 / Houdini Typed OM parsing and query in Node.js without a browser; a **standard W3C CSSOM object model** rather than a custom AST; deterministic cascade for graders; and an explicit refusal to fake `getComputedStyle` ("if it cannot be completely correct, partially correct is harmful").

What it does with invalid input is *surface-specific*, and that split is the single most important hunting fact on day one. Six surfaces probed directly (probes p1–p5, quoted in §10):

| Surface | Posture | Evidence |
|---|---|---|
| Stylesheet ingest (`parse`, `replaceSync`, Parser API list parses) | **recover-drop**, never throws on content | p1: `'@unknown-rule x{; color:red} }}} <<<>>> @media'` → 2 rules kept, no exception |
| `insertRule` | **throw** (`SyntaxError`, plus IndexSize/HierarchyRequest/NotAllowed/Security) | p2/B1: `'garbage'` → `SyntaxError`; guard chain at `src/CSSOM.ts:405-461` |
| `setProperty` / `cssText` | **ignore** invalid silently — and *leniently* | p2/C1: `setProperty('color','totally not a color')` is **kept**; only narrow classes (bad-string/bad-url, unitless lengths, negative dimensions) are rejected by `ParseHooks.validatePropertyValue` |
| `selectorText` setter | **ignore** | p2/D1: assigning `'>>>bad<<<'` leaves selectorText unchanged |
| `matches` / `querySelectorAll` | **forgiving swallow** — never throws | p3/E1–E3: `'div:'` → false, `'::??'` → [] (DOM would throw `SyntaxError`; README documents no such deviation) |
| Typed OM `CSSNumericValue.parse` / `CSSStyleValue.parse` | **throw** `SyntaxError` DOMException / `TypeError` respectively | p4/G2,G3,G5,G6 |

The leniency of `setProperty` (C1) and the silent forgiveness of the matcher are the two postures most likely to hide real defects, because both look like "working as intended" in green test runs while diverging from browser behavior.

## 2. Transformation boundaries

Every boundary is text → tokens → component values/rules → CSSOM or Typed OM objects → back to text, and each emit direction has a serializer (`src/serializer.ts`, `serializeDeclarations`, `serializeSelectorList`, `MediaParser.serializeMediaQuery`). The critical nuance: **no serializer is an inverse in the identity sense** — they are canonicalizers:

- `serialize()` lowercases function names, trims `url( … )` whitespace, strips `counter(x, 'decimal')`'s default style and `attr(|x, "")` fallbacks (`serializer.ts:187-252`), and inserts `/**/` comment separators where re-tokenization would merge tokens (required by cssom-1 § 2.1 serialization principles). Probe p5 confirms output is a fixpoint after one application but not equal to input.
- Typed OM `toString()` canonicalizes units (`calc(1in + 96px)` → `192px`) while deliberately preserving math-tree structure (README deviations).

So the assertable relation at every boundary is **round-trip fixpoint**: `f(f(x)) == f(x)` and re-parse(serialize(ast)) ≡ ast — not string equality with the original. Any hunt that asserts byte-identity will drown in false positives from intended canonicalization.

Two boundaries have *duplicated implementation* rather than shared code: preprocessing lives twice (`tokenizer.ts:41-52` sync, `streaming-tokenizer.ts:118-144` chunked with remnant buffering for CR and lone high surrogates). That duplication is a standing invitation for divergence.

## 3. Stateful objects & lifecycles

Four objects carry mutation-sequence-sensitive state (yaml §stateful_objects):

1. **PropertyRegistry's module-global Map** (`PropertyRegistry.ts:298`) — `registerProperty`, `@property` rules parsed from *any* stylesheet, `unregisterProperty`, and `clear()` all mutate one process-global table. Sequence bugs here contaminate unrelated tests/parses.
2. **CSSStyleSheet flags** (constructed / disallow-modification / origin-clean, `CSSOM.ts:295-315, 344-367`) — legal operations depend on transition history (`replaceSync` on a non-constructed sheet → NotAllowedError).
3. **CSSStyleDeclaration** — dual `_declarations` array + `_declMap`, shorthand fan-out via recursive `setProperty(notify=false)`, and an `_onChange` invalidation hook. The code itself documents a past bug of exactly this class ("Drop a stored `all` … deleting first made a later invalid setProperty empty cssText", line 524-529) — treat this object as the highest-prior-probability location for sequence bugs.
4. **StreamingTokenizer** — `getTokens()` *drains* the queue and truncates the consumed buffer; interleavings of `appendChunk`/`getTokens` change index bases, and `close()` gates EOF semantics.

Plus the import-time `ParseHooks` injection (`parser.ts:2068-2081`) — a global wiring whose correctness depends on import order (architecturally mandated by AGENTS.md to break circular deps).

## 4. Environment-dependent outputs

- **Media evaluation** fabricates an environment when none is supplied (`MediaParser.evaluate(query, env?)`, defaults resolution 96dpi, blending 'opaque'; `MediaParser.ts:788-816`). Conformance claims about `(resolution)` etc. are only meaningful per-env — `docs/css-domain-models.md` already pins dpi ∈ 0..9600.
- **baseURL resolution sniffs host globals**: the constructor reads `globalThis.document?.baseURI` / `globalThis.location?.href` before falling back to `about:blank` (`CSSOM.ts:303-313`). Identical options produce different `href`s depending on whether a host injected globals — an environment-coupled output inside a supposedly hermetic library.
- **`env()` substitution and cascade** need caller-supplied maps/mocks by design (ruling: defer/refuse; README non-goal covers computed style).

Ruling summary recorded in yaml: implement-and-document for media defaults and baseURL sniffing; refuse for layout-dependent outputs.

## 5. Grammar & tables

The valid-input grammar lives in three layers, all machine-generated and therefore cheap to exploit for *both* directions of generation:

1. **Generated data tables** under `src/data/gen/` (`properties.ts`, `shorthands.ts`, `standard-syntax.ts` with per-property value-syntax strings, `units.ts`, `media-features.ts`, `selectors.ts`, `math-functions.ts`, `colors.ts`) regenerated from mdn-data/@webref/css via `scripts/codegen/generate_all.ts` (`pnpm codegen`).
2. **Interpreters over those tables**: `PropertyRegistry.matchesSyntax(tokens, syntax)` (`PropertyRegistry.ts:167`) and `ParseHooks.validatePropertyValue`.
3. **The css-syntax-3 token grammar** itself in `AbstractTokenizer.ts`, including defined bad-token variants.

This is the ideal engine for a two-sided fuzzer: sample valid values *from syntax strings* (valid-sampling), then apply single-token mutations and assert each ingestion surface rejects them (invalid-mutation) — modulo documented leniency classes (var/env/calc-containing values bypass validation by early return; custom properties accept nearly anything per css-variables-1). Domain tables in `docs/css-domain-models.md` (at-rule dispatch mutex, position arity reification grid) supply ready-made edge cells.

## 6. Failure ledgers & corpora

Ledger inventory with ownership/staleness (details in yaml):

- **`tests/fixtures/baselines/ownership.json` + `unclaimed-inventory.json`** — the only ledger that assigns owners: claims map baseline entries to KI ids (e.g., entry → KI-38, kind open-KI). But `unclaimed-inventory.json` is ~508KB of entries with **no owner** — the largest unowned backlog visible on day one.
- **Passing-set baseline** (`wpt-passing-set-baseline.json`, 778 entries, mtime 08-24), enforced exactly by `wpt:verify`.
- **Known-failure sets** (wpt-cssom / wpt-sandbox / lightning, 08-24).
- **`wpt-progress.md`** — aggregate log; last row 2026-08-18, i.e. 7 days stale relative to today, matching README's embedded table.
- **`proof/vectors/*.yaml`** — 7 P1 vectors, all `status: unresearched`, dated ~08-21. Nobody has executed them.
- **`proof/checklists/onboard_v1.state.yaml`** — fresh (updated today 10:19Z); hazard step confirmed, coverage/history-mine pending.

Net judgment: ledgers exist, are recent (≤1 week), and ownership is *partially* tracked — differential testing against recorded expectations is immediately feasible because harness + fixtures + verify gate are already wired (`wpt:*` scripts, external fixture JSONs frozen at repo seed 08-21).

## 7. Armed oracle families & equivalence contracts

One family is genuinely **armed** (harness executes it today): the WPT recorded-expectation differential (P0). Its contract: subtest-level scalar pass/fail equality against `tests/fixtures/wpt/*.json` and the passing-set baseline; exclusions = browser-only manifest, README-documented intentional deviations (e.g. `CSSImportRule.styleSheet` empty-not-null), upstream WPT churn after submodule upgrades.

Six families are **proposed**, each with a full equivalence contract in yaml (they may not arm until their contract questions are settled). The two highest-yield relational oracles:

- **Serializer fixpoint** (P1): assert `s1 == s0` where `s0 = serialize(tokenize(x))`, `s1 = serialize(tokenize(s0))` — *not* `s0 == x`. Known FPs: all intentional canonicalization listed in §2. The bug signal this family catches is non-convergence: canonical forms that re-parse differently than they serialize.
- **Sync-vs-streaming tokenizer equivalence** (P1): every chunk-splitting of `x` must yield identical `(type, value)` streams and concatenated originalText vs `tokenize(x)`. Known FPs: positional fields differ across chunkings by design. This targets the duplicated preprocessing implementations directly.
- Also proposed: **posture-consistency triage** (same malformed text classified consistently across ingest/insertRule/setProperty per the declared posture table; any uncaught RangeError/TypeError-from-internals is a finding at any depth), **grammar-table-driven rejection completeness** (valid samples accepted, mutants rejected, minus whitelisted leniency), **shorthand↔longhand expansion equivalence** (excluding var()-containing values where store-as-is is correct), and **selector forgiveness containment** (valid members of mixed lists still match; fully-invalid lists never throw).

Contracts-before-oracles discipline matters here especially: three of these families (fixpoint, triage, grammar completeness) would otherwise generate floods of "findings" that are actually documented deviations.

## 8. Degenerations

None. All twelve ladder questions were applicable to this artifact and are answered above/in yaml; the yaml records `degenerations: []` with an explicit ladder-check comment so silence cannot be misread. The closest candidate was Q9 (resource bounds) — it did not degenerate, because probing produced the sharpest finding of this analysis (§9).

## 9. Vector candidates

Twelve proposals (`PROPOSED-*`, named in yaml `vectors_proposed`, dispositions recorded in the reconciliation table below). Rationale, one line each:

1. **PROPOSED-parser-recursion-depth-rangeerror** — *confirmed by probe*: `parse()` throws uncatchable-in-spirit `RangeError: Maximum call stack size exceeded` on ≥~1000 nested blocks on default Node stack (p6); tokenizer alone survives 50k depth iteratively (p7), isolating the recursion to the parser's consume algorithms. Extends existing unresearched V-RECURSION-DEPTH with concrete evidence. Highest-severity lead: stylesheet ingest promises recover-drop, and a malformed deeply-nested file crashes instead.
2. **PROPOSED-serialize-fixpoint-nonconvergence** — serializer canonicalization means round-trips are fixpoints; hunt for inputs where the fixpoint is not reached (family §7b).
3. **PROPOSED-csstext-roundtrip-drift** — parse→`cssText`→re-parse drift via shorthand expand/contract asymmetry (the object with a documented past bug of this class).
4. **PROPOSED-setproperty-lenient-acceptance** — `color: totally not a color` is kept (p2/C1); systematically diff acceptance against generated syntax tables to map the true rejection boundary.
5. **PROPOSED-selector-forgiveness-swallow** — matcher returns false/[] instead of DOM SyntaxError and skips `invalid-selector` nodes mid-list; classify deviation-vs-gap per selectors-4 forgiving contexts.
6. **PROPOSED-global-registry-sequence-contamination** — global PropertyRegistry Map mutated by both API calls and ordinary stylesheet parsing; hunt register/re-register/@property/unregister orderings.
7. **PROPOSED-streaming-chunk-split-equivalence** — every-chunk-splitting differential between StreamingTokenizer and `tokenize`, targeting the duplicated CR/high-surrogate remnant logic.
8. **PROPOSED-media-default-env-drift** — evaluate() results depend on fabricated env defaults and undocumented host context; pin the default matrix so conformance claims aren't environment-confounded.
9. **PROPOSED-posture-triage-inconsistency** — same malformed text takes different verdicts across the three ingestion postures beyond legitimate layer-context differences.
10. **PROPOSED-sync-stream-preprocess-divergence** — direct differential on the two independent § 3.3 preprocessing implementations (NUL/FF/CR/lone-surrogate cases).
11. **PROPOSED-shorthand-longhand-expansion-equivalence** — expansion equivalence incl. logical-property aliasing via LogicalMapping (var()-containing values whitelisted).
12. **PROPOSED-selector-backtracking-cost-blowup** — matcher uses recursive backtracking combinator evaluation (`matcher.ts:185+`); adversarial selector + tree shapes may exhibit super-linear cost, complementing V-DOS-PARSE.

### Reconciliation (schema v1, 2026-08-25)

The numbered list above is the verbatim blind-day record. Ground-truth reconciliation
against the filed ledgers (`proof/known-issues/`, `proof/vectors/`) disposed of each
proposal; the annotated `{id, reconciliation}` entries now live in yaml
`vectors_proposed`:

| Proposal | Disposition |
|---|---|
| PROPOSED-parser-recursion-depth-rangeerror | **Already covered** — existing vector `V-RECURSION-DEPTH` (still unresearched) + filed KI-18; blind probe evidence appended to the vector's notes |
| PROPOSED-serialize-fixpoint-nonconvergence | **New vector** `V-SERIALIZATION-FIXPOINT` (P1; serialization-round-trip-stability obligation, registered builtin class `encoding_safety`) |
| PROPOSED-csstext-roundtrip-drift | **New vector** `V-SHORTHAND-EXPANSION-EQUIVALENCE` (P2; folds the drift proposal and the shorthand↔longhand equivalence oracle family) |
| PROPOSED-setproperty-lenient-acceptance | **Already covered** — filed KI-124 (+ requirement SYS-REQ-260825-4R9S) |
| PROPOSED-selector-forgiveness-swallow | **New vector** `V-SELECTOR-FORGIVENESS-DIVERGENCE` (P2; README deviation stance to be verified at filing time) |
| PROPOSED-global-registry-sequence-contamination | **New vector** `V-REGISTRY-SEQUENCE-CONTAMINATION` (P2) |
| PROPOSED-media-default-env-drift | **New vector** `V-MEDIA-DEFAULT-ENV-DRIFT` (P3) |
| PROPOSED-posture-triage-inconsistency | **New vector** `V-CROSS-SURFACE-POSTURE-TRIAGE` (P2) |
| PROPOSED-sync-stream-preprocess-divergence | **Not a vector** — test lane `sync-stream-tokenizer-equivalence` |
| PROPOSED-streaming-chunk-split-equivalence | **Not a vector** — same test lane `sync-stream-tokenizer-equivalence` (chunk-split facet) |
| PROPOSED-shorthand-longhand-expansion-equivalence | **Not a vector** — test lane `shorthand-longhand-expansion-equivalence` |
| PROPOSED-selector-backtracking-cost-blowup | **New vector** `V-SELECTOR-BACKTRACKING-COST` (P2, flagged needs-verification in its description) |

### Schema v1 tunings applied

`proof/surfaces/threat-surface.yaml` moved from `schema_version: 0` to `1`, preserving
the blind content verbatim and formalizing what the blind run improvised: a new
top-level `resource_bounds:` section is the home for ladder Q9 answers (populated from
this analysis' own p6/p7 probes and linked to V-RECURSION-DEPTH + KI-18); every entry
type now carries optional `grounding:`; `grammar_tables` rows require two derived-family
declarations (`drives_valid_sampling` + `drives_rejection_completeness`, valued with a
family name or `none-yet`, superseding the v0 boolean flags);
non-vector proposals moved to a new `test_lanes:` section (lane / arming_status /
contract_ref); and three lanes the blind run missed were added to `oracle_families`
tagged `source: schema-v1-tuning` so they stay distinguishable from the original record:
the token-conservation partition invariant, grammar-table valid-subset sampling, and the
identifier-escape round-trip relation.


## 10. Method notes

**Question order pursued:** structure recon (tree, package.json, index.ts exports, README) → Q1 postures (code reading + probes) → Q2 serializers → Q9 bounds (probes, promoted after the RangeError finding) → Q3 stateful lifecycles → Q4 environment coupling → Q5 grammar tables → Q6/Q11 ledgers & corpora → Q7 oracle contracts → Q8 metamorphic relations → Q10 interop tier (folded into yaml surfaces + §1) → Q12 vector synthesis.

**Artifacts consulted:** README.md; AGENTS.md; package.json; CONTRIBUTING.md (listing only); src/: index.ts, parser.ts (entry points, ParseHooks injection, error collection), tokenizer.ts, streaming-tokenizer.ts, AbstractTokenizer.ts (via grep), serializer.ts (canonicalization sites), CSSOM.ts (guards, insertRule, baseURL), CSSStyleDeclaration.ts (setProperty/expansion), matcher.ts, parser-api.ts, css-escape.ts, PropertyRegistry.ts, MediaParser.ts (evaluate/env), typed-om numeric + style-value parsers; src/data/gen listing + standard-syntax/properties heads; scripts/codegen listing; docs/threat-surface.md (schema), docs/proof-onboard-research.md, docs/css-domain-models.md; wpt-progress.md head; tests/ directory structure + tests/fixtures/{baselines,external,wpt} listings and JSON metadata (counts, mtimes, ownership sample); proof/vectors/*.yaml; proof/catalog/domain/no_external_io_on_parse.yaml + semantic-scan.json; proof/checklists/onboard_v1.state.yaml; spec sources cited via anchors only (cssom-1 § 2.1/§ 3, css-syntax-3 § 3.3/§ 4, mediaqueries-4 #error-handling, css-values-4 § 4.1).

**Probes run** (all ≤20 lines, <2s, `/opt/node24/bin/node` v24.11.0 against `src/index.ts` ESM):
- p1 stylesheet-ingest garbage recovery → 2 rules kept, invalid declarations dropped.
- p2 mutation APIs → insertRule SyntaxError; setProperty keeps `totally not a color`; custom-prop `--weird` rejected; selectorText ignores invalid. *Probe correction recorded honestly:* my initial B3 call omitted the index argument (defaulted to 0, returned 0); on re-grounding by reading `CSSOM.ts:413-419` the IndexSizeError guard exists and works — probe artifact, not a library gap.
- p3 matcher + escape → forgiving swallow confirmed; escape TypeError-on-zero-args, coerces null→`"null"`.
- p4 Typed OM → DOMException/SyntaxError and TypeError postures confirmed.
- p5 round-trip → url() whitespace canonicalized; idempotent on second pass.
- p6/p7 nesting → RangeError at depth ≥1000 (default stack), max-safe 2000 under `--stack-size=2000` (~linear stack/level); tokenize iterative, survives 50k depth.

**Exclusions honored:** opened none of fuzz/**, docs/proof-escape-*.md, PLAN.md, docs/proof-next-agent.md, LOOP.md, proof/known-issues/, proof/evidence/, .proof/, or any /tmp content other than my own probes (directory listings necessarily exposed filenames; no contents read). No accidental glimpses to disclose.

**Schema gaps this analysis hit** (for the next schema revision): the skeleton's `entry_surfaces` and `oracle_families` comments define no `grounding`/`note` slots even though rule 1 demands citations — grounding keys were added ad hoc; there is no home for measured resource bounds (Q9) or probe records (folded into narrative §9–10); `vectors_proposed` carries ids only, so rationales live here rather than in the machine core; and `degenerations` cannot express "checked, none N/A" without a comment convention.
