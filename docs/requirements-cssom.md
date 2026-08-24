// Documents: SYS-REQ-260822-YEQZ, SYS-REQ-260822-FM19, SYS-REQ-260822-XEPS, SYS-REQ-260822-50T6, SYS-REQ-260822-HARM, SYS-REQ-260823-KTS6, SYS-REQ-260822-1MB8, SYS-REQ-260824-EVNP, SYS-REQ-260824-BJTQ, SYS-REQ-260824-CFQG, SYS-REQ-260823-S4DW, SYS-REQ-260823-YQPJ, SYS-REQ-260823-0BRJ, SYS-REQ-260823-1V3K, SYS-REQ-260823-BNDX, SYS-REQ-260823-EEQN, SYS-REQ-260823-MRT1, SYS-REQ-260823-SMA3, SYS-REQ-260822-8HDQ, SYS-REQ-260824-XRYP, SYS-REQ-260824-N9AE

# CSSOM object-model requirements

These are the object-model contracts that bind the CSSOM-facing known-issue
reproducers (KI-101…KI-105, KI-112…KI-116, KI-118…KI-121, KI-31, KI-33) plus
the serializer guarantees they exposed. They exist because the differential
WPT campaign found defects where the library *accepts or retains* something a
browser would drop, or *drops/mangles* something a browser would retain.
Each requirement narrows one observable oracle so a single reproducer leg can
be red without muddying its siblings.

Shared verification context (unless stated otherwise per requirement): the
binding evidence is a tripwire under `proof/evidence/ki-N.yaml` running
`proof/reproducers/KI-N-*-overlay-*.ts`, currently **red with observed result
`known_issue_reproduced`** — the defect is confirmed and intentionally left
unfixed in `src/**` for the bug-hunting campaign, so `informal_verification`
stays unverified on purpose. Turning any of these green means shipping the
product fix, not editing this document.

## Keyframes and rule-list lifecycle

### SYS-REQ-260822-YEQZ — keyframe child parent links while attached
Contracts that a `CSSKeyframeRule` inside a `CSSKeyframesRule` carries live
`parentRule`/`parentStyleSheet` back-references. It closes the attach half of
KI-101, where detached keyframe rules broke the rule-tree invariant WPT
asserts via `parentRule` walks. Evidence: `proof/evidence/ki-101.yaml`,
reproducer `proof/reproducers/KI-101-keyframe-parent-links-overlay-260822.ts`.
Status `review`; tripwire red (`known_issue_reproduced`).

### SYS-REQ-260822-FM19 — keyframe child links cleared after removal
The deliberate twin of YEQZ: it pins only the *detach* half — after
`deleteRule()` removes a keyframe child, its parent links must be cleared so
a stale rule cannot masquerade as attached. The split exists because the
reproducer showed attach and detach failing independently, and one combined
requirement could go green while the other half stayed broken.
Evidence: same KI-101 tripwire as YEQZ. Status `review`; tripwire red.

### SYS-REQ-260822-XEPS — counter-style descriptor setter serialization
After `CSSCounterStyleRule` descriptor setters run, `cssText` must serialize
the *current* descriptor state, not a cached parse of the original text.
This binds KI-102, where setter writes were invisible to serialization — a
getter/setter coherence break that no amount of parser correctness would
catch. Evidence: `proof/evidence/ki-102.yaml`, reproducer
`proof/reproducers/KI-102-counter-style-setter-cssText-overlay-260822.ts`.
Status `review`; tripwire red.

### SYS-REQ-260822-50T6 — appendRule rejects trailing garbage tokens
`CSSKeyframesRule.appendRule()` takes the *whole* input as the keyframe
selector; trailing non-whitespace tokens must prevent insertion rather than
being silently truncated away. Closes KI-103, where appendRule laundered
malformed input into an appended rule, diverging from the css-animations-1
setter error contract. Evidence: `proof/evidence/ki-103.yaml`, reproducer
`proof/reproducers/KI-103-keyframes-append-trailing-garbage-overlay-260822.ts`.
Status `review`; tripwire red.

### SYS-REQ-260822-HARM — forbidden declarations dropped in @keyframes blocks
Declarations that css-animations-1 forbids inside keyframe blocks — including
`!important`-marked ones — must be dropped at parse time instead of being
stored. This is the parser-side sibling of the keyframes lifecycle group and
binds KI-104; note the oracle is *drop*, not "parse error", matching how the
spec's error handling works for declaration contexts.
Evidence: `proof/evidence/ki-104.yaml`, reproducer
`proof/reproducers/KI-104-keyframes-forbidden-declarations-overlay-260822.ts`.
Status `review`; tripwire red.

### SYS-REQ-260823-KTS6 — keyText setter rejects grammar violations
The `CSSKeyframeRule.keyText` setter must throw `SyntaxError` and leave the
old value intact for anything outside `<keyframe-selector>`
(`from | to | <percentage [0,100]>`). The non-obvious part: JS numeric
coercion is not validation — accepting `0x10%` as 16% passes a `Number()`-based
check while violating the token grammar, which is exactly what KI-44 caught at
the `normalizeKeyframeSelector` call site. The tokenizer already drops such
selectors during `@keyframes` parsing, so the setter must agree with the
parser instead of using a weaker homemade check.
Evidence: `proof/evidence/ki-44.yaml`, reproducer
`proof/reproducers/KI-44-keytext-setter-js-coercion-overlay-260823.ts`.
Status `draft`; tripwire red.

## Declaration-block parsing and value storage

### SYS-REQ-260822-1MB8 — invalid declaration values dropped
A declaration whose value fails the applicable property grammar is ignored,
leaving `getPropertyValue` empty for that property while neighbors survive.
Narrowly introduced to bind KI-105 (property-specific invalid-value oracle);
its value is that it isolates *value-grammar* failures from structural parse
failures covered elsewhere, so a fix in one lane cannot mask the other.
Evidence: `proof/evidence/ki-105.yaml`, reproducer
`proof/reproducers/KI-105-stylesheet-invalid-display-overlay-260822.ts`.
Status `review`; tripwire red.

### SYS-REQ-260824-EVNP — duplicate declarations retained, never silently dropped
cssom-1's declaration-block loop appends every successfully parsed
declaration — repeats included — and cascade arbitration decides winners only
at computed-value time. This requirement closes KI-119, where a repeated
shorthand (`font:` twice) lost the earlier entry at parse time, a decision the
spec reserves for the cascade, not the parser. The budget variable
(`dropped_duplicate_count <= 0`) counts losses across both plain-property and
shorthand legs. Formalized against `specs/system/variables/cssom-budget.vars.yaml`.
Evidence: `proof/evidence/ki-119.yaml`, reproducer
`proof/reproducers/KI-119-repeated-shorthand-declaration-loss-overlay-260824.ts`.
Status `review`; defect legs red.

### SYS-REQ-260824-BJTQ — stored values carry no trailing whitespace
css-syntax-3 #consume-declaration strips trailing whitespace tokens before
storage, so every read surface (`getPropertyValue`, cssText, Typed OM)
returns the canonical value. Closes KI-120, where a stored trailing space
leaked into serializations — harmless-looking until a byte-exact WPT
serialization comparison fails. Budget variable `value_whitespace_leak_count <= 0`
from `cssom-budget.vars.yaml`. Evidence: `proof/evidence/ki-120.yaml`,
reproducer `proof/reproducers/KI-120-declaration-value-trailing-whitespace-overlay-260824.ts`.
Status `review`; defect legs red.

### SYS-REQ-260824-CFQG — grammar-invalid color declarations dropped
Extends the 1MB8 principle to `color` specifically against css-color-5's
relative-color grammar: WPT-invalid spellings like `rgb(from rebeccapurple r
10deg 10)` must be dropped, not retained. Worth its own requirement because
the relative-color rows were newly pinned upstream and the library accepted
them — a fresh conformance surface, not a re-run of the generic oracle.
Budget variable `invalid_color_retention_count <= 0`.
Evidence: `proof/evidence/ki-117.yaml`, reproducer
`proof/reproducers/KI-117-relative-color-invalid-retained-overlay-260824.ts`.
Status `review`; defect legs red.

## Font shorthand retention

### SYS-REQ-260823-S4DW — lone system font keyword retained and round-trips
Setting or parsing exactly one system font keyword (`caption|icon|menu|…`)
must leave `getPropertyValue('font')` equal to the keyword and stable under a
read-back-and-reset cycle. These keywords are grammatically valid as a lone
alternative per css-fonts-4 #font-prop, so dropping them is overzealous error
handling, not conformance — that is the escape KI-112 closed. Budgets come
from the reproducer's 6 keywords × parse/setProperty legs (currently red).
Evidence: `proof/evidence/ki-112.yaml`, reproducer
`proof/reproducers/KI-112-font-system-keyword-shorthand-empty-overlay-260823.ts`.
Status `review`; defect legs red.

### SYS-REQ-260823-YQPJ — system keyword must not pollute longhands
Companion to S4DW with a different failure mode: the keyword must stay on the
shorthand only. Stamping it into all 13 specified longhand values (what the
library does today) contradicts css-fonts-4, which keeps system-font longhand
values at the UA's disposal, and breaks the local
`system-fonts-serialization.tentative.html` fixture that asserts empty-string
longhands. Sharing KI-112's reproducer but counting longhand pollution
separately keeps the two repairs independently testable.
Evidence: same KI-112 tripwire. Status `review`; defect legs red.

### SYS-REQ-260823-0BRJ — invalid keyword mixes dropped
The mirror image of S4DW: a font value mixing a system keyword with size or
family components (`font: menu 10px serif`) matches *neither* grammar
alternative and must be dropped, leaving `font` empty. The subtlety the
budget encodes: `setProperty` and `insertRule` paths already honor this, while
stylesheet `parse()` legs stay red — so the contract is about closing the
path inconsistency KI-113 found, not inventing new grammar rules.
Evidence: `proof/evidence/ki-113.yaml`, reproducer
`proof/reproducers/KI-113-font-shorthand-invalid-mix-accepted-overlay-260823.ts`.
Status `review`; parse legs red, control legs green.

## border-image retention and stability

### SYS-REQ-260823-1V3K — valid border-image declarations fully retained
Parsing or setting a grammatically valid border-image (quoted url() source,
numeric slice) must preserve it end to end: source readable back, slice
applied, declaration present in cssText. Closes KI-114, where valid values
were laundered to initial longhands or lost their slice — a drop the spec
licenses only for grammar failures. The budget counts 4 defect legs against 3
green WPT controls from `border-shorthand-serialization.html`.
Evidence: `proof/evidence/ki-114.yaml`, reproducer
`proof/reproducers/KI-114-border-image-declaration-lost-overlay-260823.ts`.
Status `review`; defect legs red, controls green.

### SYS-REQ-260823-BNDX — border-image serialization reaches a one-cycle fixpoint
Serializing `border-image:url(…)` and re-parsing must converge after one pass:
source stays quoted, shorthand reads unchanged, cssText matches input.
Distinct from 1V3K because the defect there is *loss*; here it is *instability*
(the url("") function form drifting toward `none`), proven implementation bug
by contrast with the stable `background:url()` control on the identical token
shape. Budget `border_image_fixpoint_drift <= 0`.
Evidence: `proof/evidence/ki-116.yaml`, reproducer
`proof/reproducers/KI-116-border-image-url-fixpoint-overlay-260823.ts`.
Status `review`; defect legs red, controls green.

## Media and feature-query condition surfaces

### SYS-REQ-260823-EEQN — grouped negation survives conditionText round-trip
`((not (x)) and (r))` serialized to `conditionText` and re-parsed must yield
the same condition — the grouping parentheses around `<media-not>` are
load-bearing because mediaqueries-4 defines `not` only over
`<media-in-parens>`. Binds KI-115's narrow grouped-negation legs, where
collapsing them let #error-handling replace the query with `not all`. Green
controls reuse mq-invalid-media-type-005.html grammar-error rows so the
budget measures only illegitimate collapses.
Evidence: `proof/evidence/ki-115.yaml`, reproducer
`proof/reproducers/KI-115-media-condition-roundtrip-collapse-overlay-260823.ts`.
Status `review`; defect legs red, controls green.

### SYS-REQ-260823-MRT1 — media condition serialization preserves evaluability
The general contract behind EEQN: every and/or operand stays a
`<media-in-parens>` through a serialize/re-parse cycle, since conditional-rule
`conditionText` forbids logical simplifications like removing parentheses.
Predates EEQN and binds the root cause — the serializer joining nested
and/or children bare (KI-31) — whereas EEQN pins the specific
grouped-negation symptom; both stay until the serializer fix makes both
green. Evidence: `proof/evidence/ki-31.yaml`, reproducer
`proof/reproducers/KI-31-media-condition-paren-dropping-overlay-260823.ts`.
Status `review`; tripwire red.

### SYS-REQ-260823-SMA3 — CSSSupportsRule exposes readonly matches
Every `CSSSupportsRule` instance must expose the css-conditional-3 `matches`
IDL attribute evaluating its own conditionText. Closes KI-33, where the
attribute was absent outright (`typeof rule.matches === 'undefined'`). The
rationale records why this is assertable offline: the library's public
`CSS.supports()` already evaluates identical conditions, so no browser host
is needed to check agreement.
Evidence: `proof/evidence/ki-33.yaml`, reproducer
`proof/reproducers/KI-33-supports-rule-matches-idl-overlay-260823.ts`.
Status `draft`; tripwire red.

## Serialization fidelity

### SYS-REQ-260822-8HDQ — identifiers escaped per serialize-an-identifier
Hash token values and AST function names must escape identifier-context code
points, so decoded `; { } :` cannot break out of declaration/rule boundaries
when cssText is re-parsed. This closes an *injection* escape (KI-21), not a
conformance cosmetic: an escaped `#\3B` re-emitted raw becomes a real `;` and
smuggles declarations across a boundary on re-embed.
Evidence: `proof/evidence/ki-21.yaml`, reproducer
`proof/reproducers/KI-21-serializer-hash-identifier-escape-overlay-260822.ts`.
Status `draft`; tripwire red.

### SYS-REQ-260824-XRYP — attr() namespaced names serialize losslessly
Serialization of `attr()` must preserve the optional namespace pipe and
fallback exactly as css-values-5's `<attr-name>` grammar admits
(`attr(|bar)`, `attr(|bar, "fallback")`), keeping serialize-then-reparse
lossless — dropping the pipe changes which attribute the value denotes, which
is semantic corruption rather than formatting drift. Local WPT fixture
`serialize-values.html` pins the verbatim rows. Budget
`attr_namespace_drop_count <= 0` from `cssom-budget.vars.yaml`.
Evidence: `proof/evidence/ki-121.yaml`, reproducer
`proof/reproducers/KI-121-attr-namespaced-name-dropped-overlay-260824.ts`.
Status `review`; defect legs red.

### SYS-REQ-260824-N9AE — NaN math results use the canonical keyword spelling
Math functions evaluating to NaN must serialize with the exact `NaN`
capitalization of css-values-4 #calc-serialize step 2 (`calc(NaN)`, or
`calc(NaN * 1px)` for length-typed results); lowercase `nan` anywhere is a
defect. Spelling is normative here because the local
`calc-infinity-nan-serialize-*` fixtures assert byte-exact output (160
baseline failures), so case-insensitive acceptance still fails WPT.
Evidence: `proof/evidence/ki-118.yaml`, reproducer
`proof/reproducers/KI-118-calc-nan-canonical-keyword-overlay-260824.ts`.
Status `review`; defect legs red.
