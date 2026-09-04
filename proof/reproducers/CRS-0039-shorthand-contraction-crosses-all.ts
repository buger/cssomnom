/**
 * Reproducer for CRS-0039/C09+C19+C25 (src/serializer.ts checkIntervening).
 * css-syntax-3 #serialization: serializing then re-parsing must reproduce the
 * same declarations. checkIntervening skips any intervening declaration whose
 * name has no propertyToGroup entry, so `all` (a reset for every property) and
 * same-side shorthands such as `border-top` never block a shorthand
 * contraction. The contracted shorthand lands at the FIRST longhand position,
 * ahead of the intervening reset, so re-parsing the serialized cssText flips
 * the cascade: declarations that won originally lose after round-trip.
 * Asserts the round-trip contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/tokenizer.ts';
import { ParseHooks } from '../../src/parse-hooks.ts';
import '../../src/parser.ts';
import { serializeDeclarations } from '../../src/serializer.ts';
import { parse } from '../../src/parser.ts';
import type { Declaration } from '../../src/types.ts';

function D(name: string, css: string): Declaration {
  return {
    type: 'declaration',
    name,
    value: ParseHooks.parseComponentValues(tokenize(css)),
    important: false,
  };
}

function winnersOf(decls: Declaration[]): { style: string; color: string } {
  const text = serializeDeclarations(decls);
  const sheet = parse(`.x { ${text} }`);
  const s = sheet.cssRules[0].style;
  return {
    style: s.getPropertyValue('border-top-style') || s.getPropertyValue('background-repeat') || '',
    color: s.getPropertyValue('border-top-color') || s.getPropertyValue('background-color') || '',
  };
}

test('CRS-0039/C09: border side longhands do not contract across an intervening all', () => {
  const decls = [
    D('border-top-width', '1px'),
    D('all', 'unset'),
    D('border-top-style', 'solid'),
    D('border-top-color', 'red'),
  ];
  const out = serializeDeclarations(decls);
  // The contraction `border-top: 1px solid red` placed before `all: unset`
  // loses to the reset on re-parse; solid/red must survive the round-trip.
  const re = parse(`.x { ${out} }`).cssRules[0].style;
  assert.equal(re.getPropertyValue('border-top-style'), 'solid',
    `intervening all must block the border-top contraction; got ${out}`);
  assert.equal(re.getPropertyValue('border-top-color'), 'red');
});

test('CRS-0039/C25: a same-side shorthand between longhands blocks the contraction', () => {
  const decls = [
    D('border-top-width', '1px'),
    D('border-top', '5px dotted blue'),
    D('border-top-style', 'solid'),
    D('border-top-color', 'red'),
  ];
  const out = serializeDeclarations(decls);
  const re = parse(`.x { ${out} }`).cssRules[0].style;
  assert.equal(re.getPropertyValue('border-top-style'), 'solid',
    `later longhands must keep winning after round-trip; got ${out}`);
  assert.equal(re.getPropertyValue('border-top-color'), 'red');
});

test('CRS-0039/C19: background longhands do not contract across an intervening all', () => {
  const decls = [
    D('background-image', 'url(a)'),
    D('all', 'unset'),
    D('background-color', 'red'),
    D('background-position', '0 0'),
    D('background-size', 'auto auto'),
    D('background-repeat', 'repeat'),
    D('background-attachment', 'scroll'),
    D('background-origin', 'padding-box'),
    D('background-clip', 'border-box'),
  ];
  const out = serializeDeclarations(decls);
  const re = parse(`.x { ${out} }`).cssRules[0].style;
  assert.equal(re.getPropertyValue('background-color'), 'red',
    `background-color declared after all must survive; got ${out}`);
});

test('control: contraction without an intervening reset still round-trips', () => {
  const decls = [
    D('border-top-width', '1px'),
    D('border-top-style', 'solid'),
    D('border-top-color', 'red'),
  ];
  const out = serializeDeclarations(decls);
  const re = parse(`.x { ${out} }`).cssRules[0].style;
  assert.equal(re.getPropertyValue('border-top-style'), 'solid');
  assert.equal(re.getPropertyValue('border-top-color'), 'red');
});
