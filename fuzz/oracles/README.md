# Fuzz Oracles — Output-Correctness Checking for a Recovery Parser

Status: dry-run triage infrastructure. Nothing in this directory mutates repo
state, files KIs, or gates CI on raw finding counts.

## Why these exist

`cssomnom` is a **recovery** parser: by design it never crashes on malformed
input — it recovers and keeps going. That makes classic fuzzing signals
(crashes, sanitizer hits, hangs) nearly useless here; a fuzzer that only
reports crashes will run forever and find nothing.

What a recovery parser *can* get wrong is its **output**: dropped rules,
mangled token streams, serialization that drifts when re-parsed. The oracles
in [`lib/invariants.ts`](lib/invariants.ts) assert *relations* that must hold
for **every** input, valid or malformed. A violation is a candidate bug even
when the input was garbage.

## The four oracles

| # | Oracle | Invariant | Finding kinds |
|---|--------|-----------|---------------|
| 1 | Fixpoint (`checkFixpoint`) | `serialize ∘ parse` is idempotent: re-parsing our own canonical output and re-serializing must reproduce it byte-for-byte; no rule count regressions; no throws | `fixpoint-unstable`, `rules-dropped-on-reparse`, `parse-threw`, `serialize-threw` |
| 2 | Conservation (`checkTokenConservation`) | css-syntax-3 § 4 tokenization partitions the preprocessed input exactly — content-token offsets are contiguous and `concat(token.originalText)` over **all** tokens *including* the trailing `<EOF-token>` reproduces the preprocessed string (css-syntax-3 § 3.3, § 4.3.1 [#consume-token](https://drafts.csswg.org/css-syntax-3/#consume-token), § 4.3.2 [#consume-comment](https://drafts.csswg.org/css-syntax-3/#consume-comment)) | `token-gap`, `token-overlap`, `text-loss` |
| 3 | Refixation (`checkTokenRefixation`) | Re-tokenizing the concatenated token text (over all tokens including EOF) yields the identical token sequence (the tokenizer is itself a fixpoint) | `token-refixate` |
| 4 | Streaming equivalence (`checkStreamingEquivalence`) | Chunked `StreamingTokenizer` ingestion produces the same `(type, originalText)` sequence as one-shot `tokenize()` | `stream-divergence` |

`checkInput(input, {streaming?, maxInputChars?})` runs all four and
returns `{inputLength, findings}`. `Finding{kind, detail, expected?, actual?,
offset?}` carries capped detail strings so reports stay heap-safe.

### Comments and the `<EOF-token>` (why trailing comments are not `text-loss`)

css-syntax-3 defines **no comment token**: "consume comments" runs as step 1 of
[#consume-token](https://drafts.csswg.org/css-syntax-3/#consume-token) (§ 4.3.1)
and [#consume-comment](https://drafts.csswg.org/css-syntax-3/#consume-comment)
(§ 4.3.2) *returns nothing* — a comment can never become part of the token
stream as its own token. The `<EOF-token>` is likewise conceptual (§ 5.3
[#parser-definitions](https://drafts.csswg.org/css-syntax-3/#parser-definitions))
with no width or span constraints.

This tokenizer folds consumed comment bytes into the `originalText` of the
**next** token — at end of input, into the EOF token, so e.g.
`tokenize('a{color:red} /* x */')` ends with an EOF token whose
`originalText` is `'/* x */'`. Preserving those bytes is explicitly allowed by
§ 8 [#serialization](https://drafts.csswg.org/css-syntax-3/#serialization) as
long as it has no effect on parsing.

Consequently the conservation oracle:

- runs the gap/overlap (`detectContiguityProblems`) check over **content tokens
  only** — the EOF sentinel stays out of structural assertions; and
- rebuilds the text via `rebuiltTextMatches()` over **all tokens including
  EOF**, requiring byte equality with the preprocessed input.

An input whose final token is a comment is therefore clean: `concat`
*including* EOF reproduces the input exactly, and a `text-loss` finding there
would be an oracle artifact, not a parser bug. Genuine byte loss still fires —
`rebuiltTextMatches` is unit-tested with synthetic token arrays that drop
bytes mid-stream and at the tail (`tests/fuzz-oracles.test.ts`).

`ORACLE_VERSION` was bumped to `fuzz/oracles v2` for this change: v1 sweep
reports counted these inputs as false-positive `text-loss` findings and are not
comparable to v2 output for that kind.

### Equivalence relation (why false positives stay low)

Oracle 1 compares **serialized canonical forms**, not ASTs. This matters:
spec-sanctioned lossy normalization (comment removal, whitespace collapsing,
case canonicalization — all legal per cssom-1 serialization rules) happens
once at stage *s1* and then *stays*. Because we compare s1 with s2 = serialize
∘ parse(s1), any difference is drift the parser introduced on its own output,
not a sanctioned normalization being misjudged. AST-level comparison would
flag every legitimate normalization; byte-level self-consistency does not.

## Tools

### `roundtrip-sweep.ts` — corpus sweep (dry-run triage)

```sh
node fuzz/oracles/roundtrip-sweep.ts --budget-ms 20000 --out /tmp/sweep.json
node fuzz/oracles/roundtrip-sweep.ts --corpus-dir some/dir --external --ci
```

Feeds an embedded edge-case corpus + `fuzz/css-fuzz` seeds (+ optional
external fixture dirs / `.css` file trees) through `checkInput` and emits a
clustered findings report. Exit 0 unless `--ci` is passed (then 1 if any
finding exists — for gating *curated* corpora only).

### `minimize.ts` — delta-debugging shrinker

```sh
node fuzz/oracles/minimize.ts --input repro.css --check conservation
cat repro.css | node fuzz/oracles/minimize.ts --stdin --check all
```

Generic greedy hierarchical delta-debugging: line-level passes, then
character-chunk passes over sizes `[64,32,16,8,4,2,1]`, repeated to fixpoint
or `maxEvals` (default 4000). Deterministic. Prints JSON
`{originalLen, minimizedLen, evals, ok, findingKinds, minimized}`.
`--check` selects which finding kinds count as "interesting"
(`fixpoint|conservation|refixate|streaming|all`; streaming equivalence runs
only for `all`/`streaming`).

### `valid-subset.ts` — grammar-valid declarations must survive

```sh
node fuzz/oracles/valid-subset.ts --per-property 3 --seed 20260823 \
     --filter '^font' --budget-ms 60000 --max-findings 200 --out report.json
```

Samples values from each property's standard value-definition syntax
(css-values-4 § "Value definition syntax") via
[`lib/grammar-gen.ts`](lib/grammar-gen.ts), wraps them as `.o{prop:value};`
snippets, and asserts:

1. **Survival** — `parseDeclarationValue(snippet, prop)` returns non-empty.
   Only asserted for properties in `SUPPORTED_PROPERTIES`
   (`src/data/gen/property-list.ts`); sampled-but-unsupported properties are
   counted in `unsupportedSampled` and never produce findings (anti-
   false-positive rule).
2. **Fixpoint** — every `checkFixpoint(snippet)` finding is forwarded.

Always exits 0 (triage tool).

## Pipeline policy (raw counts never count)

Findings from these tools are **candidates**, not bugs. The pipeline is:

1. **Dry-run triage** — sweep / valid-subset produce clustered reports.
2. **Minimize** — shrink each representative to a minimal reproducer with
   `minimize.ts`.
3. **Cluster** — group minimized reproducers by root cause, not by symptom;
   dedup aggressively.
4. **Spec validation** — validate each cluster root against the normative spec
   text (`submodules/csswg-drafts/...`) via the Scrutineer flow before
   believing it.
5. **KI filing** — only clusters that survive spec validation get filed, each
   with a **twice-red reproducer** (fails deterministically on two separate
   runs/workspaces before filing).

Raw counts, unminimized dumps, and single-run observations never enter bug
ledgers and never gate CI.

## css-fuzzer improvement backlog

- **WPT inline-CSS seed harvesting** — extract `<style>` blocks and inline
  `style=` attributes from the WPT submodule into JSON fixtures via
  `scripts/external_suites/` (same shape as existing extracted suites), giving
  thousands of real-world high-edge-density seeds for free.
- **Coverage-guided mutation** — feed per-input coverage feedback (V8
  coverage or source-map-free heuristic coverage) into the mutator so budget
  concentrates near oracle boundaries instead of uniform random walks.
- **Metamorphic relations** — program-preserving input transformations whose
  observable output relation is fixed by spec; cheap extra oracles without new
  checkers:

  | Relation | Transformation | Expected relation |
  |----------|----------------|-------------------|
  | Case-flip | UPPERCASE/lowercase selectors & keywords | Same rule structure after case-canonicalizing both outputs |
  | Escape-encoding | Re-encode idents as `\XX ` escapes | Identical parsed values |
  | Whitespace/comment injection | Insert spaces/comments between tokens | Same token *kinds* sequence modulo whitespace/comments |
  | Chunk-boundary permutation | Re-split streaming chunk boundaries | Streaming output invariant to split points |
  | Cascade-order invariance | Duplicate a rule verbatim later in the sheet | Original rules unchanged; no drops |

- **Shorthand expansion ↔ contract differential** (future lane): expand
  `margin: 1px` → longhands, re-contract via serialization, compare round-trip
  semantics; a dedicated differential lane once the four base oracles are
  quiet.
- **proof.yaml wiring** — when lanes stabilize, register sweep/minimizer/
  valid-subset runs under `evidence_profiles` there (deliberately *not* done
  from this directory; proof.yaml is owned elsewhere).
