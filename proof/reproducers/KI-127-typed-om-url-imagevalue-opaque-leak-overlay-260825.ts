/**
 * Overlay reproducer for KI-127. This file intentionally stays red until
 * url() image values reify as direct, opaque CSSImageValue instances instead of
 * the concrete CSSURLImageValue subclass.
 *
 * Reproduces: KI-127
 * Verifies: SYS-REQ-260825-VKNX
 *
 * Spec anchors:
 * - css-typed-om-1 #imagevalue-objects (~line 3011): the Level 1 IDL declares
 *   only `interface CSSImageValue : CSSStyleValue {};`. No CSSURLImageValue
 *   interface exists anywhere in the specification surface.
 * - Same section: "This object is intentionally opaque, and exposes no details
 *   of what kind of image it contains, or any aspect of the image."
 * - Local WPT fixtures (background-image.html, border-image-source.html,
 *   list-style-image.html, mask-image.html, shape-outside.html) pin
 *   assert_class_string(result, 'CSSImageValue'), which reads the
 *   Object.prototype.toString tag.
 *
 * Root-dedup notes:
 * - vs KI-123 (base-only rows over-reify into subclasses; kill_domain
 *   reified_type_identity): different rule and direction. KI-123 covers rows
 *   whose table says "reify as a direct CSSStyleValue". Here the spec DOES
 *   define an image-specific class (CSSImageValue); the defect leaks a MORE
 *   derived concrete class that the IDL never exposes.
 * - vs KI-116 (border-image url() serialization fixpoint collapse): KI-116
 *   pins cssText round-trip text; this KI pins only the reified constructor
 *   identity and toString tag on get().
 *
 * Observed defect at HEAD via public API:
 *   map.get('background-image').constructor.name === 'CSSURLImageValue'
 *   Object.prototype.toString.call(v) === '[object CSSURLImageValue]'
 * Spec requires the opaque '[object CSSImageValue]' identity.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, StylePropertyMap, CSSImageValue, CSSKeywordValue } from '../../src/index.ts';

function mapFor(cssText: string): StylePropertyMap {
  const sheet = parse(`div{${cssText}}`);
  return new StylePropertyMap(sheet.cssRules[0].style);
}

// Reproduces: KI-127
// Verifies: SYS-REQ-260825-VKNX (positive controls)
describe('KI-127 controls', () => {
  test('keyword image component still reifies as CSSKeywordValue', () => {
    const v = mapFor('list-style-image: none').get('list-style-image');
    assert.ok(v instanceof CSSKeywordValue, `expected CSSKeywordValue, got ${v?.constructor?.name}`);
    assert.equal((v as CSSKeywordValue).value, 'none');
  });

  test('url() values satisfy instanceof CSSImageValue (hierarchy leg)', () => {
    const v = mapFor('background-image: url("foo.png")').get('background-image');
    assert.ok(v instanceof CSSImageValue, 'subclass hierarchy must keep CSSImageValue satisfied');
  });
});

// Reproduces: KI-127
// Verifies: SYS-REQ-260825-VKNX (opaque identity legs)
describe('KI-127: url() must reify as the opaque exact CSSImageValue', () => {
  test('background-image url() exposes the CSSImageValue toString tag', () => {
    const v = mapFor('background-image: url("foo.png")').get('background-image');
    assert.equal(
      Object.prototype.toString.call(v),
      '[object CSSImageValue]',
      `css-typed-om-1 #imagevalue-objects exposes no CSSURLImageValue interface; got ${Object.prototype.toString.call(v)}`,
    );
  });

  test('background-image url() constructor identity is exactly CSSImageValue', () => {
    const v = mapFor('background-image: url("foo.png")').get('background-image');
    assert.equal(v?.constructor?.name, 'CSSImageValue', `got ${v?.constructor?.name}`);
  });

  test('border-image-source url() exposes the CSSImageValue toString tag', () => {
    const v = mapFor('border-image-source: url("a.png")').get('border-image-source');
    assert.equal(
      Object.prototype.toString.call(v),
      '[object CSSImageValue]',
      `got ${Object.prototype.toString.call(v)}`,
    );
  });
});
