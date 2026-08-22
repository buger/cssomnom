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
// Verifies: SYS-REQ-260821-HGFK, SYS-REQ-260821-Y6R3, SW-REQ-260821-7AKJ, SW-REQ-260821-E5D5, INT-REQ-260821-9SGA
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSSStyleValue,
  CSSKeywordValue,
  CSSUnparsedValue,
  CSSUnitValue,
  CSSPositionValue,
  CSSImageValue,
} from '../src/typed-om.ts';
import { CSSURLImageValue, CSSGradientImageValue } from '../src/typed-om/values/CSSImageValue.ts';

function parseAll(property: string, css: string): CSSStyleValue[] {
  return CSSStyleValue.parseAll(property, css);
}

describe('MC/DC leftover: CSSStyleValue.parseAll / _parseAll property families', () => {
  // css-typed-om-1 § 6.6 #parse-a-cssstylevalue / § 3.5 #imagevalue-objects
  test('images: url, gradient, none, image-set, list split, invalid', () => {
    const url = parseAll('background-image', 'url(a.png)');
    assert.equal(url.length, 1);
    assert.ok(url[0] instanceof CSSURLImageValue);
    assert.ok(url[0] instanceof CSSImageValue);
    assert.equal(url[0].toString().includes('a.png'), true);

    const none = parseAll('background-image', 'none');
    assert.ok(none[0] instanceof CSSKeywordValue);
    assert.equal((none[0] as CSSKeywordValue).value, 'none');

    const linear = parseAll('background-image', 'linear-gradient(red, blue)');
    assert.ok(linear[0] instanceof CSSGradientImageValue);
    assert.equal(linear[0].toString().includes('linear-gradient'), true);

    const radial = parseAll('background-image', 'radial-gradient(circle, red, blue)');
    assert.ok(radial[0] instanceof CSSGradientImageValue);

    const conic = parseAll('background-image', 'conic-gradient(red, blue)');
    assert.ok(conic[0] instanceof CSSGradientImageValue);

    const repeating = parseAll('background-image', 'repeating-linear-gradient(red, blue)');
    assert.ok(repeating[0] instanceof CSSGradientImageValue);

    const mixed = parseAll('background-image', 'url(a.png), linear-gradient(red, blue)');
    assert.equal(mixed.length, 2);
    assert.ok(mixed[0] instanceof CSSURLImageValue);
    assert.ok(mixed[1] instanceof CSSGradientImageValue);

    const imageSet = parseAll('background-image', 'image-set(url(a.png) 1x)');
    assert.equal(imageSet[0].constructor, CSSStyleValue);
    assert.equal(imageSet[0].toString().includes('image-set'), true);

    const trailing = parseAll('background-image', 'url(a.png),');
    assert.equal(trailing.length, 1);
    assert.ok(trailing[0] instanceof CSSURLImageValue);

    assert.throws(() => parseAll('background-image', 'not-an-image'), TypeError);
    assert.throws(() => parseAll('background-image', ','), TypeError);

    const listStyle = parseAll('list-style-image', 'url(bullet.png)');
    assert.ok(listStyle[0] instanceof CSSURLImageValue);
    assert.ok(parseAll('list-style-image', 'none')[0] instanceof CSSKeywordValue);
    const listGrad = parseAll('list-style-image', 'linear-gradient(red, blue)');
    assert.ok(listGrad[0] instanceof CSSGradientImageValue);

    const borderSrc = parseAll('border-image-source', 'url(frame.png)');
    assert.ok(borderSrc[0] instanceof CSSURLImageValue);
    assert.ok(parseAll('border-image-source', 'none')[0] instanceof CSSKeywordValue);
    const borderGrad = parseAll('border-image-source', 'linear-gradient(red, blue)');
    assert.ok(borderGrad[0] instanceof CSSGradientImageValue);

    const maskUrl = parseAll('mask-image', 'url(m.png)');
    assert.ok(maskUrl[0] instanceof CSSURLImageValue);
    assert.ok(parseAll('mask-image', 'none')[0] instanceof CSSKeywordValue);
    const maskGrad = parseAll('mask-image', 'linear-gradient(black, transparent)');
    assert.ok(maskGrad[0] instanceof CSSGradientImageValue);
    // mask-image is not LIST_PROPERTIES: commas stay one value and fail syntax.
    assert.throws(() => parseAll('mask-image', 'none, url(m.png)'), TypeError);

    const first = CSSStyleValue.parse('background-image', 'url(a.png), none');
    assert.ok(first instanceof CSSURLImageValue);

    const mixedCase = parseAll('Background-Image', 'none');
    assert.ok(mixedCase[0] instanceof CSSKeywordValue);
  });

  // css-backgrounds-3 #propdef-box-shadow / css-text-decor-4 #text-shadow-property
  test('shadows: box-shadow shorthand vs list split; text-shadow syntax vs comma list', () => {
    const none = parseAll('box-shadow', 'none');
    assert.equal(none.length, 1);
    assert.equal(none[0].constructor, CSSStyleValue);
    assert.equal(none[0].toString(), 'none');

    const one = parseAll('box-shadow', '1px 2px 3px red');
    assert.equal(one[0].constructor, CSSStyleValue);
    assert.equal(one[0].toString().includes('1px'), true);

    const inset = parseAll('box-shadow', 'inset 1px 2px 3px 4px red');
    assert.equal(inset[0].constructor, CSSStyleValue);
    assert.equal(inset[0].toString().includes('inset'), true);

    const layers = parseAll('box-shadow', '1px 2px red, 3px 4px blue');
    assert.equal(layers.length, 2);
    assert.equal(layers[0].constructor, CSSStyleValue);
    assert.equal(layers[1].constructor, CSSStyleValue);

    const mixedNone = parseAll('box-shadow', '1px 2px, none');
    assert.equal(mixedNone.length, 2);
    assert.equal(mixedNone[0].constructor, CSSStyleValue);
    assert.ok(mixedNone[1] instanceof CSSKeywordValue);

    // SHORTHANDS_DATA path accepts tokens that the generated longhand syntax would reject.
    const junk = parseAll('box-shadow', 'not-a-shadow');
    assert.equal(junk[0].constructor, CSSStyleValue);
    assert.throws(() => parseAll('box-shadow', ','), TypeError);

    const textNone = parseAll('text-shadow', 'none');
    assert.ok(textNone[0] instanceof CSSKeywordValue);
    const textLen = parseAll('text-shadow', '1px');
    assert.ok(textLen[0] instanceof CSSUnitValue);
    const textColor = parseAll('text-shadow', 'red');
    assert.ok(textColor[0] instanceof CSSKeywordValue);
    const textInset = parseAll('text-shadow', 'inset');
    assert.ok(textInset[0] instanceof CSSKeywordValue);

    // No comma: syntax is a single-token union, so a full shadow list TypeErrors.
    assert.throws(() => parseAll('text-shadow', '1px 1px 2px black'), TypeError);
    assert.throws(() => parseAll('text-shadow', 'not-a-shadow'), TypeError);

    // LIST_PROPERTIES comma split returns before syntax, so multi-token items parse.
    const textList = parseAll('text-shadow', '1px 1px red, 2px 2px blue');
    assert.equal(textList.length, 2);
    assert.equal(textList[0].constructor, CSSStyleValue);
    const trailing = parseAll('text-shadow', '1px,');
    assert.equal(trailing.length, 1);
    assert.ok(trailing[0] instanceof CSSUnitValue);

    assert.equal(CSSStyleValue.parse('box-shadow', '1px 2px red, 3px 4px blue').toString().includes('1px'), true);

    const mixedCase = parseAll('Box-Shadow', 'none');
    assert.equal(mixedCase[0].constructor, CSSStyleValue);
  });

  // filter-effects-1 #FilterProperty / #BackdropFilterProperty
  test('filters remaining: drop-shadow, url, multi, var, NONE, will-change leftover', () => {
    const drop = parseAll('filter', 'drop-shadow(1px 1px 1px black)');
    assert.equal(drop[0].constructor, CSSStyleValue);
    assert.equal(drop[0].toString().includes('drop-shadow'), true);

    const url = parseAll('filter', 'url(filters.svg#f)');
    assert.equal(url[0].constructor, CSSStyleValue);
    assert.equal(url[0].toString().includes('url('), true);

    const multi = parseAll('filter', 'blur(2px) brightness(1.2)');
    assert.equal(multi[0].constructor, CSSStyleValue);
    assert.equal(multi[0].toString().includes('blur'), true);

    const gray = parseAll('filter', 'grayscale(1)');
    assert.equal(gray[0].constructor, CSSStyleValue);

    // shouldFallbackToCSSStyleValue skips var(); hasVarFunction reifies unparsed.
    const filterVar = parseAll('filter', 'var(--f)');
    assert.ok(filterVar[0] instanceof CSSUnparsedValue);

    // NONE lowercases to none so fallback is false; generated syntax is case-sensitive.
    assert.throws(() => parseAll('filter', 'NONE'), TypeError);

    const noneNone = parseAll('filter', 'none none');
    assert.equal(noneNone[0].constructor, CSSStyleValue);

    const commaFilters = parseAll('filter', 'blur(2px), blur(1px)');
    assert.equal(commaFilters.length, 1);
    assert.equal(commaFilters[0].constructor, CSSStyleValue);

    const backdropUrl = parseAll('backdrop-filter', 'url(f.svg#x)');
    assert.equal(backdropUrl[0].constructor, CSSStyleValue);
    const backdropOp = parseAll('backdrop-filter', 'opacity(0.5)');
    assert.equal(backdropOp[0].constructor, CSSStyleValue);
    assert.ok(parseAll('backdrop-filter', 'var(--bf)')[0] instanceof CSSUnparsedValue);

    assert.ok(parseAll('filter', 'inherit')[0] instanceof CSSKeywordValue);
    assert.equal(CSSStyleValue.parse('filter', 'drop-shadow(1px 1px 1px black)').constructor, CSSStyleValue);

    const willScroll = parseAll('will-change', 'scroll-position');
    assert.equal(willScroll[0].constructor, CSSStyleValue);
    const willList = parseAll('will-change', 'transform, opacity');
    assert.equal(willList[0].constructor, CSSStyleValue);

    const mixedCase = parseAll('Filter', 'blur(1px)');
    assert.equal(mixedCase[0].constructor, CSSStyleValue);
  });

  // css-grid-1 #explicit-grid-properties / #grid-shorthand
  test('grid shorthand, tracks, areas, placement, and generated-syntax misses', () => {
    const none = parseAll('grid', 'none');
    assert.equal(none[0].constructor, CSSStyleValue);
    assert.equal(none[0].toString(), 'none');

    const flow = parseAll('grid', 'auto-flow / 1fr 1fr');
    assert.equal(flow[0].constructor, CSSStyleValue);
    assert.equal(flow[0].toString().includes('auto-flow'), true);

    // SHORTHANDS_DATA (not SHORTHANDS): invalid tokens still reify as CSSStyleValue.
    const junk = parseAll('grid', 'not-a-grid');
    assert.equal(junk[0].constructor, CSSStyleValue);

    assert.ok(parseAll('grid-template-areas', 'none')[0] instanceof CSSKeywordValue);
    assert.throws(() => parseAll('grid-template-areas', '"a b" "c d"'), TypeError);

    assert.ok(parseAll('grid-template-columns', 'none')[0] instanceof CSSKeywordValue);
    const fr = parseAll('grid-template-columns', '1fr');
    assert.ok(fr[0] instanceof CSSUnitValue);
    assert.equal((fr[0] as CSSUnitValue).unit, 'fr');
    const px = parseAll('grid-template-columns', '100px');
    assert.ok(px[0] instanceof CSSUnitValue);
    const pct = parseAll('grid-template-columns', '50%');
    assert.ok(pct[0] instanceof CSSUnitValue);
    assert.ok(parseAll('grid-template-columns', 'subgrid')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('grid-template-columns', 'red')[0] instanceof CSSKeywordValue);
    assert.throws(() => parseAll('grid-template-columns', '1fr 2fr'), TypeError);
    assert.throws(() => parseAll('grid-template-columns', 'repeat(2, 1fr)'), TypeError);
    assert.throws(() => parseAll('grid-template-columns', 'minmax(10px, 1fr)'), TypeError);

    assert.ok(parseAll('grid-template-rows', 'auto')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('grid-auto-flow', 'row')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('grid-auto-flow', 'dense')[0] instanceof CSSKeywordValue);
    const autoCol = parseAll('grid-auto-columns', '1fr');
    assert.ok(autoCol[0] instanceof CSSUnitValue);
    assert.ok(parseAll('grid-auto-rows', 'min-content')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('grid-auto-rows', 'max-content')[0] instanceof CSSKeywordValue);

    const area = parseAll('grid-area', '1 / 2 / 3 / 4');
    assert.equal(area[0].constructor, CSSStyleValue);
    const column = parseAll('grid-column', '1 / span 2');
    assert.equal(column[0].constructor, CSSStyleValue);
    const rowStart = parseAll('grid-row-start', '2');
    assert.ok(rowStart[0] instanceof CSSUnitValue);
    assert.ok(parseAll('grid-column-start', 'auto')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('grid-row-end', 'span')[0] instanceof CSSKeywordValue);

    const template = parseAll('grid-template', 'none');
    assert.equal(template[0].constructor, CSSStyleValue);
    const templateAreas = parseAll('grid-template', '"a" 1fr / auto');
    assert.equal(templateAreas[0].constructor, CSSStyleValue);

    assert.ok(parseAll('grid', 'var(--g)')[0] instanceof CSSUnparsedValue);
    assert.equal(CSSStyleValue.parse('grid', 'none').constructor, CSSStyleValue);

    const mixedCase = parseAll('Grid-Template-Columns', '1fr');
    assert.ok(mixedCase[0] instanceof CSSUnitValue);
  });

  // css-transitions-1 #transition-shorthand-property
  test('transition shorthand and remaining longhands', () => {
    const one = parseAll('transition', 'margin 1s');
    assert.equal(one.length, 1);
    assert.equal(one[0].constructor, CSSStyleValue);
    assert.equal(one[0].toString(), 'margin 1s');

    const list = parseAll('transition', 'margin 1s, color 2s');
    assert.equal(list.length, 2);
    assert.equal(list[0].toString(), 'margin 1s');
    assert.equal(list[1].toString(), 'color 2s');

    const none = parseAll('transition', 'none');
    assert.equal(none[0].constructor, CSSStyleValue);
    const noneThen = parseAll('transition', 'none, margin 1s');
    assert.equal(noneThen.length, 2);
    assert.ok(noneThen[0] instanceof CSSKeywordValue);
    assert.equal(noneThen[1].constructor, CSSStyleValue);

    const props = parseAll('transition-property', 'opacity, transform');
    assert.equal(props.length, 2);
    assert.ok(props[0] instanceof CSSKeywordValue);
    assert.ok(props[1] instanceof CSSKeywordValue);
    assert.ok(parseAll('transition-property', 'all')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('transition-property', 'none')[0] instanceof CSSKeywordValue);

    const ease = parseAll('transition-timing-function', 'ease-in, linear');
    assert.equal(ease.length, 2);
    assert.ok(ease.every((v) => v instanceof CSSKeywordValue));
    assert.ok(parseAll('transition-timing-function', 'ease-out')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('transition-timing-function', 'step-start')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('transition-timing-function', 'step-end')[0] instanceof CSSKeywordValue);
    assert.throws(
      () => parseAll('transition-timing-function', 'cubic-bezier(0.1, 0.2, 0.3, 0.4)'),
      TypeError,
    );

    const delays = parseAll('transition-delay', '1s, 2s');
    assert.equal(delays.length, 2);
    assert.ok(delays[0] instanceof CSSUnitValue);
    assert.ok(delays[1] instanceof CSSUnitValue);

    const extra = parseAll('transition', '1s 2s 3s 4s 5s');
    assert.equal(extra[0].constructor, CSSStyleValue);

    assert.equal(CSSStyleValue.parse('transition', 'margin 1s, color 2s').toString(), 'margin 1s');
  });

  // css-animations-1 #animation
  test('animation shorthand and remaining longhands', () => {
    const one = parseAll('animation', 'spin 1s linear');
    assert.equal(one.length, 1);
    assert.equal(one[0].constructor, CSSStyleValue);
    assert.equal(one[0].toString(), 'spin 1s linear');

    const list = parseAll('animation', 'spin 1s, fade 2s');
    assert.equal(list.length, 2);
    assert.equal(list[0].toString(), 'spin 1s');
    assert.equal(list[1].toString(), 'fade 2s');

    const none = parseAll('animation', 'none');
    assert.equal(none[0].constructor, CSSStyleValue);
    assert.ok(parseAll('animation-name', 'none')[0] instanceof CSSKeywordValue);

    const durs = parseAll('animation-duration', '1s, 2s');
    assert.equal(durs.length, 2);
    assert.ok(durs[0] instanceof CSSUnitValue);

    const timing = parseAll('animation-timing-function', 'ease, steps(4)');
    assert.equal(timing.length, 2);
    assert.ok(timing[0] instanceof CSSKeywordValue);
    assert.equal(timing[1].constructor, CSSStyleValue);
    assert.throws(
      () => parseAll('animation-timing-function', 'cubic-bezier(0.1, 0.7, 1.0, 0.1)'),
      TypeError,
    );

    const delays = parseAll('animation-delay', '0s, 100ms');
    assert.equal(delays.length, 2);
    assert.ok(delays[0] instanceof CSSUnitValue);
    assert.ok(delays[1] instanceof CSSUnitValue);

    const counts = parseAll('animation-iteration-count', '1, infinite');
    assert.equal(counts.length, 2);
    assert.ok(counts[0] instanceof CSSUnitValue);
    assert.ok(counts[1] instanceof CSSKeywordValue);
    assert.ok(parseAll('animation-iteration-count', 'infinite')[0] instanceof CSSKeywordValue);

    const dirs = parseAll('animation-direction', 'normal, reverse');
    assert.equal(dirs.length, 2);
    assert.ok(parseAll('animation-direction', 'alternate-reverse')[0] instanceof CSSKeywordValue);

    const fills = parseAll('animation-fill-mode', 'forwards, both');
    assert.equal(fills.length, 2);
    const play = parseAll('animation-play-state', 'running, paused');
    assert.equal(play.length, 2);

    const extra = parseAll('animation', '1s 2s 3s 4s 5s 6s 7s 8s 9s extra');
    assert.equal(extra[0].constructor, CSSStyleValue);

    assert.equal(CSSStyleValue.parse('animation', 'spin 1s, fade 2s').toString(), 'spin 1s');
    assert.ok(parseAll('animation', 'var(--a)')[0] instanceof CSSUnparsedValue);
  });

  // css-content-3 #content-property
  test('content: keywords, string, url, counter, attr, invalid', () => {
    for (const kw of ['none', 'normal', 'open-quote', 'close-quote', 'no-open-quote', 'no-close-quote', 'contents']) {
      const results = parseAll('content', kw);
      assert.equal(results.length, 1);
      assert.ok(results[0] instanceof CSSKeywordValue);
      assert.equal((results[0] as CSSKeywordValue).value, kw);
    }

    const str = parseAll('content', '"hello"');
    assert.equal(str[0].constructor, CSSStyleValue);
    assert.equal(str[0].toString().includes('hello'), true);

    const url = parseAll('content', 'url(x.png)');
    assert.ok(url[0] instanceof CSSURLImageValue);

    const counter = parseAll('content', 'counter(section)');
    assert.equal(counter[0].constructor, CSSStyleValue);
    assert.equal(counter[0].toString().includes('counter'), true);

    const attr = parseAll('content', 'attr(data-x)');
    assert.equal(attr[0].constructor, CSSStyleValue);
    assert.equal(attr[0].toString().includes('attr'), true);

    assert.throws(() => parseAll('content', 'not-a-content-keyword'), TypeError);
    assert.throws(() => parseAll('content', '"a" / "alt"'), TypeError);
    assert.throws(() => parseAll('content', '"hello" "world"'), TypeError);

    assert.ok(parseAll('content', 'inherit')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('content', 'var(--c)')[0] instanceof CSSUnparsedValue);
    assert.equal(CSSStyleValue.parse('content', '"hello"').toString().includes('hello'), true);

    const mixedCase = parseAll('Content', '"x"');
    assert.equal(mixedCase[0].constructor, CSSStyleValue);
  });

  // css-content-3 #quotes
  test('quotes: auto, none, match-parent, string, invalid pairs', () => {
    assert.ok(parseAll('quotes', 'none')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('quotes', 'auto')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('quotes', 'match-parent')[0] instanceof CSSKeywordValue);

    const one = parseAll('quotes', '"«"');
    assert.equal(one[0].constructor, CSSStyleValue);
    assert.equal(one[0].toString().includes('«'), true);

    assert.throws(() => parseAll('quotes', '"«" "»"'), TypeError);
    assert.throws(() => parseAll('quotes', '"«" "»" "‹" "›"'), TypeError);
    assert.throws(() => parseAll('quotes', 'not-quotes'), TypeError);
    assert.throws(() => parseAll('quotes', '1px'), TypeError);

    assert.ok(parseAll('quotes', 'inherit')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('quotes', 'var(--q)')[0] instanceof CSSUnparsedValue);
    assert.equal(CSSStyleValue.parse('quotes', 'none').toString(), 'none');

    const mixedCase = parseAll('Quotes', 'none');
    assert.ok(mixedCase[0] instanceof CSSKeywordValue);
  });

  // css-ui-4 #cursor
  test('cursor remaining: keywords, invalid default, url hotspot, var', () => {
    for (const kw of ['auto', 'grab', 'grabbing', 'zoom-in', 'zoom-out', 'none', 'wait', 'help', 'text', 'not-allowed']) {
      const results = parseAll('cursor', kw);
      assert.equal(results.length, 1);
      assert.ok(results[0] instanceof CSSKeywordValue);
      assert.equal((results[0] as CSSKeywordValue).value, kw);
    }

    // Generated syntax omits `default`; document the TypeError rather than swallow it.
    assert.throws(() => parseAll('cursor', 'default'), TypeError);
    assert.throws(() => parseAll('cursor', 'not-a-cursor'), TypeError);

    const urlHotspot = parseAll('cursor', 'url(foo.png) 4 4, pointer');
    assert.equal(urlHotspot[0].constructor, CSSStyleValue);
    assert.equal(urlHotspot[0].toString().includes('url('), true);

    const urlOnly = parseAll('cursor', 'url(foo.png)');
    assert.equal(urlOnly[0].constructor, CSSStyleValue);

    assert.ok(parseAll('cursor', 'var(--c)')[0] instanceof CSSUnparsedValue);
    assert.ok(parseAll('cursor', 'inherit')[0] instanceof CSSKeywordValue);
    assert.equal(CSSStyleValue.parse('cursor', 'grab').toString(), 'grab');

    const mixedCase = parseAll('Cursor', 'wait');
    assert.ok(mixedCase[0] instanceof CSSKeywordValue);
  });

  // css-masking-1 #the-clip-path
  test('clip-path: geometry boxes, url, basic shapes rejected by generated syntax', () => {
    for (const kw of ['none', 'border-box', 'padding-box', 'content-box', 'margin-box', 'fill-box', 'stroke-box', 'view-box']) {
      const results = parseAll('clip-path', kw);
      assert.equal(results.length, 1);
      assert.ok(results[0] instanceof CSSKeywordValue);
      assert.equal((results[0] as CSSKeywordValue).value, kw);
    }

    const url = parseAll('clip-path', 'url(clip.svg#c)');
    assert.ok(url[0] instanceof CSSURLImageValue);
    const quoted = parseAll('clip-path', 'url("clip.svg#c")');
    assert.ok(quoted[0] instanceof CSSURLImageValue);

    assert.throws(() => parseAll('clip-path', 'circle(50%)'), TypeError);
    assert.throws(() => parseAll('clip-path', 'polygon(0 0, 100% 0, 100% 100%)'), TypeError);
    assert.throws(() => parseAll('clip-path', 'inset(10px)'), TypeError);
    assert.throws(() => parseAll('clip-path', 'not-a-clip'), TypeError);

    assert.ok(parseAll('clip-path', 'inherit')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('clip-path', 'var(--p)')[0] instanceof CSSUnparsedValue);
    assert.ok(CSSStyleValue.parse('clip-path', 'url(c.svg#x)') instanceof CSSURLImageValue);

    const mixedCase = parseAll('Clip-Path', 'none');
    assert.ok(mixedCase[0] instanceof CSSKeywordValue);
  });

  // css-typed-om-1 § 3.3 #positionvalue-objects — list-valued <position> leftover
  test('position list leftover: background-position commas and offset auto', () => {
    const list = parseAll('background-position', '0 0, 10px 10px');
    assert.equal(list.length, 2);
    assert.ok(list[0] instanceof CSSPositionValue);
    assert.ok(list[1] instanceof CSSPositionValue);

    const keywords = parseAll('background-position', 'left, right');
    assert.equal(keywords.length, 2);
    assert.ok(keywords[0] instanceof CSSPositionValue);

    const trailing = parseAll('background-position', '0 0,');
    assert.equal(trailing.length, 1);
    assert.ok(trailing[0] instanceof CSSPositionValue);

    assert.throws(() => parseAll('background-position', ','), TypeError);

    assert.ok(parseAll('offset-position', 'auto')[0] instanceof CSSKeywordValue);
    const offset = parseAll('offset-position', '10px 20px');
    assert.ok(offset[0] instanceof CSSPositionValue);
    assert.ok(parseAll('offset-anchor', 'auto')[0] instanceof CSSKeywordValue);

    const mask = parseAll('mask-position', 'center');
    assert.ok(mask[0] instanceof CSSPositionValue);
    const webkit = parseAll('-webkit-mask-position', 'center');
    assert.ok(webkit[0] instanceof CSSPositionValue);
  });

  test('remaining background list longhands and SHORTHANDS_DATA-only shorthands', () => {
    const repeats = parseAll('background-repeat', 'repeat-x, no-repeat');
    assert.equal(repeats.length, 2);
    assert.ok(repeats.every((v) => v instanceof CSSKeywordValue));

    const sizes = parseAll('background-size', 'cover, contain');
    assert.equal(sizes.length, 2);
    assert.throws(() => parseAll('background-size', '10px 20px'), TypeError);
    const sizeList = parseAll('background-size', '10px 20px, cover');
    assert.equal(sizeList.length, 2);
    assert.equal(sizeList[0].constructor, CSSStyleValue);
    assert.ok(sizeList[1] instanceof CSSKeywordValue);

    const attach = parseAll('background-attachment', 'fixed, scroll');
    assert.equal(attach.length, 2);
    const origin = parseAll('background-origin', 'content-box, padding-box');
    assert.equal(origin.length, 2);
    const clip = parseAll('background-clip', 'border-box, text');
    assert.equal(clip.length, 2);

    const bg = parseAll('background', 'red');
    assert.equal(bg[0].constructor, CSSStyleValue);
    const bgLayers = parseAll('background', 'url(a.png), url(b.png) red');
    assert.equal(bgLayers.length, 2);
    assert.ok(bgLayers[0] instanceof CSSURLImageValue);
    assert.equal(bgLayers[1].constructor, CSSStyleValue);

    const family = parseAll('font-family', 'Georgia, serif');
    assert.equal(family.length, 2);
    assert.ok(family.every((v) => v instanceof CSSKeywordValue));
    const quoted = parseAll('font-family', '"Courier New"');
    assert.equal(quoted[0].constructor, CSSStyleValue);

    // SHORTHANDS_DATA entries that are not in SHORTHANDS[].
    assert.equal(parseAll('gap', '10px')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('gap', '10px 20px')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('place-content', 'center')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('place-items', 'center start')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('columns', '2')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('columns', '100px 3')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('animation-range', 'normal')[0].constructor, CSSStyleValue);
  });

  // css-logical-1 #logical-shorthand-properties — leftover 2-value fall-through then syntax
  test('logical two-value leftover: remaining longhands and 2-token syntax fail', () => {
    const width = parseAll('border-block-width', '1px');
    assert.ok(width[0] instanceof CSSUnitValue);
    const style = parseAll('border-inline-style', 'solid');
    assert.ok(style[0] instanceof CSSKeywordValue);
    const color = parseAll('border-block-color', 'red');
    assert.ok(color[0] instanceof CSSKeywordValue);
    const inlineColor = parseAll('border-inline-color', 'blue');
    assert.ok(inlineColor[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('margin-inline', 'auto')[0] instanceof CSSKeywordValue);

    assert.throws(() => parseAll('margin-inline', '1px 2px'), TypeError);
    assert.throws(() => parseAll('padding-block', '1px 2px'), TypeError);
    assert.throws(() => parseAll('padding-inline', '1px 2px'), TypeError);
    assert.throws(() => parseAll('inset-inline', '1px 2px'), TypeError);
    assert.throws(() => parseAll('border-block-style', 'solid dashed'), TypeError);
    assert.throws(() => parseAll('border-inline-width', '1px 2px'), TypeError);
  });
});
