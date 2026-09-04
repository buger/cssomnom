/**
 * Reproducer for CRS-0035/C08 (src/CSSOM.ts CSSContainerRule constructor).
 *
 * css-containers-2 #container-rule: @container [<container-name>]? {
 * <container-query> }, where <container-name> is a <custom-ident>. A query
 * that starts with a function token such as style(...) or scroll-state(...)
 * has no name. The constructor's fallback splits the text on the first
 * space and stores 'style(color:' as the container name with 'red)' as the
 * query when no space-separated name precedes a parenthesis, so
 * containerName reports a fragment that is not a custom-ident. Asserts the
 * spec outcome so this command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

function containerOf(css: string): { containerName: string; containerQuery: string; conditionText: string } {
  const sheet = parse(css);
  return (sheet as unknown as { cssRules: unknown[] }).cssRules[0] as unknown as
    { containerName: string; containerQuery: string; conditionText: string };
}

test('CRS-0035/C08: style() query is not a container name', () => {
  const rule = containerOf('@container style(color: red) { div { color: red } }');
  assert.equal(rule.containerName, '', 'a function-token query has no <custom-ident> name');
  assert.equal(rule.conditionText.includes('style(color: red)'), true,
    'the style() query text is preserved');
});

test('CRS-0035/C08: named container still parses name and query', () => {
  const rule = containerOf('@container card style(color: red) { div { color: red } }');
  assert.equal(rule.containerName, 'card');
});

test('control: plain size query keeps an empty name', () => {
  const rule = containerOf('@container (min-width: 1px) { div { color: red } }');
  assert.equal(rule.containerName, '');
});
