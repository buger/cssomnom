/**
 * Overlay reproducer for KI-134. This file stays red until matches() and
 * querySelectorAll()/querySelector() surface a loud SyntaxError for
 * selectors that fail to parse in non-forgiving contexts, instead of
 * silently returning false / [].
 *
 * Reproduces: KI-134
 * Source vector: V-SELECTOR-FORGIVENESS-DIVERGENCE
 *
 * Spec anchors:
 * - DOM Standard #ref-for-dom-element-matches and
 *   #dom-parent-node-queryselectorall: "throw a 'SyntaxError' DOMException
 *   if the specified selector list is invalid" — scope/matches/qSA are
 *   NON-forgiving contexts.
 * - selectors-4 § #forgiving-selector-list: only :is()/:where() (and a
 *   few CSSOM APIs) parse forgivingly; a plain selector list that fails to
 *   parse is an error. Our :is(span,>>>) behavior (valid members still
 *   match) is correct and pinned as a control; the divergence is the
 *   top-level API posture.
 * - README.md documents the matcher as "Pure-AST static selector matcher"
 *   under the Selectors 4 conformance umbrella and records NO deviation
 *   for invalid-selector error posture — so this files an undocumented
 *   interop divergence, not a declared design choice.
 *
 * Observed defect at HEAD via public API:
 *   matches(el, '..dots') === false and querySelectorAll(root, '>>>')
 *   returns [] where the DOM contract requires a thrown SyntaxError.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matches, querySelectorAll } from '../../src/index.ts';

// Verifies: SYS-REQ-260826-J4NJ (KI-134 helper: minimal element fixture; V-SELECTOR-FORGIVENESS-DIVERGENCE)
function makeElement(tag: string, parent?: { children: unknown[] }): Record<string, unknown> {
  const el: Record<string, unknown> = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    localName: tag,
    attributes: [],
    getAttribute: () => null,
    children: [],
    parentNode: null,
    classList: { contains: () => false },
  };
  if (parent) (parent.children as unknown[]).push(el);
  return el;
}

const tree = { children: [] as unknown[] } as { children: unknown[] };
const div = makeElement('div', tree) as never;
const span = makeElement('span', tree) as never;

// Verifies: SYS-REQ-260826-J4NJ (control leg)
test('control: valid selector still matches and queries', () => {
  assert.equal(matches(span, 'span'), true);
  assert.equal(querySelectorAll(tree as never, 'div').length, 1);
});

// Verifies: SYS-REQ-260826-J4NJ (control leg: forgiving semantics preserved)
test('control: forgiving :is() keeps matching valid members of mixed lists', () => {
  // selectors-4 forgiving-list semantics must survive any fix here.
  assert.equal(matches(span, ':is(span,>>>)'), true);
  assert.equal(matches(span, ':where(div,>>>)'), false);
});

// Verifies: SYS-REQ-260826-J4NJ (KI-134 helper: error-class capture)
function throwsSyntaxLike(fn: () => unknown): string {
  try {
    fn();
    return 'no-throw';
  } catch (e: unknown) {
    return (e as Error).name;
  }
}

// Verifies: SYS-REQ-260826-J4NJ (defect leg: matches)
test('defect: matches() must throw for a selector that cannot parse', () => {
  const outcome = throwsSyntaxLike(() => matches(span, '..dots'));
  assert.equal(outcome, 'SyntaxError', `matches() returned silently (${outcome})`);
});

// Verifies: SYS-REQ-260826-J4NJ (defect leg: querySelectorAll)
test('defect: querySelectorAll() must throw for a fully-invalid selector', () => {
  const outcome = throwsSyntaxLike(() => querySelectorAll(tree as never, '>>>'));
  assert.equal(outcome, 'SyntaxError', `querySelectorAll() returned silently (${outcome})`);
});

// Verifies: SYS-REQ-260826-J4NJ (defect leg: non-forgiving plain list)
test('defect: mixed valid+invalid plain list is not a forgiving context', () => {
  // DOM throws for 'div,:pseudoclass'; silent all-or-nothing false hides
  // author typos instead of surfacing them.
  const m = throwsSyntaxLike(() => matches(div, 'div,:pseudoclass'));
  assert.equal(m, 'SyntaxError');
  const q = throwsSyntaxLike(() => querySelectorAll(tree as never, 'span, >>>'));
  assert.equal(q, 'SyntaxError');
});
