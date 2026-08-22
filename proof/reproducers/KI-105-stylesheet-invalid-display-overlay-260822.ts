/**
 * Overlay reproducer for KI-105.
 *
 * Reproduces: KI-105
 * Verifies: SYS-REQ-260822-1MB8
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { parse } from '../../src/parser.ts';
import { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';

// Reproduces: KI-105
test('KI-105 parser: stylesheet parsing drops invalid display but keeps valid neighbors', () => {
  // cssom-1 #parse-a-css-declaration-block: parse each declaration block;
  // css-syntax-3 § 5.4.5 #parse-block-contents: invalid declarations are dropped.
  // declaration according to its property specification and drop it when the
  // whole declaration is invalid. css-display-3 § 2 #the-display-properties
  // defines the finite display value grammar.
  const sheet = parse('.target { display: definitely-not-a-display-value; color: red; }');
  const style = sheet.cssRules[0].style;
  assert.equal(style.getPropertyValue('display'), '',
    'property-grammar-invalid display declaration must be dropped');
  assert.equal(style.getPropertyValue('color'), 'red',
    'a neighboring valid declaration must remain after the invalid one');
});

// Reproduces: KI-105 (setProperty branch; consolidated from retired KI-106)
test('KI-105 setProperty: invalid display is a no-op and valid display remains', () => {
  // cssom-1 § 6.6 #dom-cssstyledeclaration-setproperty and
  // css-display-3 § 2 #the-display-properties: invalid parsed values return
  // without mutation, while a valid display keyword is retained.
  const style = new CSSStyleDeclaration();
  style.setProperty('color', 'red');
  style.setProperty('display', 'definitely-not-a-display-value');
  assert.equal(style.getPropertyValue('display'), '',
    'setProperty must ignore an invalid display value');
  assert.equal(style.getPropertyValue('color'), 'red',
    'setProperty invalid-value no-op must preserve existing declarations');
});

test('KI-105 setProperty positive control: valid display is retained', () => {
  const style = new CSSStyleDeclaration();
  style.setProperty('display', 'block');
  assert.equal(style.getPropertyValue('display'), 'block');
});

// Reproduces: KI-105 (cssText branch; consolidated from retired KI-106)
test('KI-105 cssText: invalid display is dropped and valid display remains', () => {
  // cssom-1 § 6.6 #dom-cssstyledeclaration-csstext: parse a CSS declaration
  // block and insert only declarations that survive property parsing.
  const style = new CSSStyleDeclaration();
  style.cssText = 'color: blue; display: definitely-not-a-display-value;';
  assert.equal(style.getPropertyValue('display'), '',
    'cssText must drop an invalid display declaration');
  assert.equal(style.getPropertyValue('color'), 'blue',
    'cssText must retain a valid neighboring declaration');
});

test('KI-105 cssText positive control: valid display is retained', () => {
  const style = new CSSStyleDeclaration();
  style.cssText = 'display: inline;';
  assert.equal(style.getPropertyValue('display'), 'inline');
});
