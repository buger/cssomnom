// Documents: SYS-REQ-260825-VKNX, SYS-REQ-260825-V4ZS, SYS-REQ-260825-2FMA, SYS-REQ-260825-26NJ
# Proof escape analysis: KI-127…KI-130 (Typed OM subsystem fidelity — WAVE-C clusters)

Companion to the WAVE-C typed-OM batch filed from the wpt-sandbox known-failure mass
(546 baseline rows / 118 files re-mined at HEAD). Four filings:

- **KI-127** — `url()` reifies as concrete `CSSURLImageValue`; L1 exposes only the
  opaque exact `CSSImageValue` (`#imagevalue-objects`). 5 sandbox rows.
- **KI-128** — declared StylePropertyMap iterates in sorted key order instead of
  inline declaration order (`#declared-stylepropertymap`). 2 sandbox rows.
- **KI-129** — `append()` skips the pending-substitution TypeError when `var()`
  hides behind a shorthand (`#append-to-a-stylepropertymap` step 7). 1 row.
- **KI-130** — unitless zero coerces to px on border-image-outset/width instead of
  preserving the number leg (`#reify-a-numeric-value` steps 2–3). 1–2 rows.

All reproduction used public API only (`parse` + `StylePropertyMap` +
`CSSStyleValue.parse/parseAll` + value classes from `src/index.ts`) — no dom-shim,
no vm sandbox, no browser-entry surface.

## The C5 iteration-order question (refuted hypothesis overturned, with both passages)

An earlier ledger hypothesis claimed sorted iteration is spec-mandated and used that
to refute this cluster. css-typed-om-1 carries **two** ordering rules:

1. **Default rule** (div before `#stylevalue-subclasses`, ~line 424):

   > "Unless otherwise stated, the initial ordering of the {{[[declarations]]}}
   > internal slot is based on the key of each entry: 1. Standardized properties …
   > [=ASCII lowercased=] and then sorted in increasing code-point order. …
   > 3. [=Custom properties=], sorted in increasing code-point order."

2. **Declared-map override** (`#declared-stylepropertymap`, ~line 824):

   > "When constructed, the {{[[declarations]]}} internal slot for [=declared
   > StylePropertyMap=] objects is initialized to contain an entry for each property
   > with a valid value inside the {{CSSStyleRule}} or inline style that the object
   > represents, **in the same order as the {{CSSStyleRule}} or inline style**."

The default rule is self-conditioned ("unless otherwise stated"); the declared-map
init states otherwise, so **declaration order governs declared StylePropertyMap
instances** (`CSSStyleRule.styleMap`, `element.attributeStyleMap`, and our
constructor-backed declared maps), with custom properties interleaved at source
positions. Local WPT `declared/iterable.tentative.html` pins exactly that order
(`['--A','width','--C','transition-duration','color','--B']`). The refutation read
only passage 1; it does not survive passage 2. KI-128 FILED.

## Root-dedup table (all existing KI titles + affected_api reviewed)

| New | Distinct from | Why |
|---|---|---|
| KI-127 | KI-123 (`reified_type_identity`) | Opposite direction of error: KI-123 covers table rows requiring a direct base `CSSStyleValue`; here the spec DOES define an image class, and we leak a MORE-derived concrete subclass the IDL never exposes. |
| KI-127 | KI-116 (border-image url fixpoint) | KI-116 pins cssText round-trip text collapse; KI-127 pins only reified constructor identity on get(). |
| KI-128 | KI-119 (declaration_retention) | KI-119 pins how many repeated entries survive; KI-128 pins traversal ORDER of surviving entries. Different clause, different observable. |
| KI-129 | KI-107/108/109 (var grammar/substitution/case) | Those cover CSS.supports(), cascade substitution order, ASCII-case dispatch; KI-129 covers the Typed OM append guard only. set() has no such clause in the spec, so the filing asserts append only. |
| KI-130 | KI-122 (`numeric_range_wrapping`) | KI-122 = range wrap of negative magnitudes into a fresh CSSMathSum; KI-130 = unit identity of an IN-RANGE zero on a dual length-or-number grammar. No wrap involved. |
| KI-130 | KI-114 / KI-116 | Both pin declaration-block text outcomes; KI-130 pins only the CSSUnitValue unit of typed round-trips. |

## Twice-red evidence record

Node v24.11.1, custom Proof binary `/tmp/proof-dx/proof` 0.1.0-dev. Every reproducer
ran twice BEFORE filing — both runs exited 1 for the asserted reasons, controls green:

```text
KI-127  run 1 exit 1   5 tests: 2 controls (keyword reify, instanceof hierarchy), 3 defect failures
KI-127  run 2 exit 1   identical counts
KI-128  run 1 exit 1   5 tests: 3 controls (empty map, list values, custom reify), 2 defect failures
KI-128  run 2 exit 1   identical counts
KI-129  run 1 exit 1   4 tests: 2 controls (longhand var throws, plain append works), 2 defect failures
KI-129  run 2 exit 1   identical counts
KI-130  run 1 exit 1   7 tests: 4 controls (non-zero number x3, pure-length zero px), 3 defect failures
KI-130  run 2 exit 1   identical counts
```

`proof evidence capture` then genuinely re-executed each reproducer and stamped
`proof/evidence/ki-{127,128,129,130}.yaml` (`status: fail`,
`observed_result: known_issue_reproduced`). Freshness sha256 verified equal to
`sha256sum` of the final reproducer bytes for all four.

Requirement drafts created through `proof req new` under the fidelity-family parent
`STK-REQ-260821-BQKD`: `SYS-REQ-260825-VKNX` (KI-127), `SYS-REQ-260825-V4ZS`
(KI-128), `SYS-REQ-260825-2FMA` (KI-129), `SYS-REQ-260825-26NJ` (KI-130). They are
informal prose + spec references; formal variables live as undeclared names until
`specs/system/variables/cssom.vars.yaml` ownership clears (**formalization debt**,
same posture as KI-122/123).

## Refused candidates (no silent scope-shaving)

### R1 · C1 REG-GAP leftovers (text-combine-upright digits, cubic-bezier/steps legs) — DUPLICATE of KI-125, do not file

Live-verified at HEAD: `CSSStyleValue.parse('text-combine-upright', 'digits 3')`,
`parse('animation-timing-function', 'cubic-bezier(0.1, 0.7, 1.0, 0.1)')`, and
`parse('transition-timing-function', 'steps(4, end)')` all throw today. But the root
is exactly KI-125's generic claim: "Stale registry syntax strings reject
grammar-valid property values" (kill_domain `registry_data_drift`, remediation
"regenerate property syntax strings from mdn-data or @webref/css through
scripts/codegen"). KI-125 already owns scrollbar-gutter both-edges,
font-variant-alternates functions, text-indent hanging, and font-palette
dashed-ident legs; the easing/writing-modes legs differ only in property name, not
mechanism. Honest counting bar #1 bars re-filing symptoms of an already-counted
defect. Action item: fold these legs into KI-125's remediation verification when the
registry regenerates (sibling agents own scripts/codegen/**).

### R2 · C2 COMPUTED-UNITS (67 rows) — REFUSED: public-surface gate; sharpens prior refusal A.1

W-C judged the cluster headless-implementable with a fixed 16px font-size. That
judgment fails one gate earlier than data availability:

1. **No public computed map exists.** css-typed-om-1
   `#computed-stylepropertymapreadonly` requires the [[declarations]] slot to hold
   "the name and [=computed value=] of every longhand". Producing computed values is
   the cascade/computed-value pipeline's job; the only `computedStyleMap` in the
   product lives in `src/browser-entry.ts` DOM patching, and `src/index.ts` exports
   no equivalent constructor. A reproducer would have to drive the WPT sandbox DOM
   shim, which prior refusals (A.1/A.2) and the honest bar (#4 public-API
   reproducer) exclude.
2. **Sub-mechanism split recorded for the future owner** (unlock conditions):
   - Pure-data once ANY computed surface exists: font-weight normal/bold→400/700,
     SVG `<number>`→px user units, opacity clamping to [0,1].
   - Additionally context-dependent: em/%→px needs inherited font-size resolution;
     bolder/lighter need parent weight — adjacent to open KI-38 (cascade computed
     path ignores PropertyRegistry).

Nothing is waived; the mass stays documented so a browser-entry/computed-lane owner
knows exactly what unlocks.

### R3 · C3 STEPS canonicalization (4 rows) — REFUSED: same computed-surface gate

Anchor verified locally: css-easing-2 `#step-easing-function` ("step-start …
Computes to ''steps(1, start)''") and `#steps-serialization` (~line 897): "Unlike
the other [=easing function=] keywords, ''step-start'' and ''step-end'' do not
serialize as themselves. Instead, they serialize as 'steps(1, start)' and
'steps(1)', respectively." All four failing WPT assertions run against
`element.computedStyleMap().get(...)` (fixture `computed:` callbacks); the declared
map correctly preserves `step-start` per the specified-value contract (live-verified,
and the fixture's default specified equality demands exactly that). With no public
computed map (see R2), the observable is unreachable from an honest reproducer.
Re-file together with the R2 unlock, not separately.

## Proof autonomy plans

- **KI-127** — (a) MC/DC rows once formalized: url reifies exact opaque class (T/F
  vs subclass leak); keyword leg unaffected. (b) Witness tests pinned by the three
  red identity legs + two green controls. (c) Lane: promote `assert_class_string`
  expectations from local WPT property fixtures into a machine-readable
  constructor-identity differential signal vs Chrome (needs a NEW differential-reify
  lane; not the invalid-superset lane).
- **KI-128** — (a) MC/DC rows: declared init preserves source position (T/F vs key
  sort); custom props interleave (T/F vs group-at-end). (b) Witnesses: mixed-order
  keys + first-entry legs. (c) Lane: extract iterable.tentative expectations into a
  fixture lane keyed by declaration text (NEW ordered-declaration fixture lane).
- **KI-129** — (a) MC/DC rows: guard inspects shorthand-derived entries (T/F);
  throw-before-mutation ordering (T/F). (b) Witnesses: shorthand-var append throw +
  storage-untouched legs; longhand-var control stays green. (c) Lane: extend the
  append.tentative invalid matrix into a pending-substitution oracle lane (NEW
  lane; orthogonal to the existing invalid-superset accept-invalid family).
- **KI-130** — (a) MC/DC rows: reify dispatches on matched grammar leg (T/F);
  dimension-zero→px branch reachable only via true dimensions (T/F). (b) Witnesses:
  typed-zero outset/width + string-zero legs; non-zero + pure-length controls stay
  green. (c) Lane: unit-identity round-trip lane over dual length-or-number
  grammars derived from registry range metadata (NEW numeric-unit lane).

## Gate outputs (verbatim, end of wave)

```text
$ proof known-issue check
known issue work items clean: 72 issue(s) checked
Summary: status=fixed:13,open:59 severity=high:6,low:5,medium:61 cve_surface=none:70 security_relevant=6

$ proof audit --check known_issue_complete --fail-level warn
Errors: 0  Warnings: …

$ pnpm exec oxlint proof/reproducers/KI-12{7,8,9}*.ts proof/reproducers/KI-130*.ts
Found 0 warnings and 0 errors. (97 rules)
```

## Created-files list (all new; nothing pre-existing touched; left uncommitted for gates)

```text
proof/reproducers/KI-127-typed-om-url-imagevalue-opaque-leak-overlay-260825.ts
proof/reproducers/KI-128-declared-stylemap-declaration-order-overlay-260825.ts
proof/reproducers/KI-129-append-pending-substitution-shorthand-overlay-260825.ts
proof/reproducers/KI-130-border-image-unitless-zero-number-leg-overlay-260825.ts
proof/known-issues/KI-127.yaml
proof/known-issues/KI-128.yaml
proof/known-issues/KI-129.yaml
proof/known-issues/KI-130.yaml
proof/evidence/ki-127.yaml
proof/evidence/ki-128.yaml
proof/evidence/ki-129.yaml
proof/evidence/ki-130.yaml
specs/system/requirements/SYS-REQ-260825-VKNX.req.yaml
specs/system/requirements/SYS-REQ-260825-V4ZS.req.yaml
specs/system/requirements/SYS-REQ-260825-2FMA.req.yaml
specs/system/requirements/SYS-REQ-260825-26NJ.req.yaml
docs/proof-escape-ki-127-130.md   (this file)
```
