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
// Verifies: SYS-REQ-260821-03VA, SYS-REQ-260821-7521, SW-REQ-260821-YG9J,
// SW-REQ-260821-HHVE, SYS-REQ-260821-9YM3, SW-REQ-260821-ARC1,
// SYS-REQ-260821-H3BD, SW-REQ-260821-5W6X, SW-REQ-260821-9KNX,
// INT-REQ-260821-ZP03
// Public-API unique-cause legs for src/parser.ts decisions still hot after
// rounds 1-N:
//   - consumeNestedQualifiedRuleFromStream `stopToken && val.type === stopToken`
//     semicolon-stop leg via a `--`-prelude pseudo selector inside a style rule
//     (css-nesting-1 § 3 #nest-selector; css-syntax-3 § 5.5.6
//     #consume-remnants-of-a-bad-declaration).
//   - handleFontFeatureValuesRule `{`-block guard F leg via `[0]` junk block
//     (css-fonts-4 § 8 #cssfontfeaturevaluesrule-interface).
//   - handlePropertyRule prelude ident guard F leg and unknown-descriptor leg
//     (css-properties-values-api § 2.2 #the-property-rule).
//   - handleImportRule non-function prelude leg
//     (cssom-1 § 6.4.4 #dom-cssimportrule-href).
//   - handleNamespaceRule extractUri non-function / quoted-url legs
//     (cssom-1 § 6.5 #dom-cssnamespacerule-prefix).
//   - handleCustomMediaRule non-ident name leg
//     (mediaqueries-5 § 2.3 #custom-mq).
//   - assembleUnicodeRanges loop-exit leg via a single valid <urange>
//     (css-fonts-4 § 6.10 #unicode-range-desc).
// Drive parse / parseRuleListSync / CSSStyleDeclaration.cssText only.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.ts';
import { parseRuleListSync } from '../src/parser-api.ts';
import {
  CSSFontFeatureValuesRule,
  CSSImportRule,
  CSSNamespaceRule,
  CSSPropertyRule,
  CSSStyleRule,
} from '../src/CSSOM.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';

describe('MC/DC public unique-cause round 1: parser.ts at-rule arms', () => {
  test('semicolon stop-token leg: `--`-led junk inside a style rule stops at `;`', () => {
    // css-syntax-3 § 5.5.3: the pseudo qualified rule `-- : red` accumulates a
    // prelude until the stopToken (`;`) fires, dropping it but keeping the
    // following declaration on the host rule.
    const sheet = parse('.a { -- : red; color: blue; }');
    assert.equal(sheet.cssRules.length, 1);
    const host = sheet.cssRules[0];
    assert.ok(host instanceof CSSStyleRule);
    assert.equal(host.style.length, 1);
    assert.equal(host.style.getPropertyValue('color'), 'blue');
    assert.equal(host.cssRules.length, 0);
  });

  test('font-feature-values junk simple block without `{` associator is skipped', () => {
    // Unique-cause of associatedToken !== '{': `[0]` is a simple block whose
    // associator is `[`, so @swash never registers.
    const sheet = parse('@font-feature-values Fancy { @swash[0] { foo: 1; } }');
    const rule = sheet.cssRules[0];
    assert.ok(rule instanceof CSSFontFeatureValuesRule);
    assert.equal(rule.swash.size, 0);

    // Positive row for contrast: `{}` associator registers.
    const ok = parse('@font-feature-values Fancy { @swash { foo: 1; } }');
    const okRule = ok.cssRules[0] as CSSFontFeatureValuesRule;
    assert.deepEqual(okRule.swash.get('foo'), [1]);
  });

  test('@property prelude that does not start with an ident is dropped', () => {
    // Unique-cause of v.type === 'ident' F: dimension-led prelude → null.
    const dim = parse('@property 1px { syntax: "*"; inherits: false; }');
    assert.equal(dim.cssRules.length, 0);

    // Unique-cause of !value.startsWith('--') F: plain ident prelude → null.
    const plain = parse('@property foo { syntax: "*"; inherits: false; }');
    assert.equal(plain.cssRules.length, 0);

    // Positive rows: dashed-ident prelude survives.
    const ok = parse('@property --p { syntax: "*"; inherits: false; }');
    assert.equal(ok.cssRules.length, 1);
    assert.ok(ok.cssRules[0] instanceof CSSPropertyRule);
  });

  test('@property descriptor that is neither syntax/inherits/initial-value still parses', () => {
    // Unique-cause of descName === 'initial-value' F: an unrelated descriptor
    // reaches the last else-if arm and is ignored.
    const sheet = parse(
      '@property --p { syntax: "<length>"; inherits: false; initial-value: 0px; unknown-descriptor: bar; }',
    );
    assert.equal(sheet.cssRules.length, 1);
    const rule = sheet.cssRules[0];
    assert.ok(rule instanceof CSSPropertyRule);
    assert.equal((rule as CSSPropertyRule).initialValue, '0px');
  });

  test('@import whose prelude starts with a bare ident has empty href', () => {
    // Unique-cause of first.type === 'function' F: ident prelude skips both
    // string/url and url() arms; the remainder becomes the media part.
    const sheet = parse('@import print;');
    assert.equal(sheet.cssRules.length, 1);
    const rule = sheet.cssRules[0];
    assert.ok(rule instanceof CSSImportRule);
    assert.equal((rule as CSSImportRule).href, '');
    assert.equal((rule as CSSImportRule).media.mediaText, 'print');

    // Positive row: function named url sets href (pair witness for B).
    const fn = parse('@import url("a.css") screen;');
    const fnRule = fn.cssRules[0] as CSSImportRule;
    assert.equal(fnRule.href, 'a.css');
    assert.equal(fnRule.media.mediaText, 'screen');
  });

  test('@namespace URI extraction: bare ident yields empty URI, quoted url() wins', () => {
    // Unique-cause of token.type === 'function' F: ident component falls
    // through both string/url and url() arms → ''.
    const sheet = parse('@namespace svg screen;');
    const rule = sheet.cssRules[0];
    assert.ok(rule instanceof CSSNamespaceRule);
    assert.equal((rule as CSSNamespaceRule).prefix, 'svg');
    assert.equal((rule as CSSNamespaceRule).namespaceURI, '');

    // Quoted url(...) function: urlArg T row.
    const quoted = parse('@namespace url("http://example.com/ns")');
    const qRule = quoted.cssRules[0] as CSSNamespaceRule;
    assert.equal(qRule.prefix, '');
    assert.equal(qRule.namespaceURI, 'http://example.com/ns');
  });

  test('@custom-media with a non-ident name is dropped', () => {
    // Unique-cause of nameToken.type !== 'ident' T: string name → null rule.
    const bad = parse('@custom-media "notident" --small;');
    assert.equal(bad.cssRules.length, 0);

    // Positive row: ident + `--` prefix keeps the rule.
    const ok = parse('@custom-media --small (width > 100px);');
    assert.equal(ok.cssRules.length, 1);
  });

  test('single unicode-range value exits the assemble loop', () => {
    // Loop-exit leg: one valid range consumes every value, so the while
    // condition goes false and the assembled range is returned.
    const sheet = parse('@font-face { src: url(x.ttf); unicode-range: U+0-7F; }');
    const rule = sheet.cssRules[0] as CSSStyleRule & { style: CSSStyleDeclaration };
    assert.equal(rule.style.getPropertyValue('unicode-range'), 'U+0-7F');
  });
});

describe('MC/DC public unique-cause round 1: declaration-level arms', () => {
  test('declaration literally named `--` in style attribute text is rejected', () => {
    // cssom-1 § 6.7.1 #set-a-css-declaration + css-syntax-3 § 5.4.7:
    // `--` alone is not a <dashed-ident>; the declaration is dropped while
    // siblings survive.
    const style = new CSSStyleDeclaration();
    style.cssText = '-- : red; color: blue;';
    assert.equal(style.length, 1);
    assert.equal(style.item(0), 'color');
    assert.equal(style.getPropertyValue('--'), '');

    // Positive row: validateCustomPropertyValue T keeps real custom props.
    const ok = new CSSStyleDeclaration();
    ok.cssText = '--real: red; color: blue;';
    assert.equal(ok.getPropertyValue('--real'), 'red');
  });

  test('CDO/CDC inside a rule list never yield a rule (documented residue)', () => {
    // css-syntax-3 § 5.5.1: in a non-top-level rule list CDO/CDC enter
    // consume-rule where they pollute the qualified-rule prelude, so the
    // pushed-rule arm cannot fire publicly; top level discards them.
    const rules = parseRuleListSync('<!-- -->');
    assert.equal(rules.length, 0);
    // A trailing CDO/CDC pollutes the following rule's prelude, so `.b {}`
    // merges away instead of yielding a second qualified rule.
    const mixed = parseRuleListSync('.a { color: red; } <!-- --> .b { }');
    assert.equal(mixed.length, 1);
    assert.equal(mixed[0].constructor.name, 'CSSParserQualifiedRule');
  });
});
