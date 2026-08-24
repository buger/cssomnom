# Proof escape analysis: KI-107 through KI-111

This is the Proof escape companion for the ordinary CSSOM conformance batch
KI-107 through KI-111. The five findings remain open and unfixed in `src/**`;
each overlay reproducer asserts the normative result and is expected to stay
red until the product is repaired.

The evidence was captured with the workspace's custom Proof fork at
`/tmp/proof-dx/proof` and Node 24.11.1. Each reproducer was run twice before
capture, and `proof evidence capture` ran it again:

```text
proof/evidence/ki-107.yaml  known_issue_reproduced
proof/evidence/ki-108.yaml  known_issue_reproduced
proof/evidence/ki-109.yaml  known_issue_reproduced
proof/evidence/ki-110.yaml  known_issue_reproduced
proof/evidence/ki-111.yaml  known_issue_reproduced
```

`proof evidence validate --strict`, `proof known-issue check`, and the
`known_issue_complete` audit pass for this batch. The evidence manifests use
the honest KnownIssue validation path; they are not claimed as obligation
profiles because these correctness KIs do not carry an obligation class.
Each failing MC/DC row also carries a reviewed `capability-gap` or
`known-issue` disposition linked to its KI and spec review record (REVIEW-42
through REVIEW-47). This is why the custom Proof fallback scanner reports the
new rows as accepted tripwire-backed KI debt rather than silently counting
them as uncovered.

## KI-107 — malformed `var()` accepted by `CSS.supports()`

Reproducer: `proof/reproducers/KI-107-css-supports-malformed-var-overlay-260822.ts`  
Requirement: `SYS-REQ-260822-V107`  
Spec anchors: CSS Conditional 3 `#the-css-interface`; CSS Variables 1
`#using-variables`.

`CSS.supports('color', 'var()')`, an unclosed function, and a `var()` name
with extra tokens all return `true`. Valid direct, empty-fallback, and
non-empty-fallback controls pass. CSS Conditional requires the two-argument
`supports()` algorithm to return true only when the value parses according to
the property's grammar; the Variables grammar supplies the required dashed
custom-property name and optional fallback.

Why Proof missed it: the existing requirement corpus had a generic
`CSS.supports()` surface but no variable for malformed substitution-function
grammar. The existing syntax checks treated the presence of any `var()` as an
escape hatch, so there was no requirement, obligation, or fixture asking the
feature-query API to distinguish valid and malformed `var()` forms.

What was missing in Proof: a narrow grammar-validity requirement, a positive
empty-fallback control, and independent malformed public-API witnesses. This
is a cssomnom overlay/model gap, not a Proof engine defect.

## KI-108 — nested `var()` custom-property names are not substituted

Reproducer: `proof/reproducers/KI-108-var-name-substitution-overlay-260822.ts`  
Requirement: `SYS-REQ-260822-V108`  
Spec anchors: CSS Variables 1 `#using-variables` and `#replace-a-var`.

For `--other: 10px; --myvar: --other; width: var(var(--myvar))`, the cascade
returns an empty width instead of `10px`; the same failure propagates through
an intermediate `--result` custom property. A direct `var(--other)` control
passes. The local `replace a var()` algorithm explicitly substitutes arbitrary
functions in the first argument before parsing the resulting custom-property
name.

Why Proof missed it: existing variable requirements modeled ordinary
custom-property lookup and fallback replacement, but not the first argument as
a substitution context. No requirement variable or test linked the nested
name relation, so Proof had no row or evidence lane that could distinguish
`var(--other)` from `var(var(--myvar))`.

What was missing in Proof: a relation-aware nested-name requirement and a
public cascade witness for both direct nested substitution and a custom-
property chain. This is a cssomnom model gap; the Proof checks correctly
validated the newly authored requirement and evidence once those artifacts
existed.

## KI-109 — mixed-case `VAR()` / `ENV()` are not dispatched in custom properties

Reproducer: `proof/reproducers/KI-109-case-insensitive-var-env-overlay-260822.ts`  
Requirement: `SYS-REQ-260822-V109`  
Spec anchors: CSS Variables 1 `#using-variables`; CSS Environment Variables 1
`#env-function`.

Lowercase `var()` and `env()` controls resolve, but `VAR()` and `ENV()` stored
in intermediate custom properties remain unresolved at the use site. CSS
function dispatch is ASCII case-insensitive while custom-property text itself
remains author-cased.

Why Proof missed it: the existing tests exercised lowercase direct and
intermediate values only. No requirement variable represented function-name
case, and no obligation bound the custom-property intermediate-value path to
the environment-variable path. Static source tracing therefore saw a normal
variable substitution surface without a mixed-case witness.

What was missing in Proof: a case-partitioned dispatch requirement with
lowercase positive controls and independent mixed-case `VAR()` and `ENV()`
red paths. This is a missing overlay partition, not a classifier defect.

## KI-110 — one `env()` grammar root, two independent failures

Reproducer: `proof/reproducers/KI-110-env-grammar-supports-overlay-260822.ts`  
Requirements: `SYS-REQ-260822-V110` and `SYS-REQ-260822-V11A`  
Spec anchors: CSS Environment Variables 1 `#env-function`; CSS Conditional 3
`#the-css-interface`.

The same grammar root exposes two independently executing failures. First,
`CSS.supports('width', 'env(name)')` and the valid empty-fallback form return
false, although syntactically valid `env()` makes the containing property
parse-valid. Second, `env(name -1, 5px)` is treated as a usable fallback/index
path instead of invalidating the property at computed-value time. A valid
non-negative indexed environment variable is a passing control.

Why Proof missed it: the existing environment-variable coverage treated
`env()` as a substitution-only convenience and did not model its parse-time
grammar or non-negative-integer index domain. The feature-query route and
computed-value route were separate unmodeled surfaces, so neither the
requirement MC/DC rows nor the evidence profiles demanded these cases.

What was missing in Proof: one shared grammar requirement with separate
`CSS.supports()` and invalid-index consequents, plus independent public-API
red witnesses. KI-110 is deliberately one root rather than two duplicate KIs;
the two requirements preserve the independent trace paths. This is an overlay
model gap, not a Proof engine defect.

## KI-111 — registered `<length>` / `<image>` syntax matcher is shallow

Reproducer: `proof/reproducers/KI-111-registered-syntax-matcher-overlay-260822.ts`  
Requirement: `SYS-REQ-260822-V111`  
Spec anchors: Properties and Values API `#the-registerproperty-function` and
`#supported-names`.

`CSS.registerProperty()` accepts `calc(foo)` for `<length>` and
`not-an-image(1)` for `<image>`. Valid `10px` and `url(...)` controls register
successfully. The Properties and Values API requires `initialValue` to parse
against the consumed syntax and throw `SyntaxError` on failure.

Why Proof missed it: existing registration tests checked syntax-string
consumption and successful registration, but not deep initial-value matching
for the individual `<length>` and `<image>` component grammars. The shallow
matcher is syntactically plausible and no invalid-value obligation was linked
to the registration API.

What was missing in Proof: syntax-component-specific invalid initial-value
witnesses and one registration-rejection requirement covering both matcher
branches. This is an overlay/model gap, not a Proof engine defect.

## Batch disposition

All five KIs are ordinary correctness findings with `cve_surface: none`,
`status: open`, and `release_disposition: ship_with_known_issue`. The
reproducers contain exact local Bikeshed anchors and MC/DC annotations,
including known-issue rows. No `src/**` or `PLAN.md` file was changed by this
batch. The only remaining warnings in broad validation/audit output are
repository baseline debt (AI-review/realizability, pre-existing MC/DC and
legacy evidence-profile configuration); the batch's targeted
`known_issue_complete` and strict evidence checks add no warning.

## Landing stamp (champ, 2026-08-24)

Re-verified at landing on branch CSSOmNom/Audit before committing this file:

- All five reproducers exited 1 twice under
  `node --experimental-strip-types --test` (KI-107..111), matching their
  `status: open` contracts.
- Evidence manifests ki-107..111 re-stamped via genuine
  `proof evidence refresh` execution (`observed: command exit fail`, hash
  match against current reproducer bytes).
- Filings completed per campaign bar: grounded 11-rule `poc_quality` blocks,
  `kill_domain` / `do_not_refile_as` added to all five.
- Requirements SYS-REQ-260822-V107..V11A promoted draft → review via
  `proof req status --to review`; review happens through this campaign's LOOP
  gate on the landing commit.
- `proof audit --check known_issue_template_transfer --max-findings 0`,
  `known-issue check`, and `known_issue_complete` report zero findings for
  this batch after filing completion.
