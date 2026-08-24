# Proof escape analysis: KI-122 … KI-123 (Typed OM reification fidelity — limited-range CSSMathSum wrap, base-only reification identity)

This is the Proof escape companion for the subsystem-KI wave filed from the
wpt-sandbox typed-om failure mass (546 baseline assertion rows across 118 files,
re-clustered at HEAD into 4 empirical roots + 2 refused clusters):

- **KI-122** — `StylePropertyMap.set()` stores out-of-range negative
  `CSSUnitValue`s **unwrapped** (bare unit value round-trips through
  `get()`/`getAll()`), instead of replacing them "with the result of wrapping it in
  a fresh {{CSSMathSum}}" per css-typed-om-1 `#create-an-internal-representation`.
  150 failing sandbox rows across 42 property fixtures.
- **KI-123** — values whose css-typed-om-1 normalization row ends in *reify as a
  CSSStyleValue* (`color`/`border-top-color` for everything except `currentcolor`)
  over-reify into subclasses: `get('color')` after `color: red` returns
  `CSSKeywordValue`, after `#bbff00`/`rgb()` a CSSRGB value — not the direct
  `CSSStyleValue` with `[[associatedProperty]] = color` required by `#reify-property`
  step 2 + `#reify-as-a-cssstylevalue`. 204 failing sandbox rows.

Both findings remain open and unfixed in `src/**`; each overlay reproducer asserts
the spec-honest contract and stays red until the product is repaired. All
reproduction used public API only (`parse` + `StylePropertyMap` +
`CSSUnitValue`/`CSSMathSum` from `src/index.ts`) — no dom-shim, no vm sandbox.

## Scope corrections vs the wave briefing (recorded honestly)

1. **Cluster S2 (constructable stylesheet cascade invalidation) is REFUTED at HEAD
   — not filed, do not re-file without new evidence.** Feasibility gate first, per
   briefing:
   - Surface exists: `CSSStyleSheet` constructed flag
     (`src/CSSOM.ts` `_constructedFlag`, `replaceSync` per cssom-1 § 6.5.1
     `#synchronously-replace-the-rules-of-a-cssstylesheet`),
     `adoptedStyleSheets` consumption in `src/cascade/rule-filter.ts`
     (`collectStyleSheetsAndRules` steps 2 and 3, document and ShadowRoot shaped).
   - Public-API probes at HEAD all pass: document-level adopted sheet reflects
     `insertRule('.target { color: blue !important; }')` immediately; after
     `replaceSync('span{}')` the div rule disappears from the cascade; a
     ShadowRoot-shaped root (`{host, styleSheets:[], adoptedStyleSheets:[sheet]}`)
     applies `:host`/`.inner` rules and drops `.inner` after `replaceSync`.
   - Existing regression net already pins the contract:
     `tests/cssom-phase90.test.ts` "Constructable Stylesheets & adoptedStyleSheets
     Invalidation" ("Live mutation with replaceSync recalculates getCascadedStyle",
     adoption precedence).
   - The prior-audit symptom therefore describes an already-fixed or never-present
     defect on the current HEAD; no live failure mass exists to file. The
     invalidation contract does NOT depend on getComputedStyle/layout plumbing
     (it is exercised entirely through `getCascadedStyle`), so this is a genuine
     refutation, not a capability-gap waiver.
2. **The numeric-objects baseline trio is STALE and its one non-conforming row is
   spec-refuted** (details in appendix A.3): `arithmetic.tentative`,
   `create-a-type.tentative`, `to.tentative` were converted to `.any.js` by WPT
   commit e94af787e3 (2026-07-16); the baseline still keys their old `.html` names,
   which the `.html`-only sandbox crawler can never reach again. Direct public-API
   probes show HEAD already conforms for every row except the mul/div TypeError
   row, which the spec text itself contradicts (see appendix).
3. **Numbering**: batch files contiguously as KI-122…KI-123 (next-free ID verified
   via directory listing immediately before filing: KI-121 was highest).

## Mined-case table (symptom → root → disposition)

| Symptom mass (sandbox rows) | Empirical root | Disposition |
|---|---|---|
| 150 rows / 42 files: "expected CSSMathSum but got CSSUnitValue" on negative inputs | Limited numeric range of property grammar not enforced at typed-set storage time → **KI-122 FILED** | filed |
| 204 rows: "Unsupported value must be a CSSStyleValue and not one of its subclasses" (`color`, `border-top-color`, …) | Base-only reification rows ignored; unrepresentable values boxed into subclasses → **KI-123 FILED** | filed |
| 67 rows: computed `unit: expected "px" but got "em"`, font-size keyword rows "relative lengths must compute to a CSSUnitValue" | Computed-value resolution of relative units/keywords needs element font-size/layout context | REFUSED — environment-limitation (appendix A.1) |
| 88 rows: "Setting 'margin' to <typed value> throws TypeError" family | Blink supported-property model; not derivable from L1 spec text (Issue 644 open) | REFUSED — spec-refuted/under-defined (appendix A.2) |
| 8 rows: arithmetic/create-a-type/to (.html keys) | Stale keys + HEAD conforms; mul/div row contradicts "multiply two types" | REFUSED — stale baseline + spec-refuted (appendix A.3) |
| ~153 rows 'other': animation-timing-function canonicalization, CSSImageValue url() reification, anchor-scope keyword rejection, border-image-* get shapes | Heterogeneous; each needs separate mining/validation | DEFERRED honestly (appendix A.4) |

## Root-dedup table (against all existing KI titles + affected_api)

| New | Distinct from | Why |
|---|---|---|
| KI-122 | KI-39 (calc fixpoint parenthesization drift) | KI-39 pins degenerate-Sum *serialization structure* across re-serializations; KI-122 pins only the presence of the range wrap on `get()` shape after a typed `set()` and never asserts serialization text. Cross-referenced both ways via `do_not_refile_as`. |
| KI-122 | KI-111 (registered-syntax matcher initial values) | Different surface: `CSS.registerProperty()` initial-value validation vs `StylePropertyMap.set()` storage wrapping. |
| KI-123 | KI-117 (grammar-invalid relative colors retained) | KI-117's probed values are grammar-INVALID and the defect is block-parse retention/drop; here every probed value is grammar-VALID and the defect is the reified constructor identity on `get()`. |
| KI-123 | KI-122 | Different algorithm (`#create-an-internal-representation` range clause vs `#reify-property` base-only rows) and different observable (wrap shape vs direct-subclass identity); reproducers fail/pass independently. |

## Twice-red evidence record

Node v24.11.1 (`/opt/node24/bin/node`), custom Proof binary `/tmp/proof-dx/proof`
0.1.0-dev. Every reproducer ran twice before filing — both runs exited 1 for the
asserted reasons, with green positive controls:

```text
KI-122  run 1 exit 1     5 tests: 2 controls (in-range flex-grow / border-top-left-radius stay bare CSSUnitValue), 3 defect failures (flex-grow -3.14, border-radius -3.14em, getAll wrap)
KI-122  run 2 exit 1    identical counts
KI-123  run 1 exit 1     7 tests: 1 control (currentcolor stays CSSKeywordValue identifier), 1 green-today invariant pin ([[associatedProperty]] kept), 5 defect failures ('CSSKeywordValue'/'CSSRGB' !== 'CSSStyleValue' family)
KI-123  run 2 exit 1    identical counts
```

(An earlier probe draft of the KI-123 helper concatenated `div{}` + declaration text,
producing invalid stylesheet text; fixed before any filing evidence was stamped.
The definitive runs above are the recorded ones.)

`proof evidence capture` then genuinely re-executed each reproducer and stamped
`proof/evidence/ki-122.yaml` / `ki-123.yaml` (`status: fail`,
`observed_result: known_issue_reproduced`). Freshness sha256 of each manifest was
verified equal to `sha256sum` of the final reproducer bytes:

```text
sha256:5a6dfb6bd61e8980d1b8f8ead399bd7751b6b381804baa3819b7ef773e86fdae  KI-122 reproducer (matches ki-122.yaml)
sha256:3095e47b28d3efead62375ff810b43c2bf4ff8d3dc6b712a607b646d9b904aff  KI-123 reproducer (matches ki-123.yaml)
```

Requirement anchoring: two narrowly-modeled **informal** drafts created through
`proof req new` under the fidelity-family parent `STK-REQ-260821-BQKD` (style mirror
`SYS-REQ-260824-CFQG`):

| Requirement | Owns | Contract |
|---|---|---|
| `SYS-REQ-260824-QGJE` | KI-122 | out-of-range `CSSUnitValue` parts wrap into a fresh `CSSMathSum` at internal-representation creation |
| `SYS-REQ-260824-XE59` | KI-123 | base-only properties reify as direct `CSSStyleValue` with `[[associatedProperty]]`, never subclass-boxed |

They are intentionally informal prose + spec references (no FRETish variables):
formalizing needs new cssom component variables, and declaring them requires editing
`specs/system/variables/cssom.vars.yaml`, which this batch may not touch while it is
concurrently owned (**formalization debt**). Whoever owns the vars file next should
add e.g. `numeric_range_wrapped_in_math_sum`, `base_only_reification_direct_value`.

## KI-122 — out-of-range negative unit values stored unwrapped

Reproducer: `proof/reproducers/KI-122-typed-om-negative-range-mathsum-wrap-overlay-260824.ts`
Requirement: `SYS-REQ-260824-QGJE`
Spec anchors: css-typed-om-1 `#create-an-internal-representation` (~line 694:
"If any component of |property|'s CSS grammar has a limited numeric range … replace
that value with the result of wrapping it in a fresh {{CSSMathSum}} whose values
internal slot contains only that part of |value|"); `#reify-stylevalue`
`#reify-property` (~line 3619: the list defines reification for every property);
limited ranges of the probed grammars (`<number [0,∞]>` flex-grow per css-flexbox-1;
`<length-percentage [0,∞]>` border-*-radius per css-backgrounds-3 § corner-radius);
WPT testsuite.js `assert_is_equal_with_range_handling`: "Invalid (out-of-range)
numeric values must be wrapped in a CSSMathSum".

Root subsystem: `validateValuesForProperty` /
the StylePropertyMap set path stores the rectified value verbatim; there is no
per-property limited-range check anywhere between `set()` and storage, so the
internal representation equals the input and `get()` reifies a bare `CSSUnitValue`.

Why it escaped: Typed OM lanes assert round-trip *equality* of parsed/set values but
no lane ranges over out-of-range magnitudes for limited-range grammars; the wpt-sandbox
ledger carried the 150-row mass only as aggregate known-failure counts, never as a
modeled obligation.

Correction locus: cssomnom overlay first (range metadata already exists in generated
property data for other purposes; wire it into the set path). Proof second: the draft
requirement names the wrap contract; the three red legs are tripwires.

### Proof autonomy plan

- **(a) MC/DC rows once formalized**: `create_internal_representation wraps
  out-of-range unit value` (T: outside range → fresh CSSMathSum single-child; F:
  inside range → stored bare); `wrap preserves value+unit` (T/F on unit/value
  preservation through the wrap); `get reifies wrapped representation as CSSMathSum`
  (T/F vs bare path). Boundary witnesses: `[0,∞]` endpoints (0 stored bare, −ε
  wrapped), `[1,∞)` (column-count 0 wrapped, 1 bare), `[1,1000]` font-weight bounds.
- **(b) Named witness tests**: `set(flex-grow, -3.14 number) reifies as CSSMathSum
  wrapping the input`; `set(border-top-left-radius, -3.14em) reifies as CSSMathSum`;
  `getAll carries the wrapped representation`; controls `in-range flex-grow stays a
  bare CSSUnitValue` / `in-range border-top-left-radius stays bare` must stay green.
- **(c) Lane proposals**: extract `assert_is_equal_with_range_handling` usage from
  the local WPT testsuite.js into a fixture lane keyed by property so the 42-file
  mass becomes per-property negative oracles; add a differential lane comparing
  cssomnom wrap decisions against Chrome rows for the same fixtures (border-radius,
  scroll-padding, flex-*, column-count, font-weight, orphans/widows,
  animation-duration are the highest-yield files).

## KI-123 — unrepresentable values over-reified into subclasses

Reproducer: `proof/reproducers/KI-123-unrepresentable-value-overreification-overlay-260824.ts`
Requirement: `SYS-REQ-260824-XE59`
Spec anchors: css-typed-om-1 `#reify-stylevalue` "Property-specific Rules"
(`#reify-property`, ~line 3619: "defines the reification behavior for every single
property in CSS"); `'color'` row ~line 4105 and `'border-top-color'` row ~line 4013,
step 2: "Otherwise, reify as a {{CSSStyleValue}} and return the result";
`#reify-failure` (~line 5290) + `#reify-as-a-cssstylevalue` (~line 5307): direct
object with `[[associatedProperty]]` set to the property; WPT `color.html`
`runUnsupportedPropertyTests` pinning "Unsupported value must be a CSSStyleValue and
not one of its subclasses" (comment in source: "`<color>`s are not supported in
level 1").

Root subsystem: the string→value factory (`style-value-factory.ts` /
declaration reification path) boxes any parseable value into the richest available
subclass (`CSSKeywordValue` for identifiers, `CSSColorValue`/CSSRGB for colors),
ignoring the per-property base-only rows. The currentcolor control proves identifier
reification per se works — the miss is dispatching the property table at all.

Why it escaped: Typed OM unit tests assert `instanceof CSSKeywordValue` for
`set('color','red')` (codifying the deviation, e.g. tests/mcdc-hotspot-typed-om-more.test.ts
and tests/typed-om-math.test.ts), and the sandbox ledger aggregated the 204 rows
without a modeled contract; no obligation states the reified constructor identity
for base-only rows.

Correction locus: cssomnom overlay first (route get/getAll through the
`#reify-property` table; keep `[[associatedProperty]]`). Proof second: add the
identity oracle described below before anyone "fixes" the codifying unit tests, so
the direction of truth is pinned by requirement + tripwire rather than by test churn.

### Proof autonomy plan

- **(a) MC/DC rows once formalized**: `reify_property dispatches base-only row` (T:
  row ends in reify-as-CSSStyleValue → direct object; F: typed row → subclass);
  `direct_reification sets associatedProperty` (T/F on slot == property);
  `currentcolor reifies as identifier` boundary row (identifier branch vs step-2
  fall-through) for color and border-top-color.
- **(b) Named witness tests**: `get('color') after 'color: red' is a direct
  CSSStyleValue` (+ hex/rgb()/transparent legs); `get('border-top-color') … direct`;
  control `currentcolor reifies as an identifier (CSSKeywordValue)` and invariant
  pin `[[associatedProperty]] = color` must stay green through any fix.
- **(c) Lane proposals**: promote `runUnsupportedPropertyTests` lists from the local
  WPT property fixtures into a machine-readable unsupported-value lane (they are the
  normative negative oracle for this class); add a constructor-identity differential
  signal against Chrome for the 110 baseline property files so future over/under
  reification lands per-row instead of as aggregate counts.

## Appendix A — refused filings (every declined candidate, no silent scope-shaving)

### A.1 Computed relative-unit / font-keyword resolution (67 rows) — environment-limitation, DO NOT FILE headless

Rows: margin/scroll-margin `-3.14em` → `unit: expected "px" but got "em"`
(`defaultComputed: (_, result) => assert_is_unit('px', result)`), font-size keyword
rows (`xx-small…larger/smaller` → "relative lengths must compute to a CSSUnitValue"),
line-height/letter-spacing/tab-size em legs. The *specified*-value half of these same
tests passes at HEAD (bare `CSSUnitValue(-3.14,'em')` equality) — the failing half is
exclusively the **computed** map, which requires resolving `em`/`%`/font keywords
against an element's inherited font-size and box geometry. No public Node API surface
(`src/index.ts`) supplies that context; supplying it would mean inventing layout.
Per the mission gate this is environment-limitation, not a library defect: recorded
here so the mass is not silently dropped, and so a future browser-entry/computed-lane
owner knows exactly which 67 rows unlock when font metrics become pluggable.

### A.2 Typed-set TypeError on shorthand/base-only properties (88 rows) — spec-refuted/under-defined

Rows: `Setting 'margin' to a length: 0px throws TypeError` family (margin.html ×12,
plus sibling shorthands). Blink throws because Typed OM supports a fixed property
list; the L1 text does not mandate it: `#dom-stylepropertymap-set` steps contain no
grammar check, and `#create-an-internal-representation`'s subclass branch requires a
match against "the grammar of a [=list-valued property iteration=]" — a concept left
open by Issue(644) ("Define precisely which properties are list-valued and which
aren't"). Reading it strictly enough to make `margin` throw would also make
single-valued supported properties (e.g. `width` + `CSS.px(1)`, which WPT asserts
MUST work) throw. A lone `<length>` `CSSUnitValue` matches `margin`'s whole grammar
(`<length-percentage>{1,4}`). Filing this as a spec violation would not survive
Scrutineer; recording the tension here instead. Note the GET-side consequence of the
same normalization table IS filed (KI-123) — that half is unambiguous.

### A.3 Stale numeric-objects trio + mul/div TypeError row (8 baseline rows) — stale keys + spec-refuted

Baseline keys `arithmetic.tentative.html`, `create-a-type.tentative.html`,
`to.tentative.html` no longer exist upstream (converted to `.any.js` twins by WPT
commit e94af787e3, 2026-07-16) and cannot be reached by the `.html`-only sandbox
crawler — they are dead ledger weight. Probing their assertions against HEAD public
API: `add/sub/min/max` incompatible-type TypeError ✔; `new CSSUnitValue(0,'Hz')
.type()` → `{frequency:1}` ✔; `dpi.type()` → `{resolution:1}` ✔; `to(same unit)`
returns identity ✔. The remaining row — `mul/div` with `(px(1), s(2))` expected to
throw — is contradicted by css-typed-om-1 `#dom-cssnumericvalue-mul` step 5 +
`#multiply-two-types` (~line 1938): length·time multiplication succeeds (only
conflicting percent hints fail), so returning `calc(0px * 1px * 2s)` is
spec-correct. (The WPT row likely passes in browsers vacuously because IDL static
operations like `CSS.px` are not constructors, so `new CSS.px(0)` throws TypeError
before `mul` is reached.) No filing; recommend pruning the three stale keys when the
baseline ledger is next legally editable.

### A.4 Deferred heterogeneous cluster (~153 'other' rows) — real candidates, out of wave budget

Representative members needing individual mining/validation (each is potentially its
own root and should be a future wave):

- animation-timing-function: `step-start`/`step-end` round-trip as themselves instead
  of canonical `steps(1, start)` / `steps(1)` (css-easing-2 keyword canonicalization).
- background-image / border-image-source: url() values do not reify as `CSSImageValue`
  ("Image value must be a CSSImageValue").
- anchor-scope: `--a` keyword leg throws `Invalid value of type CSSKeywordValue` —
  dashed-ident handling in typed set.
- border-image-outset/slice/width, column-rule-style, counter-*: get-shape mismatches
  beyond the two filed roots (mixed number/length grammars, pair values).

Declined this wave purely for budget/scope discipline (quality over quantity);
none were waived, none were approved by fiat.

## Gate outputs (verbatim, end of wave)

```text
$ proof known-issue check
known issue work items clean: 68 issue(s) checked
Summary: status=fixed:13,open:53 severity=high:6,low:4,medium:56 cve_surface=none:66 security_relevant=6

$ proof audit --check known_issue_complete --fail-level warn
Errors: 0  Warnings: 1
(warning = pre-existing ACC-08 note: KI-26 internal duplicate against KI-24
(kill_domain) — present before this batch; 0 of 53 active KIs below quality floor,
including the two new ones)

$ pnpm exec oxlint proof/reproducers/KI-122-*.ts proof/reproducers/KI-123-*.ts
Found 0 warnings and 0 errors. (97 rules)
```

## Created-files list (all new; nothing pre-existing touched; left uncommitted for gates)

```text
proof/reproducers/KI-122-typed-om-negative-range-mathsum-wrap-overlay-260824.ts
proof/reproducers/KI-123-unrepresentable-value-overreification-overlay-260824.ts
proof/known-issues/KI-122.yaml
proof/known-issues/KI-123.yaml
proof/evidence/ki-122.yaml
proof/evidence/ki-123.yaml
specs/system/requirements/SYS-REQ-260824-QGJE.req.yaml
specs/system/requirements/SYS-REQ-260824-XE59.req.yaml
docs/proof-escape-ki-122-123.md   (this file)
```
