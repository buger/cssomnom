// Documents: SYS-REQ-260823-QBD2, SYS-REQ-260823-PRT3, SYS-REQ-260823-BTC4, SYS-REQ-260823-PVE7, SYS-REQ-260823-DRP5, SYS-REQ-260822-JD78, SYS-REQ-260823-SCS2, SYS-REQ-260823-00C0, SYS-REQ-260822-ZQJT, SYS-REQ-260823-PMB5, SYS-REQ-260822-V111

# Parser API, selector, and registry requirements

This group collects contracts outside the CSSOM object layer: the Parser API
surface (WICG css-parser-api semantics over css-syntax-3), selector matching
semantics and its complexity budget, and `@property` registration validation.
They bind known issues KI-16, KI-22, KI-32, KI-34, KI-35, KI-40…KI-45.

Shared verification context: each requirement's binding evidence is a
tripwire manifest under `proof/evidence/` executing a reproducer under
`proof/reproducers/`, observed **red with result
`known_issue_reproduced`** — the defects are confirmed and intentionally
unfixed in `src/**` during the campaign. `informal_verification.verified`
stays false until the product repair lands; these documents describe the
contracts, they do not claim the behavior holds today.

## Parser API contracts

### SYS-REQ-260823-QBD2 — qualified-rule bodies expose declarations
Parsing a style rule through the Parser API must surface its declarations as
`CSSParserDeclaration` entries in `body`, at top level and inside at-rules.
KI-40 found the mapping branch dead: the converter checked truthiness of an
inherited-but-empty `cssRules` before consulting `style`, so every style-rule
body serialized empty while the data was actually parsed. The requirement is
written to cover both call paths so fixing only the top-level one cannot pass.
Evidence: `proof/evidence/ki-40.yaml`, reproducer
`proof/reproducers/KI-40-parser-api-style-rule-body-drops-declarations-overlay-260823.ts`.
Status `draft`; tripwire red.

### SYS-REQ-260823-PRT3 — at-rule prelude survives serialization round-trip
Serializing a Parser API at-rule and re-parsing must reproduce the same
at-rule *name*, which requires keeping a separator between at-keyword and
prelude. KI-41 caught `@media screen` collapsing into an at-rule literally
named `mediascreen` because the stringifier joined tokens with no separator
and stripped whitespace — a corruption that silently changes rule identity,
not just formatting. Budget `prelude_roundtrip_corruptions <= 0`.
Evidence: `proof/evidence/ki-41.yaml`, reproducer
`proof/reproducers/KI-41-atrule-prelude-whitespace-roundtrip-overlay-260823.ts`.
Status `draft`; tripwire red.

### SYS-REQ-260823-BTC4 — bad-url/bad-string component values rejected
A lone `<bad-url-token>` or `<bad-string-token>` is an always-parse-error per
css-syntax-3, so `parseComponentValue` must throw rather than return the
truncated remnant. KI-42 found `url(a b)` yielding the ident `a` after
whitespace filtering — the tokenizer did its job, but the API layer failed to
check what kind of token survived. The paired budget also requires legitimate
multi-value rejections to keep passing, so a blanket "always throw" fix
cannot satisfy it dishonestly.
Evidence: `proof/evidence/ki-42.yaml`, reproducer
`proof/reproducers/KI-42-bad-url-component-value-not-rejected-overlay-260823.ts`.
Status `draft`; tripwire red.

### SYS-REQ-260823-PVE7 — parseValue rejects trailing garbage like parseComponentValue
Both single-value APIs wrap css-syntax-3 #parse-a-component-value, which
errors on non-empty input after one value — so `CSS.parseValue('10% x')` must
throw exactly where `parseComponentValue` throws. Closes KI-45, a silent
truncation caused by parseValueSync missing the EOF check its sibling has;
the requirement exists to pin API-pair consistency so one entry point cannot
be lenient while the other is strict for identical input.
Evidence: `proof/evidence/ki-45.yaml`, reproducer
`proof/reproducers/KI-45-parsevalue-trailing-garbage-lenient-overlay-260823.ts`.
Status `draft`; tripwire red.

### SYS-REQ-260823-DRP5 — grammar-invalid @import dropped, valid hrefs round-trip
An @import whose prelude violates the css-cascade-5 grammar must not enter
`cssRules` as a fabricated `CSSImportRule`; it is dropped like any invalid
rule, while layered/unlayered valid imports keep byte-exact hrefs. KI-43
showed the parser manufacturing a rule object (empty href, wrong mediaText)
out of invalid input — inventing DOM state the stylesheet never expressed.
The two-sided budget keeps the drop fix from regressing valid-import parsing.
Evidence: `proof/evidence/ki-43.yaml`, reproducer
`proof/reproducers/KI-43-invalid-import-fabricated-not-dropped-overlay-260823.ts`.
Status `draft`; defect legs red, control legs green.

## Parsing resource bounds

### SYS-REQ-260822-JD78 — math expression consumption is depth-bounded
Nested parentheses, nested `calc()`, and deep CSSMathValue trees must hit an
explicit depth bound (≥ 3000 levels handled) that fails closed with a
structured error instead of overflowing the JS call stack with RangeError.
css-values-4 permits unbounded nesting, so a conforming consumer needs its own
budget — relying on engine stack depth makes crash depth platform-dependent
and turns malformed CSS into a host-abort vector (KI-22).
Evidence: `proof/evidence/ki-22.yaml`, reproducer
`proof/reproducers/KI-22-math-parser-unbounded-recursion-overlay-260822.ts`.
Status `draft`; tripwire red.

## Selector matching semantics

### SYS-REQ-260823-SCS2 — type selectors case-sensitive outside HTML namespace
Element names outside the HTML namespace match by exact string comparison:
`textpath` must not select SVG `<textPath>`, `foreignobject` not
`<foreignObject>`. selectors-4 defaults name matching to identity and scopes
ASCII case-insensitivity to HTML-namespace elements only; the matcher
lowercased both sides unconditionally (KI-32), silently swallowing camelCase
SVG and foreign elements. The budget counts false matches on cased non-HTML
elements, so HTML-namespace convenience stays untouched.
Evidence: `proof/evidence/ki-32.yaml`, reproducer
`proof/reproducers/KI-32-svg-type-selector-case-sensitivity-overlay-260823.ts`.
Status `draft`; tripwire red.

### SYS-REQ-260823-00C0 — :lang() honors RFC 4647 wildcard ranges
`:lang()` ranges are RFC 4647 extended language ranges matched by extended
filtering, so asterisk subtags act as wildcards (`*-US` matches `en-US`);
selectors-4 #lang-pseudo mandates this and WPT lang-007/008/010/015/018/021
corroborate. KI-34 found only exact/dash-prefix comparison implemented, so
wildcard ranges never matched anything. Distinct from SCS2 despite both being
"matching is too naive": that one over-matches, this one under-matches.
Evidence: `proof/evidence/ki-34.yaml`, reproducer
`proof/reproducers/KI-34-lang-wildcard-extended-filtering-overlay-260823.ts`.
Status `draft`; tripwire red.

### SYS-REQ-260822-ZQJT — selector matching cost bounded per query
Relational `:has()` neighborhood search and descendant/subsequent-sibling
backtracking must run within a per-query work budget (≤ 8 evaluation units in
the formalization) even over large trees with attacker-influenced selector
text. Without a budget, `querySelectorAll(':has(…)')` re-walks the subtree
per node for quadratic-or-worse CPU — a denial-of-service escape, not a
correctness bug, which is why it lives beside the semantic selector reqs
rather than with them. Evidence: `proof/evidence/ki-16.yaml`, reproducer
`proof/reproducers/KI-16-has-combinator-no-match-budget-overlay-260822.ts`.
Status `draft`; tripwire red.

## Property registration

### SYS-REQ-260823-PMB5 — @property syntax multipliers closed set
The syntax-string multiplier set is exactly `+` and `#` per
css-properties-values-api #multipliers; brace forms `{N}`/`{N,M}` do not exist
in the grammar and `registerProperty` must reject them with SyntaxError while
continuing to accept the legal pair. KI-35 found the brace forms accepted —
a validation gap distinct from KI-111 (below), which covers initial-value
matching against already-registered syntaxes; two requirements because the
defects live at different lifecycle stages (registration vs use).
Evidence: `proof/evidence/ki-35.yaml`, reproducer
`proof/reproducers/KI-35-register-property-brace-multiplier-overlay-260823.ts`.
Status `draft`; tripwire red.

### SYS-REQ-260822-V111 — registerProperty validates initial value against syntax
An initial value that does not parse against the registered syntax must be
rejected at registration time. Binds KI-111, where mismatched initial values
slipped through, deferring the failure to substitution time when the spec
demands eager validation. Companion to PMB5 on the same API but a different
input field (`initialValue` vs `syntax`).
Evidence: `proof/evidence/ki-111.yaml`, reproducer
`proof/reproducers/KI-111-registered-syntax-matcher-overlay-260822.ts`.
Status `review`; tripwire red.
