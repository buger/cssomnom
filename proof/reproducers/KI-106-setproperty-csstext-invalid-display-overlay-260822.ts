/**
 * Overlay reproducer for KI-106.
 *
 * Reproduces: KI-106
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';

// Reproduces: KI-106
test('KI-106: setProperty and cssText ignore an invalid display value', () => {
  // cssom-1 § 6.6 #dom-cssstyledeclaration-setproperty: a null parsed
  // component value list causes an early return without mutation. The
  // cssText setter uses parse a CSS declaration block and therefore applies
  // the same property-grammar filtering (cssom-1 #dom-cssstyledeclaration-csstext).
  // css-display-3 § 2 #the-display-properties defines display's grammar.
  const style = new CSSStyleDeclaration();
  style.setProperty('color', 'red');
  style.setProperty('display', 'definitely-not-a-display-value');
  assert.equal(style.getPropertyValue('display'), '',
    'setProperty must ignore an invalid display value');
  assert.equal(style.getPropertyValue('color'), 'red',
    'setProperty invalid-value no-op must preserve existing declarations');

  style.cssText = 'color: blue; display: definitely-not-a-display-value;';
  assert.equal(style.getPropertyValue('display'), '',
    'cssText must drop an invalid display declaration');
  assert.equal(style.getPropertyValue('color'), 'blue',
    'cssText must retain a valid neighboring declaration');
});
