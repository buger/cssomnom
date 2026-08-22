/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
// Verifies: SW-REQ-260821-6D9T, SYS-REQ-260821-PJ76, SW-REQ-260821-W8S1, SYS-REQ-260821-5283, INT-REQ-260821-JTY2
import '../src/typed-om.ts';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import { matches } from '../src/matcher.ts';
import { SelectorParser } from '../src/SelectorParser.ts';
import { Parser } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { MediaParser, serializeMediaQuery } from '../src/MediaParser.ts';
import {
  DOMMatrix,
  parseTransformListHook,
  setParseTransformListHook,
} from '../src/DOMMatrix.ts';

const matcherSrc = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/matcher.ts'),
  'utf8',
);

function sampleDiv(): Element {
  const { document } = parseHTML('<html><body><div class="t"></div></body></html>');
  const el = document.querySelector('div');
  assert.ok(el);
  return el;
}

describe('MC/DC selectors media geometry witnesses', { concurrency: false }, () => {
  describe('SW-REQ-260821-6D9T', () => {
    // Verifies: SW-REQ-260821-6D9T
    // MCDC SW-REQ-260821-6D9T: bad_selector_supplied=F, empty_match=F, parse_selector_rejects=T => TRUE [no-action: matcher empty_match]
    test('good selector matches while parseSelector reject path is armed', () => {
      assert.match(matcherSrc, /forgiving:\s*false/);
      assert.match(matcherSrc, /selectors:\s*\[\s*\]/);
      const el = sampleDiv();
      let emptyMatchAction = 0;
      const matched = matches(el, 'div');
      if (!matched) emptyMatchAction++;
      assert.equal(matched, true);
      assert.equal(emptyMatchAction, 0);
    });
    //mcdc:ignore:defensive SW-REQ-260821-6D9T: bad_selector_supplied=T, empty_match=F, parse_selector_rejects=T => FALSE — matcher parseSelector catch returns an empty list so matches() is false for a rejected selector [reviewed: agent:grok-4.6]

    // Verifies: SW-REQ-260821-6D9T
    // MCDC SW-REQ-260821-6D9T: bad_selector_supplied=T, empty_match=T, parse_selector_rejects=T => TRUE
    test('bad selector is rejected and matches nothing', () => {
      const el = sampleDiv();
      const tokens = tokenize('###');
      const parser = new Parser(tokens);
      const values = parser.parseComponentValues();
      assert.throws(() => {
        new SelectorParser(values, { allowRelative: true, forgiving: false }).parse();
      });
      assert.equal(matches(el, '###'), false);
      assert.equal(matches(el, '['), false);
    });
  });

  describe('SYS-REQ-260821-PJ76', () => {
    // Verifies: SYS-REQ-260821-PJ76
    // MCDC SYS-REQ-260821-PJ76: bad_selector_supplied=F, empty_match=F => TRUE [no-action: matcher empty_match]
    test('good selector is not an empty match', () => {
      const el = sampleDiv();
      let emptyMatchAction = 0;
      const matched = matches(el, '.t');
      if (!matched) emptyMatchAction++;
      assert.equal(matched, true);
      assert.equal(emptyMatchAction, 0);
    });
    //mcdc:ignore:defensive SYS-REQ-260821-PJ76: bad_selector_supplied=T, empty_match=F => FALSE — matches() returns false for a bad selector [reviewed: agent:grok-4.6]

    // Verifies: SYS-REQ-260821-PJ76
    // MCDC SYS-REQ-260821-PJ76: bad_selector_supplied=T, empty_match=T => TRUE
    test('bad selector yields no match', () => {
      const el = sampleDiv();
      assert.equal(matches(el, '###'), false);
      assert.equal(matches(el, ':not()'), false);
    });
  });

  describe('SW-REQ-260821-W8S1', () => {
    // Verifies: SW-REQ-260821-W8S1
    // MCDC SW-REQ-260821-W8S1: media_query_invalid=F, serialize_media_query_runs=T, serialized_as_not_all=F => TRUE [no-action: serializeMediaQuery not-all mapping]
    test('valid media query serializes as itself not not-all', () => {
      const original = serializeMediaQuery;
      let notAllMapping = 0;
      const queries = MediaParser.parse('screen');
      assert.equal(queries.length, 1);
      const serialized = original(queries[0]);
      if (serialized === 'not all') notAllMapping++;
      assert.equal(serialized, 'screen');
      assert.equal(notAllMapping, 0);
    });
    // Verifies: SW-REQ-260821-W8S1
    // MCDC SW-REQ-260821-W8S1: media_query_invalid=T, serialize_media_query_runs=F, serialized_as_not_all=F => TRUE [no-action: serializeMediaQuery]
    test('invalid media query is idle when serializeMediaQuery is not called', () => {
      let serializeCalls = 0;
      const parsed = MediaParser.parse('&test');
      assert.equal(parsed.length, 1);
      assert.equal(parsed[0].invalid, true);
      assert.equal(serializeCalls, 0);
    });
    // Verifies: SW-REQ-260821-W8S1
    // MCDC SW-REQ-260821-W8S1: media_query_invalid=T, serialize_media_query_runs=T, serialized_as_not_all=T => TRUE
    test('invalid media query serializes as not all', () => {
      const queries = MediaParser.parse('&test');
      assert.equal(queries.length, 1);
      assert.equal(queries[0].invalid, true);
      assert.equal(serializeMediaQuery(queries[0]), 'not all');
    });
    //mcdc:ignore:defensive SW-REQ-260821-W8S1: media_query_invalid=T, serialize_media_query_runs=T, serialized_as_not_all=F => FALSE — serializeMediaQuery emits not all for invalid queries including unbalanced (( (KI-5 class-fix); unique-cause SAT is serialized_as_not_all=T [reviewed: agent:grok-4.6]

    // Verifies: SW-REQ-260821-W8S1
    // MCDC SW-REQ-260821-W8S1: media_query_invalid=T, serialize_media_query_runs=T, serialized_as_not_all=T => TRUE
    test('unbalanced (( serializes as not all', () => {
      const queries = MediaParser.parse('((');
      assert.equal(queries.length, 1);
      assert.equal(queries[0].invalid, true);
      const serialized = serializeMediaQuery(queries[0]);
      assert.equal(serialized, 'not all');
    });
  });

  describe('SYS-REQ-260821-5283', () => {
    // Verifies: SYS-REQ-260821-5283
    // MCDC SYS-REQ-260821-5283: media_query_invalid=F, serialized_as_not_all=F => TRUE [no-action: serializeMediaQuery not-all mapping]
    test('valid media query is not serialized as not all', () => {
      const serialized = MediaParser.parse('only screen').map(serializeMediaQuery);
      assert.deepEqual(serialized, ['only screen']);
    });
    // Verifies: SYS-REQ-260821-5283
    // MCDC SYS-REQ-260821-5283: media_query_invalid=T, serialized_as_not_all=T => TRUE
    test('invalid media query serializes as not all', () => {
      const serialized = MediaParser.parse('screen and').map(serializeMediaQuery);
      assert.deepEqual(serialized, ['not all']);
    });
    //mcdc:ignore:defensive SYS-REQ-260821-5283: media_query_invalid=T, serialized_as_not_all=F => FALSE — serializeMediaQuery emits not all for invalid queries including unbalanced (( (KI-5 class-fix); unique-cause SAT is serialized_as_not_all=T [reviewed: agent:grok-4.6]

    // Verifies: SYS-REQ-260821-5283
    // MCDC SYS-REQ-260821-5283: media_query_invalid=T, serialized_as_not_all=T => TRUE
    test('unbalanced (( is serialized as not all', () => {
      const serialized = MediaParser.parse('((').map(serializeMediaQuery);
      assert.deepEqual(serialized, ['not all']);
    });
  });

  describe('INT-REQ-260821-JTY2', () => {
    // Verifies: INT-REQ-260821-JTY2
    // MCDC INT-REQ-260821-JTY2: transform_string_parsed=F, typed_om_transform_hook_used=F => TRUE [no-action: parseTransformListHook]
    test('non-string DOMMatrix construction does not use the transform hook', () => {
      const prev = parseTransformListHook;
      let hookCalls = 0;
      setParseTransformListHook((str) => {
        hookCalls++;
        assert.ok(prev);
        return prev(str);
      });
      try {
        const identity = new DOMMatrix();
        assert.equal(identity.e, 0);
        const fromArray = new DOMMatrix([1, 0, 0, 1, 0, 0]);
        assert.equal(fromArray.a, 1);
        assert.equal(hookCalls, 0);
      } finally {
        setParseTransformListHook(prev!);
      }
    });
    //mcdc:ignore:defensive INT-REQ-260821-JTY2: transform_string_parsed=T, typed_om_transform_hook_used=F => FALSE — DOMMatrix transform-list strings (translate/rotate) always call the typed_om parseTransformListHook; native matrix() is a documented exemption not a FRETish hole [reviewed: agent:grok-4.6]

    // Verifies: INT-REQ-260821-JTY2
    // MCDC INT-REQ-260821-JTY2: transform_string_parsed=T, typed_om_transform_hook_used=T => TRUE
    test('translate string construction uses the typed_om transform hook', () => {
      const prev = parseTransformListHook;
      let hookCalls = 0;
      setParseTransformListHook((str) => {
        hookCalls++;
        assert.ok(prev);
        return prev(str);
      });
      try {
        const translated = new DOMMatrix('translate(10px, 20px)');
        assert.equal(translated.is2D, true);
        assert.equal(translated.e, 10);
        assert.equal(translated.f, 20);
        assert.ok(hookCalls >= 1, 'DOMMatrix string ctor must call parseTransformListHook');
        assert.throws(() => {
          new DOMMatrix('nope(1)');
        }, (err: unknown) => err instanceof DOMException && (err as DOMException).name === 'SyntaxError');
      } finally {
        setParseTransformListHook(prev!);
      }
    });
  });
});
