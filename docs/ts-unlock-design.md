# Typed-OM Unlock Design — computedStyleMap surface + relative-color engine

Readiness package for the frozen subsystems documented in
`docs/proof-escape-ki-122-123.md` appendix A.1, vectors `V-TYPED-OM-COMPUTED-UNITS`
(67 computed-unit rows + 4 step-easing rows) and `V-RELATIVE-COLOR-ENGINE`
(~220 rows). Witnesses: `tests/ts-readiness.witness.ts` (the `.witness.ts`
suffix keeps the expected-red suite out of the product glob
`tests/**/*.test.ts`, mirroring proof/reproducers/ for ki-10x);
expected-fail lanes `ts-readiness-{1..10}-tripwire` in `proof.yaml`.

## Decision: Option A (recommended) — export + fixed-root approximation

Export `computedStyleMap` from `src/index.ts` and resolve relative values
against an explicit-or-defaulted context. Basis: the W-C finding
(`docs/proof-escape-ki-127-130.md` §R2) judged the 67-row cluster
headless-implementable with a fixed 16px font-size; Chrome passes these legs
under UA-default root metrics, so constants reproduce browser behavior.

```ts
type ComputedStyleContext = {
    fontSize?: CSSUnitValue;        // default CSS.px(16)   (fixed root)
    containerWidth?: CSSUnitValue;  // default CSS.px(1280)
    parentFontWeight?: number;      // covers bolder/lighter headlessly
};
export function computedStyleMap(
    source: Record<string, string>, context?: ComputedStyleContext
): StylePropertyMapReadOnly;
```

Resolution order per declaration: explicit context > intra-block `font-size`
declaration > defaults. Pure-data legs ignore context entirely.

**Option B (rejected)**: keep browser-entry-only, close both vectors as
wontfix-refused. Costs: abandons the 67-row mass + 4 easing rows that W-C
already judged implementable, leaves `ts-readiness-*` lanes red forever, and
keeps `src/browser-entry.ts` (untested, tsconfig-excluded) as the sole owner
of the computed pipeline. Option B wins only if the surface owner refuses the
approximation constants on principle.

### Row-count math (Option A)

- **Unlocked by export alone (pure data, no context)**: font-weight
  normal/bold→400/700 (`css-fonts-4 #font-weight-absolute-values`: "normal —
  Same as 400", "bold — Same as 700"), SVG `<number>`→px user units, opacity
  clamp [0,1] (`css-color-4 #opacity`: "Computed value: specified number,
  clamped to the range [0,1]"), letter-spacing normal→0px, plus **all 4**
  step-easing rows (`css-easing-2 #steps-serialization`: serialize as
  "steps(1, start)" / "steps(1)") — R3 confirms these need only
  `computedStyleMap().get()`.
- **Unlocked with context constants**: margin/scroll-margin `-3.14em`→px
  family, line-height/tab-size em legs, width `%`→px legs
  (`css-values-4 #em`: em is "equal to the computed value of the 'font-size'
  property"; percentages resolve against containerWidth), font-size keyword
  table rows (`css-fonts-4 #absolute-size-mapping`, larger/smaller = ±1 step).
- **Stays environment-bound**: bolder/lighter rows *unless* `parentFontWeight`
  joins the context (then unlocked); rows measuring real multi-element boxes
  or viewport units. Final per-row disposition requires sweeping the frozen
  `V-TYPED-OM-COMPUTED-UNITS` row list at execution time; estimate ≥60/67
  implementable, remainder refused until a real layout engine exists.

## Relative-color engine (minimal channel-math design)

New module `src/typed-om/color/relative-color.ts` (no Parser import — ride
ParseHooks per AGENTS.md circular-dependency rule):

1. **Grammar** (css-color-5 `#relative-syntax`): accept `from <color>` in
   rgb/hsl/hwb/lab/lch/oklab/oklch/color(); parse origin via the existing
   `CSSColorValue` path; bind channel keywords (r g b h s w l c a) plus
   `<number>|<percentage>|calc()` substitutions.
2. **Conversions**: sRGB ↔ linear-sRGB ↔ XYZ(D65) ↔ Lab/LCH and OKLab/OKLCH
   matrices from css-color-4 §11 (tables belong in codegen from mdn-data/
   @webref/css if not already generated — prefer `scripts/codegen/` over
   hardcoding).
3. **Compute**: convert origin into the relative function's space, substitute
   channels, resolve calc() against bound keywords. Per `#relative-colors`:
   components are **not clamped** ("retained as-is"); omitted alpha defaults
   to the origin alpha and **is clamped** to [0,1]; missing components carry
   forward per css-color-4 interpolation rules.
4. **Reify**: emit CSSRGB/CSSHSL/CSSHWB/CSSLab/CSSLCH/CSSOKLab/CSSOKLCH;
   wire through `style-value-parser.ts` + `color-reify.ts` hooks.

Effort estimate: 3–5 agent-days (grammar 0.5, conversion tables + unit tests
2, reification 1, WPT sweep + lane flips 1). Depends on the surface unlock
only because witnesses observe results through `computedStyleMap().get()`;
`CSSStyleValue.parse` acceptance flips independently once grammar lands.

## Migration: how lanes flip green

Per witness `[ts-rN]` in `tests/ts-readiness.witness.ts`: land the slice of the
contract it pins, confirm the witness passes (`node --test
"--test-name-pattern=ts-rN\b" tests/ts-readiness.witness.ts`), then in the SAME
change delete that lane's `expected: fail` + `reason` pair (or the whole lane)
from `proof.yaml`. Partial flips work lane-by-lane because each lane filters
via `--test-name-pattern "ts-rN\b"`. If any witness turns green before its
unlock ships, reclassify it as a regression pin: keep the test, drop the lane,
note the pin in the file header. Controls (`control-a/b`) never enter lanes.

Hygiene for future prose: lane reasons ≥16 runes, single sentence, no banned
terms (fretish/mcdc/scrutineer/reqproof) and no hedge words ("may be",
"might", "possibly", "it is believed", "appears to") so STE100 lint stays
0/0; KI-side prose follows `known_issue_text_hygiene.ste100`.
