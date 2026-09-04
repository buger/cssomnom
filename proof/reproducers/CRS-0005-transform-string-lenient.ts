/**
 * Reproducer for CRS-0005/C02, C03, C04, C05, C06, C28, C30
 * (requirement INT-REQ-260821-JTY2, src/DOMMatrix.ts parseMatrixString).
 *
 * The native matrix()/matrix3d() fast paths split their argument text on
 * /[\s,]+/ and coerce with Number(), and parseIdentityOrNone runs after a trim,
 * so transform strings that are not valid CSS parse into matrices instead of
 * throwing SyntaxError:
 *   - whitespace-only strings become identity (geometry-1 #dommatrix-parse step
 *     1 rewrites only the *exact* empty string, everything else is CSS-parsed);
 *   - matrix()/matrix3d() are <number>#{6} / <number>#{16} comma productions,
 *     so space-separated and collapsed/trailing commas are parse failures;
 *   - `Infinity` is an identifier, not a CSS <number>;
 *   - setMatrixValue shares the same parser, so it inherits every hole;
 *   - malformed native-looking strings never reach the typed-om transform hook,
 *     which is the only component that could reject them.
 * Asserts the intended contract so this command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/typed-om/index.ts';
import { DOMMatrix } from '../../src/DOMMatrix.ts';

function assertSyntaxError(label: string, fn: () => unknown): void {
  try {
    fn();
  } catch (err) {
    const name = (err as { name?: string }).name;
    assert.equal(name, 'SyntaxError', `${label} must fail with SyntaxError, got ${name}`);
    return;
  }
  assert.fail(`${label} must throw SyntaxError but parsed successfully`);
}

test('CRS-0005/C02: whitespace-only transform list is not the empty string', () => {
  assertSyntaxError('new DOMMatrix("   ")', () => new DOMMatrix('   '));
  assertSyntaxError('new DOMMatrix("\\t\\n")', () => new DOMMatrix('\t\n'));
});

test('CRS-0005/C03: collapsed and trailing commas are not <number>#{6}', () => {
  assertSyntaxError('matrix(1,,0,0,1,0,0)', () => new DOMMatrix('matrix(1,,0,0,1,0,0)'));
  assertSyntaxError('matrix(1, 0, 0, 1, 0, 0,)', () => new DOMMatrix('matrix(1, 0, 0, 1, 0, 0,)'));
});

test('CRS-0005/C04: space-separated matrix() arguments are not a comma list', () => {
  assertSyntaxError('matrix(1 0 0 1 0 0)', () => new DOMMatrix('matrix(1 0 0 1 0 0)'));
});

test('CRS-0005/C05: space-separated matrix3d() arguments are not a comma list', () => {
  assertSyntaxError('matrix3d(1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1)',
    () => new DOMMatrix('matrix3d(1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1)'));
});

test('CRS-0005/C06: Infinity is an identifier, not a CSS <number>', () => {
  assertSyntaxError('matrix(Infinity, 0, 0, 1, 0, 0)', () => new DOMMatrix('matrix(Infinity, 0, 0, 1, 0, 0)'));
});

test('CRS-0005/C28: setMatrixValue inherits the same parser holes', () => {
  const m = new DOMMatrix();
  assertSyntaxError('setMatrixValue("  ")', () => m.setMatrixValue('  '));
  assertSyntaxError('setMatrixValue("matrix(1 0 0 1 0 0)")', () => m.setMatrixValue('matrix(1 0 0 1 0 0)'));
});

test('CRS-0005/C01 control: the exact empty string stays an identity matrix', () => {
  // geometry-1 #dommatrix-parse step 1 rewrites the empty string to matrix(1,0,0,1,0,0).
  assert.equal(new DOMMatrix('').isIdentity, true);
});
