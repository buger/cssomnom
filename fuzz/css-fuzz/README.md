# css-fuzz

A standalone, structure-aware **CSS** fuzzer for any CSS parser (cssomnom,
browser engines, …). It is the CSS counterpart of
[`xml-fuzz`](https://github.com/probelabs/xml-fuzz) and
[`graphql-fuzz`](https://github.com/probelabs/graphql-fuzz):

| Pillar | Module | Role |
|--------|--------|------|
| **Generate** | `generator` | Grammar-based well-formed + controlled malformed CSS |
| **Mutate** | `mutate` | **28** CSS-aware operators (`MUTATION_OPS.length`, asserted in tests) |
| **Corpus** | `corpus` | Seed bank for encoding, names, nesting, strings/comments, selectors, at-rules, values, structural |
| **Gates** | `gates` | no-panic, clean-fail, determinism, deep-nesting, output-valid, within-budget; round-trip via `runSuite` / optional `print` |
| **Orchestrate** | `fuzz` | `runStructureAware` + `CssParseTarget` |

**Standalone library** (like xml-fuzz / graphql-fuzz): not tied to cssomnom.
Any parser implements `CssParseTarget`. `CssomnomTarget` is the in-tree adapter.

Blind byte fuzzing reaches CSS state-machine edges only after huge trial counts.
`css-fuzz` always emits *structure*, then breaks it where parsers branch.

## Why structure-aware fuzzing?

Blind mutation reaches the dangerous structural boundaries of a CSS parser
(truncation right after `{`, cut inside `url(`, unmatched braces, invalid UTF-8
inside a string) only after exponentially many trials. `css-fuzz` always emits
structurally-motivated CSS from the grammar, then applies mutations that break
it at the exact positions where the tokenizer/parser state machine must
transition — maximizing coverage per fuzz iteration.

## Bug classes / nuance families

| Family | Examples |
|--------|----------|
| **Encoding / BOM / UTF-8** | UTF-8 BOM, overlong `C0 AF`, truncated sequences, `0xFF`, NUL |
| **Names / idents / custom props** | digit-start names, `--`, keywords-as-names, unicode, 1KB+ idents |
| **Deep nesting** | 80-level style-rule depth open/closed (stack DoS class) |
| **Strings / comments / CDO-CDC** | unclosed strings, unclosed comments, `<!--` / `-->` |
| **Selectors** | `:is()` / `:has()` / `:nth-*` / attribute selectors, trailing comma |
| **At-rules** | `@media` / `@supports` / `@keyframes` / `@import` / `@layer` / `@property` / `@container` / `@scope` |
| **Values / functions** | `calc()` / `var()` cycles / `url()` / `color-mix()` / `clamp()` / `!important` |
| **Structural** | truncation after `{`, extra closer, cut inside function / selector / at-keyword |

## Quick start

```ts
import * as cssfuzz from './fuzz/css-fuzz/src/index.ts';
import { rngFromSeed } from './fuzz/css-fuzz/src/index.ts';

function fuzzOne(seed: number) {
  const rng = rngFromSeed(seed);
  const doc = cssfuzz.genDocument(rng);
  const mutated = cssfuzz.applyMutation(rng, doc);
  const target = new cssfuzz.StubCssParser();
  cssfuzz.gates.noPanic('parse', () => {
    target.parse(mutated);
  });
}
```

Wire a **real** parser by implementing `CssParseTarget`:

```ts
class MyParser {
  parse(data: Uint8Array): cssfuzz.ParseOutcome {
    // must not throw on clean TypeError/SyntaxError — return Rejected instead
    return cssfuzz.accepted({
      rootHint: 'sheet',
      textFingerprint: '...',
      elapsedMs: 0,
      mode: 'stylesheet',
    });
  }
}
```

In-tree cssomnom adapter: `new CssomnomTarget('stylesheet' | 'tokenizer' | …)`.

## Structure-aware loop

```ts
import { runStructureAware, StubCssParser } from './fuzz/css-fuzz/src/index.ts';

const target = new StubCssParser();
runStructureAware(new TextEncoder().encode('a{color:red}'), target);
```

`runStructureAware` does: grammar work (if empty/short or 55% of the time) →
0–3 mutations → clean-fail parse → determinism → deep nesting (closed + open)
→ a random corpus seed → amplification sketch under a 3s budget → **optional
round-trip** if the target implements `print` (graphql-fuzz `run_suite` analog;
xml-fuzz also omits round-trip from the default loop unless a serializer exists).

## Generators

| Function | Output |
|----------|--------|
| `genDocument` / `genDocumentAtDepth` | ~28 families (style rules, at-rules, nesting, encoding, …) |
| `genWellformed` | closed, structurally motivated CSS |
| `genMalformed` | unclosed strings/comments/braces, invalid UTF-8, truncated at-rules |
| `genWork` | 75% document / 25% malformed |
| `genDeepNesting(depth, closed)` | `a{…}` nesting |
| `genValidName` / `genName` | spec-valid vs adversarial idents |
| `genSelector` / `genMediaQuery` / `genValue` / `genDeclaration` | fragments |
| `genAmplificationSketch` | `var()` cycles and deep `:is()` chains |

`MAX_GEN_DEPTH = 6`, `DEEP_NEST_DEPTH = 80` (modest for the JS stack).
Documents are `Uint8Array` so invalid UTF-8 mutations stay bytes.

## Mutations

`MUTATION_OPS.length === 28` (asserted in tests). Operators never mutate in place.

| # | Operator | Boundary |
|---|----------|----------|
| 1 | `truncateAfterOpenBrace` | cut after `{` |
| 2 | `truncateInsideDeclaration` | cut after `:` |
| 3 | `truncateInsideFunction` | cut inside `(`…`)` |
| 4 | `truncateInsideString` | cut inside quotes |
| 5 | `truncateInsideComment` | cut after `/*` |
| 6 | `truncateAfterAtKeyword` | cut after `@` ident |
| 7 | `truncateInsideSelector` | cut before `{` |
| 8 | `truncateInsideUrl` | cut inside `url(` |
| 9 | `injectInvalidUtf8` | overlong / `0xFF` / truncated |
| 10 | `injectLoneSurrogate` | U+D800 bytes or `\uD800` |
| 11 | `byteflipStructural` | XOR `{}()[]:;,@!"'` |
| 12 | `swapBraceBracket` | `{`↔`[` `}`↔`]` |
| 13 | `injectDeepNesting` | wrap in unclosed `a{` |
| 14 | `injectUnbalancedBrace` | extra `{` / `(` |
| 15 | `injectUnclosedString` | extra quote |
| 16 | `duplicateProperty` | repeat a declaration |
| 17 | `injectNulByte` | `0x00` |
| 18 | `injectBomPrefix` | UTF-8 BOM |
| 19 | `stripRandomCloser` | drop `}` / `)` / `]` |
| 20 | `swapColonSemicolon` | `:` ↔ `;` |
| 21 | `injectUnclosedComment` | `/*` without closer |
| 22 | `injectBadEscape` | lone `\` |
| 23 | `unbalanceMediaParens` | extra `(` after `@media` |
| 24 | `injectExtraCloser` | extra `}` / `)` / `]` |
| 25 | `truncateAtImportant` | cut `!important` |
| 26 | `injectCdoCdc` | `<!--` / `-->` |
| 27 | `messCustomProperty` | corrupt `--` |
| 28 | `injectNestedAmpersand` | `&:hover{…}` after `{` |

`applyMutation` picks one at random; `applyMutations(r, data, n)` applies n times.

## Gates

| Gate | Invariant | Bug class |
|---|---|---|
| `noPanic` | Function returns; does not throw unexpected exceptions | Truncation panics, assertion throws, stack overflow |
| `cleanFail` | Alias of no-panic (accept or typed reject, never crash) | Error-recovery crashes |
| `outputValid` | `{ ok: true }` passes; `{ ok: false }` is OutputInvalid; throw is Panic | Validator panics or reports invalid output |
| `roundTrip` | Parse → print → parse is equivalent (**opt-in**: `runSuite` / `target.print`) | Printer/parser asymmetry |
| `determinism` | Two parses of identical input match | Stale state / non-deterministic errors |
| `deepNestingSafe` | Deeply nested input errors cleanly | Unbounded-recursion DoS |
| `withinBudgetSync` | Completes within a wall-clock budget | Amplification / hang |

JS analog of `catch_unwind` is `try/catch`. Clean vs finding is **per-API**
inside `CssomnomTarget.isCleanError`:

- `stylesheet` / `tokenizer` / `selector` / `media` / `parser_api`: `TypeError`
  is a **finding** (css-syntax-3 returns a stylesheet/tokens/error list).
- `typed_om` / `declaration`: `TypeError` / `SyntaxError` / `DOMException` are
  clean IDL rejects.
- `RangeError` (stack overflow) is always a **finding**.

`roundTrip` is **not** an unconditional `runStructureAware` pillar. Call
`gates.roundTrip` / `runSuite` directly, or implement `CssParseTarget.print`
(`CssomnomTarget` does this for `stylesheet`).

## Corpus inventory

`REQUIRED_FAMILIES`: `encoding`, `names`, `nesting`, `strings_comments`,
`selectors`, `at_rules`, `values_functions`, `structural` — enforced by unit tests.

Size is ≥ 30 seeds (currently ~80).

## APIs (cssomnom)

| API | Entry | Fingerprint |
|-----|--------|-------------|
| `stylesheet` | `parse()` | `cssRules.length` + each `cssText` |
| `tokenizer` | `tokenize()` | token types joined |
| `selector` | `ParseHooks.parseComponentValues` + `SelectorParser.parse` | AST JSON |
| `media` | `MediaParser.parse` | query JSON |
| `typed_om` | `CSSStyleValue.parse('color', text)` | `toString()`; TypeError/SyntaxError/DOMException → Rejected |
| `parser_api` | `CSS.parseStylesheetSync` | rule count + `String(rule)` |
| `declaration` | `CSS.parseDeclaration` | name + `toString()` |

`genForApi(rng, api)` emits bytes shaped for that surface.

## Long campaign

Timed structure-aware loop. Writes interesting inputs under `crashes/`:

| Env | Default | Meaning |
|-----|---------|---------|
| `CSS_FUZZ_SECONDS` | `120` | Wall-clock budget |
| `CSS_FUZZ_ITERS` | (none) | Optional hard iteration cap |
| `CSS_FUZZ_CRASH_DIR` | `fuzz/css-fuzz/crashes` | Where to store findings |

```sh
pnpm run fuzz:campaign
CSS_FUZZ_SECONDS=5 CSS_FUZZ_ITERS=20 pnpm run fuzz:campaign
```

## Corpus export

Export curated corpus entries (by family) plus a generated batch, and refresh
the keyword dictionary:

```sh
pnpm run fuzz:export
# CSS_FUZZ_EXPORT_DIR=fuzz/css-fuzz/corpus_export
# CSS_FUZZ_EXPORT_GEN=32
# CSS_FUZZ_DICT=fuzz/css-fuzz/css-fuzz.dict
```

## How to run

```sh
# Self-tests (stub) + modest cssomnom harness
pnpm run fuzz
# or via preflight:
pnpm test:node   # includes tests/css-fuzz-*.test.ts

node fuzz/css-fuzz/examples/fuzz-loop.ts
pnpm run fuzz:campaign
pnpm run fuzz:export
```

CI iteration counts stay small (`CSS_FUZZ_ITERS`, default 32) so `pnpm test:node`
does not explode. The older blind fuzzer in `tests/fuzz.test.ts` (Phase 4) is
**not** replaced — this library supplements it.

## Differential

`compareOutcomes` + `NaiveStructuralParser` (brace/ident fingerprint).
Informational: do **not** fail CI solely because naive ≠ cssomnom.

## Non-goals

- Replacing the existing 10k-iteration blind fuzzer in `tests/fuzz.test.ts`
- Claiming exhaustive discovery of all CSS bugs
- Mutating `src/**` product code to make the fuzzer green (overlay/KI policy)
