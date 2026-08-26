/**
 * @license
 * Copyright 2026 Google LLC *
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
// MC/DC witness tail: rows for SelectorParser.parseAnPlusB !t1 (selectors-4
// § 8.5 #the-anb-type) and StylePropertyMapReadOnly d.name.startsWith('--')
// (css-typed-om-1 § 3.2 #the-stylepropertymap) that record reliably when this
// suite runs scoped, duplicated here at the tail of the glob order so the
// full-suite trace merge retains them. See tests/mcdc-witness-final-media
// .test.ts and tests/mcdc-witness-final-cssom.test.ts for the primary
// witnesses of the same rows.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAnPlusB } from '../src/SelectorParser.ts';
import { StylePropertyMapReadOnly } from '../src/typed-om/style-map/StylePropertyMapReadOnly.ts';

describe('MC/DC witness tail: parseAnPlusB and style-map name rows', () => {
  // selectors-4 § 8.5: a lone "+" prefix leaves no t1 token after the offset.
  test('lone plus prefix leaves no An+B token (tail)', () => {
    assert.equal(parseAnPlusB([{ type: 'delim', value: '+' } as never]), null);
  });

  // css-typed-om-1 § 3.2: dashed-ident declaration names take the custom
  // property arm of the has()/getAll() normalization ternaries.
  test('declarations-backed map custom-property rows (tail)', () => {
    const declMap = new StylePropertyMapReadOnly([
      { type: 'declaration', name: '--tail-x', value: [{ type: 'ident', value: 'auto', sign: null }], important: false },
    ] as never);
    assert.equal(declMap.has('--tail-x'), true);
    assert.deepEqual(declMap.getAll('--tail-x').map(String), ['auto']);
    assert.equal(declMap.has('--tail-absent'), false);
  });
});
