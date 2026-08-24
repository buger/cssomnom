# Proof escape analysis: KI-117 … KI-121 (relative-color grammar drop, NaN keyword, duplicate-declaration retention, value whitespace trimming, attr() namespace loss)

This is the Proof escape companion for the confirmed five-defect batch filed from the
audited UNCLAIMED cluster ledger:

- **KI-117** — declaration-block parsing *retains* color declarations whose values fail
  the css-color grammar (every probed row of WPT
  `css/css-color/parsing/color-invalid-relative-color.html`), instead of dropping them
  per cssom-1 `#parse-a-css-declaration-block` step 3.1.
- **KI-118** — math-function results that evaluate to NaN serialize as a lowercase
  `nan` identifier (`calc(nan)`, `calc(calc(nan * 1px))`) instead of the normative
  `NaN` keyword of css-values-4 `#calc-serialize` step 2 (160 wpt-cssom baseline rows).
- **KI-119** — a repeated declaration (`color:red;color:green`, or
  `font:22px Helvetica;font:xxx-large system-ui`) silently replaces the earlier one:
  `style.length` collapses to 1 / 13 where cssom-1's append-everything parse plus its
  `length` definition require 2 / 26.
- **KI-120** — insignificant trailing whitespace survives into stored values:
  `color:red ;` → `getPropertyValue('color') === 'red '`, violating css-syntax-3
  `#consume-declaration`'s normative trailing-whitespace removal.
- **KI-121** — the serializer drops the `attr()` namespace pipe:
  `attr(|bar)` round-trips as `attr(bar)`, silently changing which attribute reference
  the value denotes (WPT `css/cssom/serialize-values.html` verbatim rows).

All findings remain open and unfixed in `src/**`; each overlay reproducer asserts the
spec-honest contract and stays red until the product is repaired.

## Scope corrections vs the audited ledger briefing (recorded honestly)

1. **Cluster C1 ("valid relative colors drop whole rules / stylesheet serializes
   empty") was investigated and DISPROVEN in that direction.** Verified at HEAD:
   - `.k{color:lch(from indianred calc(l * 0.8) c h);}` and all other block-bearing
     relative-color lightning fixtures round-trip losslessly (232 fixtures scanned;
     zero rule drops; zero value mangling beyond canonical `0.8` number normalization).
   - The bare-value lightning inputs (`test|lch(from indianred calc(l + 10) c h)`)
     yield **zero rules** because a stylesheet of tokens without a `{}` block *must*
     produce no qualified rule (css-syntax-3 consume-a-list-of-rules → EOF → return
     nothing). That is compliance, not data loss.
   - What lightning actually expects for those rows is *computed* absolute output
     (`lab(43.1402% 45.7516 23.1557)`), i.e. a css-color-5 relative-color computation
     engine — a whole-subsystem gap outside parser conformance, queued below.
   - The genuine, fixture-backed defect in this area runs the **opposite** direction
     and is what KI-117 files: grammar-invalid relative colors are retained.
2. **Cluster C5 (StylePropertyMap iteration order "violated") is REFUTED — not
   filed, do not re-file.** css-typed-om-1 § "StylePropertyMap.[[declarations]]"
   (`submodules/css-houdini-drafts/css-typed-om/Overview.bs` ~line 409–436)
   normatively orders iteration as (1) standard properties ASCII-lowercased and sorted,
   (2) vendor-prefixed likewise, (3) custom properties sorted — exactly what
   `_getKeys()` implements (`src/typed-om/style-map/StylePropertyMapReadOnly.ts`).
   `color` before `--A` is spec-correct even when `--A` was authored first. The
   insertion-order contract applies to `CSSStyleDeclaration.item()`, which also passes
   today (probed: `--A,color,z-index` preserved). No violation exists on either
   surface.
3. **Cluster C4 retargeted to the verified surface.** The briefing said replace'd
   rules serialize `"red "`; every cssText surface already trims. The real, minimal
   violation is the *stored value*: `getPropertyValue('color')` returns `'red '` for
   `color:red ;`. Filed as KI-120 against css-syntax-3 `#consume-declaration`.
4. **Numbering**: batch files contiguously as KI-117…KI-121 (next-free ID verified via
   directory listing immediately before filing; no collision).

## Root-dedup table (against all existing KI titles + affected_api)

| New | Briefed | Distinct from | Why |
|---|---|---|---|
| KI-117 | C1 | KI-105 (display), KI-113 (font invalid-mix) | Same *class* (grammar-drop omission), different property subsystem: css-color relative-color grammar. Precedent for per-property filings: KI-112/KI-113 vs KI-105. |
| KI-118 | C2 | KI-39 (calc fixpoint parenthesization) | KI-39 pins degenerate-Sum *structure drift*; KI-118 pins only NaN *keyword casing*, asserted through a structure-independent regex so the reproducers fail/pass independently. Cross-referenced both ways (`do_not_refile_as`). |
| KI-119 | C3 | KI-112, KI-113, KI-36 | KI-112 = system-keyword expansion; KI-113 = invalid system-keyword mix retention; KI-36 = missing expansion table (122 shorthands). In KI-119 both declarations are ordinary valid values and `font` demonstrably expands (13-longhand green control) — the root is wholesale replacement of the earlier declaration. |
| KI-120 | C4 | KI-41, KI-21 | Parser-API at-rule prelude filtering (KI-41) and identifier escaping (KI-21) are different layers/surfaces; here the CSSStyleDeclaration storage path keeps a trailing whitespace token. |
| KI-121 | C6 | KI-21, KI-116, KI-114 | Not url/border-image laundering and not identifier escaping: lossy normalization of a grammar-legal namespaced function argument. |
| — | C5 | — | REFUTED (see scope correction 2); recorded as an explicit non-filing. |

## Twice-red evidence record

Node v24.11.1 (`/opt/node24/bin/node`), custom Proof binary `/tmp/proof-dx/proof`
0.1.0-dev. Every reproducer was run twice before filing — all ten runs exited 1 for
the asserted reasons, with green positive controls:

```text
KI-117  run 1 exit 1    12 tests: 1 control (valid lch(from orchid l 30 h) retained), 11 defect failures
KI-117  run 2 exit 1    identical counts
KI-118  run 1 exit 1     4 tests: 1 control (canonical lowercase infinity keyword), 3 defect failures ('calc(nan)' !== 'calc(NaN)' et al.)
KI-118  run 2 exit 1    identical counts
KI-119  run 1 exit 1     3 tests: 1 control (single font shorthand -> 13), 2 defect failures (length 1!==2; 13!==26; item(13)==='')
KI-119  run 2 exit 1    identical counts
KI-120  run 1 exit 1     4 tests: 1 control (clean value round-trips), 3 defect failures ('red ' !== 'red', 'calc(1px) ', 'url("x") ')
KI-120  run 2 exit 1    identical counts
KI-121  run 1 exit 1     5 tests: 1 control (attr(foo, "") verbatim), 4 defect failures ('attr(bar)' !== 'attr(|bar)' family)
KI-121  run 2 exit 1    identical counts
```

(KI-120 gained its third defect leg after the first probe sweep showed the shorthand
`background:` path trims; the longhand `background-image:url(x) ;` shape fails and was
re-run twice post-edit before evidence capture.)

`proof evidence capture` then re-executed each reproducer and stamped
`proof/evidence/ki-117.yaml` … `ki-121.yaml`
(`status: fail`, `observed_result: known_issue_reproduced`). Freshness sha256 of every
manifest was verified equal to `sha256sum` of the final reproducer bytes — all five
FRESH.

Requirement anchoring: five narrowly-modeled **informal** drafts created through
`proof req new` under the fidelity-family parent `STK-REQ-260821-BQKD`:

| Requirement | Owns | Contract |
|---|---|---|
| `SYS-REQ-260824-CFQG` | KI-117 | css-color grammar drop for `color` declarations |
| `SYS-REQ-260824-N9AE` | KI-118 | canonical NaN keyword serialization |
| `SYS-REQ-260824-EVNP` | KI-119 | append-everything declaration-block retention |
| `SYS-REQ-260824-BJTQ` | KI-120 | canonical declaration-value whitespace trimming |
| `SYS-REQ-260824-XRYP` | KI-121 | lossless namespaced `attr()` serialization |

They are intentionally informal prose + spec references (no FRETish variables):
formalizing needs new cssom component variables, and declaring them requires editing
`specs/system/variables/cssom.vars.yaml`, which this batch may not touch while it is
concurrently owned (**formalization debt**). Whoever owns the vars file next should add
e.g. `color_grammar_dropped`, `math_nan_keyword_canonical`,
`duplicate_declaration_retained`, `declaration_value_trailing_ws_stripped`,
`attr_namespace_preserved`.

## KI-117 — grammar-invalid relative colors retained

Reproducer: `proof/reproducers/KI-117-relative-color-invalid-retained-overlay-260824.ts`
Requirement: `SYS-REQ-260824-CFQG`
Spec anchors: cssom-1 `#parse-a-css-declaration-block` step 3.1 ("dropping parts that
are said to be ignored" — required for grammar failures, licensed for nothing else);
css-color-5 `#relative-colors` (~line 962, origin-color channel grammar); WPT
`color-invalid-relative-color.html` `test_invalid_value` rows reproduced verbatim.

Root subsystem: declaration-block parsing performs property-grammar validation only
for a handful of properties (`display` per KI-105, partial font handling per
KI-112/113); there is no color grammar check at all — even `color:bogus` is retained.
The defect direction is *retention*, the mirror image of the briefed claim.

Why it escaped: the corpus's color lanes feed valid syntaxes only; the invalid-input
lanes that exist target tokenizer-level errors, not per-property grammar rejection.
No obligation states "a declaration whose value fails the property grammar is absent
from the parsed block".

Correction locus: cssomnom overlay/model first (the draft names the drop contract;
the eleven red legs are tripwires). Proof second: needs a variable ranging over
property-grammar validity wired into the declaration-block oracle.

### Proof autonomy plan

- **(a) MC/DC rows once formalized**: `parse_declaration_block drops color grammar
  failure` (T: dropped, F: retained — current F branch must become uncovered by
  removal); `parse_declaration_block preserves neighbor after drop` (T/F on neighbor
  presence); `color_value matches relative-color grammar` T/F boundary rows for each
  function family (rgb/hsl/hwb/lab/oklch channel-type mismatch).
- **(b) Witness tests**: promote the reproducer's two named predicates into the gate —
  `invalid relative color yields empty getPropertyValue` and
  `neighbor preservation after invalid drop`.
- **(c) Lane proposals**: extend the WPT extraction lane to emit
  `test_invalid_value` rows as negative oracles keyed by property (fixture already
  local); add a differential lane comparing cssomnom drop decisions against
  LightningCSS error-recovery rows for color functions.

## KI-118 — NaN results serialize lowercase `nan`

Reproducer: `proof/reproducers/KI-118-calc-nan-canonical-keyword-overlay-260824.ts`
Requirement: `SYS-REQ-260824-N9AE`
Spec anchors: css-values-4 `#calc-serialize` step 2 (keyword spelling normative:
`infinity`, `-infinity`, `NaN`; non-empty type appends ` * <canonical unit value>`);
local WPT `calc-infinity-nan-serialize-length.html` rows (`1px * NaN` →
`calc(NaN * 1px)`); baseline carries 160 open rows across the five
`calc-infinity-nan-serialize-*` fixtures.

Root subsystem: the math evaluator produces JS `NaN` and the serializer stringifies it
via a generic number path (lowercase identifier) instead of dispatching the
infinite/NaN keyword branch. The infinity keyword already round-trips correctly (green
control), isolating the miss to the NaN spelling constant.

Why it escaped: the fixpoint oracle checks structural stability across re-serialization
(and is the lane that caught KI-39), but nothing compares keyword *spelling* against
the css-values-4 table; no modeled row ranges over special float values.

Correction locus: cssomnom overlay (keyword branch) first. Proof second: add
special-value witnesses (∞/−∞/NaN) to the serialization-equivalence signal.

### Proof autonomy plan

- **(a) MC/DC rows once formalized**: `serialize_math_function dispatches NaN keyword`
  (T: NaN result → `NaN` keyword; F: ordinary numeric path);
  `serialize_math_function appends canonical unit for non-empty type` (number vs
  length-typed NaN); `math evaluation infects NaN through product/inversion`.
- **(b) Witness tests**: `calc(NaN) serializes calc(NaN)` (exact-equality leg) and
  `no standalone lowercase nan token in any serialized math result` (structure-
  independent predicate, deliberately decoupled from KI-39's wrapper fix).
- **(c) Lane proposals**: wire the five local `calc-infinity-nan-serialize-*` fixtures
  into the wpt-cssom differential lane as a dedicated special-values profile so the
  160-row backlog becomes visible per-commit rather than as one aggregate count.

## KI-119 — repeated declarations wholesale-replace earlier ones

Reproducer: `proof/reproducers/KI-119-repeated-shorthand-declaration-loss-overlay-260824.ts`
Requirement: `SYS-REQ-260824-EVNP`
Spec anchors: cssom-1 `#parse-a-css-declaration-block` steps 3/3.1/3.2 (append every
non-dropped declaration; no same-name replacement step exists);
`CSSStyleDeclaration.length` ("must return the number of CSS declarations");
cascade arbitration belongs to computed-value time.

Interpretation flagged for Scrutineer (`validation=pending` noted in the yaml): the
font-case expected count (26) assumes cssomnom's own demonstrated expansion granularity
(green control: one font shorthand → 13 entries). The plain `color` case (expected 2)
is independent of any granularity reading. Browsers collapse duplicates too, but the
local authoritative .bs text is the conformance target and documents no such
replacement; if Scrutineer rules the browser behavior intentional-deviation material,
this KI should be withdrawn rather than weakened.

Root subsystem: the declaration-block store keys by property name and overwrites on
insert, conflating "later wins the cascade" with "earlier ceases to exist".

Why it escaped: every cascade obligation models winner selection over distinct
properties; no requirement ever counted declarations, and no fixture lane feeds a
block repeating one property into a `length` assertion.

Correction locus: cssomnom model (list semantics) first. Proof second: add a
declaration-count invariant to the roundtrip oracle.

### Proof autonomy plan

- **(a) MC/DC rows once formalized**: `declaration_block_store appends duplicate name`
  (T: appended, F: replaced — replacement branch removed); `length counts retained
  declarations`; `cascade arbitration picks later duplicate without mutating block`.
- **(b) Witness tests**: `repeated color yields length 2 with cascade-stable winner`;
  `repeated font shorthand retains both sets (item(13) restarts the longhand run)`.
- **(c) Lane proposals**: PBT generator variant that samples properties *with
  replacement* inside a block and asserts `length >= distinct-count`; WPT lane addition
  for duplicate-declaration fixtures if upstream gains one.

## KI-120 — trailing whitespace survives into stored declaration values

Reproducer: `proof/reproducers/KI-120-declaration-value-trailing-whitespace-overlay-260824.ts`
Requirement: `SYS-REQ-260824-BJTQ`
Spec anchors: css-syntax-3 `#consume-declaration` (~line 2962): "While the last item in
decl's value is a <<whitespace-token>>, remove that token"; cssom-1
`#serialize-a-css-declaration` appends the stored value verbatim between ": " and ";".

Root subsystem: the declaration consumer slices raw source text for the value instead
of dropping trailing whitespace tokens; some downstream surfaces (shorthand paths,
cssText assembly) trim independently, which is why `margin:1px 2px ;` reads clean while
`color:red ;` does not — inconsistent trimming is itself evidence of a missing
storage-time normalization.

Why it escaped: byte-exact serialization obligations compare full cssText (which trims)
and the fuzz oracles normalize whitespace globally; nothing asserted equality between
the *stored value read-back* and the canonical token stream.

Correction locus: cssomnom (strip at consume time) — single fix closes all surfaces.

### Proof autonomy plan

- **(a) MC/DC rows once formalized**: `consume_declaration strips trailing ws token`
  (T: stripped, F: kept — F removed); `readback equals canonical token serialization`
  across single-token/function/url shapes.
- **(b) Witness tests**: the three red legs (`color:red ;`, `color: calc(1px) ;`,
  `background-image:url(x) ;`) plus the clean-value control.
- **(c) Lane proposals**: roundtrip-sweep oracle variant asserting
  `getPropertyValue(p) === serialize(trimmed tokens(source))` for every generated
  declaration (whitespace-sensitive mode, currently normalized away).

## KI-121 — attr() namespace pipe dropped by serializer

Reproducer: `proof/reproducers/KI-121-attr-namespaced-name-dropped-overlay-260824.ts`
Requirement: `SYS-REQ-260824-XRYP`
Spec anchors: WPT `css/cssom/serialize-values.html` `attr()` rows (~lines 100–110,
verbatim expectations incl. `attr( |bar )` internal spacing); css-values-5 `#attr`
(~line 1980): `<<attr-name>> = [ <<ident-token>>? '|' ]? <<ident-token>>`.

Root subsystem: the attr()-argument serializer reconstructs the function from parsed
components and emits only the bare attribute ident, discarding the optional namespace
prefix token (and, for the spaced fallback row, normalizing away authoring whitespace).

Why it escaped: serializer-equivalence signals compare parse→serialize→parse stability
for *supported* function grammars; attr() falls into the lenient passthrough class, so
only the WPT fixture's verbatim expectations can catch it — and that fixture family is
not wired into any gate.

Correction locus: cssomnom first (preserve the namespaced token stream). Proof second:
promote `serialize-values.html` rows into a content-property fixture profile.

### Proof autonomy plan

- **(a) MC/DC rows once formalized**: `serialize_attr_name preserves namespace
  prefix` (T/F on prefix presence); `serialize_attr_args preserve fallback and
  spacing` (fallback present/absent × spacing variants).
- **(b) Witness tests**: the four red legs mirroring WPT rows plus the green
  `attr(foo, "")` control pinning that ordinary forms stay verbatim.
- **(c) Lane proposals**: extract every `{actual, serialized}` object pair from local
  WPT cssom fixtures into a verbatim-serialization oracle lane (they are machine-readable
  already); flag any pair whose actual differs from serialized as a must-pass witness.

## Queued whole-subsystem efforts (explicitly NOT filed this wave)

Per briefing instruction, the following audit clusters require subsystem-scale work and
are queued for future waves rather than force-filed as narrow KIs:

1. **Typed OM reification mass** — broad family of Typed OM interfaces/behaviors whose
   absence surfaces across dozens of wpt-sandbox typed-om fixtures
   (`tests/fixtures/baselines/wpt-sandbox-known-failures.json` includes the inline
   `the-stylepropertymap/get.html` family). Needs a reification-coverage plan, not
   per-row filings.
2. **Constructable-sheet invalidation** — adopted/constructable stylesheet cascade
   ordering and invalidation semantics
   (`css/CSSStyleSheet-constructable-duplicate.html` family) need an ownership/lifetime
   model that does not exist yet in the Node bridge.
3. **Relative-color computation engine** (discovered during C1 investigation) —
   computing absolute outputs for `rgb(from …)`-family values (lightning `test`
   expectations, ~220 rows). This is a compute subsystem, not parser conformance;
   file only if/when cssomnom claims computed-value support.

## Gates

Run after this doc was written (see report); expected clean:
`proof known-issue check`; `proof audit --check known_issue_complete --fail-level warn`;
oxlint scoped to the five new reproducers.
