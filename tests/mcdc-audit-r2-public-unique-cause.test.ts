/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Verifies: SYS-REQ-260821-NHZ8, SW-REQ-260821-39E0, SYS-REQ-260821-KA02,
// SW-REQ-260821-E5D5, INT-REQ-260821-9SGA
// Public-API unique-cause legs, audit round 2:
//   - MediaParser unclosed-construct guards, trailing comma split, zero
//     length, plain/calc length arms, non-numeric aspect-ratio, fractional
//     integer features, unknown numeric range features
//     (mediaqueries-4 § 3 #media-types / § 5 #mq-syntax).
//   - collectStyleSheetsAndRules element validation
//     (css-cascade-5 § 2 #filtering).
//   - getUaDefault / getInitialValue prefixed fallbacks and misses
//     (css-cascade-5 § 6.4 #default-values).
//   - processStandardDeclarations custom-property skip + unset with no parent
//     (css-variables-1 § 3 #variables-in-shorthands, css-cascade-5 § 7.3).
//   - CSSTransformValue matrix/matrix3d dispatch (css-transforms-1 § 16.1).
//   - DOMMatrix skew/rotate no-op and axis arms (geometry-1 #dommatrix).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MediaParser,
  evaluateMediaQueries,
  DEFAULT_MEDIA_ENV,
} from '../src/MediaParser.ts';
import type { MediaEnvironment } from '../src/types.ts';
import { collectStyleSheetsAndRules } from '../src/cascade/rule-filter.ts';
import {
  getUaDefault,
  getInitialValue,
  processStandardDeclarations,
} from '../src/cascade/value-processor.ts';
import { CSSTransformValue } from '../src/typed-om/transform/CSSTransformValue.ts';
import { DOMMatrix } from '../src/DOMMatrix.ts';

const env = (over: Partial<MediaEnvironment> = {}): MediaEnvironment => ({
  ...DEFAULT_MEDIA_ENV,
  ...over,
});

function evalMedia(query: string, e: MediaEnvironment): boolean | 'unknown' {
  return evaluateMediaQueries(MediaParser.parse(query), e);
}

describe('MC/DC audit round 2: MediaParser arms', () => {
  test('unclosed constructs make queries not-all-false', () => {
    // Unclosed function/paren construct witnesses the drop guard.
    assert.equal(evalMedia('screen and (min-width: 100px', env()), false);
    assert.equal(evalMedia('(width >= calc(100px', env()), false);
    // Balanced query for contrast.
    assert.equal(evalMedia('screen and (min-width: 100px)', env()), true);
  });

  test('trailing comma splits without adding an empty query', () => {
    assert.equal(evalMedia('screen,', env()), true);
    assert.equal(evalMedia('(width < 100px),', env()), false);
  });

  test('zero-length feature value takes the zero shortcut', () => {
    // t.type number && value === 0 leg inside width evaluation.
    assert.equal(evalMedia('(width: 0)', env({ width: 0 })), true);
    // Non-zero dimension row for contrast.
    assert.equal(evalMedia('(width: 10px)', env({ width: 10 })), true);
  });

  test('calc() and plain lengths both parse to px', () => {
    assert.equal(evalMedia('(width: calc(1px + 9px))', env({ width: 10 })), true);
    assert.equal(evalMedia('(width: 10px)', env({ width: 10 })), true);
  });

  test('aspect-ratio with a keyword value evaluates unknown', () => {
    // Unique-cause of filtered[0].type !== number in parseRatio.
    assert.equal(evalMedia('(aspect-ratio: auto)', env()), 'unknown');
    assert.equal(evalMedia('(aspect-ratio: 16/9)', env({ aspectRatio: [16, 9] })), true);
  });

  test('fractional counts are rejected by the integer grammar', () => {
    assert.equal(evalMedia('(color: 1.5)', env()), 'unknown');
    assert.equal(evalMedia('(color: 2)', env({ color: 2 })), true);
  });

  test('unknown numeric features in range syntax evaluate unknown', () => {
    // actual === null leg of evaluateMediaFeature's numeric arm.
    assert.equal(evalMedia('(device-pixel-ratio >= 2)', env()), 'unknown');
    assert.equal(evalMedia('(width >= 2px)', env()), true);
  });

  test('resolution accepts x units', () => {
    assert.equal(evalMedia('(resolution: 2x)', env({ resolution: 192 })), true);
  });
});

describe('MC/DC audit round 2: cascade collection + defaults', () => {
  test('collectStyleSheetsAndRules rejects falsy and non-object elements', () => {
    assert.equal(collectStyleSheetsAndRules(undefined), null);
    assert.equal(collectStyleSheetsAndRules(null), null);
    assert.equal(collectStyleSheetsAndRules(42 as unknown as object), null);
    const real = collectStyleSheetsAndRules({ ownerDocument: {} });
    assert.deepEqual(real, []);
  });

  test('getUaDefault falls back through prefixed lookups', () => {
    // Unknown property: both lookups miss.
    assert.equal(getUaDefault('no-such-prop-xyz', null), '');
    // Known property hits directly.
    assert.equal(getUaDefault('color', null), 'rgb(0, 0, 0)');
    // Prefixed property resolves via its unprefixed entry.
    assert.equal(getUaDefault('-webkit-transform', null), 'none');
    assert.equal(getInitialValue('-webkit-transform', null), 'none');
    assert.equal(getInitialValue('no-such-prop-xyz', null), '');
  });

  test('processStandardDeclarations skips custom properties and honors unset without a parent', () => {
    const out = processStandardDeclarations(
      [
        { name: '--x', value: 'red', important: false, layerOrder: 0 },
        { name: 'color', value: 'blue', important: false, layerOrder: 0 },
      ] as never[],
      new Map(),
      new Set(),
      null,
      null,
    );
    assert.equal(out.size, 1);
    assert.equal(out.has('--x'), false);
    assert.equal(out.get('color')!.value, 'blue');

    const unset = processStandardDeclarations(
      [{ name: 'color', value: 'unset', important: false, layerOrder: 0 }] as never[],
      new Map(),
      new Set(),
      null,
      null,
    );
    assert.ok(unset.has('color'));
  });
});

describe('MC/DC audit round 2: transform matrix dispatch + DOMMatrix axes', () => {
  test('matrix / matrix3d take their own dispatch arm', () => {
    const m = CSSTransformValue.parse('matrix(1, 0, 0, 1, 10, 20)');
    assert.equal(m.toString(), 'matrix(1, 0, 0, 1, 10, 20)');
    const m3d = CSSTransformValue.parse('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1)');
    assert.equal(m3d.is2D, false);
  });

  test('DOMMatrix skew by zero is a no-op, non-zero shears', () => {
    const m = new DOMMatrix();
    const zero = m.skewX(0);
    assert.equal(zero.toString(), m.toString());
    const sheared = m.skewX(30);
    assert.match(sheared.toString(), /matrix\(1, 0, 0\.5773502691896257, 1, 0, 0\)/);

    const mz = new DOMMatrix();
    assert.equal(mz.skewY(0).toString(), m.toString());
    assert.equal(mz.skewY(45).is2D, true);
  });

  test('rotateSelf arity selects the Z-only or full axis path', () => {
    const twoArg = new DOMMatrix().rotateSelf(10, 20);
    assert.equal(twoArg.is2D, false);
    const threeArg = new DOMMatrix().rotateSelf(10, 20, 30);
    assert.equal(threeArg.is2D, false);
    const oneArg = new DOMMatrix().rotateSelf(90);
    assert.equal(oneArg.is2D, true);
  });

  test('rotateAxisAngle treats (0,0,1) as the 2D axis', () => {
    assert.equal(new DOMMatrix().rotateAxisAngleSelf(0, 0, 1, 45).is2D, true);
    assert.equal(new DOMMatrix().rotateAxisAngleSelf(0, 0, 2, 45).is2D, false);
    assert.equal(new DOMMatrix().rotateAxisAngleSelf(1, 0, 0, 45).is2D, false);
  });

  test('fromFloat64Array rejects arrays that are not exactly 16 long', () => {
    assert.throws(() => DOMMatrix.fromFloat64Array(new Float64Array(15)), TypeError);
    const identity = new Float64Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
    // fromFloat64Array always yields a 4x4 (3D-flagged) matrix.
    const from16 = DOMMatrix.fromFloat64Array(identity);
    assert.equal(from16.is2D, false);
    assert.match(from16.toString(), /matrix3d/);
    // Array constructor path keeps its own 6-or-16 length grammar.
    assert.throws(() => new DOMMatrix(new Float64Array(15) as unknown as number[]), TypeError);
  });
});
