# ReqProof skeleton ID map

// Documents: STK-REQ-260821-BQKD, STK-REQ-260821-D7WX, STK-REQ-260821-AMK6, STK-REQ-260821-DKBQ, STK-REQ-260821-556N

Campaign: `onboard_v1` step `skeleton`.
Date: 2026-08-21.
Status: all 66 requirements in `review` (not approved).
Source: `docs/proof-onboard-research.md`.

Counts: **5 STK**, **24 SYS**, **27 SW**, **10 INT**.

## STK

| ID | Component | Purpose |
|----|-----------|---------|
| STK-REQ-260821-BQKD | cssom_consumer | Node.js caller parses CSS text into CSSStyleSheet and reads declarations |
| STK-REQ-260821-D7WX | grader_operator | Grader computes cascaded style for a mock element without getComputedStyle |
| STK-REQ-260821-AMK6 | houdini_consumer | Houdini caller parses Typed OM values and registers custom properties |
| STK-REQ-260821-DKBQ | tooling_integrator | Tooling tokenizes streams and parses without fetching `@import` |
| STK-REQ-260821-556N | conformance_owner | Maintainer uses WPT as oracle and documents intentional deviations |

## SYS

| ID | Component | Satisfies | Purpose |
|----|-----------|-----------|---------|
| SYS-REQ-260821-7521 | parser | BQKD | Parse CSS text into CSSStyleSheet |
| SYS-REQ-260821-03VA | parser | BQKD | Drop invalid rules; parse does not throw |
| SYS-REQ-260821-YMEY | cssom | BQKD | insertRule throws SyntaxError on a bad rule |
| SYS-REQ-260821-8TGB | cssom | BQKD | setProperty ignores an invalid value |
| SYS-REQ-260821-X3KX | cssom | BQKD | cssRules throws SecurityError when origin-clean is false |
| SYS-REQ-260821-SBJ7 | tokenizer | BQKD | tokenize returns a token list; StreamingTokenizer accepts chunks |
| SYS-REQ-260821-KV30 | serializer | BQKD | Serialize `.btn { color: #fff; }` tokens back to that text |
| SYS-REQ-260821-NHZ8 | parser | BQKD | Nested declarations after a nested rule become CSSNestedDeclarations |
| SYS-REQ-260821-5283 | media | BQKD | Invalid media query serializes as `not all` |
| SYS-REQ-260821-ZXZW | cascade | D7WX | getCascadedStyle returns a declaration and does not perform layout |
| SYS-REQ-260821-PJ76 | selectors | D7WX | Bad selector yields an empty match, not a crash |
| SYS-REQ-260821-MV44 | cascade | D7WX | Product does not export getComputedStyle (constraint) |
| SYS-REQ-260821-HGFK | typed_om | AMK6 | CSSStyleValue/CSSNumericValue.parse throws on invalid input |
| SYS-REQ-260821-Y6R3 | typed_om | AMK6 | Valid `10px` reifies as CSSUnitValue |
| SYS-REQ-260821-EGCP | property_registry | AMK6 | registerProperty throws on a bad dictionary or a duplicate JS-then-JS register (not CSS-then-JS) |
| SYS-REQ-260821-9YM3 | property_registry | AMK6 | `@property` with bad descriptors is dropped |
| SYS-REQ-260821-NGJH | parser_api | AMK6 | parseStylesheetSync returns CSSParserRule objects |
| SYS-REQ-260821-KA02 | parser_api | AMK6 | parseRule throws on trailing garbage |
| SYS-REQ-260821-SMW6 | parser_api | AMK6 | CSS.supports returns a boolean and does not throw |
| SYS-REQ-260821-H3BD | parser | DKBQ | `@import` is not fetched from network or disk |
| SYS-REQ-260821-RAAM | parser_api | DKBQ | CSS namespace exposes escape, supports, registerProperty, and parse |
| SYS-REQ-260821-V7V0 | library | DKBQ | Dual package exports (`cssomnom` / `cssomnom/ts`) exist |
| SYS-REQ-260821-GR67 | cssom | 556N | Documented README deviations remain the contract |
| SYS-REQ-260821-2TXS | library | 556N | Public API surface is locked by api-surface tests |

## SW

| ID | Component | Parent SYS | Purpose |
|----|-----------|------------|---------|
| SW-REQ-260821-HHVE | parser | 7521 | consume-a-stylesheet builds CSSStyleSheet |
| SW-REQ-260821-9KNX | parser | 03VA | Drop qualified rule when consumeQualifiedRule returns null |
| SW-REQ-260821-YG9J | parser | 03VA | Continue consumeListOfRules after an invalid rule |
| SW-REQ-260821-TF5T | cssom | YMEY | insertRule throws when consumeRule fails |
| SW-REQ-260821-HNRG | cssom | 8TGB | setProperty leaves the declaration unchanged on validation failure |
| SW-REQ-260821-6951 | cssom | X3KX | cssRules getter throws SecurityError when origin-clean is false |
| SW-REQ-260821-7M07 | tokenizer | SBJ7 | tokenize emits CSS Syntax-3 tokens |
| SW-REQ-260821-QV2H | tokenizer | SBJ7 | StreamingTokenizer yields tokens after appendChunk+getTokens |
| SW-REQ-260821-YTV6 | serializer | KV30 | Stringify button-color token list to the source text |
| SW-REQ-260821-39E0 | parser | NHZ8 | Wrap leftover nested declarations as CSSNestedDeclarations |
| SW-REQ-260821-W8S1 | media | 5283 | Replace an invalid query with not-all |
| SW-REQ-260821-FWNH | cascade | ZXZW | Cascade sorter picks the winning declaration without layout |
| SW-REQ-260821-6D9T | selectors | PJ76 | Selector parser rejects a bad selector; matcher returns empty |
| SW-REQ-260821-RPSA | cascade | MV44 | Cascade module omits getComputedStyle from public exports |
| SW-REQ-260821-7AKJ | typed_om | HGFK | Typed OM parse throws SyntaxError/TypeError on invalid input |
| SW-REQ-260821-E5D5 | typed_om | Y6R3 | Numeric parser constructs CSSUnitValue 10 px |
| SW-REQ-260821-PD6M | property_registry | EGCP | Throw SyntaxError/TypeError on a bad PropertyDefinition |
| SW-REQ-260821-V5GA | property_registry | EGCP | Throw InvalidModificationError on a duplicate JS-then-JS register (not CSS-then-JS) |
| SW-REQ-260821-ARC1 | property_registry | 9YM3 | Drop an at-property rule with bad descriptors |
| SW-REQ-260821-MZ8P | parser_api | NGJH | Map consume-stylesheet output to CSSParserRule nodes |
| SW-REQ-260821-2Z0N | parser_api | KA02 | parseRule throws when tokens remain after one rule |
| SW-REQ-260821-HW77 | parser_api | SMW6 | CSS.supports returns a boolean |
| SW-REQ-260821-5W6X | parser | H3BD | Construct CSSImportRule when an import URL is present |
| SW-REQ-260821-3553 | parser_api | RAAM | Bind CSS.escape, supports, registerProperty, and parse |
| SW-REQ-260821-1E5K | library | V7V0 | Export cssomnom and cssomnom/ts entry points |
| SW-REQ-260821-PAKB | cssom | GR67 | replace path honors the documented sync-parse deviation |
| SW-REQ-260821-37RC | library | 2TXS | api-surface test fails when a public export changes |

## INT

| ID | Caller | Serves SYS | Purpose |
|----|--------|------------|---------|
| INT-REQ-260821-N2VE | parser | 7521 | Parser consume path uses TokenStream peek/next + EOF sentinel |
| INT-REQ-260821-30ZA | cssom | YMEY | insertRule calls ParseHooks.consumeRule; cssom does not import Parser |
| INT-REQ-260821-9SGA | typed_om | HGFK | Typed OM parse calls ParseHooks.parseComponentValues; no Parser import |
| INT-REQ-260821-ZMZR | parser | 7521 | Parser constructs CSSOM rule classes and passes a parse callback |
| INT-REQ-260821-WQX9 | cssom | 8TGB | StylePropertyMap duck-types CSSStyleDeclaration set/get |
| INT-REQ-260821-HJVC | cascade | ZXZW | Cascade walks CSSOM rules and consults matcher, MediaParser, supports |
| INT-REQ-260821-WTPD | parser_api | NGJH | parser_api adapts Parser AST to CSSParserRule nodes |
| INT-REQ-260821-MZW3 | cssom | 5283 | MediaList calls MediaParser.parse for mediaText |
| INT-REQ-260821-ZP03 | parser_api | EGCP | CSS.registerProperty / @property share PropertyRegistry |
| INT-REQ-260821-JTY2 | geometry | HGFK | DOMMatrix string ctor uses the typed_om transform parse hook |
