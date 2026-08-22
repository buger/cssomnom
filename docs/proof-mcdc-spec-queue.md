# Requirement-level MC/DC spec queue (uncovered rows)

Campaign dump for later witness work. Generated from:

- `proof mcdc spec queue --format json --limit 0`
- `proof mcdc show --all --format json --table-only`

Do not run `proof audit` / `autolink` / `measure` from this artifact.
Do not add a bare `//mcdc:ignore` on a live defect. KI-1 is **fixed**; do not treat HNRG row 2 as a live `capability-gap [ki: KI-1]` hole.

## Totals

- **Uncovered witness rows:** 213
- **Requirements with uncovered rows:** 61
- Queue summary: `61 requirements checked, 213 witness rows total, 213 uncovered [1 no verifying tests, 60 missing row witnesses]`
- Status: `queue has work: 213/213 witness row(s) uncovered across 61 requirement(s)`
- Category counts: `{'missing-row-witnesses': 60, 'no-verifying-tests': 1}`
- Row kinds: `{'trigger_false': 78, 'guarantee_violation': 65, 'satisfied': 63, 'invariant_violation': 7}` (satisfied = no `kind` field on the table-only JSON row)

Every required row is currently unwitnessed (`213/213`).
`// Verifies:` links (when present) count as requirement evidence, not as row-level MC/DC coverage.
Witness comment grammar: `// MCDC <REQ-ID>: <assignment> => TRUE|FALSE`.
`trigger_false` rows also need `[no-action: …]` or `[manual-evidence: <ME-ID>]`.

## Previously 9 reqs with no verifying tests

From `docs/proof-remaining-work.md`: 1E5K, V7V0, and 7 INTs (9SGA, HJVC, JTY2, N2VE, WQX9, WTPD, ZMZR).
That bucket is **no longer true as a group**. Current queue classification:

| REQ-ID | current queue category | verifying_tests (queue) | uncovered rows | still no verifying tests? |
|--------|------------------------|-------------------------|----------------|---------------------------|
| `SW-REQ-260821-1E5K` | no-verifying-tests | 0 | 3/3 | yes (queue bucket) |
| `SYS-REQ-260821-V7V0` | missing-row-witnesses | 2 | 3/3 | no — now missing-row-witnesses |
| `INT-REQ-260821-9SGA` | missing-row-witnesses | 2 | 4/4 | no — now missing-row-witnesses |
| `INT-REQ-260821-HJVC` | missing-row-witnesses | 2 | 3/3 | no — now missing-row-witnesses |
| `INT-REQ-260821-JTY2` | missing-row-witnesses | 2 | 3/3 | no — now missing-row-witnesses |
| `INT-REQ-260821-N2VE` | missing-row-witnesses | 2 | 3/3 | no — now missing-row-witnesses |
| `INT-REQ-260821-WQX9` | missing-row-witnesses | 2 | 3/3 | no — now missing-row-witnesses |
| `INT-REQ-260821-WTPD` | missing-row-witnesses | 2 | 3/3 | no — now missing-row-witnesses |
| `INT-REQ-260821-ZMZR` | missing-row-witnesses | 2 | 3/3 | no — now missing-row-witnesses |

Notes:

- Queue currently reports **1** `no-verifying-tests` item: `SW-REQ-260821-1E5K`.
- `proof mcdc show SW-REQ-260821-1E5K` (non-table-only) **does** list verifying tests in `tests/dual-export-nominal.test.ts` (file-level + a named test), with **no** row-level `// MCDC` lines. Treat 1E5K as **uncovered rows**, not a missing-test start-from-scratch, despite the queue bucket.
- The other 8 prior members are `missing-row-witnesses` (have Verifies / `verified_by`, zero `// MCDC` lines).
- The other 3 INT-REQs (30ZA, MZW3, ZP03) were already outside that prior-9 set; they are also `missing-row-witnesses`.

## SW-REQ-260821-HNRG full table (KI-1 **fixed**)

FRETish: `when value_validation_fails the cssom shall always satisfy declaration_unchanged`

Formula: `(H ((H (! value_validation_fails)) | declaration_unchanged))`

Variables: `declaration_unchanged`, `value_validation_fails`

KI-1 (`setProperty('all')` delete-before-`expandAll`) is **fixed**. Invalid `all` is a no-op; stored `all: var(--x)` remains. Do **not** use `//mcdc:ignore:capability-gap … [ki: KI-1]` or `// MCDC … => FALSE [known-issue] [ki: KI-1]` as a live hole. Overlay SAT TRUE is `declaration_unchanged=T, value_validation_fails=T => TRUE` (`proof/reproducers/KI-1-setproperty-all.ts`, `tests/mcdc-witness-cssom.test.ts`). The `declaration_unchanged=F` FALSE rows are unreachable after the no-op class-fix; they are `//mcdc:ignore:defensive`, not a capability-gap.

| # | declaration_unchanged | value_validation_fails | Result | kind | Independent effect | KI / witness notes |
|---|-----------------------|------------------------|--------|------|--------------------|--------------------|
| 1 | F | F | TRUE | trigger_false | value_validation_fails (F→T changes result) | Positive trigger-false / no-action row. `// MCDC SW-REQ-260821-HNRG: declaration_unchanged=F, value_validation_fails=F => TRUE [no-action: …]`. |
| 2 | F | T | FALSE | guarantee_violation | declaration_unchanged (baseline); value_validation_fails (baseline) | **KI-1 closed.** Failed expand is a no-op. Unreachable `declaration_unchanged=F` under `value_validation_fails=T`. Defensive ignore only; never `[ki: KI-1]` as a live hole. |
| 3 | T | T | TRUE | satisfied | declaration_unchanged (T→F changes result) | **SAT TRUE no-op row** (declaration unchanged when validation fails). Witnessed: `// MCDC SW-REQ-260821-HNRG: declaration_unchanged=T, value_validation_fails=T => TRUE`. |

Exact `// MCDC` lines to copy:

```
// MCDC SW-REQ-260821-HNRG: declaration_unchanged=F, value_validation_fails=F => TRUE [no-action: <spy/mock/counter proving the action was not invoked>]
// MCDC SW-REQ-260821-HNRG: declaration_unchanged=T, value_validation_fails=T => TRUE
```

Do **not** copy a capability-gap or `[known-issue] [ki: KI-1]` recipe. KI-1 is fixed.

Queue category for HNRG: `missing-row-witnesses` in this dump (stale campaign snapshot). Show listed tests include `tests/api.test.ts`, `tests/cssom-style-declaration-bridge.test.ts`, `tests/setproperty-null.test.ts`, `tests/setproperty-order.test.ts`.

## Per-requirement uncovered rows

Status is `no verifying tests` only for the queue bucket; everyone else is `uncovered` (tests may exist; rows do not).
Assignment column is the exact text to paste after `// MCDC <REQ-ID>:`.

| REQ-ID | row assignment (exact text for // MCDC comments) | expected | current status |
|--------|--------------------------------------------------|----------|----------------|
| **SW-REQ-260821-1E5K** · library · no-verifying-tests · 0 verifying test(s) · 3/3 rows | | | |
| `SW-REQ-260821-1E5K` | `dual_package_exports_exist=F, package_json_exports_map_read=F => TRUE` | TRUE | no verifying tests |
| `SW-REQ-260821-1E5K` | `dual_package_exports_exist=F, package_json_exports_map_read=T => FALSE` | FALSE | no verifying tests |
| `SW-REQ-260821-1E5K` | `dual_package_exports_exist=T, package_json_exports_map_read=T => TRUE` | TRUE | no verifying tests |
| **SYS-REQ-260821-03VA** · parser · missing-row-witnesses · 3 verifying test(s) · 6/6 rows | | | |
| `SYS-REQ-260821-03VA` | `invalid_rule_consumed=F, ordinary_invalid_css=F, parse_does_not_throw=F, rule_dropped=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-03VA` | `invalid_rule_consumed=F, ordinary_invalid_css=T, parse_does_not_throw=F, rule_dropped=F => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-03VA` | `invalid_rule_consumed=T, ordinary_invalid_css=F, parse_does_not_throw=F, rule_dropped=F => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-03VA` | `invalid_rule_consumed=T, ordinary_invalid_css=T, parse_does_not_throw=F, rule_dropped=T => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-03VA` | `invalid_rule_consumed=T, ordinary_invalid_css=T, parse_does_not_throw=T, rule_dropped=F => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-03VA` | `invalid_rule_consumed=T, ordinary_invalid_css=T, parse_does_not_throw=T, rule_dropped=T => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-2Z0N** · parser_api · missing-row-witnesses · 3 verifying test(s) · 5/5 rows | | | |
| `SW-REQ-260821-2Z0N` | `ensure_eof_runs=F, parse_rule_called=T, parse_rule_throws=F, trailing_garbage=T => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-2Z0N` | `ensure_eof_runs=T, parse_rule_called=F, parse_rule_throws=F, trailing_garbage=T => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-2Z0N` | `ensure_eof_runs=T, parse_rule_called=T, parse_rule_throws=F, trailing_garbage=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-2Z0N` | `ensure_eof_runs=T, parse_rule_called=T, parse_rule_throws=F, trailing_garbage=T => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-2Z0N` | `ensure_eof_runs=T, parse_rule_called=T, parse_rule_throws=T, trailing_garbage=T => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-FWNH** · cascade · missing-row-witnesses · 2 verifying test(s) · 5/5 rows | | | |
| `SW-REQ-260821-FWNH` | `cascaded_style_returned=F, compare_cascade_declarations_runs=T, element_and_rules_supplied=T, layout_performed=F => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-FWNH` | `cascaded_style_returned=T, compare_cascade_declarations_runs=F, element_and_rules_supplied=T, layout_performed=T => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-FWNH` | `cascaded_style_returned=T, compare_cascade_declarations_runs=T, element_and_rules_supplied=F, layout_performed=T => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-FWNH` | `cascaded_style_returned=T, compare_cascade_declarations_runs=T, element_and_rules_supplied=T, layout_performed=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-FWNH` | `cascaded_style_returned=T, compare_cascade_declarations_runs=T, element_and_rules_supplied=T, layout_performed=T => FALSE` | FALSE | uncovered |
| **SW-REQ-260821-HW77** · parser_api · missing-row-witnesses · 2 verifying test(s) · 5/5 rows | | | |
| `SW-REQ-260821-HW77` | `boolean_returned=F, evaluate_supports_condition_runs=T, supports_called=T, supports_throws=F => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-HW77` | `boolean_returned=T, evaluate_supports_condition_runs=F, supports_called=T, supports_throws=T => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-HW77` | `boolean_returned=T, evaluate_supports_condition_runs=T, supports_called=F, supports_throws=T => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-HW77` | `boolean_returned=T, evaluate_supports_condition_runs=T, supports_called=T, supports_throws=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-HW77` | `boolean_returned=T, evaluate_supports_condition_runs=T, supports_called=T, supports_throws=T => FALSE` | FALSE | uncovered |
| **SYS-REQ-260821-EGCP** · property_registry · missing-row-witnesses · 2 verifying test(s) · 5/5 rows | | | |
| `SYS-REQ-260821-EGCP` | `bad_dictionary=F, duplicate_js_register=F, register_throws=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-EGCP` | `bad_dictionary=F, duplicate_js_register=T, register_throws=F => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-EGCP` | `bad_dictionary=T, duplicate_js_register=F, register_throws=F => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-EGCP` | `bad_dictionary=T, duplicate_js_register=T, register_throws=F => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-EGCP` | `bad_dictionary=T, duplicate_js_register=T, register_throws=T => TRUE` | TRUE | uncovered |
| **INT-REQ-260821-30ZA** · cssom · missing-row-witnesses · 3 verifying test(s) · 4/4 rows | | | |
| `INT-REQ-260821-30ZA` | `insert_rule_path=F, parse_hooks_consume_rule_called=F, parser_imported=F => TRUE` | TRUE | uncovered |
| `INT-REQ-260821-30ZA` | `insert_rule_path=T, parse_hooks_consume_rule_called=F, parser_imported=F => FALSE` | FALSE | uncovered |
| `INT-REQ-260821-30ZA` | `insert_rule_path=T, parse_hooks_consume_rule_called=T, parser_imported=F => TRUE` | TRUE | uncovered |
| `INT-REQ-260821-30ZA` | `insert_rule_path=T, parse_hooks_consume_rule_called=T, parser_imported=T => FALSE` | FALSE | uncovered |
| **INT-REQ-260821-9SGA** · typed_om · missing-row-witnesses · 2 verifying test(s) · 4/4 rows | | | |
| `INT-REQ-260821-9SGA` | `parse_hooks_component_values_called=F, parse_style_value=F, parser_imported=F => TRUE` | TRUE | uncovered |
| `INT-REQ-260821-9SGA` | `parse_hooks_component_values_called=F, parse_style_value=T, parser_imported=F => FALSE` | FALSE | uncovered |
| `INT-REQ-260821-9SGA` | `parse_hooks_component_values_called=T, parse_style_value=T, parser_imported=F => TRUE` | TRUE | uncovered |
| `INT-REQ-260821-9SGA` | `parse_hooks_component_values_called=T, parse_style_value=T, parser_imported=T => FALSE` | FALSE | uncovered |
| **SW-REQ-260821-37RC** · library · missing-row-witnesses · 2 verifying test(s) · 4/4 rows | | | |
| `SW-REQ-260821-37RC` | `api_surface_snapshot_compared=F, api_surface_test_updated=F, export_changed=T => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-37RC` | `api_surface_snapshot_compared=T, api_surface_test_updated=F, export_changed=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-37RC` | `api_surface_snapshot_compared=T, api_surface_test_updated=F, export_changed=T => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-37RC` | `api_surface_snapshot_compared=T, api_surface_test_updated=T, export_changed=T => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-39E0** · parser · missing-row-witnesses · 2 verifying test(s) · 4/4 rows | | | |
| `SW-REQ-260821-39E0` | `css_nested_declarations_emitted=F, flush_decls_runs=F, nested_declarations_after_nested_rule=T => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-39E0` | `css_nested_declarations_emitted=F, flush_decls_runs=T, nested_declarations_after_nested_rule=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-39E0` | `css_nested_declarations_emitted=F, flush_decls_runs=T, nested_declarations_after_nested_rule=T => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-39E0` | `css_nested_declarations_emitted=T, flush_decls_runs=T, nested_declarations_after_nested_rule=T => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-5W6X** · parser · missing-row-witnesses · 2 verifying test(s) · 4/4 rows | | | |
| `SW-REQ-260821-5W6X` | `css_import_rule_constructed=F, external_sheet_fetched=T, import_url_present=T => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-5W6X` | `css_import_rule_constructed=T, external_sheet_fetched=F, import_url_present=T => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-5W6X` | `css_import_rule_constructed=T, external_sheet_fetched=T, import_url_present=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-5W6X` | `css_import_rule_constructed=T, external_sheet_fetched=T, import_url_present=T => FALSE` | FALSE | uncovered |
| **SW-REQ-260821-6951** · cssom · missing-row-witnesses · 1 verifying test(s) · 4/4 rows | | | |
| `SW-REQ-260821-6951` | `css_rules_getter_runs=F, origin_clean=F, security_error_thrown=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-6951` | `css_rules_getter_runs=T, origin_clean=F, security_error_thrown=F => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-6951` | `css_rules_getter_runs=T, origin_clean=F, security_error_thrown=T => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-6951` | `css_rules_getter_runs=T, origin_clean=T, security_error_thrown=F => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-6D9T** · selectors · missing-row-witnesses · 4 verifying test(s) · 4/4 rows | | | |
| `SW-REQ-260821-6D9T` | `bad_selector_supplied=F, empty_match=F, parse_selector_rejects=T => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-6D9T` | `bad_selector_supplied=T, empty_match=F, parse_selector_rejects=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-6D9T` | `bad_selector_supplied=T, empty_match=F, parse_selector_rejects=T => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-6D9T` | `bad_selector_supplied=T, empty_match=T, parse_selector_rejects=T => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-7AKJ** · typed_om · missing-row-witnesses · 4 verifying test(s) · 4/4 rows | | | |
| `SW-REQ-260821-7AKJ` | `invalid_typed_input=F, parse_style_value=T, parse_throws=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-7AKJ` | `invalid_typed_input=T, parse_style_value=F, parse_throws=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-7AKJ` | `invalid_typed_input=T, parse_style_value=T, parse_throws=F => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-7AKJ` | `invalid_typed_input=T, parse_style_value=T, parse_throws=T => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-7M07** · tokenizer · missing-row-witnesses · 3 verifying test(s) · 4/4 rows | | | |
| `SW-REQ-260821-7M07` | `consume_token_loop_runs=F, css_text_supplied=T, token_list_returned=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-7M07` | `consume_token_loop_runs=T, css_text_supplied=F, token_list_returned=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-7M07` | `consume_token_loop_runs=T, css_text_supplied=T, token_list_returned=F => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-7M07` | `consume_token_loop_runs=T, css_text_supplied=T, token_list_returned=T => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-ARC1** · property_registry · missing-row-witnesses · 3 verifying test(s) · 4/4 rows | | | |
| `SW-REQ-260821-ARC1` | `at_property_validate_fails=F, bad_at_property=T, property_rule_dropped=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-ARC1` | `at_property_validate_fails=T, bad_at_property=F, property_rule_dropped=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-ARC1` | `at_property_validate_fails=T, bad_at_property=T, property_rule_dropped=F => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-ARC1` | `at_property_validate_fails=T, bad_at_property=T, property_rule_dropped=T => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-E5D5** · typed_om · missing-row-witnesses · 2 verifying test(s) · 4/4 rows | | | |
| `SW-REQ-260821-E5D5` | `css_unit_value_returned=F, parse_numeric_value_runs=F, ten_px_parsed=T => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-E5D5` | `css_unit_value_returned=F, parse_numeric_value_runs=T, ten_px_parsed=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-E5D5` | `css_unit_value_returned=F, parse_numeric_value_runs=T, ten_px_parsed=T => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-E5D5` | `css_unit_value_returned=T, parse_numeric_value_runs=T, ten_px_parsed=T => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-MZ8P** · parser_api · missing-row-witnesses · 2 verifying test(s) · 4/4 rows | | | |
| `SW-REQ-260821-MZ8P` | `css_parser_rule_returned=F, parse_stylesheet_sync_called=F, to_parser_rule_maps_ast=T => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-MZ8P` | `css_parser_rule_returned=F, parse_stylesheet_sync_called=T, to_parser_rule_maps_ast=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-MZ8P` | `css_parser_rule_returned=F, parse_stylesheet_sync_called=T, to_parser_rule_maps_ast=T => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-MZ8P` | `css_parser_rule_returned=T, parse_stylesheet_sync_called=T, to_parser_rule_maps_ast=T => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-PAKB** · cssom · missing-row-witnesses · 1 verifying test(s) · 4/4 rows | | | |
| `SW-REQ-260821-PAKB` | `deviation_applies=F, documented_deviation_honored=F, replace_sync_parse_runs=T => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-PAKB` | `deviation_applies=T, documented_deviation_honored=F, replace_sync_parse_runs=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-PAKB` | `deviation_applies=T, documented_deviation_honored=F, replace_sync_parse_runs=T => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-PAKB` | `deviation_applies=T, documented_deviation_honored=T, replace_sync_parse_runs=T => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-W8S1** · media · missing-row-witnesses · 3 verifying test(s) · 4/4 rows | | | |
| `SW-REQ-260821-W8S1` | `media_query_invalid=F, serialize_media_query_runs=T, serialized_as_not_all=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-W8S1` | `media_query_invalid=T, serialize_media_query_runs=F, serialized_as_not_all=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-W8S1` | `media_query_invalid=T, serialize_media_query_runs=T, serialized_as_not_all=F => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-W8S1` | `media_query_invalid=T, serialize_media_query_runs=T, serialized_as_not_all=T => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-YTV6** · serializer · missing-row-witnesses · 2 verifying test(s) · 4/4 rows | | | |
| `SW-REQ-260821-YTV6` | `serialize_token_list_runs=F, serialized_equals_source=F, tokens_from_btn_rule=T => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-YTV6` | `serialize_token_list_runs=T, serialized_equals_source=F, tokens_from_btn_rule=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-YTV6` | `serialize_token_list_runs=T, serialized_equals_source=F, tokens_from_btn_rule=T => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-YTV6` | `serialize_token_list_runs=T, serialized_equals_source=T, tokens_from_btn_rule=T => TRUE` | TRUE | uncovered |
| **SYS-REQ-260821-8TGB** · cssom · missing-row-witnesses · 5 verifying test(s) · 4/4 rows | | | |
| `SYS-REQ-260821-8TGB` | `invalid_value=F, set_property_called=T, set_property_ignored=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-8TGB` | `invalid_value=T, set_property_called=F, set_property_ignored=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-8TGB` | `invalid_value=T, set_property_called=T, set_property_ignored=F => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-8TGB` | `invalid_value=T, set_property_called=T, set_property_ignored=T => TRUE` | TRUE | uncovered |
| **SYS-REQ-260821-KA02** · parser_api · missing-row-witnesses · 3 verifying test(s) · 4/4 rows | | | |
| `SYS-REQ-260821-KA02` | `parse_rule_called=F, parse_rule_throws=F, trailing_garbage=T => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-KA02` | `parse_rule_called=T, parse_rule_throws=F, trailing_garbage=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-KA02` | `parse_rule_called=T, parse_rule_throws=F, trailing_garbage=T => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-KA02` | `parse_rule_called=T, parse_rule_throws=T, trailing_garbage=T => TRUE` | TRUE | uncovered |
| **SYS-REQ-260821-SMW6** · parser_api · missing-row-witnesses · 2 verifying test(s) · 4/4 rows | | | |
| `SYS-REQ-260821-SMW6` | `boolean_returned=F, supports_called=F, supports_throws=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-SMW6` | `boolean_returned=F, supports_called=T, supports_throws=F => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-SMW6` | `boolean_returned=T, supports_called=T, supports_throws=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-SMW6` | `boolean_returned=T, supports_called=T, supports_throws=T => FALSE` | FALSE | uncovered |
| **SYS-REQ-260821-YMEY** · cssom · missing-row-witnesses · 5 verifying test(s) · 4/4 rows | | | |
| `SYS-REQ-260821-YMEY` | `bad_rule=F, insert_rule_called=T, syntax_error_thrown=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-YMEY` | `bad_rule=T, insert_rule_called=F, syntax_error_thrown=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-YMEY` | `bad_rule=T, insert_rule_called=T, syntax_error_thrown=F => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-YMEY` | `bad_rule=T, insert_rule_called=T, syntax_error_thrown=T => TRUE` | TRUE | uncovered |
| **SYS-REQ-260821-ZXZW** · cascade · missing-row-witnesses · 3 verifying test(s) · 4/4 rows | | | |
| `SYS-REQ-260821-ZXZW` | `cascaded_style_returned=F, element_and_rules_supplied=F, layout_performed=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-ZXZW` | `cascaded_style_returned=F, element_and_rules_supplied=T, layout_performed=F => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-ZXZW` | `cascaded_style_returned=T, element_and_rules_supplied=T, layout_performed=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-ZXZW` | `cascaded_style_returned=T, element_and_rules_supplied=T, layout_performed=T => FALSE` | FALSE | uncovered |
| **INT-REQ-260821-HJVC** · cascade · missing-row-witnesses · 2 verifying test(s) · 3/3 rows | | | |
| `INT-REQ-260821-HJVC` | `cascaded_style_requested=F, matcher_and_media_consulted=F => TRUE` | TRUE | uncovered |
| `INT-REQ-260821-HJVC` | `cascaded_style_requested=T, matcher_and_media_consulted=F => FALSE` | FALSE | uncovered |
| `INT-REQ-260821-HJVC` | `cascaded_style_requested=T, matcher_and_media_consulted=T => TRUE` | TRUE | uncovered |
| **INT-REQ-260821-JTY2** · geometry · missing-row-witnesses · 2 verifying test(s) · 3/3 rows | | | |
| `INT-REQ-260821-JTY2` | `transform_string_parsed=F, native_matrix_string=F, typed_om_transform_hook_used=F => TRUE` | TRUE | retargeted (this dump stale) |
| `INT-REQ-260821-JTY2` | `transform_string_parsed=T, native_matrix_string=T, typed_om_transform_hook_used=F => TRUE` **← native matrix()/matrix3d() exemption SAT TRUE; not defensive** | TRUE | retargeted |
| `INT-REQ-260821-JTY2` | `transform_string_parsed=T, native_matrix_string=F, typed_om_transform_hook_used=T => TRUE` | TRUE | retargeted |
| **INT-REQ-260821-MZW3** · cssom · missing-row-witnesses · 3 verifying test(s) · 3/3 rows | | | |
| `INT-REQ-260821-MZW3` | `media_parser_parse_called=F, media_text_set=F => TRUE` | TRUE | uncovered |
| `INT-REQ-260821-MZW3` | `media_parser_parse_called=F, media_text_set=T => FALSE` | FALSE | uncovered |
| `INT-REQ-260821-MZW3` | `media_parser_parse_called=T, media_text_set=T => TRUE` | TRUE | uncovered |
| **INT-REQ-260821-N2VE** · parser · missing-row-witnesses · 2 verifying test(s) · 3/3 rows | | | |
| `INT-REQ-260821-N2VE` | `consume_step=F, token_stream_peek_next_used=F => TRUE` | TRUE | uncovered |
| `INT-REQ-260821-N2VE` | `consume_step=T, token_stream_peek_next_used=F => FALSE` | FALSE | uncovered |
| `INT-REQ-260821-N2VE` | `consume_step=T, token_stream_peek_next_used=T => TRUE` | TRUE | uncovered |
| **INT-REQ-260821-WQX9** · cssom · missing-row-witnesses · 2 verifying test(s) · 3/3 rows | | | |
| `INT-REQ-260821-WQX9` | `style_declaration_duck_typed=F, style_map_mutated=F => TRUE` | TRUE | uncovered |
| `INT-REQ-260821-WQX9` | `style_declaration_duck_typed=F, style_map_mutated=T => FALSE` | FALSE | uncovered |
| `INT-REQ-260821-WQX9` | `style_declaration_duck_typed=T, style_map_mutated=T => TRUE` | TRUE | uncovered |
| **INT-REQ-260821-WTPD** · parser_api · missing-row-witnesses · 2 verifying test(s) · 3/3 rows | | | |
| `INT-REQ-260821-WTPD` | `parse_stylesheet_sync_called=F, parser_ast_adapted=F => TRUE` | TRUE | uncovered |
| `INT-REQ-260821-WTPD` | `parse_stylesheet_sync_called=T, parser_ast_adapted=F => FALSE` | FALSE | uncovered |
| `INT-REQ-260821-WTPD` | `parse_stylesheet_sync_called=T, parser_ast_adapted=T => TRUE` | TRUE | uncovered |
| **INT-REQ-260821-ZMZR** · parser · missing-row-witnesses · 2 verifying test(s) · 3/3 rows | | | |
| `INT-REQ-260821-ZMZR` | `cssom_rule_constructed=F, grouping_rule_built=F => TRUE` | TRUE | uncovered |
| `INT-REQ-260821-ZMZR` | `cssom_rule_constructed=F, grouping_rule_built=T => FALSE` | FALSE | uncovered |
| `INT-REQ-260821-ZMZR` | `cssom_rule_constructed=T, grouping_rule_built=T => TRUE` | TRUE | uncovered |
| **INT-REQ-260821-ZP03** · parser_api · missing-row-witnesses · 3 verifying test(s) · 3/3 rows | | | |
| `INT-REQ-260821-ZP03` | `property_registry_updated=F, register_property_called=F => TRUE` | TRUE | uncovered |
| `INT-REQ-260821-ZP03` | `property_registry_updated=F, register_property_called=T => FALSE` | FALSE | uncovered |
| `INT-REQ-260821-ZP03` | `property_registry_updated=T, register_property_called=T => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-3553** · parser_api · missing-row-witnesses · 2 verifying test(s) · 3/3 rows | | | |
| `SW-REQ-260821-3553` | `css_namespace_methods_exported=F, css_namespace_object_bound=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-3553` | `css_namespace_methods_exported=F, css_namespace_object_bound=T => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-3553` | `css_namespace_methods_exported=T, css_namespace_object_bound=T => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-9KNX** · parser · missing-row-witnesses · 2 verifying test(s) · 3/3 rows | | | |
| `SW-REQ-260821-9KNX` | `consume_qualified_rule_returns_null=F, qualified_rule_dropped=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-9KNX` | `consume_qualified_rule_returns_null=T, qualified_rule_dropped=F => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-9KNX` | `consume_qualified_rule_returns_null=T, qualified_rule_dropped=T => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-HHVE** · parser · missing-row-witnesses · 3 verifying test(s) · 3/3 rows | | | |
| `SW-REQ-260821-HHVE` | `consume_stylesheet_completed=F, css_text_supplied=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-HHVE` | `consume_stylesheet_completed=F, css_text_supplied=T => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-HHVE` | `consume_stylesheet_completed=T, css_text_supplied=T => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-HNRG** · cssom · missing-row-witnesses · 5 verifying test(s) · 3/3 rows | | | |
| `SW-REQ-260821-HNRG` | `declaration_unchanged=F, value_validation_fails=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-HNRG` | `declaration_unchanged=F, value_validation_fails=T => FALSE` **← KI-1 fixed; not a live hole** | FALSE | uncovered |
| `SW-REQ-260821-HNRG` | `declaration_unchanged=T, value_validation_fails=T => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-PD6M** · property_registry · missing-row-witnesses · 2 verifying test(s) · 3/3 rows | | | |
| `SW-REQ-260821-PD6M` | `bad_dictionary=F, register_throws=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-PD6M` | `bad_dictionary=T, register_throws=F => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-PD6M` | `bad_dictionary=T, register_throws=T => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-QV2H** · tokenizer · missing-row-witnesses · 2 verifying test(s) · 3/3 rows | | | |
| `SW-REQ-260821-QV2H` | `chunk_appended=F, tokens_available_after_get_tokens=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-QV2H` | `chunk_appended=T, tokens_available_after_get_tokens=F => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-QV2H` | `chunk_appended=T, tokens_available_after_get_tokens=T => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-RPSA** · cascade · missing-row-witnesses · 1 verifying test(s) · 3/3 rows | | | |
| `SW-REQ-260821-RPSA` | `cascade_index_exports_read=F, get_computed_style_exported=T => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-RPSA` | `cascade_index_exports_read=T, get_computed_style_exported=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-RPSA` | `cascade_index_exports_read=T, get_computed_style_exported=T => FALSE` | FALSE | uncovered |
| **SW-REQ-260821-TF5T** · cssom · missing-row-witnesses · 5 verifying test(s) · 3/3 rows | | | |
| `SW-REQ-260821-TF5T` | `consume_rule_fails=F, syntax_error_thrown=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-TF5T` | `consume_rule_fails=T, syntax_error_thrown=F => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-TF5T` | `consume_rule_fails=T, syntax_error_thrown=T => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-V5GA** · property_registry · missing-row-witnesses · 2 verifying test(s) · 3/3 rows | | | |
| `SW-REQ-260821-V5GA` | `duplicate_js_register=F, invalid_modification_error=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-V5GA` | `duplicate_js_register=T, invalid_modification_error=F => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-V5GA` | `duplicate_js_register=T, invalid_modification_error=T => TRUE` | TRUE | uncovered |
| **SW-REQ-260821-YG9J** · parser · missing-row-witnesses · 2 verifying test(s) · 3/3 rows | | | |
| `SW-REQ-260821-YG9J` | `ordinary_invalid_css=F, parse_does_not_throw=F => TRUE` | TRUE | uncovered |
| `SW-REQ-260821-YG9J` | `ordinary_invalid_css=T, parse_does_not_throw=F => FALSE` | FALSE | uncovered |
| `SW-REQ-260821-YG9J` | `ordinary_invalid_css=T, parse_does_not_throw=T => TRUE` | TRUE | uncovered |
| **SYS-REQ-260821-2TXS** · library · missing-row-witnesses · 2 verifying test(s) · 3/3 rows | | | |
| `SYS-REQ-260821-2TXS` | `api_surface_test_updated=F, export_changed=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-2TXS` | `api_surface_test_updated=F, export_changed=T => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-2TXS` | `api_surface_test_updated=T, export_changed=T => TRUE` | TRUE | uncovered |
| **SYS-REQ-260821-5283** · media · missing-row-witnesses · 3 verifying test(s) · 3/3 rows | | | |
| `SYS-REQ-260821-5283` | `media_query_invalid=F, serialized_as_not_all=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-5283` | `media_query_invalid=T, serialized_as_not_all=F => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-5283` | `media_query_invalid=T, serialized_as_not_all=T => TRUE` | TRUE | uncovered |
| **SYS-REQ-260821-7521** · parser · missing-row-witnesses · 4 verifying test(s) · 3/3 rows | | | |
| `SYS-REQ-260821-7521` | `css_text_supplied=F, stylesheet_returned=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-7521` | `css_text_supplied=T, stylesheet_returned=F => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-7521` | `css_text_supplied=T, stylesheet_returned=T => TRUE` | TRUE | uncovered |
| **SYS-REQ-260821-9YM3** · property_registry · missing-row-witnesses · 3 verifying test(s) · 3/3 rows | | | |
| `SYS-REQ-260821-9YM3` | `bad_at_property=F, property_rule_dropped=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-9YM3` | `bad_at_property=T, property_rule_dropped=F => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-9YM3` | `bad_at_property=T, property_rule_dropped=T => TRUE` | TRUE | uncovered |
| **SYS-REQ-260821-GR67** · cssom · missing-row-witnesses · 1 verifying test(s) · 3/3 rows | | | |
| `SYS-REQ-260821-GR67` | `deviation_applies=F, documented_deviation_honored=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-GR67` | `deviation_applies=T, documented_deviation_honored=F => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-GR67` | `deviation_applies=T, documented_deviation_honored=T => TRUE` | TRUE | uncovered |
| **SYS-REQ-260821-H3BD** · parser · missing-row-witnesses · 3 verifying test(s) · 3/3 rows | | | |
| `SYS-REQ-260821-H3BD` | `external_sheet_fetched=F, import_url_present=T => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-H3BD` | `external_sheet_fetched=T, import_url_present=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-H3BD` | `external_sheet_fetched=T, import_url_present=T => FALSE` | FALSE | uncovered |
| **SYS-REQ-260821-HGFK** · typed_om · missing-row-witnesses · 5 verifying test(s) · 3/3 rows | | | |
| `SYS-REQ-260821-HGFK` | `invalid_typed_input=F, parse_throws=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-HGFK` | `invalid_typed_input=T, parse_throws=F => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-HGFK` | `invalid_typed_input=T, parse_throws=T => TRUE` | TRUE | uncovered |
| **SYS-REQ-260821-KV30** · serializer · missing-row-witnesses · 2 verifying test(s) · 3/3 rows | | | |
| `SYS-REQ-260821-KV30` | `serialized_equals_source=F, tokens_from_btn_rule=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-KV30` | `serialized_equals_source=F, tokens_from_btn_rule=T => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-KV30` | `serialized_equals_source=T, tokens_from_btn_rule=T => TRUE` | TRUE | uncovered |
| **SYS-REQ-260821-NGJH** · parser_api · missing-row-witnesses · 2 verifying test(s) · 3/3 rows | | | |
| `SYS-REQ-260821-NGJH` | `css_parser_rule_returned=F, parse_stylesheet_sync_called=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-NGJH` | `css_parser_rule_returned=F, parse_stylesheet_sync_called=T => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-NGJH` | `css_parser_rule_returned=T, parse_stylesheet_sync_called=T => TRUE` | TRUE | uncovered |
| **SYS-REQ-260821-NHZ8** · parser · missing-row-witnesses · 2 verifying test(s) · 3/3 rows | | | |
| `SYS-REQ-260821-NHZ8` | `css_nested_declarations_emitted=F, nested_declarations_after_nested_rule=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-NHZ8` | `css_nested_declarations_emitted=F, nested_declarations_after_nested_rule=T => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-NHZ8` | `css_nested_declarations_emitted=T, nested_declarations_after_nested_rule=T => TRUE` | TRUE | uncovered |
| **SYS-REQ-260821-PJ76** · selectors · missing-row-witnesses · 4 verifying test(s) · 3/3 rows | | | |
| `SYS-REQ-260821-PJ76` | `bad_selector_supplied=F, empty_match=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-PJ76` | `bad_selector_supplied=T, empty_match=F => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-PJ76` | `bad_selector_supplied=T, empty_match=T => TRUE` | TRUE | uncovered |
| **SYS-REQ-260821-RAAM** · parser_api · missing-row-witnesses · 7 verifying test(s) · 3/3 rows | | | |
| `SYS-REQ-260821-RAAM` | `css_namespace_imported=F, css_namespace_methods_exported=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-RAAM` | `css_namespace_imported=T, css_namespace_methods_exported=F => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-RAAM` | `css_namespace_imported=T, css_namespace_methods_exported=T => TRUE` | TRUE | uncovered |
| **SYS-REQ-260821-SBJ7** · tokenizer · missing-row-witnesses · 4 verifying test(s) · 3/3 rows | | | |
| `SYS-REQ-260821-SBJ7` | `css_text_supplied=F, token_list_returned=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-SBJ7` | `css_text_supplied=T, token_list_returned=F => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-SBJ7` | `css_text_supplied=T, token_list_returned=T => TRUE` | TRUE | uncovered |
| **SYS-REQ-260821-V7V0** · library · missing-row-witnesses · 2 verifying test(s) · 3/3 rows | | | |
| `SYS-REQ-260821-V7V0` | `cssomnom_or_cssomnom_ts_imported=F, dual_package_exports_exist=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-V7V0` | `cssomnom_or_cssomnom_ts_imported=T, dual_package_exports_exist=F => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-V7V0` | `cssomnom_or_cssomnom_ts_imported=T, dual_package_exports_exist=T => TRUE` | TRUE | uncovered |
| **SYS-REQ-260821-X3KX** · cssom · missing-row-witnesses · 1 verifying test(s) · 3/3 rows | | | |
| `SYS-REQ-260821-X3KX` | `origin_clean=F, security_error_thrown=F => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-X3KX` | `origin_clean=F, security_error_thrown=T => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-X3KX` | `origin_clean=T, security_error_thrown=F => TRUE` | TRUE | uncovered |
| **SYS-REQ-260821-Y6R3** · typed_om · missing-row-witnesses · 2 verifying test(s) · 3/3 rows | | | |
| `SYS-REQ-260821-Y6R3` | `css_unit_value_returned=F, ten_px_parsed=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-Y6R3` | `css_unit_value_returned=F, ten_px_parsed=T => FALSE` | FALSE | uncovered |
| `SYS-REQ-260821-Y6R3` | `css_unit_value_returned=T, ten_px_parsed=T => TRUE` | TRUE | uncovered |
| **SYS-REQ-260821-MV44** · cascade · missing-row-witnesses · 2 verifying test(s) · 2/2 rows | | | |
| `SYS-REQ-260821-MV44` | `get_computed_style_exported=F => TRUE` | TRUE | uncovered |
| `SYS-REQ-260821-MV44` | `get_computed_style_exported=T => FALSE` | FALSE | uncovered |

## Per-requirement counts

| REQ-ID | component | category | verifying_tests | uncovered / required | trigger_false | guarantee_violation | invariant_violation | satisfied |
|--------|-----------|----------|-----------------|----------------------|---------------|---------------------|---------------------|-----------|
| `SW-REQ-260821-1E5K` | library | no-verifying-tests | 0 | 3/3 | 1 | 1 | 0 | 1 |
| `SYS-REQ-260821-03VA` | parser | missing-row-witnesses | 3 | 6/6 | 0 | 0 | 4 | 2 |
| `SW-REQ-260821-2Z0N` | parser_api | missing-row-witnesses | 3 | 5/5 | 3 | 1 | 0 | 1 |
| `SW-REQ-260821-FWNH` | cascade | missing-row-witnesses | 2 | 5/5 | 2 | 2 | 0 | 1 |
| `SW-REQ-260821-HW77` | parser_api | missing-row-witnesses | 2 | 5/5 | 2 | 2 | 0 | 1 |
| `SYS-REQ-260821-EGCP` | property_registry | missing-row-witnesses | 2 | 5/5 | 1 | 3 | 0 | 1 |
| `INT-REQ-260821-30ZA` | cssom | missing-row-witnesses | 3 | 4/4 | 1 | 2 | 0 | 1 |
| `INT-REQ-260821-9SGA` | typed_om | missing-row-witnesses | 2 | 4/4 | 1 | 2 | 0 | 1 |
| `SW-REQ-260821-37RC` | library | missing-row-witnesses | 2 | 4/4 | 1 | 1 | 0 | 2 |
| `SW-REQ-260821-39E0` | parser | missing-row-witnesses | 2 | 4/4 | 2 | 1 | 0 | 1 |
| `SW-REQ-260821-5W6X` | parser | missing-row-witnesses | 2 | 4/4 | 2 | 1 | 0 | 1 |
| `SW-REQ-260821-6951` | cssom | missing-row-witnesses | 1 | 4/4 | 2 | 1 | 0 | 1 |
| `SW-REQ-260821-6D9T` | selectors | missing-row-witnesses | 4 | 4/4 | 2 | 1 | 0 | 1 |
| `SW-REQ-260821-7AKJ` | typed_om | missing-row-witnesses | 4 | 4/4 | 2 | 1 | 0 | 1 |
| `SW-REQ-260821-7M07` | tokenizer | missing-row-witnesses | 3 | 4/4 | 2 | 1 | 0 | 1 |
| `SW-REQ-260821-ARC1` | property_registry | missing-row-witnesses | 3 | 4/4 | 2 | 1 | 0 | 1 |
| `SW-REQ-260821-E5D5` | typed_om | missing-row-witnesses | 2 | 4/4 | 2 | 1 | 0 | 1 |
| `SW-REQ-260821-MZ8P` | parser_api | missing-row-witnesses | 2 | 4/4 | 2 | 1 | 0 | 1 |
| `SW-REQ-260821-PAKB` | cssom | missing-row-witnesses | 1 | 4/4 | 2 | 1 | 0 | 1 |
| `SW-REQ-260821-W8S1` | media | missing-row-witnesses | 3 | 4/4 | 2 | 1 | 0 | 1 |
| `SW-REQ-260821-YTV6` | serializer | missing-row-witnesses | 2 | 4/4 | 2 | 1 | 0 | 1 |
| `SYS-REQ-260821-8TGB` | cssom | missing-row-witnesses | 5 | 4/4 | 2 | 1 | 0 | 1 |
| `SYS-REQ-260821-KA02` | parser_api | missing-row-witnesses | 3 | 4/4 | 2 | 1 | 0 | 1 |
| `SYS-REQ-260821-SMW6` | parser_api | missing-row-witnesses | 2 | 4/4 | 1 | 2 | 0 | 1 |
| `SYS-REQ-260821-YMEY` | cssom | missing-row-witnesses | 5 | 4/4 | 2 | 1 | 0 | 1 |
| `SYS-REQ-260821-ZXZW` | cascade | missing-row-witnesses | 3 | 4/4 | 1 | 2 | 0 | 1 |
| `INT-REQ-260821-HJVC` | cascade | missing-row-witnesses | 2 | 3/3 | 1 | 1 | 0 | 1 |
| `INT-REQ-260821-JTY2` | geometry | missing-row-witnesses | 2 | 3/3 | 1 | 1 | 0 | 1 |
| `INT-REQ-260821-MZW3` | cssom | missing-row-witnesses | 3 | 3/3 | 1 | 1 | 0 | 1 |
| `INT-REQ-260821-N2VE` | parser | missing-row-witnesses | 2 | 3/3 | 1 | 1 | 0 | 1 |
| `INT-REQ-260821-WQX9` | cssom | missing-row-witnesses | 2 | 3/3 | 1 | 1 | 0 | 1 |
| `INT-REQ-260821-WTPD` | parser_api | missing-row-witnesses | 2 | 3/3 | 1 | 1 | 0 | 1 |
| `INT-REQ-260821-ZMZR` | parser | missing-row-witnesses | 2 | 3/3 | 1 | 1 | 0 | 1 |
| `INT-REQ-260821-ZP03` | parser_api | missing-row-witnesses | 3 | 3/3 | 1 | 1 | 0 | 1 |
| `SW-REQ-260821-3553` | parser_api | missing-row-witnesses | 2 | 3/3 | 1 | 1 | 0 | 1 |
| `SW-REQ-260821-9KNX` | parser | missing-row-witnesses | 2 | 3/3 | 1 | 1 | 0 | 1 |
| `SW-REQ-260821-HHVE` | parser | missing-row-witnesses | 3 | 3/3 | 1 | 1 | 0 | 1 |
| `SW-REQ-260821-HNRG` | cssom | missing-row-witnesses | 5 | 3/3 | 1 | 1 | 0 | 1 |
| `SW-REQ-260821-PD6M` | property_registry | missing-row-witnesses | 2 | 3/3 | 1 | 1 | 0 | 1 |
| `SW-REQ-260821-QV2H` | tokenizer | missing-row-witnesses | 2 | 3/3 | 1 | 1 | 0 | 1 |
| `SW-REQ-260821-RPSA` | cascade | missing-row-witnesses | 1 | 3/3 | 1 | 1 | 0 | 1 |
| `SW-REQ-260821-TF5T` | cssom | missing-row-witnesses | 5 | 3/3 | 1 | 1 | 0 | 1 |
| `SW-REQ-260821-V5GA` | property_registry | missing-row-witnesses | 2 | 3/3 | 1 | 1 | 0 | 1 |
| `SW-REQ-260821-YG9J` | parser | missing-row-witnesses | 2 | 3/3 | 1 | 1 | 0 | 1 |
| `SYS-REQ-260821-2TXS` | library | missing-row-witnesses | 2 | 3/3 | 1 | 0 | 1 | 1 |
| `SYS-REQ-260821-5283` | media | missing-row-witnesses | 3 | 3/3 | 1 | 1 | 0 | 1 |
| `SYS-REQ-260821-7521` | parser | missing-row-witnesses | 4 | 3/3 | 1 | 1 | 0 | 1 |
| `SYS-REQ-260821-9YM3` | property_registry | missing-row-witnesses | 3 | 3/3 | 1 | 1 | 0 | 1 |
| `SYS-REQ-260821-GR67` | cssom | missing-row-witnesses | 1 | 3/3 | 1 | 1 | 0 | 1 |
| `SYS-REQ-260821-H3BD` | parser | missing-row-witnesses | 3 | 3/3 | 1 | 1 | 0 | 1 |
| `SYS-REQ-260821-HGFK` | typed_om | missing-row-witnesses | 5 | 3/3 | 1 | 1 | 0 | 1 |
| `SYS-REQ-260821-KV30` | serializer | missing-row-witnesses | 2 | 3/3 | 1 | 1 | 0 | 1 |
| `SYS-REQ-260821-NGJH` | parser_api | missing-row-witnesses | 2 | 3/3 | 1 | 1 | 0 | 1 |
| `SYS-REQ-260821-NHZ8` | parser | missing-row-witnesses | 2 | 3/3 | 1 | 1 | 0 | 1 |
| `SYS-REQ-260821-PJ76` | selectors | missing-row-witnesses | 4 | 3/3 | 1 | 1 | 0 | 1 |
| `SYS-REQ-260821-RAAM` | parser_api | missing-row-witnesses | 7 | 3/3 | 1 | 1 | 0 | 1 |
| `SYS-REQ-260821-SBJ7` | tokenizer | missing-row-witnesses | 4 | 3/3 | 1 | 1 | 0 | 1 |
| `SYS-REQ-260821-V7V0` | library | missing-row-witnesses | 2 | 3/3 | 1 | 1 | 0 | 1 |
| `SYS-REQ-260821-X3KX` | cssom | missing-row-witnesses | 1 | 3/3 | 0 | 0 | 1 | 2 |
| `SYS-REQ-260821-Y6R3` | typed_om | missing-row-witnesses | 2 | 3/3 | 1 | 1 | 0 | 1 |
| `SYS-REQ-260821-MV44` | cascade | missing-row-witnesses | 2 | 2/2 | 1 | 0 | 1 | 0 |

## Witness grammar reminder

- Preferred: `// MCDC <REQ-ID>: <exact-assignment> => TRUE|FALSE`
- Also accepted: `// MC/DC <REQ-ID>: …`
- Trigger-false: append `[no-action: <spy/mock/counter>]` or `[manual-evidence: <ME-ID>]`
- Guarantee-violation that is a live product defect: do **not** bare-ignore. File/use KnownIssue, then `//mcdc:ignore:capability-gap … [ki: <slug>]` **after** the positive path is witnessed.
- HNRG row 2 is **not** a live KI-1 hole. KI-1 is fixed. SAT TRUE is `declaration_unchanged=T, value_validation_fails=T => TRUE`. Do not resurrect `capability-gap [ki: KI-1]`.

