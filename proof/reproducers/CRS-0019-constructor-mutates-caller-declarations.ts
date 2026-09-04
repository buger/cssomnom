/**
 * Reproducer for CRS-0019/C15 (src/CSSStyleDeclaration.ts constructor /
 * addDeclarationRecursive). The constructor lowercases decl.name in place on
 * the caller's Declaration objects instead of copying them, so an AST handed
 * to the public constructor is mutated behind the caller's back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';

test('CRS-0019/C15: constructing a declaration block leaves caller objects untouched', () => {
  const decl = {
    type: 'declaration' as const,
    name: 'Color',
    value: [{ type: 'ident', value: 'red' }],
    important: false,
  };
  new CSSStyleDeclaration([decl]);
  assert.equal(decl.name, 'Color', 'the block must not rename the caller-owned declaration');
});

test('CRS-0019/C15: sharing one declaration object between two blocks is safe', () => {
  const shared = {
    type: 'declaration' as const,
    name: 'Color',
    value: [{ type: 'ident', value: 'red' }],
    important: false,
  };
  new CSSStyleDeclaration([shared]);
  const before = shared.name;
  new CSSStyleDeclaration([shared]);
  assert.equal(shared.name, before, 'a second construction must not observe or reapply renames');
});

test('control: the block itself still normalizes its view', () => {
  const decl = {
    type: 'declaration' as const,
    name: 'Color',
    value: [{ type: 'ident', value: 'red' }],
    important: false,
  };
  const block = new CSSStyleDeclaration([decl]);
  assert.equal(block.getPropertyValue('color'), 'red', 'lookups use the lowercase name');
});
