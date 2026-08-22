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
// Leftover unique-cause for src/cascade/rule-filter.ts collectStyleSheetsAndRules
// (latest hotspot: 16 incomplete decisions / 22 missing conditions).
// Drive only through getCascadedStyle (omit the rules argument so collection
// walks document / shadow sheets). css-cascade-5 § 2 #filtering,
// cssom-1 § 6.1 #the-cssstylesheet-interface / § 7.3 #the-document-or-shadow-root-interface.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { parseStyleSheet } from '../src/parser.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { CSSStyleSheet } from '../src/CSSOM.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import type { Rule } from '../src/types.ts';

function zSheet(n: number): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`.t { z-index: ${n}; }`);
  return sheet;
}

function duckSheet(css: string, hits: { n: number }): { cssRules: Rule[] } {
  const cssRules = parseStyleSheet(css);
  return {
    get cssRules() {
      hits.n++;
      return cssRules;
    },
  };
}

function host(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    nodeType: 1,
    tagName: 'DIV',
    localName: 'div',
    className: 't',
    isConnected: true,
    ...extra,
  };
}

function zIndex(element: unknown): string {
  const style = getCascadedStyle(element);
  assert.ok(style instanceof CSSStyleDeclaration);
  return style.getPropertyValue('z-index');
}

describe('MC/DC leftover unique-cause: collectStyleSheetsAndRules via getCascadedStyle', { concurrency: false }, () => {
  // css-cascade-5 § 2 #filtering — getCascadedStyle guards the same
  // !element || typeof !== "object" pair before calling collectStyleSheetsAndRules,
  // so the inner T rows stay behind that public-API gate.
  test('null/primitive unique-cause vs object; isConnected === false vs true/undefined', () => {
    const sheet = zSheet(3);
    const connected = host({
      getRootNode: () => ({ styleSheets: [sheet] }),
    });
    assert.equal(zIndex(connected), '3');

    const undefinedConnected = host({
      isConnected: undefined,
      getRootNode: () => ({ styleSheets: [sheet] }),
    });
    assert.equal(zIndex(undefinedConnected), '3');

    const disconnected = host({
      isConnected: false,
      getRootNode: () => ({ styleSheets: [sheet] }),
      style: { cssText: 'z-index: 9' },
    });
    assert.equal(zIndex(disconnected), '');

    const zeroConnected = host({
      isConnected: 0,
      getRootNode: () => ({ styleSheets: [sheet] }),
    });
    assert.equal(zIndex(zeroConnected), '3');

    assert.equal(zIndex(null), '');
    assert.equal(zIndex(undefined), '');
    assert.equal(zIndex('div'), '');
    assert.equal(zIndex(1), '');
    assert.equal(zIndex(true), '');
  });

  // cssom-1 § 6.1 — root from getRootNode vs ownerDocument vs Document nodeType 9
  test('getRootNode not a function: ownerDocument vs nodeType 9 vs neither', () => {
    const fromOwner = zSheet(4);
    const ownerHits = { n: 0 };
    const selfHits = { n: 0 };
    const ignoredHits = { n: 0 };

    assert.equal(
      zIndex(host({
        ownerDocument: { styleSheets: [fromOwner] },
      })),
      '4',
    );

    assert.equal(
      zIndex(host({
        getRootNode: null,
        ownerDocument: { styleSheets: [fromOwner] },
      })),
      '4',
    );

    const asDocument = {
      nodeType: 9,
      className: 't',
      isConnected: true,
      styleSheets: [duckSheet('.t { z-index: 5; }', selfHits)],
    };
    assert.equal(zIndex(asDocument), '');
    assert.ok(selfHits.n >= 1, 'nodeType 9 without getRootNode uses the object as root');

    const noRoot = host({
      styleSheets: [duckSheet('.t { z-index: 6; }', ignoredHits)],
    });
    assert.equal(zIndex(noRoot), '');
    assert.equal(ignoredHits.n, 0, 'element nodeType !== 9 does not treat itself as root');

    const ownerSpy = host({
      ownerDocument: { styleSheets: [duckSheet('.t { z-index: 7; }', ownerHits)] },
    });
    assert.equal(zIndex(ownerSpy), '7');
    assert.ok(ownerHits.n >= 1);
  });

  test('root null/primitive unique-cause vs object; ShadowRoot host isConnected', () => {
    const sheet = zSheet(8);

    assert.equal(zIndex(host({ getRootNode: () => null })), '');
    assert.equal(zIndex(host({ getRootNode: () => undefined })), '');
    assert.equal(zIndex(host({ getRootNode: () => 0 })), '');

    const primitiveRoot = host({
      getRootNode: () => 1,
      shadowRoot: { styleSheets: [sheet] },
    });
    assert.equal(zIndex(primitiveRoot), '8');

    const fnRoot = host({
      getRootNode: () => zIndex,
      shadowRoot: { styleSheets: [zSheet(2)] },
    });
    assert.equal(zIndex(fnRoot), '2');

    const disconnectedHost = host({
      getRootNode: () => ({
        host: { isConnected: false },
        styleSheets: [zSheet(11)],
      }),
      style: { cssText: 'z-index: 12' },
    });
    assert.equal(zIndex(disconnectedHost), '');

    const connectedHost = host({
      getRootNode: () => ({
        host: { isConnected: true },
        styleSheets: [zSheet(11)],
      }),
    });
    assert.equal(zIndex(connectedHost), '11');

    const hostConnectedUndef = host({
      getRootNode: () => ({
        host: {},
        styleSheets: [zSheet(11)],
      }),
    });
    assert.equal(zIndex(hostConnectedUndef), '11');

    const noHost = host({
      getRootNode: () => ({ styleSheets: [zSheet(11)] }),
    });
    assert.equal(zIndex(noHost), '11');
  });

  test('root styleSheets in/null/empty/populated unique-cause and querySelectorAll fallback', () => {
    const populated = zSheet(21);
    const viaTag = { textContent: '.t { z-index: 22; }' };

    assert.equal(
      zIndex(host({
        getRootNode: () => ({ styleSheets: [populated] }),
      })),
      '21',
    );

    assert.equal(
      zIndex(host({
        getRootNode: () => ({
          styleSheets: [],
          querySelectorAll: () => [viaTag],
        }),
      })),
      '22',
    );

    assert.equal(
      zIndex(host({
        getRootNode: () => ({
          styleSheets: null,
          querySelectorAll: () => [viaTag],
        }),
      })),
      '22',
    );

    assert.equal(
      zIndex(host({
        getRootNode: () => ({
          styleSheets: undefined,
          querySelectorAll: () => [viaTag],
        }),
      })),
      '22',
    );

    assert.equal(
      zIndex(host({
        getRootNode: () => ({
          querySelectorAll: () => [viaTag],
        }),
      })),
      '22',
    );

    assert.equal(
      zIndex(host({
        getRootNode: () => ({
          styleSheets: [populated, zSheet(23)],
        }),
      })),
      '23',
    );

    assert.equal(
      zIndex(host({
        getRootNode: () => ({
          styleSheets: [populated],
          querySelectorAll: () => [{ textContent: '.t { z-index: 99; }' }],
        }),
      })),
      '21',
    );
  });

  test('shadowRoot styleSheets in/null/empty unique-cause vs querySelectorAll', () => {
    const shadowSheet = zSheet(31);
    const tagSheet = zSheet(32);

    assert.equal(zIndex(host({})), '');

    assert.equal(
      zIndex(host({
        getRootNode: () => ({}),
        shadowRoot: { styleSheets: [shadowSheet] },
      })),
      '31',
    );

    assert.equal(
      zIndex(host({
        shadowRoot: { styleSheets: [shadowSheet, zSheet(33)] },
      })),
      '33',
    );

    assert.equal(
      zIndex(host({
        shadowRoot: {
          styleSheets: [],
          querySelectorAll: () => [{ sheet: tagSheet }],
        },
      })),
      '32',
    );

    assert.equal(
      zIndex(host({
        shadowRoot: {
          styleSheets: null,
          querySelectorAll: () => [{ sheet: tagSheet }],
        },
      })),
      '32',
    );

    assert.equal(
      zIndex(host({
        shadowRoot: {
          querySelectorAll: () => [{ sheet: tagSheet }],
        },
      })),
      '32',
    );

    assert.equal(
      zIndex(host({
        shadowRoot: {},
      })),
      '',
    );

    assert.equal(
      zIndex(host({
        shadowRoot: { querySelectorAll: 0 },
      })),
      '',
    );
  });

  test('shadowRoot style tags: sheet vs text vs empty; adoptedStyleSheets unique-cause', () => {
    const viaSheet = zSheet(41);
    const viaAdopted = zSheet(44);

    assert.equal(
      zIndex(host({
        shadowRoot: {
          querySelectorAll: () => [],
        },
      })),
      '',
    );

    assert.equal(
      zIndex(host({
        shadowRoot: {
          querySelectorAll: () => [
            { sheet: viaSheet, textContent: '.t { z-index: 98; }' },
          ],
        },
      })),
      '41',
    );

    assert.equal(
      zIndex(host({
        shadowRoot: {
          querySelectorAll: () => [
            { sheet: null, textContent: '.t { z-index: 42; }' },
            { textContent: '.t { z-index: 43; }' },
          ],
        },
      })),
      '43',
    );

    assert.equal(
      zIndex(host({
        shadowRoot: {
          querySelectorAll: () => [
            { sheet: undefined, textContent: '' },
            { sheet: 0, textContent: '   ' },
          ],
        },
      })),
      '',
    );

    assert.equal(
      zIndex(host({
        shadowRoot: {
          querySelectorAll: () => [{ sheet: null }],
        },
      })),
      '',
    );

    assert.equal(
      zIndex(host({
        shadowRoot: {
          styleSheets: [zSheet(40)],
          adoptedStyleSheets: [viaAdopted],
        },
      })),
      '44',
    );

    assert.equal(
      zIndex(host({
        shadowRoot: {
          adoptedStyleSheets: [viaAdopted, zSheet(45)],
        },
      })),
      '45',
    );

    assert.equal(
      zIndex(host({
        shadowRoot: { adoptedStyleSheets: [] },
      })),
      '',
    );

    assert.equal(
      zIndex(host({
        shadowRoot: { adoptedStyleSheets: null },
      })),
      '',
    );

    assert.equal(
      zIndex(host({
        shadowRoot: { adoptedStyleSheets: undefined },
      })),
      '',
    );
  });
});
