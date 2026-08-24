// Documents: SYS-REQ-260822-V108, SYS-REQ-260822-V109, SYS-REQ-260822-V110, SYS-REQ-260822-V11A, SYS-REQ-260822-EGPW, SYS-REQ-260822-8BK4, SYS-REQ-260824-QGJE, SYS-REQ-260824-XE59

# Cascade substitution and Typed OM requirements

Two families live here: the var()/env() substitution semantics the cascade
owes to css-variables-1 and CSS Environment Variables (KI-108…KI-111), and
the resource/reification guarantees of Typed OM numeric conversion
(KI-19, KI-122, KI-123). All bind tripwires under `proof/evidence/` with
reproducers under `proof/reproducers/`, observed red
(`known_issue_reproduced`) by design — defects are confirmed but intentionally
unfixed in `src/**` during the campaign.

## Custom property and env() substitution semantics

### SYS-REQ-260822-V108 — nested var() substitutes the property name
When the custom property name itself arrives wrapped in a nested `var()`,
the cascade must substitute that inner function before resolving the name —
css-variables-1 processes functions in the first argument first. KI-108
showed the library treating the wrapper text as a literal name, so
`var(var(--x))` chains silently failed. Evidence: `proof/evidence/ki-108.yaml`,
reproducer `proof/reproducers/KI-108-var-name-substitution-overlay-260822.ts`.
Status `review`; tripwire red.

### SYS-REQ-260822-V109 — VAR()/ENV() dispatch is case-insensitive
Mixed-case `VAR()`/`ENV()` must dispatch as their lowercase forms while
author casing is preserved in stored custom-property values. The distinction
matters: css-variables-1 requires case *preservation* for names but ASCII
case-insensitive function matching for keywords — KI-109 caught the two rules
being conflated so cased functions fell through unsubstituted.
Evidence: `proof/evidence/ki-109.yaml`, reproducer
`proof/reproducers/KI-109-case-insensitive-var-env-overlay-260822.ts`.
Status `review`; tripwire red.

### SYS-REQ-260822-V110 — CSS.supports accepts syntactically valid env()
A syntactically valid `env()` in a supported property makes
`CSS.supports()` return true: environment-variable syntax is assumed valid at
parse time per its spec, so supports-time rejection is always wrong. Half of
the KI-110 reproducer (shared with V11A because one grammar path produces
both the accept-side and index-side failures).
Evidence: `proof/evidence/ki-110.yaml`, reproducer
`proof/reproducers/KI-110-env-grammar-supports-overlay-260822.ts`.
Status `review`; tripwire red.

### SYS-REQ-260822-V11A — invalid env() index invalid at computed-value time
The other half of env() grammar handling: only non-negative integers are
valid indices, and an out-of-grammar index must make the value invalid at
computed-value time (fallback/failure semantics), not parse-time garbage.
Kept separate from V110 so the accept-at-supports fix cannot be declared done
while computed-value evaluation still mishandles indices.
Evidence: same KI-110 tripwire as V110. Status `review`; tripwire red.

## Substitution resource bounds

### SYS-REQ-260822-EGPW — acyclic var()/env() expansion size bounded
Cycle detection exists per css-variables-1, but an *acyclic* fan-out DAG of
custom properties still expands exponentially (2^(N+1)−1 characters for an
N-deep doubling chain) — CPU, memory, and stack growth from attacker CSS with
no spec-mandated cap to lean on, hence this hardening budget of ≤ 10000
substitution output characters rather than a conformance clause. KI-17
demonstrated the doubling-chain blowup through both `getCascadedStyle` and
`Parser.resolveVariables`. Evidence: `proof/evidence/ki-17.yaml`, reproducer
`proof/reproducers/KI-17-var-env-exponential-expansion-overlay-260822.ts`.
Status `draft`; tripwire red.

## Typed OM numeric safety and reification

### SYS-REQ-260822-8BK4 — to()/toSum() intermediate term count capped
Converting a product of sums with distinct unit maps distributes into a
cartesian term explosion (2^n terms) before any result is produced; the
conversion must bound intermediate terms (≤ 4096 in the formalization) and
fail closed instead of allocating. KI-19 showed a compact
`calc((1px + 1em)*(1px + 1em)*…)` string forcing exponential memory/CPU ahead
of what ends in a TypeError anyway — pure denial-of-service surface.
Evidence: `proof/evidence/ki-19.yaml`, reproducer
`proof/reproducers/KI-19-numeric-tosum-cartesian-expansion-overlay-260822.ts`.
Status `draft`; tripwire red.

### SYS-REQ-260824-QGJE — out-of-range numeric parts wrapped in CSSMathSum
Per css-typed-om-1 #create-an-internal-representation, storing a value whose
numeric part violates a limited range (`flex-grow: -3.14` against
`<number [0,∞]>`) must wrap that part in a fresh `CSSMathSum`, so `get()`/
`getAll()` reify a sum containing the input unit value — not the bare input.
WPT's `assert_is_equal_with_range_handling` pins this across 42 typed-om
fixtures; the budget counts bare-CSSUnitValue reads over KI-122's defect legs
with in-range controls green, so a blanket wrap-everything fix would fail it.
Evidence: `proof/evidence/ki-122.yaml`, reproducer
`proof/reproducers/KI-122-typed-om-negative-range-mathsum-wrap-overlay-260824.ts`.
Status `review`; defect legs red, controls green.

### SYS-REQ-260824-XE59 — unrepresentable values reify as plain CSSStyleValue
For properties whose css-typed-om-1 #reify-property row says "reify as a
CSSStyleValue" (`color`, `border-top-color` excepting `currentcolor`),
`get()`/`getAll()` must return a direct `CSSStyleValue` carrying
`[[associatedProperty]]` — never a keyword/color subclass instance boxing the
value. Closes KI-123's over-reification, which WPT's
runUnsupportedPropertyTests flags as "must be a CSSStyleValue and not one of
its subclasses" (204 failing sandbox rows). Budget counts subclass-boxed reads
while pinning the `[[associatedProperty]]` attribute green.
Evidence: `proof/evidence/ki-123.yaml`, reproducer
`proof/reproducers/KI-123-unrepresentable-value-overreification-overlay-260824.ts`.
Status `review`; defect legs red, control legs green.
