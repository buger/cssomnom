/**
 * Reproducer for CRS-0062/C08 (requirement SYS-REQ-260821-NHZ8, src/parser.ts).
 *
 * css-syntax-3 #consume-a-blocks-contents calls #consume-a-declaration with
 * nested=true. #consume-a-declaration step 5 consumes the value with
 * #consume-a-list-of-component-values "with |nested|", whose <}-token> arm
 * says: "If |nested| is true, return |values|." A declaration value parsed
 * inside block-contents therefore stops at a stray <}-token>.
 *
 * consumeDeclarationFromStream (src/parser.ts ~L1106-1109) breaks only on
 * EOF or semicolon, so through the public parseBlockContents entry a bare
 * '}' token and everything after it is slurped into the declaration value.
 *
 * Asserts the intended contract so this command FAILS while the bug is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Parser } from '../../src/parser.ts';
import { tokenize } from '../../src/tokenizer.ts';

test('CRS-0062/C08: declaration value stops at a stray close-curly when nested', () => {
  // css-syntax-3 5.4.5 parse a block's contents over 'color: red } background: blue'.
  const parser = new Parser(tokenize('color: red } background: blue'));
  const rules = parser.parseBlockContents();

  // The declaration list ends at the <}-token>; the value is exactly 'red'.
  assert.equal(rules.length, 1, 'one declaration list is produced');
  const first = rules[0] as unknown as { cssText: string; style?: { getPropertyValue(n: string): string } };
  const color = first.style ? first.style.getPropertyValue('color') : first.cssText;
  assert.equal(
    color.includes('}') || color.includes('background'),
    false,
    `the value must not swallow the close-curly, got ${JSON.stringify(color)} / ${JSON.stringify(first.cssText)}`,
  );
  assert.equal(color.trim(), 'red', `color value must be 'red', got ${JSON.stringify(color)}`);
});

test('CRS-0062/C08: cssText of the declaration list excludes tokens past the close-curly', () => {
  const parser = new Parser(tokenize('color: red } background: blue'));
  const rules = parser.parseBlockContents();
  const text = (rules[0] as unknown as { cssText: string }).cssText;
  assert.equal(text.includes('}'), false, `cssText must end the block at '}', got ${JSON.stringify(text)}`);
  assert.equal(text.includes('background'), false,
    `tokens after the close-curly belong outside the block, got ${JSON.stringify(text)}`);
});
