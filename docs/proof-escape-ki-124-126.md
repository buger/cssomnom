// Documents: SYS-REQ-260825-4R9S, SYS-REQ-260825-7T66, SYS-REQ-260825-ENH2
# Proof escape analysis: KI-124 … KI-126 (grammar-validation absence, registry syntax drift, unknown-at-rule child visibility)

This is the Proof escape companion for the consolidated four-candidate hunt wave
(fuzz invalid-superset mass + hand probes + one metamorphic claim + one external
expectation). Wave outcome:

- **KI-124 FILED** — no parse-time grammar validation: declaration-block parsing
  retains grammar-invalid values (`width:red`, `color:10px`,
  `animation-timing-function:bogus()`, `margin-left:solid` all survive with
  non-empty `getPropertyValue`). Generic root behind the instance filings
  KI-113 / KI-117 / KI-105 / KI-104.
- **KI-125 FILED** — stale PropertyRegistry syntax strings REJECT grammar-valid
  values (`scrollbar-gutter: stable both-edges`,
  `font-variant-alternates: styleset(ss01)`, `text-indent: 10px hanging`,
  `font-palette: --my-palette`) because codegen-derived strings froze on
  pre-extension grammars.
- **KI-126 FILED (low)** — `parse()` leaves `CSSAtRule.childRules` unset for
  unknown at-rules, so inner qualified rules are reachable only by re-parsing
  raw cssText; the component-value-stream path populates the same field, so the
  class contract is internally inconsistent.
- **Candidate "escape-encoded property name dropped on re-parse" REFUTED — not
  filed.** See appendix A for every probe and the old-snapshot check.

All filed findings stay red via public-API overlay reproducers; nothing in
`src/**`, `fuzz/**`, or `tests/**` was touched.

## Dedup decisions (sweep against all 68 existing KI titles + affected_api)

| Candidate | Sweep result | Decision |
|---|---|---|
| Grammar-invalid retention (generic) | Titles containing invalid/retain/grammar: KI-104 keyframes, KI-105 display, KI-106 withdrawn dup of 105, KI-113 font, KI-117 relative color, KI-107 supports-var, KI-35/111 accept-invalid in registry | All instance-scoped; none claims the generic root and none of their probed properties appears in this wave's legs → **filed as generic root**, instances cross-linked via `do_not_refile_as` |
| Registry rejects valid values | KI-35 + KI-111 cover accept-invalid direction; KI-38 covers cascade ignoring the registry; no KI covers stale-syntax reject-valid | **Filed KI-125**, opposite direction of KI-35/111 recorded in both directions' `do_not_refile_as` |
| Escape-encoded property name re-parse loss | No existing KI mentions escapes decoding property names | **Refuted at HEAD before filing** (appendix A); no twice-red evidence exists |
| Unknown at-rule child access | KI-6/KI-14/KI-40 are parser-api type-mapping surfaces; none covers CSSOM `CSSAtRule.childRules` population parity | **Filed KI-126 low**, framed per briefing as unregulated-but-internally-inconsistent interop fidelity |

## Twice-red evidence record

Node v24.11.1 (`/opt/node24/bin/node`), Proof binary `/tmp/proof-dx/proof`
0.1.0-dev (today's build with STE100 lints). Every reproducer ran twice before
filing, plus a genuine capture run and a genuine refresh run through
`proof evidence capture` / `refresh`:

```text
KI-124  exit 1 ×2   tests 6 = 2 controls green + 4 defect legs (width/color/animation-timing-function/margin-left)
KI-125  exit 1 ×2   tests 6 = 2 controls green + 4 defect legs (scrollbar-gutter/styleset/text-indent/font-palette)
KI-126  exit 1 ×2   tests 5 = 2 controls green + 3 defect legs (@support/@unknownfoo/@x nested)
```

Freshness sha256 verified equal to final reproducer bytes after the last edit:

```text
sha256:7faf4cd29ae6d0ad1e3be02ae9c9027623ba4013154494125cb1386923b01966  KI-124
sha256:04d58193ce1b8db39a5a310ccf6cabba10c5b35c0dc4af7a2696e6acb750d616  KI-125
sha256:6c4fad4091dc36dd6c655f1c32f1e7bd601c48a208cdccb016db18cf5bc5b0d5  KI-126
```

Independent oracle measurement for KI-124: `node fuzz/oracles/invalid-superset.ts
--seed 260825 --budget-ms 60000` reports **6627 findings over 811 properties**
(9732 mutants, 8549 oracle-checked). The hunt wave's own run reported 6757 under
a different sampling budget; both numbers witness the same class.

## Requirement anchoring

Three informal drafts created through `proof req new` under the fidelity-family
parent `STK-REQ-260821-BQKD` (style mirror `SYS-REQ-260824-QGJE`):

| Requirement | Owns | Contract |
|---|---|---|
| `SYS-REQ-260825-4R9S` | KI-124 | declaration-block parsing drops grammar-invalid declarations, keeps valid neighbors |
| `SYS-REQ-260825-7T66` | KI-125 | registry syntax strings match current property grammars so valid values parse |
| `SYS-REQ-260825-ENH2` | KI-126 | unknown at-rule childRules populated consistently across parse entry points |

Why A+B did NOT share one draft despite both being "grammar" bugs: KI-124 pins
the DROP direction (parser must reject out-of-grammar input per cssom-1 step
3.1); KI-125 pins the ACCEPT direction (registry must not reject in-grammar
input). One requirement cannot fail in both directions coherently, and their
correction loci differ (block-parse remnant handling vs codegen data refresh).

They are intentionally informal prose + spec references: declaring FRETish
variables requires editing `specs/system/variables/cssom-budget.vars.yaml`,
which stays untouched while concurrently owned (**formalization debt**). The
next vars-file owner should add e.g. `grammar_invalid_declaration_present` /
`retained_invalid_declaration_count`, `registry_syntax_matches_spec` /
`valid_value_rejection_count`, `unknown_atrule_children_populated`.

## KI-124 — grammar-invalid declarations retained (systemic root)

Reproducer: `proof/reproducers/KI-124-declaration-block-grammar-invalid-retained-overlay-260825.ts`
Requirement: `SYS-REQ-260825-4R9S`
Spec anchors: cssom-1 `#parse-a-css-declaration-block` (~line 2497) step 3.1;
css-syntax-3 `#consume-a-declaration`; probed grammars from css-sizing-3
(width), css-color-4 (color), css-easing-1 (animation-timing-function),
css-box-3/css-logical (margin-left).

Root subsystem: declaration remnants are stored verbatim after token-level
splitting; no component compares the parsed value against generated per-property
grammars, so every property inherits accept-invalid behavior.

Why it escaped: unit lanes assert round-trip equality of valid spellings; the
invalid-superset oracle lane that catches this class exists only as a triage CLI
(`fuzz/oracles/invalid-superset.ts`) and is not yet wired into `proof.yaml`, so
no modeled obligation consumed its output.

Correction locus: cssomnom overlay first (wire grammar validation into block
remnant handling using the same generated grammar data the Typed OM matcher
uses). Proof second: promote the oracle lane into an evidence profile so
retention counts become tracked debt instead of ad-hoc reports.

### Proof autonomy plan

- **Lane wiring (primary)**: register `invalid-superset.ts` as a proof.yaml
  evidence lane with a bounded budget; the lane was built the same day this bug
  class was formalized, so the only missing step is configuration wiring.
- **(a) MC/DC rows once formalized**: `value_matches_property_grammar` (T:
  retain, F: drop); `drop_preserves_neighbors` (T/F on surviving sibling count);
  boundary witnesses: value empty vs whitespace-only vs single-token mutant.
- **(b) Named witness tests**: the four current defect legs become regression
  pins post-fix; controls `width:10px color:red …` (four-type neighbor set) and
  two-declaration splitting must stay green.
- **(c) Differential signal**: compare retained-vs-dropped decisions against
  Chrome for the top-20 retained-count properties from the oracle clusters
  (-webkit-background-size, animation-delay/duration, background-clip, mask).

## KI-125 — registry strings reject grammar-valid values

Reproducer: `proof/reproducers/KI-125-registry-stale-syntax-rejects-valid-overlay-260825.ts`
Requirement: `SYS-REQ-260825-7T66`
Spec anchors (all verified in local submodules today): css-overflow-3
`#scrollbar-gutter-property` (`auto | stable && both-edges?`); css-fonts-4
`#font-variant-alternates-prop` (+ `#font-feature-value-name-value`);
css-text-4 `#text-indent-property` (`[<length-percentage>] && hanging? &&
each-line?` — length mandatory, so bare `hanging` stays invalid and is NOT
probed); css-fonts-4 `#font-palette-prop` + `<palette-identifier>` =
`<dashed-ident>` (~line 7596).

Root subsystem: generated registry entries lag the submodule specifications they
derive from; four sampled entries are frozen pre-extension one-liners.

Why it escaped: Typed OM lanes test each property against the REGISTRY string,
not against the specification grammar, so stale data is self-consistent and
green everywhere except against the spec.

Correction locus: codegen first (refresh syntax strings via
`scripts/codegen/` from mdn-data/`@webref/css`, per automation-over-hardcoding
rules); cssomnom second if any entry needs manual override metadata.

### Proof autonomy plan

- **(a) MC/DC rows once formalized**: `syntax_string_current_vs_stale` (T:
  accept per spec grammar, F: reject); boundary witnesses: `both-edges`
  present/absent, dashed-ident leading digits, function arity edges.
- **(b) Named witness tests**: the four defect legs pin acceptance and
  round-trip serialization; controls `stable`, `dark`, `swash(var(--x))` must
  keep passing unchanged.
- **(c) Lane proposal**: spec-grammar differential lane that parses each
  registry string AND the corresponding `.bs` propdef Value line, flags
  divergence, and samples three valid spellings per divergent property.

## KI-126 — unknown at-rule children unreachable on parse() path (low)

Reproducer: `proof/reproducers/KI-126-unknown-atrule-childrules-unset-overlay-260825.ts`
Requirement: `SYS-REQ-260825-ENH2`
Spec anchors: css-syntax-3 § 5.5.2 `#consume-an-at-rule` (unknown names still
consume prelude+block); cssom-1 defines NO unknown-rule interface — child access
for unrecognized at-rules is unregulated, so this files internal API
consistency (typed field + serializer branch + cascade walker consumer) and the
postcss#8 expectation, explicitly NOT a cssom-1 violation.

Root subsystem: `src/parser.ts` `consumeAtRule` fallback constructs
`new CSSAtRule(name, prelude, block)` without the children array; the sibling
`consumeAtRuleFromStream` populates `childRules` for the identical shape, and
`src/cascade/rule-filter.ts` walks exactly that field, so entry point decides
visibility.

Why it escaped: unknown at-rules carry no WPT conformance suite (unregulated),
and parser-api lanes exercise the populated path, masking the divergent one.

Correction locus: cssomnom overlay first (one-line construction-site fix).
Proof second: none beyond the requirement + tripwire already filed.

### Proof autonomy plan

- **(a) MC/DC rows once formalized**: `atrule_known_vs_unknown_dispatch` (T:
  known handler arm, F: fallback arm); `fallback_populates_child_rules` (T:
  children attached, F: semicolon-terminated rule with no block).
- **(b) Named witness tests**: the three defect legs (misspelled supports,
  bare unknown name, nested unknown) plus controls @media grouping and
  blockless `@foo bar;`.
- **(c) Lane proposal**: metamorphic lane asserting population parity:
  for any stylesheet text, `parse(s)` child shapes equal the shapes obtained by
  routing the same rules through the component-value-stream entry point.

## Appendix A — REFUTED candidate: escape-encoded property name dropped on re-parse (NOT filed)

The wave briefing relayed a metamorphic M2 claim: `\75 nicode-range:` serializes
but drops on second parse (css-syntax-3 § 4.3.9 #consume-name makes escapes
decode identically, so a lossy round-trip would be real). Independent
reproduction FAILED at HEAD across every shape tried:

```text
@font-face{\75 nicode-range:U+0-7F;}     pass1 ur='U+0-7F'  reparse(cssText) len=1 ur='U+0-7F'
@font-face{\75nicode-range:…}            same, retained
@font-face{\55 NICODE-RANGE:…}           same, retained
@font-face{\75\6E icode-range:…}         same, retained
direct double parse of source            len=1 both times
.o{\63 olor:red}                         pass1 'red', reparse 'red'
:root{--\31 23:red}                      items '--123', cssText '--123: red;', stable
@font-face{font-fa\6D ily:X}             retained
unescaped control                        retained (sanity)
```

The snapshot preceding today's parallel-agent commits (8991369) behaves
identically, so the finding never reproduced on this codebase state; Grizz's
minimized case could not be recovered (`/tmp/opencode/grizz-ste/*` holds only Go
build caches). Per the counting bar (reproducer fails for the asserted reason
twice), NO issue is filed. If the original case resurfaces with exact input,
re-open under kill_domain `ident_escape_fidelity`.

## Gate outputs (verbatim, end of wave)

```text
$ proof known-issue check          -> exit 0  (17 informational lines; none for KI-124..126)
$ proof evidence validate --strict -> valid: 6 evidence profile result(s)
$ proof audit --check known_issue_complete --fail-level warn
    Errors: 0  Warnings: 1
    (sole warning = PRE-EXISTING ACC-08 note: KI-26 internal duplicate against
     KI-24 by kill_domain, present since before the ki-122 batch;
     0 of 56 active KIs below quality floor, including the 3 new ones)

$ proof audit --check spec_lint_ki_ste100 --fail-level warn
    Errors: 0  Warnings: 0
$ proof audit --check spec_lint_req_ste100 --fail-level warn
    Errors: 0  Warnings: 0
$ pnpm exec oxlint proof/reproducers/KI-124-*.ts KI-125-*.ts KI-126-*.ts
    Found 0 warnings and 0 errors. (97 rules)
```

## Created-files list (all new; nothing pre-existing touched; left uncommitted for gates)

```text
proof/reproducers/KI-124-declaration-block-grammar-invalid-retained-overlay-260825.ts
proof/reproducers/KI-125-registry-stale-syntax-rejects-valid-overlay-260825.ts
proof/reproducers/KI-126-unknown-atrule-childrules-unset-overlay-260825.ts
proof/known-issues/KI-124.yaml
proof/known-issues/KI-125.yaml
proof/known-issues/KI-126.yaml
proof/evidence/ki-124.yaml
proof/evidence/ki-125.yaml
proof/evidence/ki-126.yaml
specs/system/requirements/SYS-REQ-260825-4R9S.req.yaml
specs/system/requirements/SYS-REQ-260825-7T66.req.yaml
specs/system/requirements/SYS-REQ-260825-ENH2.req.yaml
docs/proof-escape-ki-124-126.md   (this file)
```
