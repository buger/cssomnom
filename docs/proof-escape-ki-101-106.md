# Proof escape analysis: KI-101 through KI-106

This is the audit companion for the ordinary CSSOM conformance findings KI-101
through KI-105 (with KI-106 retired as a duplicate). Each finding is intentionally left unfixed in `src/**`; the
reproducer asserts the normative behavior and is expected to remain red until
the product is repaired.

Proof evidence was captured with the workspace fork at `/tmp/proof-dx/proof`:

```text
proof/evidence/ki-101.yaml  known_issue_reproduced
proof/evidence/ki-102.yaml  known_issue_reproduced
proof/evidence/ki-103.yaml  known_issue_reproduced
proof/evidence/ki-104.yaml  known_issue_reproduced
proof/evidence/ki-105.yaml  known_issue_reproduced
```

Every reproducer was run twice with `/opt/node24/bin/node` before and during
the Proof capture. The commands use the real public TypeScript API and scalar
assertions; none relies on a mock implementation.

The first capture intentionally happened before requirement binding so that
the five unlinked findings could be checked honestly. After the five narrow
draft requirements were authored and attached through the Proof CLI,
`proof evidence refresh` re-ran each command but did not update the manifest's
requirement metadata. The fork has no CLI operation for that metadata edit, so
the exact requirement IDs were added to those six freshly captured manifests
as a metadata-only fallback. `proof evidence validate --strict` and
`proof audit --check known_issue_complete` then passed with zero errors and
zero warnings for this batch.

## KI-101 — keyframe child ownership links

Reproducer: `proof/reproducers/KI-101-keyframe-parent-links-overlay-260822.ts`

The parser-created `CSSKeyframeRule` has neither `parentRule` nor
`parentStyleSheet`. A child added by `appendRule()` gets a parent link, but
`deleteRule()` leaves that link and the derived stylesheet link in place.
The expected lifecycle follows CSSOM-1 § 6.4, anchors
`#concept-css-rule-parent-css-rule` and
`#concept-css-rule-parent-css-style-sheet`: an enclosed rule is attached to
its enclosing rule and stylesheet, and removing it clears the relationship.

Why Proof did not find it: the existing requirement corpus models that parsing
returns a `CSSStyleSheet`, but has no relation/lifecycle variable for nested
CSSRule ownership. Existing keyframe coverage checks selector normalization
and parser shape, not parent links before and after removal. Proof therefore
had no obligation or linked test whose oracle could observe this failure.

What was missing in Proof: a relation-aware requirement and a two-phase test
oracle (`attached => parentRule/parentStyleSheet`, `removed => null`). This is
a coverage/model gap, not an indication that the existing stylesheet-return
requirement was false.

## KI-102 — counter-style setter serialization

Reproducer: `proof/reproducers/KI-102-counter-style-setter-cssText-overlay-260822.ts`

Setting the valid `prefix` descriptor changes the `prefix` getter but not the
declaration state used by `CSSCounterStyleRule.cssText`. The expected behavior
is defined by CSS Counter Styles § 8.1, anchor
`#the-csscounterstylerule-interface`, together with the `prefix` descriptor at
`#counter-style-prefix`: a valid setter replaces the associated descriptor.

Why Proof did not find it: no existing requirement describes coherence between
the ten counter-style descriptor attributes and CSSRule serialization. A getter
test can pass while the serialized rule remains stale, and static traceability
does not infer that both surfaces represent one mutable associated rule.

What was missing in Proof: a round-trip invariant requiring
`set(descriptor); get(descriptor); cssText` to agree, plus valid and invalid
descriptor setter witnesses. The new KI is deliberately unlinked instead of
being attached to an unrelated parser requirement.

## KI-103 — trailing tokens accepted by appendRule

Reproducer: `proof/reproducers/KI-103-keyframes-append-trailing-garbage-overlay-260822.ts`

`CSSKeyframesRule.appendRule()` extracts text between the first `{` and last
`}` and appends it even when non-whitespace text follows the closing brace.
The CSS Animations § 5.3 `#interface-csskeyframesrule-appendrule` contract
accepts one complete keyframe rule. CSS Syntax § 5.4.1 `#parse-rule`
requires the parsed input to be consumed as a complete rule, so the trailing
tokens must not be accepted.

Why Proof did not find it: the existing trailing-garbage requirements cover
the standalone Parser API `parseRule()` path. They do not constrain the
separate CSSKeyframesRule append path, which uses a brace search and style
attribute parser. No linked test exercised end-of-input validation at this
API boundary.

What was missing in Proof: an API-specific whole-input-consumption obligation
and a negative witness that contrasts a complete keyframe with the same text
plus trailing garbage. The existing `parseRule()` requirement was not falsely
reused as the affected requirement.

## KI-104 — forbidden declarations retained in keyframes

Reproducer: `proof/reproducers/KI-104-keyframes-forbidden-declarations-overlay-260822.ts`

The keyframe style retains `animation-name` and `animation-duration`, and it
retains `opacity: 0 !important`. CSS Animations § 3, anchor `#keyframes`, says
animation properties are ignored in keyframes except
`animation-timing-function`; declarations marked `!important` are invalid and
ignored.

Why Proof did not find it: the parser's general declaration consumer validates
token-level syntax but does not model the special declaration filtering that
only applies inside a keyframe block. Existing keyframe obligations cover
selector bounds and rule construction, so they cannot detect a declaration
that is syntactically valid but forbidden by the enclosing at-rule's grammar.

What was missing in Proof: a context-sensitive keyframe declaration variable,
an explicit exception for `animation-timing-function`, and paired witnesses
for forbidden animation properties and `!important`. This is a missing
special-context obligation, not a generic declaration-parser failure.

## KI-105 — invalid `display` retained by stylesheet parsing

Reproducer: `proof/reproducers/KI-105-stylesheet-invalid-display-overlay-260822.ts`

Parsing `.target { display: definitely-not-a-display-value; color: red; }`
stores the invalid display declaration instead of dropping it while preserving
the valid neighboring color declaration. CSS Syntax § 5.4.5,
`#parse-a-css-declaration-block`, requires parsing each declaration according
to the relevant property specification and dropping a wholly invalid one.
CSS Display § 2, `#the-display-properties`, defines the `display` grammar.

Why Proof did not find it: the current parser requirement proves that a
stylesheet object is returned and that malformed input recovers, but does not
state semantic property-grammar filtering. The implementation's generic
`validateDeclarationValue()` only rejects tokenization-level bad strings and
URLs; there was no property-specific display oracle in the evidence set.

What was missing in Proof: a semantic declaration-validity requirement (or a
narrow draft requirement owned by the parser) and a mixed invalid/valid
declaration witness that proves the invalid declaration is dropped without
discarding its neighbor.

## KI-106 — retired duplicate of KI-105

KI-106 is withdrawn and consolidated into KI-105. The KI-105 reproducer now
contains independent parser, `setProperty`, and `cssText` branches, preserving
the original mutation-path evidence without a second known-issue root.

Both `setProperty('display', invalid)` and the `cssText` setter retain the
invalid value. CSSOM § 6.6, `#dom-cssstyledeclaration-setproperty`, requires an
invalid parsed component value to return without mutation; the `cssText` path
parses a CSS declaration block. CSS Display § 2,
`#the-display-properties`, supplies the property grammar. KI-106 is attached
to the existing `SYS-REQ-260821-8TGB` and `SW-REQ-260821-HNRG` because their
explicit contract is to ignore invalid values and leave declarations
unchanged.

Why Proof did not find it: the existing invalid-value variables were exercised
with other validation cases, but the semantic display grammar is not modeled
as a branch in the mutation evidence. The generic token parser accepts the
value, so Proof sees no `value_validation_fails` signal for this property and
cannot derive the required no-op from source text alone.

What was missing in Proof: a property-registry-backed validity signal for both
mutation entry points and a witness using an invalid display keyword sequence.
The existing HNRG/8TGB requirements were sufficient once the reproducer was
bound; no new requirement was invented for KI-106.

## Disposition

KI-101 through KI-105 remain `status: open`, `release_disposition:
ship_with_known_issue`, and unfixed; KI-106 is `withdrawn` as a duplicate of
KI-105. The records are ordinary conformance
findings only. No product source or `PLAN.md` file was changed by this batch.
