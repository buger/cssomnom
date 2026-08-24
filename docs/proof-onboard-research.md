# ReqProof onboard research — cssomnom

// Documents: STK-REQ-260821-BQKD, STK-REQ-260821-D7WX, STK-REQ-260821-AMK6, STK-REQ-260821-DKBQ, STK-REQ-260821-556N

Campaign: `onboard_v1` step `research`.
Date: 2026-08-21.
Stance: owner (this repository). Trace policy: `source_native`.
DeFi callback / balance-delta / AMM enumerations: not applicable (CSS parser library; no caller-supplied callback addresses, no token accounting).

This note is the stakeholder, component, and boundary map used to author the four-layer skeleton. Claims cite `README.md`, `AGENTS.md`, and `src/`.

## Stakeholders

| ID | Persona | Need (from docs) | Source |
|----|---------|------------------|--------|
| cssom_consumer | Node.js library consumer | Parse CSS into a standard CSSOM (`stylesheet.cssRules[0].style.getPropertyValue`) without a browser. | README intro, Basic CSS Parsing |
| grader_operator | Static analysis / automated grader | Evaluate CSS against DOM-like structures with cascade, specificity, and selector matching. Must not get a fake `getComputedStyle`. | README Features, Static Analysis, Intentional Non-Goals |
| houdini_consumer | Typed OM / Houdini caller | Typed values, `CSS.registerProperty`, `CSS.supports`, Parser API parse methods. | README Typed OM, Houdini layer |
| tooling_integrator | Bundler / streaming / AST tooling | Dual import (`cssomnom` / `cssomnom/ts`), streaming tokenizer, AST accessors, tree-shakeable Parser API. Offline `@import`. | README Dual-Path, Low-level Tokenization, D2/D4 |
| conformance_owner | Maintainer / spec auditor | WPT + documented deviations stay the contract. Public API surface is locked. | README WPT, API Surface Verification, AGENTS.md |

## Components (production, `src/**`)

| Component | Files | Public guarantee owned |
|-----------|-------|------------------------|
| tokenizer | `AbstractTokenizer.ts`, `tokenizer.ts`, `streaming-tokenizer.ts`, `TokenStream.ts` | CSS Syntax-3 tokens; streaming chunks |
| parser | `parser.ts`, `parse-hooks.ts` | Stylesheet / rule / declaration consume; `parse()` |
| cssom | `CSSOM.ts`, `CSSStyleDeclaration.ts`, `data/gen/properties.ts` | CSSOM-1 object model and mutation |
| typed_om | `typed-om.ts`, `typed-om/**` | Houdini Typed OM values and maps |
| selectors | `SelectorParser.ts`, `matcher.ts`, `specificity.ts` | Selector grammar, match, `[a,b,c]` |
| media | `MediaParser.ts` | Media Queries 4 parse / eval / `not all` |
| cascade | `cascade.ts`, `cascade/**` | Cascaded style (not layout-computed) |
| serializer | `serializer.ts` | Token / CV / selector / declaration stringify |
| property_registry | `PropertyRegistry.ts` | `registerProperty` + `@property` syntax |
| parser_api | `parser-api.ts` | WICG Parser API + `CSS` namespace |
| math | `math-parser.ts` | calc / math-function trees |
| shorthands | `shorthands.ts`, `data/gen/shorthands.ts`, `LogicalMapping.ts` | Expand/contract + logical mapping |
| css_escape | `css-escape.ts` | CSS.escape / identifier escape |
| geometry | `DOMMatrix.ts` | DOMMatrix from transform strings |

Generated-only (not a product component): all of `src/data/gen/*` via `scripts/codegen/`.

Not on the package surface: `ParseHooks`, `TokenStream` adapters, `PropertyRegistry` (reached via `CSS.registerProperty`), `SelectorParser`, `MediaParser`, `math-parser` functions.

## Cross-component boundaries (INT candidates)

| Boundary | Caller | Callee | Contract | Breakage |
|----------|--------|--------|----------|----------|
| TokenStream | parser | tokenizer | `peek`/`next` + EOF sentinel | Consume algorithms desync |
| ParseHooks (CSSOM) | cssom, CSSStyleDeclaration | parser | `consumeRule`, `parseSelectorAST`, validation hooks; CSSOM must not import Parser | insertRule / setProperty throw "not injected" |
| ParseHooks (Typed OM) | typed_om | parser | `parseComponentValues`, custom-prop validation | CSSStyleValue.parse / numeric parse fail |
| Parser → CSSOM constructors | parser | cssom | Instantiates rule classes; passes `(text) => Rule` callback | insertRule on grouping rules |
| StylePropertyMap | cssom CSSStyleRule | typed_om | Duck-typed `setProperty`/`getPropertyValue` | styleMap desync; TypeError vs silent ignore split |
| Cascade vs rules/matcher | cascade | cssom + selectors + media + parser_api | Walks `Rule`/`CSSRule`, `matches()`, `supports()`, MediaParser | Silent drop of rules |
| Parser API adapter | parser_api | parser + tokenizer | Maps internal AST to `CSSParser*` | Public parse* contracts |
| MediaList | cssom | media | `MediaParser.parse`; invalid → `not all` | mediaText wrong |
| Property registry | parser_api CSS + cssom `@property` | property_registry | Dictionary + computationally independent initial value | register throws or silently ignores |
| DOMMatrix hook | geometry | typed_om | `setParseTransformListHook` | DOMMatrix string ctor SyntaxError |

## Untrusted-input policy (from code)

- Stylesheet ingest (`parse`, `replaceSync`, `parseStylesheetSync`): recover; drop bad rules; no input-size or nesting-depth cap.
- Single-rule inject (`insertRule`, `parseRule`): throw `SyntaxError` (plus hierarchy/index/security).
- Declaration mutate (`setProperty`, `cssText`): ignore invalid; readonly → `NoModificationAllowedError`.
- Typed OM `parse`: throw TypeError/SyntaxError.
- Media parse: invalid → `not all`.
- `selectorText` setter: ignore invalid.
- `@import`: no network/disk fetch. README says `styleSheet` is `null`; `CSSOM.ts` currently exposes an empty internal sheet. Skeleton records the documented offline contract; spec-review must reconcile code vs README.
- `replace()`: README says sync parse + `Promise.resolve(this)`; code uses `queueMicrotask`. Same reconciliation debt.

## Documented deviations (must be requirements, not silent gaps)

See README Architecture & Spec Boundaries:

- Rule constructors for headless use; `selectorAST` / `mediaQueriesAST`.
- `replace()` not parallel; sync parse.
- `@import` not fetched.
- Legacy `CSSRule.type` constants; modern types `0`.
- Parser API string boxing, sync methods, mutable arrays, mandatory `body`.
- `CSSTransformComponent` extends `CSSStyleValue`.
- Math trees preserved (trig not eagerly flattened); compatible sums may canonicalize.
- No public `getComputedStyle()`.
- No IE `expression()` / `CSSDocumentRule`.

## Configurable parameters

- `ParserOptions.atRules` (`declaration` | `rule` for unknown at-rules).
- `CSSStyleSheetInit`: `baseURL`, `media`, `disabled`.
- `PropertyDefinition` for `registerProperty`.
- `tokenize(..., unicodeRangesAllowed)`.
- `SelectorParserOptions` (forgiving, relative, namespaces).
- Internal flags: origin-clean, constructed, disallow-modification.

## Non-goals

- `cssom-view` geometry (`getClientRects`, caret APIs).
- Layout-true `getComputedStyle`.
- Network stylesheet fetch / HTTP charset.
- Drop-in Array-like `cssRules` for NV/CSSOM or rrweb.

## Conformance oracles

WPT (7 suites) is primary. Chrome wpt.fyi parity is diagnostic. External suites (csstree, PostCSS, LightningCSS, NV, rrweb) are secondary and must not override W3C when they disagree. `tests/api-surface.test.ts` locks public exports.
