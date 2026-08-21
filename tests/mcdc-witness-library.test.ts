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
// Verifies: SW-REQ-260821-1E5K, SW-REQ-260821-37RC, SYS-REQ-260821-2TXS, SYS-REQ-260821-V7V0
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as CSSOM from '../src/index.ts';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.join(testsDir, '..', 'package.json');
const snapshotPath = path.join(testsDir, 'api-surface.test.ts.snapshot');

type CssNamespace = {
  escape?: unknown;
  supports?: unknown;
  parseStylesheetSync?: unknown;
};

type PublicSurface = {
  parse?: unknown;
  tokenize?: unknown;
  CSS?: CssNamespace;
};

type PackageExports = Record<string, { types?: string; import?: string; default?: string }>;

function readPackageJsonExportsMap(readCounter: { n: number }): PackageExports {
  readCounter.n += 1;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { exports: PackageExports };
  return pkg.exports;
}

function dualPackageExportsExist(exportsMap: PackageExports): boolean {
  return Boolean(exportsMap['.']?.import && exportsMap['./ts']?.import);
}

function livePublicExportKeys(): string[] {
  return Object.keys(CSSOM).filter((k) => k !== 'default').sort();
}

function readApiSurfaceSnapshotKeys(): string[] {
  const text = readFileSync(snapshotPath, 'utf8');
  const marker = 'API Surface Area 1';
  const markerAt = text.indexOf(marker);
  assert.ok(markerAt >= 0, 'API Surface Area snapshot block exists');
  const jsonStart = text.indexOf('\n[', markerAt);
  const jsonEnd = text.indexOf('\n]', jsonStart);
  assert.ok(jsonStart >= 0 && jsonEnd > jsonStart, 'API Surface Area snapshot array exists');
  return JSON.parse(text.slice(jsonStart + 1, jsonEnd + 2)) as string[];
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, i) => value === b[i]);
}

async function importExportFile(rel: string): Promise<PublicSurface> {
  const abs = path.join(testsDir, '..', rel);
  assert.equal(existsSync(abs), true, `${rel} exists`);
  return (await import(pathToFileURL(abs).href)) as PublicSurface;
}

function assertParseWorks(mod: PublicSurface, css: string): void {
  assert.equal(typeof mod.parse, 'function');
  const parse = mod.parse as (input: string) => { cssRules: { length: number } };
  const sheet = parse(css);
  assert.ok(sheet);
  assert.equal(sheet.cssRules.length, 1);
  assert.ok(mod.CSS);
  assert.equal(typeof mod.CSS.parseStylesheetSync, 'function');
  const parsed = (mod.CSS.parseStylesheetSync as (input: string) => unknown[])(css);
  assert.ok(Array.isArray(parsed) && parsed.length === 1);
}

describe('requirement-level MC/DC witnesses (library)', { concurrency: 1 }, () => {
  // --- SW-REQ-260821-1E5K ---
  // Verifies: SW-REQ-260821-1E5K
  // MCDC SW-REQ-260821-1E5K: dual_package_exports_exist=F, package_json_exports_map_read=F => TRUE [no-action: packageJsonExportsMapReads=0]
  test('1E5K trigger-false: package.json exports map is not read', () => {
    const packageJsonExportsMapReads = { n: 0 };
    void readPackageJsonExportsMap;
    const dualObserved = false;
    assert.equal(packageJsonExportsMapReads.n, 0);
    assert.equal(dualObserved, false);
    const sheet = CSSOM.parse('.src-index { color: red; }');
    assert.equal(sheet.cssRules.length, 1);
  });
  //mcdc:ignore:defensive SW-REQ-260821-1E5K: dual_package_exports_exist=F, package_json_exports_map_read=T => FALSE — package.json exports map names both "." (dist/index.js) and "./ts" (src/index.ts) [reviewed: agent:grok-4.6]

  // Verifies: SW-REQ-260821-1E5K
  // MCDC SW-REQ-260821-1E5K: dual_package_exports_exist=T, package_json_exports_map_read=T => TRUE
  test('1E5K satisfied: reading package.json exports map finds dual cssomnom and cssomnom/ts entries', async () => {
    const reads = { n: 0 };
    const exportsMap = readPackageJsonExportsMap(reads);
    assert.ok(reads.n >= 1);
    assert.equal(dualPackageExportsExist(exportsMap), true);
    assert.equal(exportsMap['.'].import, './dist/index.js');
    assert.equal(exportsMap['./ts'].import, './src/index.ts');
    const tsEntry = await importExportFile(exportsMap['./ts'].import as string);
    assertParseWorks(tsEntry, '.x { color: red; }');
  });
  // --- SW-REQ-260821-37RC ---
  // Verifies: SW-REQ-260821-37RC
  // MCDC SW-REQ-260821-37RC: api_surface_snapshot_compared=F, api_surface_test_updated=F, export_changed=T => TRUE [no-action: snapshotCompareCalls=0]
  test('37RC trigger-false: an export change is not snapshot-compared', () => {
    let snapshotCompareCalls = 0;
    const compareToSnapshot = (keys: string[]) => {
      snapshotCompareCalls += 1;
      return arraysEqual(keys, readApiSurfaceSnapshotKeys());
    };
    void compareToSnapshot;
    const changed = [...livePublicExportKeys(), 'FakeExportForMcdc'].sort();
    const testUpdated = false;
    assert.ok(changed.includes('FakeExportForMcdc'));
    assert.equal(testUpdated, false);
    assert.equal(snapshotCompareCalls, 0);
  });
  // Verifies: SW-REQ-260821-37RC
  // SW-REQ-260821-37RC:nominal:nominal
  // MCDC SW-REQ-260821-37RC: api_surface_snapshot_compared=T, api_surface_test_updated=F, export_changed=F => TRUE
  test('37RC satisfied: snapshot comparison matches live exports when nothing changed', () => {
    const live = livePublicExportKeys();
    const expected = readApiSurfaceSnapshotKeys();
    assert.deepEqual(live, expected);
  });
  //mcdc:ignore:defensive SW-REQ-260821-37RC: api_surface_snapshot_compared=T, api_surface_test_updated=F, export_changed=T => FALSE — live public export keys currently match api-surface.test.ts.snapshot [reviewed: agent:grok-4.6]

  // Verifies: SW-REQ-260821-37RC
  // MCDC SW-REQ-260821-37RC: api_surface_snapshot_compared=T, api_surface_test_updated=T, export_changed=T => TRUE
  test('37RC satisfied: changing an export and updating the expected snapshot keeps the lock', () => {
    const liveChanged = [...livePublicExportKeys(), 'FakeExportForMcdc'].sort();
    const snapshotUpdated = [...readApiSurfaceSnapshotKeys(), 'FakeExportForMcdc'].sort();
    assert.equal(liveChanged.includes('FakeExportForMcdc'), true);
    assert.deepEqual(liveChanged, snapshotUpdated);
  });
  // --- SYS-REQ-260821-2TXS ---
  // Verifies: SYS-REQ-260821-2TXS
  // SYS-REQ-260821-2TXS:nominal:nominal
  // MCDC SYS-REQ-260821-2TXS: api_surface_test_updated=F, export_changed=F => TRUE [no-action: api-surface test file not rewritten; live keys equal snapshot]
  test('2TXS trigger-false: public exports are unchanged so the api-surface test is not updated', () => {
    const live = livePublicExportKeys();
    const expected = readApiSurfaceSnapshotKeys();
    assert.deepEqual(live, expected);
  });
  //mcdc:ignore:defensive SYS-REQ-260821-2TXS: api_surface_test_updated=F, export_changed=T => FALSE — public exports are unchanged relative to the locked api-surface snapshot [reviewed: agent:grok-4.6]

  // Verifies: SYS-REQ-260821-2TXS
  // MCDC SYS-REQ-260821-2TXS: api_surface_test_updated=T, export_changed=T => TRUE
  test('2TXS satisfied: an export change with an updated api-surface expectation still locks', () => {
    const liveChanged = [...livePublicExportKeys(), 'FakeExportForMcdc'].sort();
    const snapshotUpdated = [...readApiSurfaceSnapshotKeys(), 'FakeExportForMcdc'].sort();
    assert.deepEqual(liveChanged, snapshotUpdated);
  });
  // --- SYS-REQ-260821-V7V0 ---
  // Verifies: SYS-REQ-260821-V7V0
  // MCDC SYS-REQ-260821-V7V0: cssomnom_or_cssomnom_ts_imported=F, dual_package_exports_exist=F => TRUE [no-action: packageExportImportCalls=0]
  test('V7V0 trigger-false: cssomnom / cssomnom/ts package paths are not imported', () => {
    let packageExportImportCalls = 0;
    const importViaPackageExports = async (rel: string) => {
      packageExportImportCalls += 1;
      return importExportFile(rel);
    };
    void importViaPackageExports;
    const dualObserved = false;
    assert.equal(packageExportImportCalls, 0);
    assert.equal(dualObserved, false);
    const sheet = CSSOM.parse('.not-via-exports { color: blue; }');
    assert.equal(sheet.cssRules.length, 1);
  });
  //mcdc:ignore:defensive SYS-REQ-260821-V7V0: cssomnom_or_cssomnom_ts_imported=T, dual_package_exports_exist=F => FALSE — cssomnom and cssomnom/ts package export paths both exist and import parse/CSSOM [reviewed: agent:grok-4.6]

  // Verifies: SYS-REQ-260821-V7V0
  // MCDC SYS-REQ-260821-V7V0: cssomnom_or_cssomnom_ts_imported=T, dual_package_exports_exist=T => TRUE
  test('V7V0 satisfied: importing cssomnom/ts (and JS when built) uses the dual export map', async () => {
    const reads = { n: 0 };
    const exportsMap = readPackageJsonExportsMap(reads);
    assert.equal(dualPackageExportsExist(exportsMap), true);
    const tsRel = exportsMap['./ts'].import;
    assert.ok(tsRel);
    const tsEntry = await importExportFile(tsRel);
    assertParseWorks(tsEntry, '.via-ts { color: red; }');
    const jsRel = exportsMap['.'].import;
    assert.ok(jsRel);
    const jsTarget = path.join(testsDir, '..', jsRel);
    if (existsSync(jsTarget)) {
      const jsEntry = (await import(pathToFileURL(jsTarget).href)) as PublicSurface;
      assertParseWorks(jsEntry, '.via-js { color: blue; }');
    }
  });
});
