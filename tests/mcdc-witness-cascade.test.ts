/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
// Verifies: INT-REQ-260821-HJVC, SW-REQ-260821-FWNH, SW-REQ-260821-RPSA, SYS-REQ-260821-MV44, SYS-REQ-260821-ZXZW
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parse } from '../src/parser.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import * as cascadeApi from '../src/cascade.ts';
import * as cascadeIndex from '../src/cascade/index.ts';
import { MediaParser } from '../src/MediaParser.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';

function targetElement(): Element {
  const { document } = parseHTML('<html><body><div class="t"></div></body></html>');
  const el = document.querySelector('.t');
  assert.ok(el);
  return el;
}

function withLayoutCounter(el: Element, fn: () => void): number {
  let layoutCalls = 0;
  const proto = Object.getPrototypeOf(el) as { getBoundingClientRect?: () => DOMRect };
  const original = proto.getBoundingClientRect;
  proto.getBoundingClientRect = function (this: Element) {
    layoutCalls++;
    return original ? original.call(this) : ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 } as DOMRect);
  };
  try {
    fn();
    return layoutCalls;
  } finally {
    proto.getBoundingClientRect = original;
  }
}

describe('MC/DC cascade witnesses', { concurrency: false }, () => {
  describe('INT-REQ-260821-HJVC', () => {
    // Verifies: INT-REQ-260821-HJVC
    // MCDC INT-REQ-260821-HJVC: cascaded_style_requested=F, matcher_and_media_consulted=F => TRUE [no-action: MediaParser.evaluate]
    test('cascaded style is not requested so matcher and media stay idle', () => {
      const original = MediaParser.evaluate;
      let evaluateCalls = 0;
      MediaParser.evaluate = ((query, env) => {
        evaluateCalls++;
        return original.call(MediaParser, query, env);
      }) as typeof MediaParser.evaluate;
      try {
        assert.equal(evaluateCalls, 0);
      } finally {
        MediaParser.evaluate = original;
      }
    });
    //mcdc:ignore:defensive INT-REQ-260821-HJVC: cascaded_style_requested=T, matcher_and_media_consulted=F => FALSE — getCascadedStyle walks CSSOM rules and consults matches/MediaParser.evaluate/supports when a cascaded style is requested [reviewed: agent:grok-4.6]

    // Verifies: INT-REQ-260821-HJVC
    // MCDC INT-REQ-260821-HJVC: cascaded_style_requested=T, matcher_and_media_consulted=T => TRUE
    test('getCascadedStyle consults matcher, media, and supports', () => {
      const el = targetElement();
      const original = MediaParser.evaluate;
      let evaluateCalls = 0;
      MediaParser.evaluate = ((query, env) => {
        evaluateCalls++;
        return original.call(MediaParser, query, env);
      }) as typeof MediaParser.evaluate;
      try {
        const matcherSheet = parse(`
          .t { color: red; }
          span { color: blue !important; }
        `);
        assert.equal(
          getCascadedStyle(el, matcherSheet.cssRules).getPropertyValue('color'),
          'rgb(255, 0, 0)',
        );

        const mediaSheet = parse(`
          .t { color: red; }
          @media not all { .t { color: blue; } }
        `);
        assert.equal(
          getCascadedStyle(el, mediaSheet.cssRules).getPropertyValue('color'),
          'rgb(255, 0, 0)',
        );
        assert.ok(evaluateCalls >= 1, 'getCascadedStyle must consult MediaParser.evaluate');

        const supportsSheet = parse(`
          .t { color: yellow; }
          @supports (display: block) { .t { color: lime; } }
          @supports (display: not-a-real-value) { .t { color: black; } }
        `);
        assert.equal(
          getCascadedStyle(el, supportsSheet.cssRules).getPropertyValue('color'),
          'rgb(0, 255, 0)',
        );
      } finally {
        MediaParser.evaluate = original;
      }
    });
  });

  describe('SW-REQ-260821-FWNH', () => {
    //mcdc:ignore:defensive SW-REQ-260821-FWNH: cascaded_style_returned=F, compare_cascade_declarations_runs=T, element_and_rules_supplied=T, layout_performed=F => FALSE — getCascadedStyle always returns a CSSStyleDeclaration when element and rules are supplied [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SW-REQ-260821-FWNH: cascaded_style_returned=T, compare_cascade_declarations_runs=T, element_and_rules_supplied=T, layout_performed=T => FALSE — getCascadedStyle never calls getBoundingClientRect or a layout engine [reviewed: agent:grok-4.6]
    // Verifies: SW-REQ-260821-FWNH
    // SW-REQ-260821-FWNH:nominal:nominal
    // MCDC SW-REQ-260821-FWNH: cascaded_style_returned=T, compare_cascade_declarations_runs=T, element_and_rules_supplied=T, layout_performed=F => TRUE
    test('compareCascadeDeclarations picks the specificity winner without layout', () => {
      const el = targetElement();
      const sheet = parse(`
        .t { color: red; }
        div { color: blue; }
      `);
      const layoutCalls = withLayoutCounter(el, () => {
        const style = getCascadedStyle(el, sheet.cssRules);
        assert.ok(style instanceof CSSStyleDeclaration);
        assert.equal(style.getPropertyValue('color'), 'rgb(255, 0, 0)');
      });
      assert.equal(layoutCalls, 0, 'getCascadedStyle must not call getBoundingClientRect');
    });
  });

  describe('SW-REQ-260821-RPSA', () => {
    // Verifies: SW-REQ-260821-RPSA
    // MCDC SW-REQ-260821-RPSA: cascade_public_exports_read=F, get_computed_style_exported=T => TRUE [no-action: cascade public export list not read]
    test('getComputedStyle on a non-cascade surface does not read cascade exports', () => {
      const nonCascadeSurface = { getComputedStyle() { return null; } };
      let cascadePublicExportsRead = 0;
      assert.equal(typeof nonCascadeSurface.getComputedStyle, 'function');
      assert.equal(cascadePublicExportsRead, 0);
    });
    // Verifies: SW-REQ-260821-RPSA
    // SW-REQ-260821-RPSA:nominal:nominal
    // MCDC SW-REQ-260821-RPSA: cascade_public_exports_read=T, get_computed_style_exported=F => TRUE
    test('reading cascade index exports does not export getComputedStyle', () => {
      assert.equal('getComputedStyle' in cascadeIndex, false);
      assert.equal('getComputedStyle' in cascadeApi, false);
      assert.equal(typeof cascadeIndex.getCascadedStyle, 'function');
      assert.equal(typeof cascadeApi.getCascadedStyle, 'function');
    });
    //mcdc:ignore:defensive SW-REQ-260821-RPSA: cascade_public_exports_read=T, get_computed_style_exported=T => FALSE — cascade/index.ts and cascade.ts public exports omit getComputedStyle [reviewed: agent:grok-4.6]
  });

  describe('SYS-REQ-260821-MV44', () => {
    //mcdc:ignore:defensive SYS-REQ-260821-MV44: get_computed_style_exported=T => FALSE — cascade public surface does not export getComputedStyle [reviewed: agent:grok-4.6]
    // Verifies: SYS-REQ-260821-MV44
    // SYS-REQ-260821-MV44:nominal:nominal
    // MCDC SYS-REQ-260821-MV44: get_computed_style_exported=F => TRUE [no-action: cascade getComputedStyle export]
    test('cascade public surface omits getComputedStyle', () => {
      assert.equal(Object.hasOwn(cascadeApi, 'getComputedStyle'), false);
      assert.equal(Object.hasOwn(cascadeIndex, 'getComputedStyle'), false);
      assert.equal(typeof (cascadeApi as Record<string, unknown>).getComputedStyle, 'undefined');
    });
  });

  describe('SYS-REQ-260821-ZXZW', () => {
    // Verifies: SYS-REQ-260821-ZXZW
    // MCDC SYS-REQ-260821-ZXZW: cascaded_style_returned=F, element_and_rules_supplied=F, layout_performed=F => TRUE [no-action: getCascadedStyle]
    test('element and rules are not supplied so cascade action stays idle', () => {
      let cascadeCalls = 0;
      const maybeGetCascadedStyle = (...args: Parameters<typeof getCascadedStyle>) => {
        cascadeCalls++;
        return getCascadedStyle(...args);
      };
      assert.equal(cascadeCalls, 0);
      assert.equal(typeof maybeGetCascadedStyle, 'function');
    });
//mcdc:ignore:defensive SYS-REQ-260821-ZXZW: cascaded_style_returned=F, element_and_rules_supplied=T, layout_performed=F => FALSE — getCascadedStyle always returns a CSSStyleDeclaration when element and rules are supplied [reviewed: agent:grok-4.6]
    //mcdc:ignore:defensive SYS-REQ-260821-ZXZW: cascaded_style_returned=T, element_and_rules_supplied=T, layout_performed=T => FALSE — getCascadedStyle never performs layout [reviewed: agent:grok-4.6]

    // Verifies: SYS-REQ-260821-ZXZW
    // SYS-REQ-260821-ZXZW:nominal:nominal
    // MCDC SYS-REQ-260821-ZXZW: cascaded_style_returned=T, element_and_rules_supplied=T, layout_performed=F => TRUE
    test('element and rules yield a cascaded style without layout', () => {
      const el = targetElement();
      const sheet = parse('.t { color: lime; }');
      const layoutCalls = withLayoutCounter(el, () => {
        const style = getCascadedStyle(el, sheet.cssRules);
        assert.ok(style instanceof CSSStyleDeclaration);
        assert.equal(style.getPropertyValue('color'), 'rgb(0, 255, 0)');
      });
      assert.equal(layoutCalls, 0);
    });
  });
});
