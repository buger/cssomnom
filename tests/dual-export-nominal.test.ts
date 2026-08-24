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
// Verifies: SW-REQ-260821-1E5K, SYS-REQ-260821-V7V0, SYS-REQ-260821-RAAM
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.join(testsDir, '..', 'package.json');

type CssNamespace = {
  escape?: unknown;
  supports?: unknown;
  parseStylesheetSync?: unknown;
};

type PublicSurface = {
  parse?: unknown;
  tokenize?: unknown;
  CSS?: CssNamespace;
  CSSStyleSheet?: unknown;
  CSSStyleDeclaration?: unknown;
  CSSStyleRule?: unknown;
};

function assertParseAndCssom(mod: PublicSurface, label: string, css: string): void {
  assert.equal(typeof mod.parse, 'function', `${label} exports parse`);
  const parse = mod.parse as (input: string) => { cssRules: { length: number } };
  const sheet = parse(css);
  assert.ok(sheet, `${label} parse returns a stylesheet`);
  assert.equal(sheet.cssRules.length, 1, `${label} parse yields one rule`);

  assert.equal(typeof mod.tokenize, 'function', `${label} exports tokenize`);
  const tokenize = mod.tokenize as (input: string) => unknown[];
  const tokens = tokenize(css);
  assert.ok(Array.isArray(tokens) && tokens.length > 0, `${label} tokenize yields tokens`);

  assert.ok(mod.CSS, `${label} CSS is present`);
  // Verifies: SYS-REQ-260821-RAAM
  assert.equal(typeof mod.CSS.escape, 'function', `${label} CSS.escape`);
  const escape = mod.CSS.escape as (ident: unknown) => string;
  assert.equal(escape('.foo'), '\\.foo', `${label} CSS.escape serializes an identifier`);
  assert.equal(typeof mod.CSS.supports, 'function', `${label} CSS.supports`);
  const supports = mod.CSS.supports as (condition: string) => boolean;
  assert.equal(supports('(display: block)'), true, `${label} CSS.supports returns true for a known feature`);
  assert.equal(typeof mod.CSS.parseStylesheetSync, 'function', `${label} CSS.parseStylesheetSync`);
  const parseStylesheetSync = mod.CSS.parseStylesheetSync as (input: string) => unknown[];
  const parsed = parseStylesheetSync(css);
  assert.ok(Array.isArray(parsed) && parsed.length === 1, `${label} CSS.parseStylesheetSync yields one rule`);

  assert.equal(typeof mod.CSSStyleSheet, 'function', `${label} CSSStyleSheet`);
  assert.equal(typeof mod.CSSStyleDeclaration, 'function', `${label} CSSStyleDeclaration`);
  assert.equal(typeof mod.CSSStyleRule, 'function', `${label} CSSStyleRule`);
}

async function importExportFile(rel: string, label: string): Promise<PublicSurface> {
  const abs = path.join(testsDir, '..', rel);
  assert.equal(existsSync(abs), true, `${label} file ${rel} exists`);
  return await import(pathToFileURL(abs).href) as PublicSurface;
}

// SW-REQ-260821-1E5K:nominal:nominal
// SYS-REQ-260821-V7V0:nominal:nominal
// SYS-REQ-260821-RAAM:nominal:nominal
test('package.json exports map names dual JS and TS entries that expose parse and CSSOM', async () => {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
    name: string;
    exports: Record<string, { types?: string; import?: string; default?: string }>;
  };
  assert.equal(pkg.name, 'cssomnom');
  const exportsMap = pkg.exports;
  assert.equal(typeof exportsMap, 'object');
  assert.ok(exportsMap['.'], 'package.json exports["."] exists');
  assert.ok(exportsMap['./ts'], 'package.json exports["./ts"] exists');
  assert.equal(exportsMap['.'].import, './dist/index.js');
  assert.equal(exportsMap['.'].default, './dist/index.js');
  assert.equal(exportsMap['./ts'].import, './src/index.ts');
  assert.equal(exportsMap['./ts'].types, './src/index.ts');

  const tsRel = exportsMap['./ts'].import;
  assert.ok(tsRel);
  const tsEntry = await importExportFile(tsRel, 'exports["./ts"]');
  assertParseAndCssom(tsEntry, 'exports["./ts"] src/index.ts', '.x { color: red; }');

  const jsRel = exportsMap['.'].import;
  assert.ok(jsRel);
  const jsTarget = path.join(testsDir, '..', jsRel);
  if (existsSync(jsTarget)) {
    const jsEntry = await import(pathToFileURL(jsTarget).href) as PublicSurface;
    assertParseAndCssom(jsEntry, 'exports["."] dist/index.js', '.y { color: blue; }');
  }
});
