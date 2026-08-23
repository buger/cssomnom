# Proof escape analysis: KI-40 through KI-45 (Parser API adapter batch)

This is the Proof escape companion for the confirmed six-defect batch:

- **KI-40** — `parseRuleSync('div { color: red; margin: 0px }').body.length === 0`;
  every style-rule declaration is silently dropped from
  `CSSParserQualifiedRule.body` because `toParserRule` tests truthy-but-empty
  `qr.cssRules` before the `qr.style → CSSParserDeclaration` branch.
- **KI-41** — `'@media screen{a{b:c}}'` serializes as `'@mediascreen{a{}}'`, which
  re-parses to an at-rule **named** `mediascreen`; same for `@keyframesk`,
  `@layerl`, `@namespacesvgurl` (and `@supports(display…)`, `@page:first`).
- **KI-42** — `parseComponentValueSync('url(a b)')` returns a truncated token `'a'`
  instead of throwing SyntaxError for an always-parse-error `<bad-url-token>`.
- **KI-43** — `parse('@import url(a b)x.css;')` fabricates a
  `CSSImportRule(href:'', mediaText:'not all')` instead of dropping the
  grammar-invalid rule (css-cascade-5 `#at-import`: `[ <url> | <string> ]`).
- **KI-44** — `keyText = '0x10%'` normalizes to `'16%'` (`'0X10%'` too): the setter
  validates with JS `Number()` coercion instead of `<percentage [0,100]>`.
- **KI-45** — `CSS.parseValue('10% x')` silently returns `'10%'` while
  `CSS.parseComponentValue('10% x')` throws; both wrap css-syntax-3
  `#parse-a-component-value`, whose EOF step mandates a syntax error.

All findings remain open and unfixed in `src/**`; each overlay reproducer asserts
the spec-honest contract and is expected to stay red until the product is repaired.

## Scope corrections vs the hunt briefing (recorded honestly)

1. **KI-41 root cause is two cooperating defects, not one.** The briefing named
   only `tokensToPrelude` whitespace-stripping (`src/parser-api.ts:202-205`). The
   dominant cause for every probed family is `CSSParserAtRule.toString()`
   (~122-128), which concatenates `@name` + prelude tokens with `''` — even where
   the prelude arrives as a single conditionText/mediaText string with no internal
   whitespace to strip (`@media screen` → prelude `['screen']`). Both halves are
   cited in the yaml; fixing either alone leaves families broken.
2. **KI-43's "engine already drops misplaced @imports" is imprecise.** Probing
   shows `parse('div{}@import url(y.css);')` keeps BOTH rules — misplaced imports
   are NOT dropped on the document-style path. What exists is (a) constructed-sheet
   policy dropping ALL imports ("not allowed in constructed stylesheets") and (b)
   `insertRule` throwing HierarchyRequestError there. Neither covers `parse()`,
   which is where fabrication happens. The yaml records this precision note so a
   future fixer doesn't "restore" the wrong behavior.
3. **KI-42's bad-string sibling observed, not filed separately**: `url("a`
   (unterminated string inside url()) is silently "repaired" into
   `CSSParserFunction('url("a")')` by our tokenizer/adapter. Same kill class,
   smaller blast radius; recorded here rather than inflating the batch count.
4. **KI-45 honesty caveat carried into the yaml**: the WICG draft does not spell
   out parseValue failure semantics explicitly; the violation is anchored on the
   shared css-syntax-3 algorithm plus internal inconsistency (sibling throws).
   Stated in both reproducer header and yaml notes.
5. **Numbering**: batch files contiguously as KI-40..KI-45 per briefing; no ID gap.

Evidence was captured with the documented custom Proof binary at `/tmp/proof-dx/proof`
and Node v24.11.1. Each probe was verified twice interactively before filing, then
each reproducer was run twice before filing — all runs exited 1 for the asserted
reasons:

```text
KI-40  run 1 exit 1    3 tests: 1 green control (keyframe path maps declarations), 2 defect failures
KI-40  run 2 exit 1    identical counts
KI-41  run 1 exit 1    4 tests: 1 green control (qualified-rule round-trip), 3 defect failures
KI-41  run 2 exit 1    identical counts
KI-42  run 1 exit 1    3 tests: 1 green control ('a b' >1-value branch throws), 2 defect failures
KI-42  run 2 exit 1    identical counts
KI-43  run 1 exit 1    2 tests: 1 green control (valid import href byte-exact), 1 defect failure
KI-43  run 2 exit 1    identical counts
KI-44  run 1 exit 1    4 tests: 2 green controls (5 correct rejections; parser drops '0x10%'), 2 defect failures
KI-44  run 2 exit 1    identical counts
KI-45  run 1 exit 1    4 tests: 2 green controls (clean value parses; sibling throws), 2 defect failures
KI-45  run 2 exit 1    identical counts
```

`proof evidence capture` then re-executed each reproducer a third time and stamped
`proof/evidence/ki-{40..45}.yaml` (`observed_result: known_issue_reproduced`);
freshness sha256 verified against `sha256sum` of the final reproducer bytes (all
six FRESH — ki-44 was re-refreshed after a post-capture type-only edit).

Requirement anchoring: no existing requirement covered any of these contracts, so
six narrowly-scoped FRETish drafts were created via `proof req new`, each with a
NEW registry vars file whose numeric domains mirror the reproducer constants, all
traced `satisfies → STK-REQ-260821-BQKD`:

| KI | Requirement | Vars registry |
|----|-------------|---------------|
| KI-40 | `SYS-REQ-260823-QBD2` qualified_rule_body_declarations_preserved | `specs/system/variables/parser-api-rule-body-budget.vars.yaml` |
| KI-41 | `SYS-REQ-260823-PRT3` at_rule_prelude_round_trip_fidelity | `specs/system/variables/parser-api-prelude-budget.vars.yaml` |
| KI-42 | `SYS-REQ-260823-BTC4` bad_token_component_value_rejected | `specs/system/variables/parser-api-bad-token-budget.vars.yaml` |
| KI-43 | `SYS-REQ-260823-DRP5` invalid_import_rule_dropped | `specs/system/variables/import-grammar-budget.vars.yaml` |
| KI-44 | `SYS-REQ-260823-KTS6` keytext_setter_grammar_fidelity | `specs/system/variables/keytext-setter-budget.vars.yaml` |
| KI-45 | `SYS-REQ-260823-PVE7` parse_value_trailing_garbage_rejected | `specs/system/variables/parse-value-eof-budget.vars.yaml` |

## Which Proof gate missed each finding, and why

### KI-40 — dead-branch truthiness drops all style-rule bodies

Reproducer: `proof/reproducers/KI-40-parser-api-style-rule-body-drops-declarations-overlay-260823.ts`
Spec anchors: WICG css-parser-api `#parser-values` (body members = the rule's
declarations incl. CSSParserDeclaration); css-syntax-3 §5.5.3 `#consume-a-qualified-rule`;
css-syntax-3 `#serialization` round-trip (~3706-3713).

Gate missed: **requirement coverage completeness for the Parser API surface.**
The only existing Parser-API body-content assertions live in
`tests/parser-api.test.ts` (~L122) and cover the KEYFRAME path exclusively — the
one branch that works (`styleToParserDeclarations`). No requirement ever stated
"qualified rule body carries the block's declarations", so nothing forced an
assertion onto the plain style-rule path, and the dead `qr.style` branch was
never executed by any gate. This is the **dead-branch truthiness bug class**: an
inherited iterable (`CSSRuleList`) is ALWAYS present on modern rules, so
`qr.cssRules ? A : B` silently disables B everywhere.

Correction locus: overlay/model first (draft names the contract; tripwires are
the two red legs). Engine second: see generated-API-surface completeness below.

### KI-41 — at-keyword/prelude separator lost in serialization

Reproduces via serialize→re-parse identity legs across four at-rule families.
Spec anchors: css-syntax-3 `#serialization` round-trip mandate; WICG note that
whitespace is parsed into DOMStrings (preserved information).

Gate missed: **no round-trip obligation exists for RULE-level serialization.**
Round-trip requirements exist for declaration blocks (cssText lanes) but never
for `String(CSSParserAtRule)` / `tokensToPrelude`. The fuzzer's roundtrip-sweep
oracle operates on the engine layer, not the adapter layer, so `@mediascreen`
never entered any gate input. Same escape shape as KI-115 (condition collapse)
but in a different subsystem — the audit's media lane checks conditionText
semantics, not the Parser-API stringifier's join policy.

Correction locus: overlay/model (draft names identity of name+prelude across a
serialize/re-parse cycle). Engine idea: extend the fixpoint oracle to rule lists
(see proposed lanes).

### KI-42 — bad-url accepted as a truncated token

Spec anchors: css-syntax-3 ~2013-2016 (bad-string/bad-url are always parse
errors); `#parse-a-component-value` (~2457-2484). Control: the library's own
>1-value branch already throws for `'a b'`.

Gate missed: **error-path obligation asymmetry.** Gates asserted the happy path
(parseComponentValue returns THE value) and the arity path (>1 value throws);
no obligation covered "single value that is itself a parse error". Because the
bad token is consumed successfully by `consumeComponentValue()` into the value
list, every count-based check passes and only a TYPE check can catch it — and no
modeled variable ranges over token types like `bad-url`.

Correction locus: overlay/model first. Engine second: the tokenizer KNOWS it
emitted `bad-url` (the type survives into the parser); a cheap invariant lint —
"no public parse* return value may contain a preserved bad-* token" — would have
caught this mechanically.

### KI-43 — fabricated CSSImportRule from grammar-invalid prelude

Spec anchors: css-cascade-5 `#at-import` (~150-160). Controls: valid unquoted
imports round-trip href byte-exactly; layered imports survive.

Gate missed: **drop-vs-fabricate obligations are unstated for at-rules.** The
model asserts what valid inputs produce (href equality — KI-8's fixed leg) but
nothing says "grammar-invalid at-rules must not materialize as rule objects".
The engine's keyframe path demonstrates the correct pattern (drops `'0x10%'`
blocks) yet no cross-check requires the import path to behave the same way —
a dual-path consistency gap (see below).

Correction locus: overlay/model. Engine idea: a differential oracle comparing
"tokenizer-level validity verdict" vs "rule objects emitted" for every at-rule
family, failing when invalid input yields a fabricated object.

### KI-44 — keyText setter validates with Number(), not the grammar

Spec anchors: css-animations-1 ~1072-1077 (SyntaxError + unchanged value),
~210-212 (`<percentage [0,100]>`). Controls that correctly throw today:
`'50%%','fifty%','Infinity%','-5%','0'`; tokenizer path drops such blocks.

Gate missed: **setter/parser agreement is unmodeled (JS-coercion-instead-of-
tokenizer class).** Every existing keyframe gate exercises either parsing or
appendRule (KI-103) or declarations (KI-104); none drives the SETTER with
grammar-violating selectors. Worse, the five green controls create a false sense
of coverage: they all fail `Number()` sanity too, so the one input class where
JS coercion diverges from the grammar (`0x10%` — hex literals coerce cleanly)
was exactly unsampled. Any numeric-literal-tolerant check inherits JS semantics
unless it is forced to tokenize.

Correction locus: overlay/model (draft pins throw+unchanged for grammar
violations AND parser/setter agreement). Engine idea: forbid raw `Number()`/
`parseFloat()` on selector-ish strings in favor of the shared tokenizer — a
lint rule plus the agreement test above.

### KI-45 — parseValue truncates trailing garbage its sibling rejects

Spec anchors: css-syntax-3 `#parse-a-component-value` EOF step (~2479-2483);
honest draft-spec caveat recorded in yaml notes.

Gate missed: **API-pair consistency obligations don't exist.** Each method has
isolated nominal tests; nothing states "two APIs documented as exposing the same
css-syntax algorithm must agree on failure". The missing EOF check
(`src/parser-api.ts` ~563-569 vs ~583-587) is invisible to per-method gates.

Correction locus: overlay/model. Engine idea: consistency lints over API pairs
that share a spec algorithm (see proposed lanes).

## Batch-level themes

1. **The Parser-API adapter layer never had requirements until now.** All four
   adapter defects (KI-40, KI-41, KI-42, KI-45) sit in `src/parser-api.ts` — a
   translation layer between the engine AST/CSSOM and the WICG object model.
   Gates historically sampled the ENGINE (parser.ts/CSSOM.ts) because that is
   where spec text pointed; the adapter had zero FRETish coverage, so any
   transformation bug escaped by construction. Six new drafts close the naming
   gap; formalized MC/DC rows should now range over ADAPTER decisions
   (branch order, join separators, filter predicates, EOF checks), not just
   engine grammar decisions.
2. **Dead-branch truthiness bug class (KI-40).** `truthyIterable ? useIt : fallback`
   is wrong whenever the iterable is inherited-and-may-be-empty. One instance is
   filed; a mechanical sweep for `? .* :` guards around `.cssRules`/`.style`/
   `.rules` accessors in adapters is cheap and should be added to review
   checklists.
3. **JS-coercion-instead-of-tokenizer class (KI-44, adjacent KI-45/KI-42).**
   Wherever validation reduces strings to JS numbers before grammar checking,
   hex/exponent forms (`0x10%`) smuggle values past closed-set grammars. The
   tokenizer is the single source of truth; setters and validators must call it.
4. **Overlay vs engine split.** All six correction loci start in the overlay
   (requirements + reproducers, done here); product code stays untouched per
   audit doctrine. Engine regression ideas below are proposals for the owners of
   `fuzz/` and `scripts/wpt/node/core/*`, not edits from this batch.

## Proposed permanent lanes (engine regression ideas — proposal only)

1. **Generated-API-surface completeness check.** For every public export pair
   that wraps one css-syntax algorithm (`parseValue`↔`parseComponentValue`,
   `parseRule`↔`parseDeclarationList`, sync↔async twins), generate a matrix of
   shared edge inputs (clean, trailing garbage, lone bad-token, empty) and assert
   IDENTICAL accept/reject verdicts. This is exactly the dual-path consistency
   lint that would have flagged KI-45 and KI-42 at CI time.
2. **Adapter round-trip fixpoint oracle.** Extend the fuzz fixpoint lane to
   Parser-API rule lists: `String(parseRuleListSync(x))` must re-parse to the
   same rule identities (name/prelude/body length) for every accepted input —
   catches KI-41-class corruption generically, including future at-rules.
3. **Dual-path consistency lint (setter vs parser).** For each attribute setter
   backed by a grammar (`keyText`, `selectorText`, `conditionText`), auto-generate
   negative inputs from the tokenizer's reject set and assert the setter throws
   iff the parser drops/rejects. Catches KI-44-class divergence without hand
   enumerating hex tricks.
4. **No-preserved-bad-token invariant.** Public parse* results must never embed
   `bad-url`/`bad-string` component values; a single walk over returned trees
   makes the always-parse-error rule mechanical (KI-42 class).
5. **Truthiness-guard sweep.** Grep-grade lint flagging ternaries whose condition
   is a possibly-empty inherited collection accessor (`.cssRules`, `.style`,
   `.childRules`) followed by a mapping branch — KI-40 class.

## Batch-level lessons

1. Coverage that samples only working branches (keyframes for KI-40, five
   non-coercing controls for KI-44) actively hides escapes; controls must be
   paired with adversarial legs ranging over the DIVERGENT input class.
2. Truthiness on always-present collections is a silent feature switch; adapters
   need explicit emptiness/type checks.
3. When two public APIs wrap one spec algorithm, their failure contracts are one
   requirement, not two — model them together or the inconsistency ships.
