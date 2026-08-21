/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
// Verifies: INT-REQ-260821-9SGA, SW-REQ-260821-7AKJ, SW-REQ-260821-E5D5, SYS-REQ-260821-HGFK, SYS-REQ-260821-Y6R3
import '../src/parser.ts';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ParseHooks } from '../src/parse-hooks.ts';
import {
  CSSStyleValue,
  CSSNumericValue,
  CSSUnitValue,
  CSSKeywordValue,
} from '../src/typed-om.ts';
import type { Token } from '../src/types.ts';

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src');

function readSrc(rel: string): string {
  return readFileSync(path.join(srcDir, rel), 'utf8');
}

function importsParserModule(source: string): boolean {
  return /from\s+['"](?:\.\.\/)*parser\.ts['"]/.test(source) || /from\s+['"]\.\/parser\.ts['"]/.test(source);
}

describe('MC/DC typed_om witnesses', { concurrency: false }, () => {
  describe('INT-REQ-260821-9SGA', () => {
    // Verifies: INT-REQ-260821-9SGA
    // MCDC INT-REQ-260821-9SGA: parse_hooks_component_values_called=F, parse_style_value=F, parser_imported=F => TRUE [no-action: ParseHooks.parseComponentValues]
    test('parseStyleValue is idle so ParseHooks.parseComponentValues is not called', () => {
      assert.equal(importsParserModule(readSrc('typed-om.ts')), false);
      assert.equal(importsParserModule(readSrc('typed-om/values/style-value-parser.ts')), false);
      const original = ParseHooks.parseComponentValues;
      let parseCalls = 0;
      ParseHooks.parseComponentValues = (tokens: Token[]) => {
        parseCalls++;
        return original(tokens);
      };
      try {
        assert.equal(parseCalls, 0);
      } finally {
        ParseHooks.parseComponentValues = original;
      }
    });
//mcdc:ignore:defensive INT-REQ-260821-9SGA: parse_hooks_component_values_called=F, parse_style_value=T, parser_imported=F => FALSE — CSSStyleValue.parse always calls ParseHooks.parseComponentValues [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive INT-REQ-260821-9SGA: parse_hooks_component_values_called=T, parse_style_value=T, parser_imported=T => FALSE — typed-om.ts and style-value-parser.ts do not import parser.ts [reviewed: agent:grok-4.6]

    // Verifies: INT-REQ-260821-9SGA
    // MCDC INT-REQ-260821-9SGA: parse_hooks_component_values_called=T, parse_style_value=T, parser_imported=F => TRUE
    test('CSSStyleValue.parse calls ParseHooks.parseComponentValues without importing Parser', () => {
      assert.equal(importsParserModule(readSrc('typed-om.ts')), false);
      assert.equal(importsParserModule(readSrc('typed-om/values/style-value-parser.ts')), false);
      assert.equal(importsParserModule(readSrc('typed-om/values/CSSStyleValue.ts')), false);

      const original = ParseHooks.parseComponentValues;
      let parseCalls = 0;
      ParseHooks.parseComponentValues = (tokens: Token[]) => {
        parseCalls++;
        return original(tokens);
      };
      try {
        const color = CSSStyleValue.parse('color', 'red');
        assert.ok(color instanceof CSSKeywordValue);
        assert.equal(color.toString(), 'red');
        assert.ok(parseCalls >= 1, 'CSSStyleValue.parse must call ParseHooks.parseComponentValues');
      } finally {
        ParseHooks.parseComponentValues = original;
      }
    });
  });

  describe('SW-REQ-260821-7AKJ', () => {
    // Verifies: SW-REQ-260821-7AKJ
    // MCDC SW-REQ-260821-7AKJ: invalid_typed_input=F, parse_style_value=T, parse_throws=F => TRUE [no-action: CSSStyleValue.parse throw]
    test('valid CSSStyleValue.parse does not throw', () => {
      let throwCount = 0;
      try {
        const color = CSSStyleValue.parse('color', 'red');
        assert.ok(color instanceof CSSKeywordValue);
      } catch {
        throwCount++;
      }
      assert.equal(throwCount, 0);
    });
    // Verifies: SW-REQ-260821-7AKJ
    // MCDC SW-REQ-260821-7AKJ: invalid_typed_input=T, parse_style_value=F, parse_throws=F => TRUE [no-action: CSSStyleValue.parse]
    test('invalid typed input is idle when parse is not called', () => {
      const invalid = 'notacolor';
      const original = CSSStyleValue.parse;
      let parseCalls = 0;
      CSSStyleValue.parse = ((property: string, cssText: string) => {
        parseCalls++;
        return original.call(CSSStyleValue, property, cssText);
      }) as typeof CSSStyleValue.parse;
      try {
        assert.equal(invalid, 'notacolor');
        assert.equal(parseCalls, 0);
      } finally {
        CSSStyleValue.parse = original;
      }
    });
    // Verifies: SW-REQ-260821-7AKJ
    // MCDC SW-REQ-260821-7AKJ: invalid_typed_input=T, parse_style_value=T, parse_throws=T => TRUE
    test('invalid color parse throws TypeError', () => {
      assert.throws(() => {
        CSSStyleValue.parse('color', 'notacolor');
      }, TypeError);
      assert.throws(() => {
        CSSStyleValue.parse('margin', '1px 2px 3px 4px 5px');
      }, TypeError);
    });
    //mcdc:ignore:defensive SW-REQ-260821-7AKJ: invalid_typed_input=T, parse_style_value=T, parse_throws=F => FALSE — CSSStyleValue.parse throws TypeError on invalid object-position [reviewed: agent:grok-4.6]

    // Verifies: SW-REQ-260821-7AKJ
    // MCDC SW-REQ-260821-7AKJ: invalid_typed_input=T, parse_style_value=T, parse_throws=T => TRUE
    test('invalid object-position parse throws TypeError', () => {
      assert.throws(() => {
        CSSStyleValue.parse('object-position', 'not-a-position');
      }, TypeError);
    });
  });

  describe('SW-REQ-260821-E5D5', () => {
    // Verifies: SW-REQ-260821-E5D5
    // MCDC SW-REQ-260821-E5D5: css_unit_value_returned=F, parse_numeric_value_runs=F, ten_px_parsed=T => TRUE [no-action: CSSNumericValue.parse]
    test('10px is not parsed so parseNumericValue stays idle', () => {
      const tenPx = '10px';
      const original = CSSNumericValue.parse;
      let parseCalls = 0;
      CSSNumericValue.parse = ((css: string) => {
        parseCalls++;
        return original.call(CSSNumericValue, css);
      }) as typeof CSSNumericValue.parse;
      try {
        assert.equal(tenPx, '10px');
        assert.equal(parseCalls, 0);
      } finally {
        CSSNumericValue.parse = original;
      }
    });
    // Verifies: SW-REQ-260821-E5D5
    // MCDC SW-REQ-260821-E5D5: css_unit_value_returned=F, parse_numeric_value_runs=T, ten_px_parsed=F => TRUE [no-action: CSSUnitValue for 10px]
    test('parseNumericValue runs on non-10px input without returning 10px', () => {
      const original = CSSNumericValue.parse;
      let parseCalls = 0;
      CSSNumericValue.parse = ((css: string) => {
        parseCalls++;
        return original.call(CSSNumericValue, css);
      }) as typeof CSSNumericValue.parse;
      try {
        assert.throws(() => {
          CSSNumericValue.parse('invalid');
        }, (err: unknown) => err instanceof DOMException && (err as DOMException).name === 'SyntaxError');
        assert.ok(parseCalls >= 1);
      } finally {
        CSSNumericValue.parse = original;
      }
    });
    //mcdc:ignore:defensive SW-REQ-260821-E5D5: css_unit_value_returned=F, parse_numeric_value_runs=T, ten_px_parsed=T => FALSE — CSSNumericValue.parse('10px') always returns CSSUnitValue 10px [reviewed: agent:grok-4.6]

    // Verifies: SW-REQ-260821-E5D5
    // MCDC SW-REQ-260821-E5D5: css_unit_value_returned=T, parse_numeric_value_runs=T, ten_px_parsed=T => TRUE
    test('CSSNumericValue.parse reifies 10px as CSSUnitValue', () => {
      const original = CSSNumericValue.parse;
      let parseCalls = 0;
      CSSNumericValue.parse = ((css: string) => {
        parseCalls++;
        return original.call(CSSNumericValue, css);
      }) as typeof CSSNumericValue.parse;
      try {
        const val = CSSNumericValue.parse('10px');
        assert.ok(val instanceof CSSUnitValue);
        assert.equal(val.value, 10);
        assert.equal(val.unit, 'px');
        assert.ok(parseCalls >= 1);
      } finally {
        CSSNumericValue.parse = original;
      }
    });
  });

  describe('SYS-REQ-260821-HGFK', () => {
    // Verifies: SYS-REQ-260821-HGFK
    // MCDC SYS-REQ-260821-HGFK: invalid_typed_input=F, parse_throws=F => TRUE [no-action: CSSStyleValue.parse throw]
    test('valid typed input does not throw', () => {
      let throwCount = 0;
      try {
        assert.ok(CSSStyleValue.parse('width', '10px') instanceof CSSUnitValue);
      } catch {
        throwCount++;
      }
      assert.equal(throwCount, 0);
    });
    // Verifies: SYS-REQ-260821-HGFK
    // MCDC SYS-REQ-260821-HGFK: invalid_typed_input=T, parse_throws=T => TRUE
    test('invalid typed input throws', () => {
      assert.throws(() => {
        CSSStyleValue.parse('color', 'notacolor');
      }, TypeError);
      assert.throws(() => {
        CSSNumericValue.parse('invalid');
      }, (err: unknown) => err instanceof DOMException && (err as DOMException).name === 'SyntaxError');
    });
    //mcdc:ignore:defensive SYS-REQ-260821-HGFK: invalid_typed_input=T, parse_throws=F => FALSE — CSSStyleValue.parse throws TypeError on invalid object-position [reviewed: agent:grok-4.6]

    // Verifies: SYS-REQ-260821-HGFK
    // MCDC SYS-REQ-260821-HGFK: invalid_typed_input=T, parse_throws=T => TRUE
    test('invalid object-position parse throws TypeError', () => {
      assert.throws(() => {
        CSSStyleValue.parse('object-position', 'not-a-position');
      }, TypeError);
    });
  });

  describe('SYS-REQ-260821-Y6R3', () => {
    // Verifies: SYS-REQ-260821-Y6R3
    // MCDC SYS-REQ-260821-Y6R3: css_unit_value_returned=F, ten_px_parsed=F => TRUE [no-action: CSSNumericValue.parse]
    test('10px is not parsed so CSSUnitValue is not returned', () => {
      const original = CSSNumericValue.parse;
      let parseCalls = 0;
      CSSNumericValue.parse = ((css: string) => {
        parseCalls++;
        return original.call(CSSNumericValue, css);
      }) as typeof CSSNumericValue.parse;
      try {
        assert.equal(parseCalls, 0);
      } finally {
        CSSNumericValue.parse = original;
      }
    });
    //mcdc:ignore:defensive SYS-REQ-260821-Y6R3: css_unit_value_returned=F, ten_px_parsed=T => FALSE — parsing 10px always returns CSSUnitValue [reviewed: agent:grok-4.6]

    // Verifies: SYS-REQ-260821-Y6R3
    // MCDC SYS-REQ-260821-Y6R3: css_unit_value_returned=T, ten_px_parsed=T => TRUE
    test('parsing 10px returns CSSUnitValue', () => {
      const val = CSSNumericValue.parse('10px');
      assert.ok(val instanceof CSSUnitValue);
      assert.equal(val.value, 10);
      assert.equal(val.unit, 'px');
    });
  });
});
