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
// Verifies: SW-REQ-260821-6D9T, SYS-REQ-260821-PJ76
// Leftover unique-cause for src/specificity.ts not already in
// tests/specificity.test.ts, tests/selectors-specificity-array.test.ts, or
// tests/phase96-conformance.test.ts.
// Drive calculateSpecificity / calculateSelectorListSpecificity /
// calculateComplexSelectorSpecificity / compareSpecificity and
// Parser.calculateSpecificity. selectors-4 § 17 #specificity,
// css-nesting-1 § 3 #nest-selector. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSpecificity,
  calculateSelectorListSpecificity,
  calculateComplexSelectorSpecificity,
  compareSpecificity,
  type Specificity,
} from '../src/specificity.ts';
import { Parser } from '../src/parser.ts';
import { SelectorParser } from '../src/SelectorParser.ts';
import { tokenize } from '../src/tokenizer.ts';
import type {
  Combinator,
  ComplexSelector,
  CompoundSelector,
  InvalidSelector,
  PseudoClassSelector,
  PseudoElementSelector,
  SelectorList,
  SimpleSelector,
} from '../src/types.ts';

function compound(...selectors: SimpleSelector[]): CompoundSelector {
  return { type: 'compound-selector', selectors };
}

function complex(...items: ComplexSelector['items']): ComplexSelector {
  return { type: 'complex-selector', items, tokens: [] };
}

function list(...selectors: (ComplexSelector | InvalidSelector)[]): SelectorList {
  return { type: 'selector-list', selectors };
}

function typeSel(name: string): SimpleSelector {
  return { type: 'type-selector', name };
}

function classSel(name: string): SimpleSelector {
  return { type: 'class-selector', name };
}

function comb(value: Combinator['value']): Combinator {
  return { type: 'combinator', value };
}

function invalid(): InvalidSelector {
  return { type: 'invalid-selector', tokens: [] };
}

function spec(sel: string | SelectorList, parent?: Specificity): Specificity[] {
  return calculateSpecificity(sel, parent);
}

function one(sel: string | SelectorList, parent?: Specificity): Specificity {
  const all = spec(sel, parent);
  assert.equal(all.length, 1, `expected one specificity for ${JSON.stringify(sel)}`);
  return all[0];
}

function parseForgiving(css: string): SelectorList {
  return new SelectorParser(new Parser(tokenize(css)).parseComponentValues(), {
    forgiving: true,
  }).parse();
}

function isWithRawArgument(argument: unknown): SelectorList {
  const pseudo: PseudoClassSelector = { type: 'pseudo-class-selector', name: 'is' };
  Object.assign(pseudo, { argument });
  return list(complex(compound(pseudo)));
}

function slottedWithRawArgument(argument: unknown): SelectorList {
  const pseudo: PseudoElementSelector = { type: 'pseudo-element-selector', name: 'slotted' };
  Object.assign(pseudo, { argument });
  return list(complex(compound(pseudo)));
}

describe('MC/DC leftover unique-cause: calculateSpecificity string vs list (selectors-4 § 17 #specificity)', { concurrency: false }, () => {
  test('typeof selector === string F via SelectorList / Parser.parseSelectorAST', () => {
    // Unique-cause: typeof selector === 'string' F (AST list, not tokenize/parse).
    const ast = Parser.parseSelectorAST('a, .b, #c');
    assert.ok(ast);
    assert.deepEqual(spec(ast), [[0, 0, 1], [0, 1, 0], [1, 0, 0]]);
    assert.deepEqual(Parser.calculateSpecificity(ast), [[0, 0, 1], [0, 1, 0], [1, 0, 0]]);

    const empty = list();
    assert.deepEqual(spec(empty), []);
    assert.deepEqual(calculateSelectorListSpecificity(empty), [0, 0, 0]);
  });

  test('invalid-selector unique-cause in map vs calculateComplexSelectorSpecificity', () => {
    // Unique-cause: complex.type === 'invalid-selector' T in calculateSpecificity map.
    const mixed = list(invalid(), complex(compound(typeSel('div'))), invalid());
    assert.deepEqual(spec(mixed), [[0, 0, 0], [0, 0, 1], [0, 0, 0]]);

    const onlyInvalid = list(invalid());
    assert.deepEqual(spec(onlyInvalid), [[0, 0, 0]]);

    const forgiving = parseForgiving('div, ###, .ok');
    assert.equal(forgiving.selectors[0].type, 'complex-selector');
    assert.equal(forgiving.selectors[1].type, 'invalid-selector');
    assert.equal(forgiving.selectors[2].type, 'complex-selector');
    assert.deepEqual(spec(forgiving), [[0, 0, 1], [0, 0, 0], [0, 1, 0]]);
  });
});

describe('MC/DC leftover unique-cause: calculateSelectorListSpecificity max (selectors-4 § 17 #specificity-of-a-selector-list)', { concurrency: false }, () => {
  test('invalid-selector unique-cause in reduce vs compareSpecificity > 0 F', () => {
    // Unique-cause: invalid-selector T in calculateSelectorListSpecificity (argument of :is).
    assert.deepEqual(one(':is(###)'), [0, 0, 0]);
    assert.deepEqual(one(':is(.foo, ###)'), [0, 1, 0]);
    assert.deepEqual(one(':is(###, .foo)'), [0, 1, 0]);
    assert.deepEqual(one(':is(###, ###)'), [0, 0, 0]);

    const crafted = list(
      invalid(),
      complex(compound(classSel('foo'))),
      invalid(),
    );
    assert.deepEqual(calculateSelectorListSpecificity(crafted), [0, 1, 0]);
  });

  test('compareSpecificity > 0 unique-cause keep vs replace vs equal', () => {
    // * vs ZERO: A/B/C all equal → > 0 F (keep ZERO).
    // .a vs ZERO: B differs → > 0 T.
    // .a vs .a: equal → > 0 F.
    // #b vs .a: A differs → > 0 T.
    // .c vs #b: A differs, current lower → > 0 F (keep ID).
    assert.deepEqual(one(':is(*, .a, .a, #b, .c)'), [1, 0, 0]);
    assert.deepEqual(one(':is(#b, .a, *)'), [1, 0, 0]);
    assert.deepEqual(one(':is(div, span, *)'), [0, 0, 1]);
    assert.deepEqual(one(':is(*, *)'), [0, 0, 0]);
    assert.deepEqual(one(':is()'), [0, 0, 0]);
  });
});

describe('MC/DC leftover unique-cause: compareSpecificity A then B then C (selectors-4 § 17 #specificity)', { concurrency: false }, () => {
  test('a[0] / a[1] / a[2] unique-cause of the three comparisons', () => {
    // Unique-cause: a[0] !== b[0] T, both signs.
    assert.equal(compareSpecificity([1, 0, 0], [0, 9, 9]) > 0, true);
    assert.equal(compareSpecificity([0, 9, 9], [1, 0, 0]) > 0, false);

    // Unique-cause: a[0] F, a[1] !== b[1] T, both signs.
    assert.equal(compareSpecificity([1, 2, 0], [1, 1, 9]) > 0, true);
    assert.equal(compareSpecificity([1, 1, 9], [1, 2, 0]) > 0, false);

    // Unique-cause: a[0] F, a[1] F, a[2] decides (positive / negative / zero).
    assert.equal(compareSpecificity([0, 0, 2], [0, 0, 1]), 1);
    assert.equal(compareSpecificity([0, 0, 1], [0, 0, 2]), -1);
    assert.equal(compareSpecificity([0, 1, 1], [0, 1, 1]), 0);
    assert.equal(compareSpecificity([2, 3, 4], [2, 3, 4]), 0);

    // Same three arms through :is() max (list reduce).
    assert.deepEqual(one(':is(.class, #id)'), [1, 0, 0]);
    assert.deepEqual(one(':is(div, .class)'), [0, 1, 0]);
    assert.deepEqual(one(':is(*, div, span)'), [0, 0, 1]);
  });
});

describe('MC/DC leftover unique-cause: combinator skip vs empty compound (selectors-4 § 17 #specificity)', { concurrency: false }, () => {
  test('item.type === compound-selector F for each combinator and empty items', () => {
    assert.deepEqual(one('div > span'), [0, 0, 2]);
    assert.deepEqual(one('div + span'), [0, 0, 2]);
    assert.deepEqual(one('div ~ span'), [0, 0, 2]);
    assert.deepEqual(one('div span'), [0, 0, 2]);
    assert.deepEqual(one('div || span'), [0, 0, 2]);

    // Unique-cause: only combinators → reduce never adds.
    assert.deepEqual(
      calculateComplexSelectorSpecificity(complex(comb('>'), comb('+'), comb('~'), comb('||'), comb(' '))),
      [0, 0, 0],
    );
    assert.deepEqual(calculateComplexSelectorSpecificity(complex()), [0, 0, 0]);
    assert.deepEqual(calculateComplexSelectorSpecificity(complex(compound())), [0, 0, 0]);
  });
});

describe('MC/DC leftover unique-cause: simple selector switch (selectors-4 § 17 #specificity)', { concurrency: false }, () => {
  test('each simple type unique-cause including default unknown', () => {
    assert.deepEqual(one('#id'), [1, 0, 0]);
    assert.deepEqual(one('.class'), [0, 1, 0]);
    assert.deepEqual(one('[attr]'), [0, 1, 0]);
    assert.deepEqual(one('div'), [0, 0, 1]);
    assert.deepEqual(one('::before'), [0, 0, 1]);
    assert.deepEqual(one('*'), [0, 0, 0]);
    assert.deepEqual(one('&'), [0, 0, 0]);
    assert.deepEqual(one(':hover'), [0, 1, 0]);
    assert.deepEqual(one('[attr].class#id::before'), [1, 2, 1]);

    const unknownCompound: CompoundSelector = { type: 'compound-selector', selectors: [] };
    Object.assign(unknownCompound, { selectors: [{ type: 'unknown-selector' }] });
    assert.deepEqual(calculateComplexSelectorSpecificity(complex(unknownCompound)), [0, 0, 0]);
    assert.deepEqual(spec(list(complex(unknownCompound))), [[0, 0, 0]]);
  });
});

describe('MC/DC leftover unique-cause: nesting parentSpecificity (css-nesting-1 § 3 #nest-selector)', { concurrency: false }, () => {
  test('parentSpecificity ?? ZERO unique-cause of nullish vs provided including [0,0,0]', () => {
    // Unique-cause: parentSpecificity nullish → ZERO. addSpecificity copies, so
    // a provided [0,0,0] is observationally equal after the add.
    assert.deepEqual(one('&'), [0, 0, 0]);
    assert.deepEqual(one('&', undefined), [0, 0, 0]);
    assert.deepEqual(one('&', [0, 0, 0]), [0, 0, 0]);

    const parent: Specificity = [2, 3, 4];
    assert.deepEqual(one('&', parent), [2, 3, 4]);
    assert.deepEqual(one('&.foo', parent), [2, 4, 4]);
    assert.deepEqual(one('&:hover', [1, 0, 0]), [1, 1, 0]);
  });

  test('parentSpecificity forwarded through :is/:not/:has/:nth-child/::slotted of &', () => {
    const parent: Specificity = [1, 0, 0];
    assert.deepEqual(one(':is(&)', parent), [1, 0, 0]);
    assert.deepEqual(one(':is(&, .foo)', parent), [1, 0, 0]);
    assert.deepEqual(one(':is(&, #id)', [0, 1, 0]), [1, 0, 0]);
    assert.deepEqual(one(':not(&)', parent), [1, 0, 0]);
    assert.deepEqual(one(':has(&)', parent), [1, 0, 0]);
    assert.deepEqual(one(':nth-child(n of &)', parent), [1, 1, 0]);
    assert.deepEqual(one('::slotted(&)', [0, 1, 0]), [0, 1, 1]);
    // Unique-cause: :where still ZERO even when parentSpecificity is present.
    assert.deepEqual(one(':where(&)', parent), [0, 0, 0]);
    assert.deepEqual(one(':where(&, #id.class)', parent), [0, 0, 0]);
  });
});

describe('MC/DC leftover unique-cause: getArgumentSpecificity AND (selectors-4 § 17 #specificity-of-logical-combination-pseudos)', { concurrency: false }, () => {
  test('argument / typeof object / type-in / selector-list unique-cause', () => {
    // All T: argument is a selector-list.
    assert.deepEqual(one(':is(div)'), [0, 0, 1]);
    assert.deepEqual(one('::slotted(div)'), [0, 0, 2]);

    // Unique-cause: argument F (undefined) while name still takes the argSpec path.
    assert.deepEqual(one(':host'), [0, 1, 0]);
    assert.deepEqual(one('::slotted'), [0, 0, 1]);

    // Unique-cause: typeof argument === 'object' T, 'type' in F (ComponentValue[]).
    assert.deepEqual(one(':nth-child(even)'), [0, 1, 0]);
    assert.deepEqual(one(':nth-last-child(odd)'), [0, 1, 0]);

    // Unique-cause: typeof argument === 'object' F (string / number / function).
    assert.deepEqual(one(isWithRawArgument('div')), [0, 0, 0]);
    assert.deepEqual(one(isWithRawArgument(1)), [0, 0, 0]);
    assert.deepEqual(one(isWithRawArgument(() => {})), [0, 0, 0]);

    // Unique-cause: object without 'type'.
    assert.deepEqual(one(isWithRawArgument({})), [0, 0, 0]);
    assert.deepEqual(one(isWithRawArgument(Object.create(null))), [0, 0, 0]);

    // Unique-cause: 'type' in T, type === 'selector-list' F.
    assert.deepEqual(one(isWithRawArgument({ type: 'function', name: 'is', value: [] })), [0, 0, 0]);
    assert.deepEqual(one(isWithRawArgument({ type: 'complex-selector', items: [], tokens: [] })), [0, 0, 0]);
    assert.deepEqual(one(slottedWithRawArgument({ type: 'function', name: 'slotted', value: [] })), [0, 0, 1]);
  });
});

describe('MC/DC leftover unique-cause: pseudo-class name folding (selectors-4 § 17 #specificity)', { concurrency: false }, () => {
  test('where vs is/not/has/matches unique-cause including ASCII case', () => {
    assert.deepEqual(one(':where(#id.class)'), [0, 0, 0]);
    assert.deepEqual(one(':WHERE(#id.class)'), [0, 0, 0]);
    assert.deepEqual(one(':Where(#id)'), [0, 0, 0]);

    assert.deepEqual(one(':is(#id, .class)'), [1, 0, 0]);
    assert.deepEqual(one(':IS(#id, .class)'), [1, 0, 0]);
    assert.deepEqual(one(':not(#id, .class)'), [1, 0, 0]);
    assert.deepEqual(one(':NOT(div)'), [0, 0, 1]);
    assert.deepEqual(one(':has(#id, .class)'), [1, 0, 0]);
    assert.deepEqual(one(':HAS(div)'), [0, 0, 1]);
    assert.deepEqual(one(':matches(#id, .class)'), [1, 0, 0]);
    assert.deepEqual(one(':MATCHES(div)'), [0, 0, 1]);
  });

  test('nth-child/nth-last-child/host/host-context unique-cause vs includes F', () => {
    // Unique-cause: nth-last-child T (existing specificity.test.ts names it but never calls it).
    assert.deepEqual(one(':nth-last-child(even)'), [0, 1, 0]);
    assert.deepEqual(one(':nth-last-child(even of li, .item)'), [0, 2, 0]);
    assert.deepEqual(one(':NTH-LAST-CHILD(2n of #id)'), [1, 1, 0]);

    assert.deepEqual(one(':nth-child(even of li, .item)'), [0, 2, 0]);
    assert.deepEqual(one(':NTH-CHILD(n of .item)'), [0, 2, 0]);
    assert.deepEqual(one(':host(.foo)'), [0, 2, 0]);
    assert.deepEqual(one(':HOST(div)'), [0, 1, 1]);
    assert.deepEqual(one(':host-context(#id)'), [1, 1, 0]);
    assert.deepEqual(one(':HOST-CONTEXT(.foo)'), [0, 2, 0]);

    // Unique-cause: includes F (not in the +1-B list; argument tokens are ignored).
    assert.deepEqual(one(':nth-of-type(even)'), [0, 1, 0]);
    assert.deepEqual(one(':nth-last-of-type(2n+1)'), [0, 1, 0]);
    assert.deepEqual(one(':lang(en)'), [0, 1, 0]);
    assert.deepEqual(one(':dir(ltr)'), [0, 1, 0]);
    assert.deepEqual(one(':hover'), [0, 1, 0]);
    assert.deepEqual(one(':checked'), [0, 1, 0]);
  });
});

describe('MC/DC leftover unique-cause: pseudo-element slotted (selectors-4 § 17 #specificity, css-scoping-1 #slotted-pseudo)', { concurrency: false }, () => {
  test('name === slotted T/F unique-cause including ::part and case fold', () => {
    assert.deepEqual(one('::slotted(*)'), [0, 0, 1]);
    assert.deepEqual(one('::slotted(.foo)'), [0, 1, 1]);
    assert.deepEqual(one('::SLOTTED(div)'), [0, 0, 2]);
    assert.deepEqual(one('::Slotted'), [0, 0, 1]);

    // Unique-cause: name === 'slotted' F (ordinary PE and functional ::part).
    assert.deepEqual(one('::before'), [0, 0, 1]);
    assert.deepEqual(one('::after'), [0, 0, 1]);
    assert.deepEqual(one('::first-line'), [0, 0, 1]);
    assert.deepEqual(one('::part(foo)'), [0, 0, 1]);
    assert.deepEqual(one('::file-selector-button'), [0, 0, 1]);
  });
});
