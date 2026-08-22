# Proof escape analysis: KI-16 through KI-22 (security/DoS batch)

This is the Proof escape companion for the confirmed security/availability
batch KI-16, KI-17, KI-18, KI-19, KI-21, and KI-22. The six findings remain
open and unfixed in `src/**`; each overlay reproducer asserts the bounded /
structure-preserving contract and is expected to stay red until the product
is repaired.

Evidence was captured with the workspace's custom Proof fork at
`/tmp/proof-dx/proof` and Node v24.11.1. Each reproducer was run twice before
filing (both runs exit 1 for the asserted reason), and
`proof evidence capture` ran it a third time:

```text
proof/evidence/ki-16.yaml  known_issue_reproduced  (:has miss ~192x over an 8x ratio budget)
proof/evidence/ki-17.yaml  known_issue_reproduced  (RangeError inside acyclic substitution)
proof/evidence/ki-18.yaml  known_issue_reproduced  (RangeError via parse()/replaceSync())
proof/evidence/ki-19.yaml  known_issue_reproduced  (~33MB heap before mixed-unit TypeError)
proof/evidence/ki-21.yaml  known_issue_reproduced  (#; declaration injection on re-parse)
proof/evidence/ki-22.yaml  known_issue_reproduced  (RangeError via createCSSStyleValue())
```

`proof known-issue check` reports no findings against this batch (only
pre-existing stale-evidence rows on older KIs). Requirement anchoring: KI-18
attaches to the existing `SYS-REQ-260821-7521`; the other five required newly
drafted requirements (`SYS-REQ-260822-ZQJT`, `-EGPW`, `-8BK4`, `-8HDQ`,
`-JD78`) because no existing obligation honestly covered resource bounds or
identifier escaping.

The common shape of this batch: every escape is a **missing quantitative
bound** — depth counters, term caps, size budgets, output escaping — not a
wrong boolean. FRETish variables in this corpus are overwhelmingly nominal
("did X happen") rather than metric ("X stayed within B"), so obligations
that name hazards qualitatively never fail quantitatively.

## KI-18 — parser unbounded nesting depth

Reproducer: `proof/reproducers/KI-18-parser-unbounded-nesting-recursion-overlay-260822.ts`
Requirement: `SYS-REQ-260821-7521` (existing)
Spec anchor: css-syntax-3 § 5.5.x consume algorithms.

Which Proof check should have exposed it: `SYS-REQ-260821-7521` already
carries `obligation_checklist: [denial_of_service_resistant, nominal,
recursion_depth_bounded]` and `obligation_hazards` naming "Deeply nested
@media/@supports/style rules recurse without a depth cap and overflow the JS
stack, crashing the host process" (SYS-REQ-260821-7521.req.yaml:53-63). The
requirement was reviewed and approved with verification_state `passing`.

Why it escaped: the hazard row is prose, not a model. No numeric domain or
bound variable exists — there is no `nesting_depth <= N` variable in the
FRETish clause ("when css_text_supplied ... stylesheet_returned"), no
generated tripwire exercises deep input, and no signal compares actual stack
depth against a cap. The obligation checklist records that someone *thought*
about recursion; nothing measures it. This is the crash-freedom-vs-budget
mismatch: `verification_state: passing` was derived from evidence profiles
that only ever feed shallow fixtures, so "returns a stylesheet" was verified
on inputs where the recursion could never overflow.

Correction locus: cssomnom overlay/model. The fix belongs in the model first:
add a bound variable (e.g. `nesting_depth <= max_nesting_depth`) to a parser
requirement, generate a deep-nest tripwire, and let the existing KI hold the
debt. The engine needs nothing new — a failing reproducer already witnesses
the violated guarantee.

Engine regression if desired: none required; if Proof later grows automatic
hazard-to-tripwire synthesis, a regression would assert that a requirement
with a `recursion_depth_bounded` hazard but no depth-domain variable and no
bound-exercising test cannot reach `verification_state: passing`. Do not
implement in this batch.

## KI-22 — math expression parse/simplify unbounded recursion

Reproducer: `proof/reproducers/KI-22-math-parser-unbounded-recursion-overlay-260822.ts`
Requirement: `SYS-REQ-260822-JD78` (newly drafted, component parser)
Spec anchor: css-values-4 `#calc-syntax`.

Which Proof check should have exposed it: the same
`SYS-REQ-260821-7521` recursion_depth_bounded hazard covers "recursive CSS
consumption" in spirit, and css-values-4 makes calc() grammar recursion
unbounded by design — exactly the combination a math-depth obligation should
pin. I inspected the 7521 rows before filing: its hazard text names at-rules
and style rules only; math/component-value consumption is not covered, so
attaching KI-22 there would have been dishonest.

Why it escaped: sibling manifestation of KI-18 in a different sink
(`parseMathFunction`/`simplify`), but the deeper cause is scope-of-hazard
narrowness: hazards were written per named construct family, so each new
recursive sink (rules, then functions/parens, then simplification) starts
with zero modeled risk. Nothing in Proof asks "is there any unbounded
recursion left?" — hazard enumeration is manual and therefore incomplete.

Correction locus: both. Overlay/model: `SYS-REQ-260822-JD78` now models
math_depth_bounded; bind its tripwire when the product lands a counter.
Engine: a coverage-style signal that flags recursive functions reachable
from exported APIs with no corresponding depth-bound obligation anywhere in
the graph would have surfaced both KI-18 and KI-22 mechanically. Regression
to prove it: seed a fixture repo with an exported recursive consumer lacking
any bound obligation and assert the audit emits a finding. Not implemented.

## KI-17 — acyclic var()/env() exponential expansion

Reproducer: `proof/reproducers/KI-17-var-env-exponential-expansion-overlay-260822.ts`
Requirement: `SYS-REQ-260822-EGPW` (newly drafted, component cascade)
Spec anchor: css-variables-1 `#using-variables` (substitute/cycle rules).

Which Proof check should have exposed it: the cascade requirements around
custom properties (e.g. the V-series drafts) model cycle invalidity —
"cyclic custom properties are invalid at computed-value time" — which is the
spec's ONLY quantitative-ish rule. The library passes those rows because its
cycle set works. No requirement models expansion size, so the pass/fail
signal never looks at output length or work count.

Why it escaped: spec-transcription bias. Proof models what css-variables-1
*requires* (cycle detection) and nothing for what a safe implementation
*additionally needs* (a budget the spec leaves unspecified). A missing-bound
escape is invisible to correctness-shaped obligations: substitution either
"resolves" or it doesn't, and at depth ≤ 15 it does resolve — just 65535
characters later and ~430ms poorer. The MC/DC rows generated from these
variables can only distinguish resolved/not-resolved, so exponential cost
with correct results is indistinguishable from linear cost.

Correction locus: overlay/model. `SYS-REQ-260822-EGPW` introduces
`substitution_size_bounded`; once the resolver gains a budget the tripwire
flips green. Engine idea (not implemented): a work/output-budget assertion
class that lets a requirement declare "output size <= f(input size)" so
fuzzing can detect superlinear blow-ups generically.

## KI-19 — CSSNumericValue.to/toSum cartesian expansion

Reproducer: `proof/reproducers/KI-19-numeric-tosum-cartesian-expansion-overlay-260822.ts`
Requirement: `SYS-REQ-260822-8BK4` (newly drafted, component typed_om)
Spec anchor: css-typed-om `#numeric-objects`.

Which Proof check should have exposed it: Typed OM conversion requirements
model `.to()`/`.toSum()` reification outcomes (value returned / TypeError
for incompatible units). The mixed-unit product correctly ends in TypeError,
so every existing row passes — the 2^n terms allocated *before* the throw
are outside any modeled observation.

Why it escaped: outcome-only contracts. The corpus verifies terminal values
and exception types, never intermediate allocation or step counts, and
createSumValue's product branch has neither a term cap nor an obligation
demanding one. Same class as KI-17: a quantitative hole under qualitative
coverage, aggravated here by the error being thrown only after the cost is
paid — "it threw the right error" actively launders the blow-up.

Correction locus: overlay/model (`SYS-REQ-260822-8BK4` declares
`conversion_terms_bounded`). Engine regression candidate (not implemented):
heap/time-instrumented test execution that flags any single API call whose
live-set growth is exponential in a controllable input parameter while tests
stay green.

## KI-16 — :has()/combinator matching lacks a complexity budget

Reproducer: `proof/reproducers/KI-16-has-combinator-no-match-budget-overlay-260822.ts`
Requirement: `SYS-REQ-260822-ZQJT` (newly drafted, component selectors)
Spec anchor: selectors-4 `#relational`.

Which Proof check should have exposed it: selector requirements model match
results (matches/querySelectorAll return the right element set) and the
bad-selector guarantee `SYS-REQ-260821-PJ76` (empty_match for bad input).
I grepped the whole system-requirements corpus for selector + denial-of-
service language: PJ76's rationale ("A bad selector shall not crash a
grader") is the closest text and it covers malformed syntax, not accepted-
but-expensive matching. Nothing asks how much work one query may do.

Why it escaped: the matcher returns CORRECT results for every fixture tried
— including the nested-`:has` rejection control — so result-shaped
obligations all pass while per-node neighborhood walks stay uncapped.
Complexity budgets are non-functional; Proof's functional-only requirement
corpus had no home for "bounded relative cost", and no fuzz signal measured
scaling between tree size and query latency.

Correction locus: overlay/model. `SYS-REQ-260822-ZQJT` models
`match_cost_bounded`; the reproducer's ratio assertion (has-miss vs plain-scan
<= 8x) is the tripwire shape once a budget lands. Engine idea (not
implemented): pairwise scaling assertions (cost(n) vs cost(2n)) as a generic
superlinear detector for pure APIs.

## KI-21 — hash/function serialization omits serialize-an-identifier

Reproducer: `proof/reproducers/KI-21-serializer-hash-identifier-escape-overlay-260822.ts`
Requirement: `SYS-REQ-260822-8HDQ` (newly drafted, component serializer)
Spec anchor: cssom-1 `#serialize-an-identifier`, `#serialize-a-function`.

Which Proof check should have exposed it: `SYS-REQ-260821-KV30` ("the
serializer shall emit the source text for tokens of the button color rule",
`serialized_equals_source`) is the round-trip requirement of record. I read
KV30 before filing: its trigger variable is `tokens_from_btn_rule` — one
benign fixture rule containing no escapes, no hashes with structural code
points, no function-name escapes. Neighboring serializer checks compare
serialized strings against golden snapshots built FROM current behavior.

Why it escaped twice over: (1) fixture poverty — the round-trip obligation's
domain contains a single friendly sample, so decode-on-parse /
escape-on-serialize asymmetry is unreachable; (2) missing output-contract —
no requirement states the *invariant* form ("re-parsing serialized output
preserves structure"), which is what catches ANY escaping omission without
enumerating payloads. Golden snapshots actively hide the bug: they certify
today's unsafe output as expected.

Correction locus: overlay/model primarily — add escaped-payload round-trip
fixtures and the structure-preservation invariant (`round_trip_structure_
preserved`) alongside KV30. Engine regression candidate (not implemented):
an audit that flags snapshot-equality evidence attached to serialization
requirements whose input domain includes attacker-controlled text, forcing
invariant-form assertions instead.

## Batch-level lessons

1. Hazards without domains don't gate anything: 7521's
   `recursion_depth_bounded` existed, was approved, and still escaped. A
   hazard row must be backed by a bound variable and a tripwire or it is
   commentary.
2. Correct results make cost holes invisible: three of six escapes (KI-16,
   KI-17, KI-19) produce right answers at unacceptable cost. Outcome-shaped
   obligations and their MC/DC rows structurally cannot see them.
3. Snapshot/golden evidence launders serializer bugs: KI-21 passed every
   check that compared output to output-derived expectations.
4. Hazard enumeration is per-construct and therefore always behind the
   sinks: KI-22 needed its own requirement although its root cause is
   KI-18's. Reachability-driven (exported-API -> recursive sink) signals
   would generalize; none exist today.
