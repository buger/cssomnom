/**
 * Overlay reproducer for KI-116.  This file intentionally stays red until
 * `border-image:url()` serialization is fixpoint-stable across parse cycles.
 *
 * Reproduces: KI-116
 * Verifies: SYS-REQ-260823-BNDX (declaration-block serialization round-trips
 *           property-specifically; witness: border-image with an empty url)
 *
 * Spec anchors:
 * - css-syntax-3 § Serialization (id="serialization"):
 *     "The only requirement for serialization is that it must 'round-trip'
 *      with parsing, that is, parsing the stylesheet must produce the same
 *      data structures as parsing, serializing, and parsing again …"
 * - css-backgrounds-3 § "border-image" (#borderimage): `url()` is a valid
 *   <<url>> source component (an empty URL is still a <<url>>), so pass 1
 *   retaining it is correct and pass 2 must not change its meaning.
 * - cssom-1 § "parse a CSS declaration block" (#parse-a-css-declaration-block)
 *   + § "serialize a CSS declaration block"
 *   (#serialize-a-css-declaration-block): a retained declaration may only be
 *   re-serialized, never silently replaced by different longhand data.
 *
 * Observed defect:
 * - Pass 1 of `.o{border-image:url()}` retains the declaration and serializes
 *   `border-image: url("");` (five border-image-* longhands set,
 *   source = url("")).  Correct.
 * - Pass 2 re-parses that serialized text and collapses to
 *   `border-image: none;` — expandBorderImage (src/shorthands.ts ~955-1001)
 *   recognizes only token-type 'url' values, while the serializer emits the
 *   quoted function form (`url("")`), which arrives as a function token named
 *   "url" per css-syntax-3 #consume-ident-like-token.  The source silently
 *   stays `none` and contractBorderImage reconstructs "none".
 * - Property-specific inconsistency proving this is an implementation bug and
 *   not inherent syntax ambiguity: `.o{background:url()}` IS stable — the
 *   same `url()` round-trips as url("") on both passes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/index.ts';
import type { CSSStyleRule } from '../../src/index.ts';

// Verifies: SYS-REQ-260823-BNDX (KI-116 reproducer helper: declaration-block style probe)
function firstStyleOf(cssText: string) {
  const sheet = parse(cssText);
  return (sheet.cssRules[0] as CSSStyleRule).style;
}

const BORDER_IMAGE_LONGHANDS = [
  'border-image-source',
  'border-image-slice',
  'border-image-width',
  'border-image-outset',
  'border-image-repeat',
] as const;

// ---------------------------------------------------------------------------
// Green controls.
// ---------------------------------------------------------------------------

// Verifies: SYS-REQ-260823-BNDX (property-specific stability control)
test('KI-116 control: background:url() is fixpoint-stable', () => {
  const pass1 = firstStyleOf('.o{background:url()}');
  const serialized = firstStyleOf(`.o{${pass1.cssText}}`);
  assert.equal(pass1.getPropertyValue('background'), 'url("")');
  assert.equal(
    serialized.getPropertyValue('background'),
    pass1.getPropertyValue('background'),
    'parsing, serializing, and parsing again yields the same value',
  );
});

// Verifies: SYS-REQ-260823-BNDX (pass-1 retention control)
test('KI-116 control: first parse retains border-image:url()', () => {
  const style = firstStyleOf('.o{border-image:url()}');
  assert.equal(style.getPropertyValue('border-image-source'), 'url("")');
});

// ---------------------------------------------------------------------------
// Defect legs (red until fixed).
// ---------------------------------------------------------------------------

// css-syntax-3 §Serialization round-trip mandate applied to the serialized
// declaration text itself.
// Reproduces: KI-116
// Verifies: SYS-REQ-260823-BNDX leg 1.
test('KI-116: border-image:url() survives re-parsing its own serialization', () => {
  const pass1 = firstStyleOf('.o{border-image:url()}');
  const pass2 = firstStyleOf(`.o{${pass1.cssText}}`);
  assert.equal(
    pass2.getPropertyValue('border-image'),
    pass1.getPropertyValue('border-image'),
    'parse(serialize(parse(x))) must equal parse(x) (css-syntax-3 #serialization)',
  );
  assert.notEqual(
    pass2.getPropertyValue('border-image'),
    'none',
    'the empty-url source must not collapse to none on the second pass',
  );
});

// The five border-image-* longhands must keep representing the same data
// structure after the second parse; today the source is silently reset.
// Reproduces: KI-116
// Verifies: SYS-REQ-260823-BNDX leg 2.
test('KI-116: second-pass longhands still carry the url source', () => {
  const pass1 = firstStyleOf('.o{border-image:url()}');
  const pass2 = firstStyleOf(`.o{${pass1.cssText}}`);
  assert.equal(
    pass2.getPropertyValue('border-image-source'),
    'url("")',
    'border-image-source keeps the serialized url across passes',
  );
});

// cssText-level stability: re-serializing the re-parsed block must not rewrite
// the declaration into different shorthand data ("border-image: none;").
// Reproduces: KI-116
// Verifies: SYS-REQ-260823-BNDX leg 3.
test('KI-116: cssText of the re-parsed block matches its input', () => {
  const pass1 = firstStyleOf('.o{border-image:url()}');
  const pass2 = firstStyleOf(`.o{${pass1.cssText}}`);
  assert.equal(pass2.cssText, pass1.cssText, 'cssText reaches a fixpoint after one cycle');
});
