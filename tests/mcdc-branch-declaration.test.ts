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
// Verifies: SYS-REQ-260821-8TGB, SW-REQ-260821-HNRG
import '../src/parser.ts';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { CSSStyleRule } from '../src/CSSOM.ts';

describe('MC/DC branch: CSSStyleDeclaration.setProperty', () => {
  test('readonly flag throws NoModificationAllowedError', () => {
    const style = new CSSStyleDeclaration([], true);
    assert.throws(() => style.setProperty('color', 'red'), { name: 'NoModificationAllowedError' });
  });

  test('dash-only custom name, unsupported property, and non-important priority are no-ops', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('color', 'blue');
    style.setProperty('--', 'red');
    style.setProperty('not-a-real-property', '1px');
    style.setProperty('color', 'green', 'nope');
    assert.equal(style.getPropertyValue('color'), 'blue');
    assert.equal(style.getPropertyValue('--'), '');
    assert.equal(style.getPropertyValue('not-a-real-property'), '');
    assert.equal(style.length, 1);
  });

  test('empty string and null values invoke removeProperty', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('color', 'red');
    style.setProperty('color', '');
    assert.equal(style.getPropertyValue('color'), '');
    style.setProperty('display', 'block');
    style.setProperty('display', null);
    assert.equal(style.getPropertyValue('display'), '');
  });

  test('custom property rejects invalid dashed ident, bad-string, bad-url, and unmatched closer', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('--foo bar', 'x');
    style.setProperty('--bad-str', '"oops\n');
    style.setProperty('--bad-url', 'url(http://x "y)');
    style.setProperty('--unmatched', 'foo ]');
    assert.equal(style.length, 0);
    style.setProperty('--ok', 'green');
    assert.equal(style.getPropertyValue('--ok'), 'green');
  });

  test('ASCII-insensitive important priority and existing-property update keep order unless all is later', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('color', 'red');
    style.setProperty('display', 'block');
    style.setProperty('color', 'blue', 'IMPORTANT');
    assert.equal(style.item(0), 'color');
    assert.equal(style.item(1), 'display');
    assert.equal(style.getPropertyValue('color'), 'blue');
    assert.equal(style.getPropertyPriority('color'), 'important');
  });

  test('updating a longhand that precedes a later all declaration moves it to the end', () => {
    const sheet = parse('.a { color: red !important; all: var(--x); }');
    const style = (sheet.cssRules[0] as CSSStyleRule).style;
    assert.deepEqual([...style], ['color', 'all']);
    style.setProperty('color', 'blue');
    assert.deepEqual([...style], ['all', 'color']);
    assert.equal(style.getPropertyValue('color'), 'blue');
  });

  test('shorthand expand, invalid shorthand no-op, and var()/env() store the shorthand', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('margin', '1px 2px');
    assert.equal(style.getPropertyValue('margin-top'), '1px');
    assert.equal(style.getPropertyValue('margin-right'), '2px');

    const before = style.cssText;
    style.setProperty('margin', 'not-a-margin');
    assert.equal(style.cssText, before);

    style.setProperty('margin', 'var(--m)');
    assert.equal(style.getPropertyValue('margin'), 'var(--m)');
    assert.equal(style.getPropertyValue('margin-top'), '');

    style.setProperty('padding', 'env(safe-area-inset-top)');
    assert.equal(style.getPropertyValue('padding').includes('env('), true);
  });

  test('setProperty notify=false skips _onChange; default notify fires it', () => {
    const style = new CSSStyleDeclaration();
    const calls: Array<boolean | undefined> = [];
    style._onChange = (force?: boolean) => {
      calls.push(force);
    };
    style.setProperty('color', 'red', '', false);
    assert.equal(style.getPropertyValue('color'), 'red');
    assert.equal(calls.length, 0);
    style.setProperty('color', 'blue');
    assert.equal(calls.length, 1);
    assert.equal(calls[0], undefined);
  });

  test('longhand validation failure is a no-op', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('width', '10px');
    style.setProperty('width', '-100');
    assert.equal(style.getPropertyValue('width'), '10px');
  });
});

describe('MC/DC branch: CSSStyleDeclaration.removeProperty', () => {
  test('readonly flag throws NoModificationAllowedError', () => {
    const style = new CSSStyleDeclaration([], true);
    assert.throws(() => style.removeProperty('color'), { name: 'NoModificationAllowedError' });
  });

  test('removeProperty("all") keeps direction, unicode-bidi, and custom properties', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('color', 'red');
    style.setProperty('direction', 'rtl');
    style.setProperty('unicode-bidi', 'isolate');
    style.setProperty('--keep', '1');
    const removed = style.removeProperty('all');
    assert.equal(removed, '');
    assert.equal(style.getPropertyValue('color'), '');
    assert.equal(style.getPropertyValue('direction'), 'rtl');
    assert.equal(style.getPropertyValue('unicode-bidi'), 'isolate');
    assert.equal(style.getPropertyValue('--keep'), '1');
  });

  test('removeProperty on a shorthand clears its longhands and returns the contracted value', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('margin', '1px');
    const removed = style.removeProperty('margin');
    assert.equal(removed.includes('1px'), true);
    assert.equal(style.getPropertyValue('margin-top'), '');
    assert.equal(style.getPropertyValue('margin'), '');
  });

  test('removeProperty on a missing name returns empty; empty custom value serializes as a space', () => {
    const style = new CSSStyleDeclaration();
    assert.equal(style.removeProperty('color'), '');
    style.setProperty('--x', ' ');
    assert.equal(style.removeProperty('--x'), ' ');
  });

  test('removeProperty notifies _onChange when a declaration is actually removed', () => {
    const style = new CSSStyleDeclaration();
    let calls = 0;
    style._onChange = () => {
      calls++;
    };
    style.setProperty('color', 'red');
    style.removeProperty('color');
    assert.equal(calls, 2);
    style.removeProperty('color');
    assert.equal(calls, 2);
  });
});

describe('MC/DC branch: CSSStyleDeclaration.cssText', () => {
  test('empty declarations serialize as empty string', () => {
    const style = new CSSStyleDeclaration();
    assert.equal(style.cssText, '');
  });

  test('readonly setter throws NoModificationAllowedError', () => {
    const style = new CSSStyleDeclaration([], true);
    assert.throws(() => {
      style.cssText = 'color: red';
    }, { name: 'NoModificationAllowedError' });
  });

  test('setter expands shorthands, drops unsupported names, skips --, and preserves custom case', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('display', 'block');
    style.cssText = 'color: red; unknown-prop: 1px; --: skip; margin: 2px; --Foo: Bar; font: italic 16px / 1.2 serif;';
    assert.equal(style.getPropertyValue('display'), '');
    assert.equal(style.getPropertyValue('color'), 'red');
    assert.equal(style.getPropertyValue('unknown-prop'), '');
    assert.equal(style.getPropertyValue('--'), '');
    assert.equal(style.getPropertyValue('margin-top'), '2px');
    assert.equal(style.getPropertyValue('--Foo'), 'Bar');
    assert.equal(style.getPropertyValue('font-size'), '16px');
    assert.equal(style.getPropertyValue('font-style'), 'italic');
  });

  test('setter stores var()/env() shorthands without expanding', () => {
    const style = new CSSStyleDeclaration();
    style.cssText = 'margin: var(--m); padding: env(safe-area-inset-top);';
    assert.equal(style.getPropertyValue('margin'), 'var(--m)');
    assert.equal(style.getPropertyValue('margin-top'), '');
    assert.equal(style.getPropertyValue('padding').includes('env('), true);
  });

  test('setter empty string clears and _onChange is invoked with force=true', () => {
    const style = new CSSStyleDeclaration();
    const forces: Array<boolean | undefined> = [];
    style._onChange = (force?: boolean) => {
      forces.push(force);
    };
    style.cssText = 'color: red;';
    assert.equal(style.getPropertyValue('color'), 'red');
    style.cssText = '';
    assert.equal(style.cssText, '');
    assert.equal(style.length, 0);
    assert.ok(forces.includes(true));
  });
});
