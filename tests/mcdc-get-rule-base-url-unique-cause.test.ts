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
// Leftover unique-cause for src/cascade/rule-filter.ts getRuleBaseURL
// (4/7 D, 4/10 C, incomplete 3) after
// tests/mcdc-rule-filter-still-hot-unique-cause.test.ts. Hottest remaining
// seams L290 element && typeof === "object", L295
// typeof globalThis.document !== "undefined" && document.baseURI, L296
// typeof globalThis.location !== "undefined" && location.href.
// Drive only public getCascadedStyle (omit rules so collection walks
// document style/link). css-cascade-5 § 2 #filtering, css-values-4 #urls,
// cssom-1 § 6.1 #the-cssstylesheet-interface / § 7.3
// #the-document-or-shadow-root-interface.
// No //mcdc:ignore.
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import '../src/parser.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';

const DROP = Symbol('drop');

function pv(element: unknown, prop: string): string {
  const style = getCascadedStyle(element);
  assert.ok(style instanceof CSSStyleDeclaration);
  return style.getPropertyValue(prop);
}

function target(html: string, selector = '.t'): Element {
  const { document } = parseHTML(html);
  const el = document.querySelector(selector);
  assert.ok(el, `missing ${selector}`);
  return el;
}

// Walk the same linkedom document sheets without an ownerDocument so L292/L293
// cannot steal globalThis.location (linkedom defaultView is Node's global).
function walker(el: Element): Record<string, unknown> {
  return {
    nodeType: 1,
    tagName: 'DIV',
    localName: 'div',
    className: 't',
    isConnected: true,
    getRootNode: () => el.getRootNode(),
  };
}

function withGlobals(
  documentValue: unknown,
  locationValue: unknown,
  run: () => void,
): void {
  const prevDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const prevLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  try {
    if (documentValue === DROP) {
      Reflect.deleteProperty(globalThis, 'document');
    } else {
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: documentValue,
      });
    }
    if (locationValue === DROP) {
      Reflect.deleteProperty(globalThis, 'location');
    } else {
      Object.defineProperty(globalThis, 'location', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: locationValue,
      });
    }
    run();
  } finally {
    if (prevDocument) Object.defineProperty(globalThis, 'document', prevDocument);
    else Reflect.deleteProperty(globalThis, 'document');
    if (prevLocation) Object.defineProperty(globalThis, 'location', prevLocation);
    else Reflect.deleteProperty(globalThis, 'location');
  }
}

const RELATIVE_HTML = `<html><head>
  <link rel="stylesheet" href="https://example.com/missing.css">
  <style></style>
  <style>   </style>
  <style>/* comment only */</style>
  <style>
    .t {
      background-image: url(a.png);
      cursor: url(b.png), pointer;
      list-style-image: url(data:image/gif;base64,xx);
    }
  </style>
</head><body><div class="t"></div></body></html>`;

describe('MC/DC leftover unique-cause: getRuleBaseURL via getCascadedStyle', { concurrency: false }, () => {
  after(() => {
    assert.equal(
      typeof (globalThis as { document?: unknown }).document,
      'undefined',
      'globalThis.document leaked',
    );
    assert.equal(
      typeof (globalThis as { location?: unknown }).location,
      'undefined',
      'globalThis.location leaked',
    );
  });

  // css-cascade-5 § 2 #filtering
  // getCascadedStyle L163 !element || typeof !== "object" is the same pair as
  // getRuleBaseURL L290, so F rows never enter getRuleBaseURL.
  test('L290 public-API element/object unique-cause vs document walk unresolved', () => {
    assert.equal(pv(null, 'background-image'), '', 'null: element F (typeof object T)');
    assert.equal(pv(undefined, 'background-image'), '');
    assert.equal(pv('div', 'background-image'), '', 'string: element T typeof object F');
    assert.equal(pv(1, 'background-image'), '');
    assert.equal(pv(true, 'background-image'), '');
    assert.equal(pv(false, 'background-image'), '');
    assert.equal(pv(() => undefined, 'background-image'), '', 'function typeof is not object');

    const el = target(RELATIVE_HTML);
    assert.equal(pv(el, 'background-image'), 'url("a.png")', 'L290 T,T with no sheet/global base');
    assert.equal(pv(el, 'cursor'), 'url("b.png"), pointer');
    assert.equal(pv(el, 'list-style-image'), 'url("data:image/gif;base64,xx")');
  });

  // css-values-4 #urls, cssom-1 § 7.3
  // L295 typeof document !== "undefined" && document.baseURI. linkedom <style>
  // rules have parentStyleSheet.href/_baseURL F; no <base> leaves ownerDocument
  // baseURI F so the global document fallback is reachable.
  test('L295 globalThis.document.baseURI unique-cause via linkedom style/link', () => {
    const el = target(RELATIVE_HTML);
    const linkedomDoc = el.ownerDocument;
    assert.ok(linkedomDoc);

    withGlobals({ baseURI: 'https://gdoc.example/dir/' }, DROP, () => {
      assert.equal(
        pv(el, 'background-image'),
        'url("https://gdoc.example/dir/a.png")',
        'L295 T,T',
      );
      assert.equal(pv(el, 'cursor'), 'url("https://gdoc.example/dir/b.png"), pointer');
      assert.equal(
        pv(el, 'list-style-image'),
        'url("data:image/gif;base64,xx")',
        'data: urls stay un-rewritten when a base is present',
      );
    });

    withGlobals(linkedomDoc, DROP, () => {
      assert.equal(
        pv(el, 'background-image'),
        'url("a.png")',
        'L295 T,F: linkedom document.baseURI is null',
      );
    });
    withGlobals({ baseURI: '' }, DROP, () => {
      assert.equal(pv(el, 'background-image'), 'url("a.png")', 'L295 T,F empty baseURI');
    });
    withGlobals({}, DROP, () => {
      assert.equal(pv(el, 'background-image'), 'url("a.png")', 'L295 T,F missing baseURI');
    });
    withGlobals(DROP, DROP, () => {
      assert.equal(pv(el, 'background-image'), 'url("a.png")', 'L295 A=F document undefined');
    });

    const withBase = target(`<html><head>
      <base href="https://style-base.example/dir/">
      <style>.t { background-image: url(b.png); }</style>
    </head><body><div class="t"></div></body></html>`);
    withGlobals({ baseURI: 'https://gdoc.example/dir/' }, DROP, () => {
      assert.equal(
        pv(withBase, 'background-image'),
        'url("https://style-base.example/dir/b.png")',
        'L292 ownerDocument.baseURI T unique-cause wins over a different L295 T',
      );
    });
  });

  // css-values-4 #urls
  // L296 typeof location !== "undefined" && location.href. Setting
  // globalThis.location on a live linkedom element fills
  // ownerDocument.defaultView.location (defaultView is Node global) so L293
  // returns first. Unique-cause L296 via a host that walks the same document
  // sheets without ownerDocument.
  test('L296 globalThis.location.href unique-cause vs L295 win', () => {
    const el = target(RELATIVE_HTML);
    const host = walker(el);

    withGlobals(DROP, { href: 'https://gloc.example/app/' }, () => {
      assert.equal(
        pv(host, 'background-image'),
        'url("https://gloc.example/app/a.png")',
        'L296 T,T',
      );
    });
    withGlobals(DROP, { href: '' }, () => {
      assert.equal(pv(host, 'background-image'), 'url("a.png")', 'L296 T,F empty href');
    });
    withGlobals(DROP, {}, () => {
      assert.equal(pv(host, 'background-image'), 'url("a.png")', 'L296 T,F missing href');
    });
    withGlobals(DROP, DROP, () => {
      assert.equal(pv(host, 'background-image'), 'url("a.png")', 'L296 A=F location undefined');
    });

    withGlobals(
      { baseURI: 'https://gdoc.example/dir/' },
      { href: 'https://gloc.example/app/' },
      () => {
        assert.equal(
          pv(host, 'background-image'),
          'url("https://gdoc.example/dir/a.png")',
          'L295 T,T unique-cause wins over L296 T,T',
        );
      },
    );
    withGlobals(
      { baseURI: '' },
      { href: 'https://gloc.example/app/' },
      () => {
        assert.equal(
          pv(host, 'background-image'),
          'url("https://gloc.example/app/a.png")',
          'L295 T,F then L296 T,T',
        );
      },
    );
    withGlobals(
      {},
      { href: 'https://gloc.example/app/' },
      () => {
        assert.equal(
          pv(host, 'background-image'),
          'url("https://gloc.example/app/a.png")',
          'L295 T missing-baseURI F then L296 T,T',
        );
      },
    );
  });

  // css-nesting-1 § 4.1 #the-cssnesteddeclarations-interface
  // Nested CSS makes linkedom style.sheet throw, then L174 parses textContent.
  // CSSNestedDeclarations (L562) and nested style rules (L392) both call
  // getRuleBaseURL; @layer is the same L174 throw path with a style rule.
  test('L295 via CSSNestedDeclarations / nested style / @layer document walk', () => {
    const nested = target(`<html><head><style>
      .t {
        background-image: url(outer.png);
        span { z-index: 1; }
        list-style-image: url(after.png);
        & { cursor: url(inner.png), pointer; }
      }
    </style></head><body><div class="t"><span></span></div></body></html>`);
    withGlobals({ baseURI: 'https://nest.example/css/' }, DROP, () => {
      assert.equal(
        pv(nested, 'background-image'),
        'url("https://nest.example/css/outer.png")',
        'nested style-rule L392',
      );
      assert.equal(
        pv(nested, 'list-style-image'),
        'url("https://nest.example/css/after.png")',
        'CSSNestedDeclarations L562',
      );
      assert.equal(pv(nested, 'cursor'), 'url("https://nest.example/css/inner.png"), pointer');
      assert.equal(pv(nested, 'z-index'), '');
    });
    withGlobals(DROP, DROP, () => {
      assert.equal(pv(nested, 'background-image'), 'url("outer.png")', 'L295 A=F leaves nested urls unresolved');
    });

    const layered = target(`<html><head>
      <style>@layer a { .t { background-image: url(layer.png); } }</style>
    </head><body><div class="t"></div></body></html>`);
    withGlobals({ baseURI: 'https://layer.example/' }, DROP, () => {
      assert.equal(
        pv(layered, 'background-image'),
        'url("https://layer.example/layer.png")',
        '@layer textContent parse unique-cause of L295 T,T',
      );
    });
    withGlobals(layered.ownerDocument, DROP, () => {
      assert.equal(
        pv(layered, 'background-image'),
        'url("layer.png")',
        'L295 T,F linkedom document on @layer walk',
      );
    });
  });
});
