// Documents: SYS-REQ-260824-DAS2, SYS-REQ-260824-4RGN, SYS-REQ-260824-BRYV, SW-REQ-260824-CAHE, SW-REQ-260824-JS91, SW-REQ-260824-23WT

# HSL color-resolver variable-model requirements

Six sibling guarantees from the 2026-08-24 variable-model cleanup batch that
formalized the cascade's `hslToRgb` behavior in `src/cascade/color-resolver.ts`.
Unlike the known-issue groups, these are not tripwire-bound: their witnesses
are green unit tests cited in each rationale. The family exists because
css-color-4's hsl-to-rgb algorithm is specified as 60-degree hue sectors plus
a 3-or-4-component arity rule, and MC/DC analysis showed the sector and arity
decisions had no owned requirements — only incidental test coverage.

The three system-level requirements (parents under STK-REQ-260821-D7WX) state
the sector/arity contracts; the three software-level children restate them
with the 4-part slash-form bound pinned explicitly, because
`parseHslComponents` rejects arities above 4 and that upper edge was the
untested decision boundary. All six are status `review`, assurance level C,
FRETish formalization valid; nominal obligations carry a deferral noting the
positive witnesses exist but the triple-form requirement tags land with the
next tests batch (`tests/**` frozen during this batch).

### SYS-REQ-260824-DAS2 — hsl() parses at 3–4 components only
The converter accepts exactly 3-part (comma/space forms) and 4-part (slash
alpha) component lists and returns null otherwise, keeping authored text
unparsed rather than guessing. The non-obvious escape it closes: 2-part and
5-part lists must *not* reach hslToRgb at all, which the witnesses pin at both
edges (`hsl(0, 100%)` never converts; `hsl(1, 2, 3, 4, 5)` stays unparsed).
Witnesses: `tests/mcdc-cascade-vars.test.ts:177-198`,
`tests/mcdc-witness-domain-bounds.test.ts:460-469`.

### SYS-REQ-260824-4RGN — chroma assigned to green in the 60–180° sector
For normalized hue in [60°, 180°) with a parseable list, chroma lands on the
green channel per css-color-4's sector table. Witnessed by hsl(120) →
rgb(0, 255, 0) plus the sector chain through hsl(300), guarding against
off-by-one sector boundaries (59.9 vs 60 degrees) that would shift chroma to
red. Witness: `tests/mcdc-witness-domain-bounds.test.ts:476-487`,
`tests/mcdc-cascade-vars.test.ts:149-168`.

### SYS-REQ-260824-BRYV — chroma assigned to blue in the 180–300° sector
Mirror of 4RGN for the blue sector: hue in [180°, 300°) assigns chroma to
blue (hsl(180) → rgb(0, 255, 255), hsl(210) → rgb(0, 128, 255), hsl(240) →
rgb(0, 0, 255)). Kept separate from 4RGN because the sectors are independent
branch outcomes in the resolver — one requirement covering all sectors would
let two stay unwitnessed while one passes.
Witnesses: `tests/mcdc-cascade-vars.test.ts:163-168`.

### SW-REQ-260824-CAHE — software-level arity contract with normalized-hue domain
Child of DAS2 adding what the system statement leaves implicit: the contract
holds across the full normalized hue domain [0°, 360°) including angle units
beyond degrees (`2rad`, `0.5turn`), while other arities still return null.
Exists so the unit-normalization path (`<angle>` → degrees) cannot regress
without failing an owned requirement. Witnesses:
`tests/mcdc-cascade-vars.test.ts:155-158,177-198`.

### SW-REQ-260824-JS91 — software-level green-sector contract
Child of 4RGN pinning the same green-sector outcome under the 3-or-4-part
arity precondition, witnessed end-to-end through the slash form
(`hsl(120 100% 50% / 0.4)` → rgba(0, 255, 0, 0.4)) — proving chroma
assignment survives the alpha-carrying parse path, not just the legacy comma
form. Witnesses: `tests/mcdc-cascade-vars.test.ts:177-180`,
`tests/mcdc-witness-domain-bounds.test.ts:476-487`.

### SW-REQ-260824-23WT — software-level blue-sector contract
Child of BRYV mirroring JS91 for blue: sector assignment holds for hsl(180),
hsl(210), hsl(240) including slash-form input. Together the three software
children guarantee that every (sector × arity) combination in the resolver's
decision table has a named owner — the cleanup batch's stated purpose.
Witnesses: `tests/mcdc-cascade-vars.test.ts:163-168,177-180`.
