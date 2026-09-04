/**
 * Reproducer for CRS-0015/C04 (requirement SW-REQ-260821-3553, src/parser-api.ts
 * CSS namespace literal). The requirement binds escape, supports, registerProperty
 * and the parse methods onto the CSS object. README.md lists `CSS.parseRuleList()`
 * and `CSS.parseRuleListSync()` side by side (README.md ~L226) and documents the
 * Sync variants for the async parse methods (~L259). The namespace literal binds
 * the async `parseRuleList` but omits its Sync sibling, so `CSS.parseRuleListSync`
 * is undefined while the standalone export exists at src/parser-api.ts L519.
 * Asserts the documented contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSS, parseRuleListSync } from '../../src/parser-api.ts';

test('CRS-0015/C04: CSS.parseRuleListSync is bound on the CSS namespace', () => {
  assert.equal(typeof (CSS as Record<string, unknown>).parseRuleListSync, 'function',
    'CSS.parseRuleListSync must exist per README and SW-REQ-260821-3553');
  assert.equal((CSS as Record<string, unknown>).parseRuleListSync, parseRuleListSync as unknown,
    'the namespace must bind the standalone parseRuleListSync export');
});

test('CRS-0015/C04: the bound factory still parses a rule list', () => {
  const rules = (CSS as unknown as { parseRuleListSync: (css: string) => unknown[] }).parseRuleListSync('@media screen { a { b: c } }');
  assert.ok(Array.isArray(rules) && rules.length === 1, 'one rule must come back');
});

test('control: the async sibling and parseStylesheetSync are already bound', () => {
  assert.equal(typeof (CSS as Record<string, unknown>).parseRuleList, 'function');
  assert.equal(typeof (CSS as Record<string, unknown>).parseStylesheetSync, 'function');
});
