/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Verifies: SW-REQ-260821-FWNH, INT-REQ-260821-HJVC
// Still-hot unique-cause for src/cascade/index.ts getCascadedStyle (L239
// upright × vertical-rl/lr, parent vs local wm/dir/to, parent vs root custom
// props) and normalizePseudoElement (L139 isColon / ident), driven only
// through getCascadedStyle from ../src/cascade.ts. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import '../src/parser.ts';
import { parseStyleSheet } from '../src/parser.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';

function cascade(
  html: string,
  css: string,
  selector: string,
  pseudo?: string | null,
): CSSStyleDeclaration {
  const { document } = parseHTML(html);
  const el = document.querySelector(selector);
  assert.ok(el, `missing ${selector}`);
  const style = getCascadedStyle(el, parseStyleSheet(css), pseudo);
  assert.ok(style instanceof CSSStyleDeclaration);
  return style;
}

function box(css: string, pseudo?: string | null): CSSStyleDeclaration {
  return cascade(
    '<html><body><div class="t" style="z-index: 7"></div></body></html>',
    css,
    '.t',
    pseudo,
  );
}

function childBox(css: string, pseudo?: string | null): CSSStyleDeclaration {
  return cascade(
    '<html><body><div class="p"><div class="t" style="z-index: 7"></div></div></body></html>',
    css,
    '.t',
    pseudo,
  );
}

/** Which physical margin received margin-inline-start: 10px. */
function inlineStartSide(style: CSSStyleDeclaration): string {
  if (style.getPropertyValue('margin-top') === '10px') return 'top';
  if (style.getPropertyValue('margin-bottom') === '10px') return 'bottom';
  if (style.getPropertyValue('margin-left') === '10px') return 'left';
  if (style.getPropertyValue('margin-right') === '10px') return 'right';
  return '';
}

type Duck = {
  nodeType: number;
  tagName: string;
  localName: string;
  className: string;
  classList: { contains(c: string): boolean };
  isConnected: boolean;
  parentElement: unknown;
  parentNode: unknown;
  ownerDocument: unknown;
};

function duckT(document: unknown, extra: Partial<Duck> = {}): Duck {
  return {
    nodeType: 1,
    tagName: 'DIV',
    localName: 'div',
    className: 't',
    classList: { contains: (c: string) => c === 't' },
    isConnected: true,
    parentElement: null,
    parentNode: null,
    ownerDocument: document,
    ...extra,
  };
}

function duckStyle(el: unknown, css: string): CSSStyleDeclaration {
  const style = getCascadedStyle(el, parseStyleSheet(css));
  assert.ok(style instanceof CSSStyleDeclaration);
  return style;
}

const PSEUDO_SHEET = `
  .p { color: lime; --x: orange; }
  .t { width: 100px; color: green; }
  .t::before { width: 50px; content: "x"; }
  .t::after { width: 40px; }
  .t::first-letter { width: 30px; }
  .t::first-line { width: 20px; }
  .t::marker { width: 11px; }
  .t::highlight(foo) { width: 15px; }
  .t::picker(select) { width: 14px; }
  .t::part(bar) { width: 13px; }
`;

describe('MC/DC unique-cause: getCascadedStyle writing-mode / text-orientation', { concurrency: false }, () => {
  // css-writing-modes-4 § 5.1 #text-orientation: used direction is ltr when
  // text-orientation is upright in vertical writing modes.
  // css-logical-1 § 2 #logical-prop-mapping
  test('L239 upright F with vertical-rl; vertical-rl T vs vertical-lr T vs both F with upright T', () => {
    const mis = '.t { direction: rtl; margin-inline-start: 10px; }';

    // A=T, B=T, C=F: upright + vertical-rl forces ltr → inline-start is top.
    const uprightRl = box(`${mis} .t { writing-mode: vertical-rl; text-orientation: upright; }`);
    assert.equal(inlineStartSide(uprightRl), 'top');
    // Specified direction stays rtl; only the mapping context is forced.
    assert.equal(uprightRl.getPropertyValue('direction'), 'rtl');

    // A=F, B=T, C=F: mixed + vertical-rl keeps rtl → inline-start is bottom.
    const mixedRl = box(`${mis} .t { writing-mode: vertical-rl; text-orientation: mixed; }`);
    assert.equal(inlineStartSide(mixedRl), 'bottom');

    // A=F (sideways) independently of mixed, still with vertical-rl.
    const sidewaysRl = box(`${mis} .t { writing-mode: vertical-rl; text-orientation: sideways; }`);
    assert.equal(inlineStartSide(sidewaysRl), 'bottom');

    // A=T, B=F, C=T: upright + vertical-lr forces ltr → top.
    const uprightLr = box(`${mis} .t { writing-mode: vertical-lr; text-orientation: upright; }`);
    assert.equal(inlineStartSide(uprightLr), 'top');

    // A=F, B=F, C=T: mixed + vertical-lr keeps rtl → bottom.
    const mixedLr = box(`${mis} .t { writing-mode: vertical-lr; text-orientation: mixed; }`);
    assert.equal(inlineStartSide(mixedLr), 'bottom');

    // A=T, B=F, C=F: upright + horizontal-tb does not force → rtl maps to right.
    const uprightHtb = box(`${mis} .t { writing-mode: horizontal-tb; text-orientation: upright; }`);
    assert.equal(inlineStartSide(uprightHtb), 'right');

    // Both writing-mode atoms F via sideways-rl (not vertical-rl/lr).
    const uprightSideways = box(`${mis} .t { writing-mode: sideways-rl; text-orientation: upright; }`);
    assert.equal(inlineStartSide(uprightSideways), 'right');
  });

  test('parent writing-mode / direction / text-orientation inherit vs local winner', () => {
    const html = '<html><body><div class="p"><div class="t"></div></div></body></html>';

    // pWm T, pDir T, pTo F: inherit vertical-rl + rtl, default mixed → bottom.
    const inheritRlRtl = cascade(
      html,
      '.p { writing-mode: vertical-rl; direction: rtl; } .t { margin-inline-start: 10px; }',
      '.t',
    );
    assert.equal(inlineStartSide(inheritRlRtl), 'bottom');
    assert.equal(inheritRlRtl.getPropertyValue('writing-mode'), 'vertical-rl');
    assert.equal(inheritRlRtl.getPropertyValue('direction'), 'rtl');

    // pWm T, pDir F, pTo F: inherit vertical-rl only (ltr default) → top.
    const onlyWm = cascade(
      html,
      '.p { writing-mode: vertical-rl; } .t { margin-inline-start: 10px; }',
      '.t',
    );
    assert.equal(inlineStartSide(onlyWm), 'top');

    // pWm F, pDir T, pTo F: inherit rtl only (horizontal-tb) → right.
    const onlyDir = cascade(
      html,
      '.p { direction: rtl; } .t { margin-inline-start: 10px; }',
      '.t',
    );
    assert.equal(inlineStartSide(onlyDir), 'right');

    // pTo T with inherited vertical-rl + rtl: upright force → top.
    const inheritUpright = cascade(
      html,
      '.p { writing-mode: vertical-rl; direction: rtl; text-orientation: upright; } .t { margin-inline-start: 10px; }',
      '.t',
    );
    assert.equal(inlineStartSide(inheritUpright), 'top');

    // Local toWinner mixed overrides parent upright → no force, rtl kept → bottom.
    const localMixed = cascade(
      html,
      '.p { writing-mode: vertical-rl; direction: rtl; text-orientation: upright; } .t { text-orientation: mixed; margin-inline-start: 10px; }',
      '.t',
    );
    assert.equal(inlineStartSide(localMixed), 'bottom');

    // Local toWinner upright overrides parent mixed → force → top.
    const localUpright = cascade(
      html,
      '.p { writing-mode: vertical-rl; direction: rtl; text-orientation: mixed; } .t { text-orientation: upright; margin-inline-start: 10px; }',
      '.t',
    );
    assert.equal(inlineStartSide(localUpright), 'top');

    // Local wmWinner horizontal-tb overrides parent vertical-rl; rtl kept → right.
    const localHtb = cascade(
      html,
      '.p { writing-mode: vertical-rl; direction: rtl; text-orientation: upright; } .t { writing-mode: horizontal-tb; margin-inline-start: 10px; }',
      '.t',
    );
    assert.equal(inlineStartSide(localHtb), 'right');

    // Local wmWinner vertical-lr vs parent vertical-rl; inherited upright still forces → top.
    const localLr = cascade(
      html,
      '.p { writing-mode: vertical-rl; direction: rtl; text-orientation: upright; } .t { writing-mode: vertical-lr; margin-inline-start: 10px; }',
      '.t',
    );
    assert.equal(inlineStartSide(localLr), 'top');

    // Local dirWinner rtl then L239 force (parent has no direction).
    const localRtlForce = cascade(
      html,
      '.p { writing-mode: vertical-rl; } .t { direction: rtl; text-orientation: upright; margin-inline-start: 10px; }',
      '.t',
    );
    assert.equal(inlineStartSide(localRtlForce), 'top');

    // wmWinner F: inherit vertical-lr + upright + rtl → top.
    const inheritLr = cascade(
      html,
      '.p { writing-mode: vertical-lr; direction: rtl; text-orientation: upright; } .t { margin-inline-start: 10px; }',
      '.t',
    );
    assert.equal(inlineStartSide(inheritLr), 'top');

    // parentCascaded F (html): local winners only.
    const root = cascade(
      '<html id="root"><body></body></html>',
      '#root { writing-mode: vertical-rl; direction: rtl; text-orientation: upright; margin-inline-start: 10px; }',
      '#root',
    );
    assert.equal(inlineStartSide(root), 'top');
  });
});

describe('MC/DC unique-cause: getCascadedStyle custom props parent vs root', { concurrency: false }, () => {
  // css-variables-1 § 3 #using, css-cascade-5 § 7 #cascaded-values
  test('parentCascaded custom props vs rootNode fallback vs element===rootNode vs no rootNode', () => {
    const html = '<html><body><div class="p"><div class="t"></div></div></body></html>';
    const css = `
      html { --x: lime; }
      .p { --x: orange; }
      .t { --y: var(--x); color: var(--y); --z: var(--missing, teal); }
    `;

    // parentCascaded T: copy from parent, skip root (html lime must not win).
    const fromParent = cascade(html, css, '.t');
    assert.equal(fromParent.getPropertyValue('--x'), 'orange');
    assert.equal(fromParent.getPropertyValue('--y'), 'orange');
    assert.equal(fromParent.getPropertyValue('color'), 'rgb(255, 165, 0)');
    assert.equal(fromParent.getPropertyValue('--z'), 'teal');

    const { document } = parseHTML(html);
    const parent = document.querySelector('.p');
    assert.ok(parent);

    // parentCascaded F, rootNode T, rootNode !== element T: raw custom props from html.
    // --x is used to resolve local --y but is not itself a local/inherited output.
    const fromRoot = duckStyle(
      duckT(document, { parentElement: null, parentNode: null }),
      css,
    );
    assert.equal(fromRoot.getPropertyValue('--x'), '');
    assert.equal(fromRoot.getPropertyValue('--y'), 'lime');
    assert.equal(fromRoot.getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(fromRoot.getPropertyValue('--z'), 'teal');

    // Same root fallback via parentNode Document (isElement F).
    const fromRootViaDoc = duckStyle(
      duckT(document, { parentElement: null, parentNode: document }),
      css,
    );
    assert.equal(fromRootViaDoc.getPropertyValue('--y'), 'lime');
    assert.equal(fromRootViaDoc.getPropertyValue('--x'), '');

    // parentCascaded F, rootNode T, rootNode !== element F (element is documentElement).
    const rootSelf = cascade(
      '<html id="root"><body></body></html>',
      'html { --x: lime; --y: var(--x); color: var(--y); }',
      '#root',
    );
    assert.equal(rootSelf.getPropertyValue('--x'), 'lime');
    assert.equal(rootSelf.getPropertyValue('--y'), 'lime');
    assert.equal(rootSelf.getPropertyValue('color'), 'rgb(0, 255, 0)');

    // parentCascaded F, rootNode F: no ownerDocument / no documentElement.
    const noOwner = duckStyle(
      duckT(undefined, { ownerDocument: undefined }),
      css,
    );
    assert.equal(noOwner.getPropertyValue('--y'), '');
    assert.equal(noOwner.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(noOwner.getPropertyValue('--z'), 'teal');

    const noDocEl = duckStyle(
      duckT({}),
      css,
    );
    assert.equal(noDocEl.getPropertyValue('--y'), '');
    assert.equal(noDocEl.getPropertyValue('color'), 'rgb(0, 0, 0)');

    // element === rootNode via duck documentElement pointing at self.
    const selfRoot: Duck = duckT(null, {
      tagName: 'HTML',
      localName: 'html',
      className: '',
      classList: { contains: () => false },
    });
    selfRoot.ownerDocument = { documentElement: selfRoot };
    const selfRootStyle = duckStyle(
      selfRoot,
      'html { --x: lime; --y: var(--x); color: var(--y); }',
    );
    assert.equal(selfRootStyle.getPropertyValue('--x'), 'lime');
    assert.equal(selfRootStyle.getPropertyValue('--y'), 'lime');
    assert.equal(selfRootStyle.getPropertyValue('color'), 'rgb(0, 255, 0)');
  });

  test('parentElement T vs parentNode element vs parentNode non-element', () => {
    const html = '<html><body><div class="p"><div class="t"></div></div></body></html>';
    const css = `
      html { --x: lime; }
      .p { --x: orange; writing-mode: vertical-rl; direction: rtl; }
      .t { --y: var(--x); color: var(--y); margin-inline-start: 10px; }
    `;
    const { document } = parseHTML(html);
    const parent = document.querySelector('.p');
    const child = document.querySelector('.t');
    assert.ok(parent);
    assert.ok(child);

    // parentElement T: second operand not evaluated (parentNode may differ).
    const viaParentEl = duckStyle(
      duckT(document, { parentElement: parent, parentNode: document.documentElement }),
      css,
    );
    assert.equal(viaParentEl.getPropertyValue('--y'), 'orange');
    assert.equal(viaParentEl.getPropertyValue('color'), 'rgb(255, 165, 0)');
    assert.equal(inlineStartSide(viaParentEl), 'bottom');

    // parentElement F, parentNode T, isElement T.
    const viaParentNode = duckStyle(
      duckT(document, { parentElement: null, parentNode: parent }),
      css,
    );
    assert.equal(viaParentNode.getPropertyValue('--y'), 'orange');
    assert.equal(inlineStartSide(viaParentNode), 'bottom');

    // parentElement F, parentNode T, isElement F (Document).
    const viaDocument = duckStyle(
      duckT(document, { parentElement: null, parentNode: document }),
      css,
    );
    assert.equal(viaDocument.getPropertyValue('--y'), 'lime');
    assert.equal(inlineStartSide(viaDocument), 'left');

    // parentElement F, parentNode F.
    const viaNeither = duckStyle(
      duckT(document, { parentElement: null, parentNode: null }),
      css,
    );
    assert.equal(viaNeither.getPropertyValue('--y'), 'lime');
    assert.equal(inlineStartSide(viaNeither), 'left');
  });
});

describe('MC/DC unique-cause: normalizePseudoElement via getCascadedStyle', { concurrency: false }, () => {
  // cssom-1 § 6.2 / WPT getComputedStyle-pseudo.html
  // css-pseudo-4 § 4 #treelike-pseudo / § 3.1 #legacy-alias
  test('third-arg typeof string, empty, ident-only, and startsWith colon unique-cause', () => {
    const originating = childBox(PSEUDO_SHEET);
    assert.equal(originating.getPropertyValue('width'), '100px');
    assert.equal(originating.getPropertyValue('z-index'), '7');
    assert.equal(originating.getPropertyValue('color'), 'rgb(0, 128, 0)');

    // typeof === 'string' F: null / omitted — originating element.
    const omitted = childBox(PSEUDO_SHEET, undefined);
    assert.equal(omitted.getPropertyValue('width'), '100px');
    assert.equal(omitted.getPropertyValue('z-index'), '7');
    const nulled = childBox(PSEUDO_SHEET, null);
    assert.equal(nulled.getPropertyValue('width'), '100px');
    assert.equal(nulled.getPropertyValue('z-index'), '7');

    // typeof T, !== '' F: empty string — originating.
    const empty = childBox(PSEUDO_SHEET, '');
    assert.equal(empty.getPropertyValue('width'), '100px');
    assert.equal(empty.getPropertyValue('z-index'), '7');

    // startsWith(':') F: ident-only is ignored (originating, including inline).
    const identOnly = childBox(PSEUDO_SHEET, 'before');
    assert.equal(identOnly.getPropertyValue('width'), '100px');
    assert.equal(identOnly.getPropertyValue('z-index'), '7');
    const firstLetterBare = childBox(PSEUDO_SHEET, 'first-letter');
    assert.equal(firstLetterBare.getPropertyValue('width'), '100px');

    // startsWith(':') T, valid known: skip inline (z-index empty).
    const before = childBox(PSEUDO_SHEET, '::before');
    assert.equal(before.getPropertyValue('width'), '50px');
    assert.equal(before.getPropertyValue('z-index'), '');
    assert.equal(before.getPropertyValue('content'), '"x"');
    // Known pseudo inherits from parentCascaded (.p), not from originating color.
    assert.equal(before.getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(before.getPropertyValue('--x'), 'orange');
  });

  test('single-colon L139 length / ident and legacy aliases vs non-alias', () => {
    // TTT + legacyAliases T: :before / :after / :first-letter / :first-line.
    assert.equal(childBox(PSEUDO_SHEET, ':before').getPropertyValue('width'), '50px');
    assert.equal(childBox(PSEUDO_SHEET, ':BEFORE').getPropertyValue('width'), '50px');
    assert.equal(childBox(PSEUDO_SHEET, ':after').getPropertyValue('width'), '40px');
    assert.equal(childBox(PSEUDO_SHEET, ':first-letter').getPropertyValue('width'), '30px');
    assert.equal(childBox(PSEUDO_SHEET, ':first-line').getPropertyValue('width'), '20px');

    // length === 2 F with isColon T and ident T: extra tokens.
    const extra = childBox(PSEUDO_SHEET, ':before extra');
    assert.equal(extra.getPropertyValue('width'), '');
    assert.equal(extra.length, 0);
    assert.equal(extra.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(childBox(PSEUDO_SHEET, ':before:').getPropertyValue('width'), '');

    // length === 2, ident F: :123 / :* / :not(x) / :.
    assert.equal(childBox(PSEUDO_SHEET, ':123').getPropertyValue('width'), '');
    assert.equal(childBox(PSEUDO_SHEET, ':*').getPropertyValue('width'), '');
    assert.equal(childBox(PSEUDO_SHEET, ':not(x)').getPropertyValue('width'), '');
    assert.equal(childBox(PSEUDO_SHEET, ':').getPropertyValue('width'), '');
    assert.equal(childBox(PSEUDO_SHEET, ': ').getPropertyValue('width'), '');

    // length 2 ident T, single in legacyAliases F (:hover, :marker, :placeholder).
    const hover = childBox(PSEUDO_SHEET, ':hover');
    assert.equal(hover.getPropertyValue('width'), '');
    assert.equal(hover.length, 0);
    assert.equal(childBox(PSEUDO_SHEET, ':marker').getPropertyValue('width'), '');
    assert.equal(childBox(PSEUDO_SHEET, ':placeholder').getPropertyValue('width'), '');
    assert.equal(childBox(PSEUDO_SHEET, ':file-selector-button').getPropertyValue('width'), '');
  });

  test('double-colon ident known vs unknown, length < 3, extra tokens, neither ident nor function', () => {
    assert.equal(childBox(PSEUDO_SHEET, '::before').getPropertyValue('width'), '50px');
    assert.equal(childBox(PSEUDO_SHEET, '::Before').getPropertyValue('width'), '50px');
    assert.equal(childBox(PSEUDO_SHEET, '::after').getPropertyValue('width'), '40px');
    assert.equal(childBox(PSEUDO_SHEET, '::first-letter').getPropertyValue('width'), '30px');
    assert.equal(childBox(PSEUDO_SHEET, '::first-line').getPropertyValue('width'), '20px');
    assert.equal(childBox(PSEUDO_SHEET, '::marker').getPropertyValue('width'), '11px');

    // Known ident with no matching rule still goes through cascade (parent inherit).
    const selection = childBox(PSEUDO_SHEET, '::selection');
    assert.equal(selection.getPropertyValue('width'), '');
    assert.equal(selection.getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(selection.getPropertyValue('--x'), 'orange');
    assert.notEqual(selection.length, 0);

    const knownEmpty = ['::backdrop', '::cue', '::placeholder', '::checkmark', '::picker-icon', '::grammar-error', '::spelling-error', '::target-text', '::view-transition', '::file-selector-button'];
    for (const p of knownEmpty) {
      const s = childBox(PSEUDO_SHEET, p);
      assert.equal(s.getPropertyValue('color'), 'rgb(0, 255, 0)', p);
      assert.equal(s.getPropertyValue('z-index'), '', p);
    }

    // valid T, isKnown F: empty computed style (no parent inherit).
    const unknown = childBox(PSEUDO_SHEET, '::not-real');
    assert.equal(unknown.getPropertyValue('width'), '');
    assert.equal(unknown.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(unknown.length, 0);
    assert.equal(childBox(PSEUDO_SHEET, '::hover').length, 0);
    assert.equal(childBox(PSEUDO_SHEET, '::highlight').length, 0);

    // length < 3: '::'
    assert.equal(childBox(PSEUDO_SHEET, '::').length, 0);
    // length !== 3 with ident: extra tokens.
    assert.equal(childBox(PSEUDO_SHEET, '::before extra').length, 0);
    assert.equal(childBox(PSEUDO_SHEET, '::before:').length, 0);
    assert.equal(childBox(PSEUDO_SHEET, '::after ').length, 0);

    // third.type ident F and function F: ':::' / ':: before'.
    assert.equal(childBox(PSEUDO_SHEET, ':::').length, 0);
    assert.equal(childBox(PSEUDO_SHEET, ':: before').length, 0);
  });

  test('functional pseudo known vs unknown, args, picker, whitespace, comment, unclosed', () => {
    // Known functional + ident arg.
    assert.equal(childBox(PSEUDO_SHEET, '::highlight(foo)').getPropertyValue('width'), '15px');
    assert.equal(childBox(PSEUDO_SHEET, '::highlight(FOO)').getPropertyValue('width'), '15px');
    assert.equal(childBox(PSEUDO_SHEET, '::picker(select)').getPropertyValue('width'), '14px');
    assert.equal(childBox(PSEUDO_SHEET, '::picker(SELECT)').getPropertyValue('width'), '14px');
    assert.equal(childBox(PSEUDO_SHEET, '::part(bar)').getPropertyValue('width'), '13px');

    // Unknown functional: valid T isKnown F → empty.
    const unknownFn = childBox(PSEUDO_SHEET, '::unknownfn(x)');
    assert.equal(unknownFn.length, 0);
    assert.equal(unknownFn.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(childBox(PSEUDO_SHEET, '::not(x)').length, 0);

    // Known functional with no matching rule still inherits.
    const slotted = childBox(PSEUDO_SHEET, '::slotted(foo)');
    assert.equal(slotted.getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(slotted.getPropertyValue('width'), '');
    assert.equal(childBox(PSEUDO_SHEET, '::view-transition-old(root)').getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(childBox(PSEUDO_SHEET, '::view-transition-group(root)').getPropertyValue('color'), 'rgb(0, 255, 0)');

    // hasCloseParen F vs T: unclosed still normalizes when the ident arg is present.
    assert.equal(childBox(PSEUDO_SHEET, '::highlight(foo').getPropertyValue('width'), '15px');
    assert.equal(childBox(PSEUDO_SHEET, '::part(bar').getPropertyValue('width'), '13px');

    // filter whitespace T vs comment T vs both F.
    assert.equal(childBox(PSEUDO_SHEET, '::highlight( foo )').getPropertyValue('width'), '15px');
    assert.equal(childBox(PSEUDO_SHEET, '::highlight(/*c*/foo)').getPropertyValue('width'), '15px');
    assert.equal(childBox(PSEUDO_SHEET, '::highlight( foo /*c*/ )').getPropertyValue('width'), '15px');
    assert.equal(childBox(PSEUDO_SHEET, '::part(/*c*/bar)').getPropertyValue('width'), '13px');

    // argTokens.length !== 1 T: empty / two idents / extra after close.
    assert.equal(childBox(PSEUDO_SHEET, '::highlight()').length, 0);
    assert.equal(childBox(PSEUDO_SHEET, '::highlight( )').length, 0);
    assert.equal(childBox(PSEUDO_SHEET, '::highlight(/*c*/)').length, 0);
    assert.equal(childBox(PSEUDO_SHEET, '::highlight(foo bar)').length, 0);
    assert.equal(childBox(PSEUDO_SHEET, '::highlight(foo, bar)').length, 0);
    assert.equal(childBox(PSEUDO_SHEET, '::highlight( foo ) extra').length, 0);
    assert.equal(childBox(PSEUDO_SHEET, '::picker()').length, 0);
    assert.equal(childBox(PSEUDO_SHEET, '::part()').length, 0);

    // length === 1, type !== ident: number / delim / string.
    assert.equal(childBox(PSEUDO_SHEET, '::highlight(1)').length, 0);
    assert.equal(childBox(PSEUDO_SHEET, '::highlight(*)').length, 0);
    assert.equal(childBox(PSEUDO_SHEET, '::highlight("foo")').length, 0);
    assert.equal(childBox(PSEUDO_SHEET, '::part(1)').length, 0);

    // fnName === 'picker' T, identVal !== 'select' T vs F; picker F via highlight.
    assert.equal(childBox(PSEUDO_SHEET, '::picker(foo)').length, 0);
    assert.equal(childBox(PSEUDO_SHEET, '::picker(select extra)').length, 0);
    assert.equal(childBox(PSEUDO_SHEET, '::highlight(select)').getPropertyValue('color'), 'rgb(0, 255, 0)');

    // Unclosed function with no ident arg: invalid.
    assert.equal(childBox(PSEUDO_SHEET, '::highlight(').length, 0);
  });
});

describe('MC/DC unique-cause: getCascadedStyle remaining parent / pseudo gates', { concurrency: false }, () => {
  test('!parsedPseudo.valid vs !isKnown vs valid known; non-object element', () => {
    // !valid T (single-colon non-alias) vs !isKnown T (unknown ::ident) vs both F.
    const invalid = childBox(PSEUDO_SHEET, ':hover');
    const unknown = childBox(PSEUDO_SHEET, '::not-real');
    const known = childBox(PSEUDO_SHEET, '::before');
    assert.equal(invalid.length, 0);
    assert.equal(unknown.length, 0);
    assert.equal(known.getPropertyValue('width'), '50px');
    assert.ok(known.length > 0);

    // !element / typeof !== 'object' (getCascadedStyle L163).
    const emptyNull = getCascadedStyle(null, parseStyleSheet('.t { width: 1px; }'));
    assert.ok(emptyNull instanceof CSSStyleDeclaration);
    assert.equal(emptyNull.getPropertyValue('width'), '');
    const emptyPrim = getCascadedStyle('div', parseStyleSheet('.t { width: 1px; }'));
    assert.equal(emptyPrim.getPropertyValue('width'), '');
  });
});
