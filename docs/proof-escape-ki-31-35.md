# Escape Analysis: KI-31 .. KI-35

Batch: Champ correctness audit, branch `CSSOmNom/Audit`, HEAD `69defe8`.
All five findings were re-verified on HEAD twice before filing (probe runs), each
reproducer ran red (`exit 1`) twice pre-filing plus once more under
`proof evidence capture`, and once more post-filing. Every candidate reproduced
exactly as predicted - no candidate was dropped.

## Why this batch escaped as a class

The five holes share one meta-cause: **the requirement catalog models behaviors
the parser gets right in its happy path, but never models IDL-surface
completeness, serializer-equivalence, or closed-set grammar validation as
first-class obligations.** Existing gates fire when an *executed* guarantee
regresses; none of them enumerate "every interface member the spec defines on a
shipped class must exist", "a serializer must be semantics-preserving under
re-parse", or "the multiplier set of a grammar is exactly {+, #}". Each KI below
names the specific check that should have caught it.

---

## KI-31 - Media condition serialization drops required parentheses

**Hole.** `serializeMediaCondition` (src/MediaParser.ts ~L839-844) joins
and/or children bare, so `((width >= 100px) or (grid)) and (hover)` serializes
to `(width >= 100px) or (grid) and (hover)`, which re-parses invalid -> `not all`.
mediaqueries-4 #mq-syntax (:900-904) requires every operand to be a
`<media-in-parens>`; css-conditional-3 #the-cssconditionrule-interface
(:752-795) requires conditionText on getting to return "the result of
serializing the associated condition" (:789), and the anti-simplification
language ("removal of unneeded parentheses ... not allowed", stated so that the
returned condition "will evaluate to the same result as the specified
condition") lives in the CSSSupportsRule-specific conditionText definition
(#the-csssupportsrule-interface :861-876), which conditional-rule subclasses
inherit.

**Which Proof check should have caught it.** A re-parse equivalence property:
`parse(serialize(rule)).evaluation === rule.evaluation`. The fuzz-oracle work
(fuzz/oracles/roundtrip-sweep.ts) covers token-level round-trips of *source
text*, not semantic equivalence of *derived accessors* like `conditionText`.
SYS-REQ-260821-5283 only pins invalid->not-all behavior, so checks derived from
that req pass while the valid-input path corrupts semantics.

**Why it escaped.** Serializer-equivalence was modeled as a *string* identity
property ("serialized_equals_source", SYS-REQ-260821-KV30) rather than a
*semantic* property. String-equality oracles never test conditions whose correct
serialization legitimately differs from input text (re-parenthesization), so the
mixed and/or case had no oracle at all.
Citation note (corrected during review): the original filing misattributed the
anti-simplification normative text to the CSSConditionRule.conditionText
definition (`#the-cssconditionrule-interface`) - a reviewer caught this.
Verified against the vendored .bs sources: `#the-cssconditionrule-interface`
spans Overview.bs:752-795 and its conditionText dd only requires "the result of
serializing the associated condition" (:789); the "logical simplifications ...
removal of unneeded parentheses ... not allowed" text lives in the
CSSSupportsRule-specific conditionText definition
(`#the-csssupportsrule-interface`, Overview.bs:861-876). For the @media case
the load-bearing citation is grammatical: mediaqueries-4 `#mq-syntax`
(:900-904) makes every and/or operand a `<media-in-parens>`, so any
serialization that drops grouping parentheses cannot round-trip. The filing,
requirement description, and reproducer header now carry these verified
anchors. (The candidate brief had also cited
css-conditional-3 `#serialize-a-conditional-group-rule`, which does not exist
in the .bs source.)

**Overlay vs engine correction.** Overlay reproducer only (this batch); engine
correction belongs to src/MediaParser.ts.

**Engine regression idea.** Extend the round-trip fuzz oracle with a
re-parse-equivalence mode for grouping-rule conditionText: parse -> serialize ->
re-parse -> assert evaluation class preserved (never degrades to `not all`
unless the original was already invalid).

---

## KI-32 - SVG/MathML element names matched ASCII-case-insensitively

**Hole.** matcher.ts ~L300-303 lowercases both sides unconditionally;
`'textpath'` matches SVG `<textPath>`. selectors-4 #case-sensitive (:1309-1318)
defaults element-name matching to string/identical-to with only an
HTML-namespace host exception (html#case-sensitivity-of-selectors).

**Which Proof check should have caught it.** The selector-matching requirement
family (SYS-REQ-260821-PJ76 "bad selector -> no match"; XDRG ":matches()") models
*selector validity*, never *name-case policy per namespace*. A namespace x case
conformance matrix (html/svg/mathml x exact/lower/upper) attached to those reqs
would have flagged unconditional lowering immediately.

**Why it escaped.** Existing selector fixtures use lowercase HTML-ish elements,
where lowercasing both sides is coincidentally correct - the test population has
zero distribution mass on camelCase non-HTML names. Classic "fixture corpus
lacks the dimension" escape; WPT contains such cases but they were never
extracted into fixtures.

**Overlay vs engine correction.** Overlay reproducer only; engine fix lives in
matcher.ts.

**Engine regression idea.** WPT fixture-extraction job keyed on
css/selectors/selectors-4 case-sensitivity + SVG-namespaced DOM fixtures; unit
assertion of matches() across a 3-namespace x 3-case matrix.

---

## KI-33 - CSSSupportsRule.matches missing entirely

**Hole.** `parse('@supports (display: grid){}').cssRules[0].matches === undefined`.
css-conditional-3 #the-csssupportsrule-interface defines
`readonly attribute boolean matches` (:845-848) returning the evaluation of
conditionText (:856-859). Implementable offline via the library's own
`CSS.supports()` evaluator (src/parser-api.ts:757).

**Which Proof check should have caught it.** An IDL surface completeness gate:
for every shipped CSSOM class, diff the spec's WebIDL interface members against
the class prototype and fail on missing members. The repo vendors the spec
sources containing the IDL blocks, so this is mechanically checkable today.

**Why it escaped.** Requirements were authored from *behavioral* spec sections
(conditionText serialization, supports evaluation) and never from *interface
definitions*. Nothing in the catalog states "every attribute defined by an
implemented interface exists" - absence yields silent `undefined` instead of
failing any executed assertion. Sibling gap noted but not filed:
CSSMediaRule.matches (:806/:820-827) is also absent but window-dependent
(value depends on a document's Window matching the query), hence parked via
do_not_refile_as rather than asserted dishonestly offline.

**Overlay vs engine correction.** Overlay asserts existence + oracle equality
offline; engine correction adds the getter backed by the supports evaluator.

**Engine regression idea.** Codegen an IDL-membership table from the vendored
.bs files (same pattern as scripts/codegen/generate_all.ts) plus a unit test
walking every exported rule class asserting each spec'd member is non-undefined.

---

## KI-34 - :lang() wildcard language ranges never match

**Hole.** The :lang() arm in matcher.ts (~L598-606) implements only exact or
dash-prefix comparison, so `:lang("*-US")` never matches lang="en-US".
selectors-4 #lang-pseudo (:2661-2667) mandates RFC4647 section 3.3.2 extended
filtering where asterisk subtags are wildcards; WPT
css/selectors/selectors-4/lang-007/008/010/015/018/021 assert it.

**Which Proof check should have caught it.** Selector pseudo-class coverage is
tracked as boolean capability ("pseudo supported"), not as argument-space
coverage per RFC algorithm. A fixture sweep over the WPT lang-* corpus would
have caught it: those fixtures exercise exactly the wildcard dimension.

**Why it escaped.** The :lang() implementation was validated against exact/prefix
cases only; the extended-filtering algorithm was never ported, and no extracted
fixture exercised wildcards. Same class as KI-32: corpus lacks the dimension,
and the spec-derived data (RFC4647 filtering table) was never codegen'd into the
matcher.

**Overlay vs engine correction.** Overlay reproducer only; engine correction
implements extended filtering in the lang arm.

**Engine regression idea.** Extract the six lang-0xx wildcard fixtures into the
JSON fixture corpus and add an RFC4647 extended-filtering conformance table
(range x tag -> expected) generated from the algorithm, run under pnpm test:node.

---

## KI-35 - registerProperty accepts invalid {N}/{N,M} brace multipliers

**Hole.** `<length>{2}` and `<length>{2,4}` register without error.
css-properties-values-api #multipliers (:976-991) closes the multiplier set to
`+` and `#`; no brace form exists in #syntax-strings. Distinct from KI-111
(initial-value matcher): different layer of the same registration pipeline.

**Which Proof check should have caught it.** Grammar closed-set validation: when
a syntax component enumerates a closed set of modifiers/multipliers, negative
tests must assert rejection of every out-of-set token. The existing
property_registry requirements (EGCP duplicate/bad-dictionary rejection; V111
initial-value rejection) cover dictionary-level and value-level failures but
never string-grammar negatives.

**Why it escaped.** Positive-path testing bias: '+', '#', '*' and bare types
were tested for acceptance; nobody enumerated the *complement* of the accepted
set. The syntax parser presumably parses `{2}` because CSS value grammars
elsewhere DO allow brace multipliers (css-values-4 <<repeat>> style syntax in
other contexts), making the hole look plausible to authors.

**Overlay vs engine correction.** Overlay reproducer only; engine correction
restricts the multiplier production in the syntax-string parser and throws
SyntaxError.

**Engine regression idea.** Property-test the syntax-string parser against the
closed multiplier alphabet: for every generated valid component name, assert
acceptance for '', '+', '#' and SyntaxError for '{n}', '{n,m}', '!' and other
near-miss tokens.

---

## Batch-level follow-ups (non-binding)

1. IDL completeness codegen gate (would kill the whole "missing member" class:
   KI-33 and future siblings like CSSMediaRule.matches once a Window model
   exists).
2. Re-parse semantic equivalence mode in the fuzz oracle (KI-31 class).
3. Namespace x case matrix fixtures for selector matching (KI-32 class).
4. WPT lang-* wildcard fixture extraction (KI-34 class).
5. Negative-grammar enumeration for @property syntax strings (KI-35 class).
