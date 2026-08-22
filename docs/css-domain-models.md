# CSS domain models (ranges, mutexes, tables)

// Documents: SYS-REQ-260822-AACP, SYS-REQ-260822-4EY2, SYS-REQ-260822-SNP4, SYS-REQ-260822-XDRG, SYS-REQ-260822-YQQZ, SYS-REQ-260822-5V7N, SYS-REQ-260822-CFRA, SYS-REQ-260822-JY0V, SW-REQ-260822-73TM, SW-REQ-260822-QKE9, SW-REQ-260822-Z6J1, SW-REQ-260822-ZN94, SW-REQ-260822-7R6Z, SW-REQ-260822-YBF2, SW-REQ-260822-1REE, SW-REQ-260822-MN8Z

These are the CSS domains authored in `5f73ceb` / `b7c76d3`. Values come from
`specs/system/variables/*.vars.yaml` and the matching software copies. They
describe what the parser already does, not a product change.

KI-7 stays open: `{css_import_rule_constructed, external_sheet_fetched}` is
not a mutex. `@import` can construct `CSSImportRule` while the href is never
fetched (`CSSImportRule.styleSheet` is README-null).

## At-rule dispatch — SYS-REQ-260822-AACP / SW-REQ-260822-73TM

`parser.domain.tables.at_rule_dispatch`. Inputs: `at_rule_kind` {media,
unknown, margin} × `at_rule_case` {lower, mixed}. Output: `typed_cssom_rule`.

| kind | case | typed CSSOM subclass |
|------|------|----------------------|
| media | lower / mixed | `CSSMediaRule` (`true`) |
| margin | lower / mixed | `CSSMarginRule` (`true`) |
| unknown | lower / mixed | `CSSAtRule` fallback (`false`) |

ASCII-case fold is css-values-4 § 4.1. Mixed-case `@MEDIA` / `@TOP-LEFT` is
typed after KI-12. Mutex `at_rule_cssom_class`: one dispatch is either a typed
subclass or the unknown fallback, never both. `parse` / `parseStyleSheet` /
`replaceSync` still return a `CSSStyleSheet`.

## Resolution dpi — SYS-REQ-260822-4EY2 / SW-REQ-260822-QKE9

`media.resolution_dpi` real range **0..9600** (0 dppx through 100 dppx after
dpi / dpcm / dppx / x conversion). Boolean `(resolution)` is
`resolution_feature_positive` when environment dpi is **greater than 0**.
`MediaParser.evaluate('(resolution)', { resolution: 0 })` is false.

Related table `invalid_media_serializes_as_not_all` (mediaqueries-4
#error-handling): invalid queries serialize as `not all`. That table is not
this pair's FRETish; this pair is the dpi>0 boolean-context row.

## Position arity — SYS-REQ-260822-SNP4 / SW-REQ-260822-Z6J1

`typed_om.position_arity` int range **1..4**. Table
`position_arity_reification` (12 cells):

| arity class | object-position | background-position | perspective-origin | transform-origin |
|-------------|-----------------|---------------------|--------------------|------------------|
| 1 or 2 | reifies | reifies | reifies | reifies |
| 3 | throws | reifies | throws | throws (z-length, not CSSPositionValue) |
| 4 | reifies | reifies | reifies | throws |

`CSSStyleValue.parse` of empty `object-position` throws (`position_arity`
below 1 is outside the range; invalid input cannot reify). Mutex
`invalid_input_vs_position_reify`: `{invalid_typed_input, position_reifies}`.

## :disabled kinds — SYS-REQ-260822-XDRG / SW-REQ-260822-ZN94

Table `disabled_element_kinds` (html #selector-disabled):

| kind | `:disabled` |
|------|-------------|
| listed form control (`input`/`button`/`fieldset` disabled, including fieldset descendants) | match |
| first-legend descendant | no match |
| non-listed `div` (even with a `disabled` attribute) | no match |

Mutex `disabled_enabled_exclusive`: `{matches_disabled, matches_enabled}` —
HTML never reports both on one element. A hit on either is a non-empty match.

## Escaped hex 0..6 — SYS-REQ-260822-YQQZ / SW-REQ-260822-7R6Z

`tokenizer.escaped_hex_digits` int range **0..6**. css-syntax-3 § 4.3.7
consume-escaped-code-point and § 4.3.13 consume-unicode-range-token stop hex
at 6 digits. `\61` decodes U+0061; `\0` / surrogates / >U+10FFFF become
U+FFFD; `\1234567` consumes six hex digits and leaves `7`. `U+10FFFF7` is a
unicode-range token plus a following number `7`. `tokenize()` still returns a
`Token[]` ending in EOF.

## Box 1..4 / keyframe 0..100 / font-weight 1..1000 — SYS-REQ-260822-5V7N / SW-REQ-260822-YBF2

`cssom` ranges:

| variable | range | source |
|----------|-------|--------|
| `box_side_count` | **1..4** | css-backgrounds-3 1-to-4 value margin/padding |
| `position_token_count` | **0..4** | background-position; more than 4 rejected |
| `keyframe_offset_percent` | **0..100** | css-animations-1 `from`/`to`/`%` |
| `font_weight_number` | **1..1000** | css-fonts-4 numeric weight in `font` |

Table `box_arity_expansion`: one / two / three / four values all assign four
longhands. Mutex `shorthand_expand_or_reject`: expandBox either assigns
longhands or returns null (`margin: red` leaves longhands empty). Five-value
margin, `font: 1001`, and `101%` keyframes sit outside these ranges.

## HSL hue 0..360 — SYS-REQ-260822-CFRA / SW-REQ-260822-1REE

`cascade.hue_degrees` real range **0..360** after css-color-4 modulo-360.
`hsl_component_count` int **3..4**. Table `hsl_hue_to_rgb`: chroma C goes to
red in sectors 0–60 and 300–360. Mutex `hsl_chroma_channel`: C is assigned to
exactly one of R, G, B. `hsl(0, 100%, 50%)` cascaded color is `rgb(255, 0, 0)`.
Two-component `hsl(0, 100%)` is outside the 3..4 component range and does not
parse as that red.

## Unicode-range / namespace / @property — SYS-REQ-260822-JY0V / SW-REQ-260822-MN8Z

`property_registry` ranges on the at-property consume path:

| variable | range | source |
|----------|-------|--------|
| `urange_hex_digits` | **0..6** | css-syntax-3 unicode-range hex+wildcard |
| `namespace_prelude_count` | **1..2** | css-namespaces-3 uri, or prefix+uri |
| `keyframe_offset_percent` | **0..100** | same 0–100 domain as cssom |

A bad `@property` (missing `inherits`, or `initial-value` that fails
`PropertyRegistry.validate`) is dropped. Valid `@property --x { syntax: "*";
inherits: false; }` is kept. 7-hex `U+10FFFF7` still stops at 6 digits.

## Matrix 0..3 (INT geometry; not one of the 16 SYS/SW reqs)

`geometry.matrix_index` int range **0..3** (Geometry 4-by-4; `multiplyArrays`
walks `i,j` in 0..3). Native `matrix()` / `matrix3d()` strings skip the
typed_om transform hook. `translate(...)` string construction uses
`parseTransformListHook`. This range lives on INT-REQ-260821-JTY2, already
documented with the integration layer.
