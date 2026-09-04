/**
 * Reproducer for CRS-0067/C25 (src/CSSOM.ts CSSPageRule / CSSGroupingRule.insertRule).
 * css-page-3 #at-page-rule constrains the @page body to page properties and
 * margin at-rules. cssom-1 § 6.5.3 #insert-a-css-rule step 5 throws
 * HierarchyRequestError when CSS constraints forbid inserting the new rule
 * into the list. CSSPageRule inherits CSSGroupingRule.insertRule unchanged,
 * which only rejects @import and @namespace, so a style rule and a grouping
 * at-rule insert into @page and re-serialize. Distinct from KI-334, which
 * pins the same grammar violation on the parser ingest path; this is the
 * insertRule path.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSSPageRule } from '../../src/CSSOM.ts';

function pageRule(): CSSPageRule & { insertRule(r: string, i?: number): number } {
  const sheet = parse('@page { margin: 1cm }');
  return sheet.cssRules[0] as CSSPageRule & { insertRule(r: string, i?: number): number };
}

test('CRS-0067/C25: a style rule cannot be inserted into @page', () => {
  const page = pageRule();
  assert.throws(
    () => page.insertRule('div { color: red }'),
    (e: unknown) => (e as DOMException).name === 'HierarchyRequestError',
    'css-page-3 allows only page properties and margin at-rules inside @page',
  );
  assert.equal(page.cssRules.length, 0, 'a rejected insert must not mutate @page children');
});

test('CRS-0067/C25: a grouping at-rule cannot be inserted into @page', () => {
  const page = pageRule();
  assert.throws(
    () => page.insertRule('@media all { }'),
    (e: unknown) => (e as DOMException).name === 'HierarchyRequestError',
  );
  assert.equal(page.cssRules.length, 0);
});

test('control: a margin at-rule still inserts into @page', () => {
  const page = pageRule();
  assert.equal(page.insertRule('@top-left { color: red }'), 0);
  assert.equal(page.cssRules.length, 1);
});
