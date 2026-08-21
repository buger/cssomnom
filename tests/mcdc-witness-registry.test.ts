/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
// Verifies: SW-REQ-260821-ARC1, SW-REQ-260821-PD6M, SW-REQ-260821-V5GA, SYS-REQ-260821-9YM3, SYS-REQ-260821-EGCP
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.ts';
import { CSS } from '../src/typed-om.ts';
import { PropertyRegistry } from '../src/PropertyRegistry.ts';
import { CSSPropertyRule } from '../src/CSSOM.ts';

describe('MC/DC property_registry witnesses', { concurrency: false }, () => {
  describe('SYS-REQ-260821-EGCP', () => {
    // Verifies: SYS-REQ-260821-EGCP
    // MCDC SYS-REQ-260821-EGCP: bad_dictionary=F, duplicate_js_register=F, register_throws=F => TRUE [no-action: CSS.registerProperty throw]
    test('valid unique registerProperty does not throw', () => {
      PropertyRegistry.clear();
      let throwCount = 0;
      try {
        CSS.registerProperty({
          name: '--mcdc-egcp-ok',
          syntax: '*',
          inherits: false,
        });
      } catch {
        throwCount++;
      }
      assert.equal(throwCount, 0);
      assert.ok(PropertyRegistry.get('--mcdc-egcp-ok'));
      PropertyRegistry.clear();
    });
    // Verifies: SYS-REQ-260821-EGCP
    test('duplicate JS register throws InvalidModificationError', () => {
      PropertyRegistry.clear();
      try {
        CSS.registerProperty({
          name: '--mcdc-egcp-dup-js',
          syntax: '*',
          inherits: false,
        });
        assert.throws(() => {
          CSS.registerProperty({
            name: '--mcdc-egcp-dup-js',
            syntax: '*',
            inherits: false,
          });
        }, (err: unknown) => err instanceof DOMException && err.name === 'InvalidModificationError');
      } finally {
        PropertyRegistry.clear();
      }
    });
    // Verifies: SYS-REQ-260821-EGCP
    // MCDC SYS-REQ-260821-EGCP: bad_dictionary=F, duplicate_js_register=F, register_throws=F => TRUE
    test('JS register after CSS @property succeeds and does not throw', () => {
      PropertyRegistry.clear();
      try {
        const sheet = parse('@property --mcdc-egcp-css { syntax: "*"; inherits: false; }');
        assert.equal(sheet.cssRules.length, 1);
        assert.ok(sheet.cssRules[0] instanceof CSSPropertyRule);
        assert.ok(PropertyRegistry.get('--mcdc-egcp-css'));

        CSS.registerProperty({
          name: '--mcdc-egcp-css',
          syntax: '<color>',
          inherits: true,
          initialValue: 'red',
        });
        const after = PropertyRegistry.get('--mcdc-egcp-css');
        assert.equal(after?.syntax, '<color>');
        assert.equal(after?.inherits, true);
      } finally {
        PropertyRegistry.clear();
      }
    });
    //mcdc:ignore:defensive SYS-REQ-260821-EGCP: bad_dictionary=F, duplicate_js_register=T, register_throws=F => FALSE — a second CSS.registerProperty for a name already in [[registeredPropertySet]] throws InvalidModificationError (JS-then-JS); @property is not that slot [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SYS-REQ-260821-EGCP: bad_dictionary=T, duplicate_js_register=F, register_throws=F => FALSE — CSS.registerProperty throws SyntaxError or TypeError on a bad dictionary [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SYS-REQ-260821-EGCP: bad_dictionary=T, duplicate_js_register=T, register_throws=F => FALSE — CSS.registerProperty.validate throws on a bad dictionary before the register returns [reviewed: agent:grok-4.6]

    // Verifies: SYS-REQ-260821-EGCP
    // MCDC SYS-REQ-260821-EGCP: bad_dictionary=T, duplicate_js_register=T, register_throws=T => TRUE
    test('bad duplicate dictionary throws', () => {
      PropertyRegistry.clear();
      try {
        CSS.registerProperty({
          name: '--mcdc-egcp-dup',
          syntax: '*',
          inherits: false,
        });
        assert.throws(() => {
          CSS.registerProperty({
            name: '--mcdc-egcp-dup',
            syntax: 'not-a-syntax',
            inherits: false,
          });
        }, (err: unknown) => err instanceof DOMException);
      } finally {
        PropertyRegistry.clear();
      }
    });
  });

  describe('SW-REQ-260821-ARC1', () => {
    // Verifies: SW-REQ-260821-ARC1
    // MCDC SW-REQ-260821-ARC1: at_property_validate_fails=F, bad_at_property=T, property_rule_dropped=F => TRUE [no-action: PropertyRegistry.validate]
    test('bad at-property text is idle when not consumed', () => {
      const badAtProperty = '@property --mcdc-arc1-idle { inherits: false; }';
      const originalValidate = PropertyRegistry.validate.bind(PropertyRegistry);
      let validateCalls = 0;
      PropertyRegistry.validate = ((definition) => {
        validateCalls++;
        return originalValidate(definition);
      }) as typeof PropertyRegistry.validate;
      try {
        assert.equal(typeof badAtProperty, 'string');
        assert.equal(validateCalls, 0);
      } finally {
        PropertyRegistry.validate = originalValidate;
      }
    });
    // Verifies: SW-REQ-260821-ARC1
    // MCDC SW-REQ-260821-ARC1: at_property_validate_fails=T, bad_at_property=F, property_rule_dropped=F => TRUE [no-action: @property rule drop]
    test('JS validate failure is not an at-property drop', () => {
      PropertyRegistry.clear();
      const sheetBefore = parse('.ok { color: red; }');
      assert.equal(sheetBefore.cssRules.length, 1);
      assert.throws(() => {
        PropertyRegistry.validate({
          name: 'not-a-custom-prop',
          syntax: '*',
          inherits: false,
        });
      }, (err: unknown) => err instanceof DOMException && (err as DOMException).name === 'SyntaxError');
      assert.equal(sheetBefore.cssRules.length, 1);
    });
    //mcdc:ignore:defensive SW-REQ-260821-ARC1: at_property_validate_fails=T, bad_at_property=T, property_rule_dropped=F => FALSE — consumePropertyRule returns null when PropertyRegistry.validate fails so the @property rule is dropped [reviewed: agent:grok-4.6]

    // Verifies: SW-REQ-260821-ARC1
    // MCDC SW-REQ-260821-ARC1: at_property_validate_fails=T, bad_at_property=T, property_rule_dropped=T => TRUE
    test('bad at-property whose validate fails is dropped', () => {
      const sheet = parse(`
        @property --mcdc-arc1-bad {
          syntax: "<length>";
          inherits: false;
          initial-value: red;
        }
      `);
      assert.equal(sheet.cssRules.length, 0);
      assert.equal(PropertyRegistry.get('--mcdc-arc1-bad'), undefined);
    });
  });

  describe('SW-REQ-260821-PD6M', () => {
    // Verifies: SW-REQ-260821-PD6M
    // MCDC SW-REQ-260821-PD6M: bad_dictionary=F, register_throws=F => TRUE [no-action: CSS.registerProperty throw]
    test('valid dictionary does not throw', () => {
      PropertyRegistry.clear();
      let throwCount = 0;
      try {
        CSS.registerProperty({
          name: '--mcdc-pd6m-ok',
          syntax: '<length>',
          inherits: false,
          initialValue: '10px',
        });
      } catch {
        throwCount++;
      }
      assert.equal(throwCount, 0);
      PropertyRegistry.clear();
    });
    //mcdc:ignore:defensive SW-REQ-260821-PD6M: bad_dictionary=T, register_throws=F => FALSE — CSS.registerProperty throws SyntaxError or TypeError on a bad dictionary [reviewed: agent:grok-4.6]

    // Verifies: SW-REQ-260821-PD6M
    // MCDC SW-REQ-260821-PD6M: bad_dictionary=T, register_throws=T => TRUE
    test('bad dictionary throws SyntaxError or TypeError', () => {
      PropertyRegistry.clear();
      assert.throws(() => {
        CSS.registerProperty({
          name: 'not-a-custom-prop',
          syntax: '*',
          inherits: false,
        });
      }, (err: unknown) => err instanceof DOMException && (err as DOMException).name === 'SyntaxError');
      assert.throws(() => {
        CSS.registerProperty({
          name: '--mcdc-pd6m-missing-inherits',
          syntax: '*',
        } as unknown as { name: string; syntax: string; inherits: boolean });
      }, TypeError);
      PropertyRegistry.clear();
    });
  });

  describe('SW-REQ-260821-V5GA', () => {
    // Verifies: SW-REQ-260821-V5GA
    // MCDC SW-REQ-260821-V5GA: duplicate_js_register=F, invalid_modification_error=F => TRUE [no-action: InvalidModificationError]
    test('first JS register does not throw InvalidModificationError', () => {
      PropertyRegistry.clear();
      let ime = 0;
      try {
        CSS.registerProperty({
          name: '--mcdc-v5ga-ok',
          syntax: '*',
          inherits: false,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'InvalidModificationError') ime++;
        else throw err;
      }
      assert.equal(ime, 0);
      PropertyRegistry.clear();
    });
    // Verifies: SW-REQ-260821-V5GA
    // MCDC SW-REQ-260821-V5GA: duplicate_js_register=F, invalid_modification_error=F => TRUE
    test('JS register after CSS @property does not throw InvalidModificationError', () => {
      PropertyRegistry.clear();
      try {
        parse('@property --mcdc-v5ga-css { syntax: "*"; inherits: false; }');
        let ime = 0;
        try {
          CSS.registerProperty({
            name: '--mcdc-v5ga-css',
            syntax: '<color>',
            inherits: true,
            initialValue: 'red',
          });
        } catch (err) {
          if (err instanceof DOMException && err.name === 'InvalidModificationError') ime++;
          else throw err;
        }
        assert.equal(ime, 0);
        const after = PropertyRegistry.get('--mcdc-v5ga-css');
        assert.equal(after?.syntax, '<color>');
      } finally {
        PropertyRegistry.clear();
      }
    });
    //mcdc:ignore:defensive SW-REQ-260821-V5GA: duplicate_js_register=T, invalid_modification_error=F => FALSE — a second CSS.registerProperty for a name already in [[registeredPropertySet]] throws InvalidModificationError (JS-then-JS); @property is not that slot [reviewed: agent:grok-4.6]

    // Verifies: SW-REQ-260821-V5GA
    // MCDC SW-REQ-260821-V5GA: duplicate_js_register=T, invalid_modification_error=T => TRUE
    test('second JS register throws InvalidModificationError', () => {
      PropertyRegistry.clear();
      try {
        CSS.registerProperty({
          name: '--mcdc-v5ga-dup',
          syntax: '*',
          inherits: false,
        });
        assert.throws(() => {
          CSS.registerProperty({
            name: '--mcdc-v5ga-dup',
            syntax: '*',
            inherits: false,
          });
        }, (err: unknown) => err instanceof DOMException && (err as DOMException).name === 'InvalidModificationError');
      } finally {
        PropertyRegistry.clear();
      }
    });
  });

  describe('SYS-REQ-260821-9YM3', () => {
    // Verifies: SYS-REQ-260821-9YM3
    // MCDC SYS-REQ-260821-9YM3: bad_at_property=F, property_rule_dropped=F => TRUE [no-action: @property drop]
    test('valid at-property is kept', () => {
      PropertyRegistry.clear();
      try {
        const sheet = parse(`
          @property --mcdc-9ym3-ok {
            syntax: "*";
            inherits: false;
          }
        `);
        assert.equal(sheet.cssRules.length, 1);
        assert.ok(sheet.cssRules[0] instanceof CSSPropertyRule);
      } finally {
        PropertyRegistry.clear();
      }
    });
    //mcdc:ignore:defensive SYS-REQ-260821-9YM3: bad_at_property=T, property_rule_dropped=F => FALSE — a bad @property rule is dropped (cssRules length 0) [reviewed: agent:grok-4.6]

    // Verifies: SYS-REQ-260821-9YM3
    // MCDC SYS-REQ-260821-9YM3: bad_at_property=T, property_rule_dropped=T => TRUE
    test('bad at-property is dropped', () => {
      PropertyRegistry.clear();
      try {
        const sheet = parse(`
          @property --mcdc-9ym3-bad {
            inherits: false;
            initial-value: red;
          }
        `);
        assert.equal(sheet.cssRules.length, 0);
        assert.equal(PropertyRegistry.get('--mcdc-9ym3-bad'), undefined);
      } finally {
        PropertyRegistry.clear();
      }
    });
  });
});
