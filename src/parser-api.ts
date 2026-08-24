// Implements: SYS-REQ-260821-NGJH, SYS-REQ-260821-KA02, SYS-REQ-260821-SMW6, SYS-REQ-260821-RAAM, SW-REQ-260821-MZ8P, SW-REQ-260821-2Z0N, SW-REQ-260821-HW77, SW-REQ-260821-3553, INT-REQ-260821-WTPD, INT-REQ-260821-ZP03
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
// Implements: SYS-REQ-260821-NGJH, SW-REQ-260821-MZ8P, INT-REQ-260821-WTPD
/**
 * @fileoverview Implementation of the CSS Parser API based on the WICG draft.
 * @see https://raw.githubusercontent.com/WICG/css-parser-api/refs/heads/main/index.bs
 * 
 * Deviations from the spec:
 * 1. String Boxing: The spec defines CSSToken as `typedef (DOMString or CSSStyleValue or CSSParserValue) CSSToken;`.
 *    We box strings in `CSSParserToken` instead of allowing raw strings directly.
 * 2. Synchronous Execution: `parseRule` and `parseDeclarationList` are implemented synchronously instead of returning Promises.
 * 3. Immutability: Properties like `prelude`, `body`, and `args` are mutable arrays instead of `FrozenArray`.
 * 4. Constructor Arguments: The `body` parameter is mandatory in some constructors (e.g., `CSSParserQualifiedRule`) where the spec makes it optional.
 */

import { Parser } from './parser.ts';
import { tokenize } from './tokenizer.ts';
import type { ComponentValue, SimpleBlock, CSSFunction, ASTAtRule, Declaration, Token } from './types.ts';
import { serialize } from './serializer.ts';
import { PropertyRegistry, type PropertyDefinition, matchesSyntax } from './PropertyRegistry.ts';
import { CSSFactories } from './data/gen/css-factories.ts';
import { resolveNestedSelector } from './cascade.ts';
import { ParseHooks } from './parse-hooks.ts';
import { SHORTHANDS } from './shorthands.ts';
import { SUPPORTED_PROPERTIES } from './data/gen/property-list.ts';
import { STANDARD_PROPERTIES_SYNTAX } from './data/gen/standard-syntax.ts';
import { SelectorParser } from './SelectorParser.ts';
import {
  CSSAtRule,
  CSSContainerRule,
  CSSKeyframeRule,
  CSSKeyframesRule,
  CSSLayerBlockRule,
  CSSLayerStatementRule,
  CSSMediaRule,
  CSSScopeRule,
  CSSStartingStyleRule,
  CSSSupportsRule,
} from './CSSOM.ts';




export abstract class CSSParserValue {
  abstract toString(): string;
}

export class CSSParserToken extends CSSParserValue {
  public value: string;
  constructor(value: string) { 
    super(); 
    this.val = value; // Wait, let's use 'value' consistently
    this.value = value;
  }
  private val: string; // Keep for internal use if needed, but 'value' is better
  toString(): string { return this.value; }
}

export type CSSToken = CSSParserValue;

export class CSSParserBlock extends CSSParserValue {
  public name: string;
  public body: CSSParserValue[];
  constructor(name: string, body: CSSParserValue[]) {
    super();
    this.name = name;
    this.body = body;
  }
  toString(): string {
    const start = this.name === '[]' ? '[' : this.name === '{}' ? '{' : '(';
    const end = this.name === '[]' ? ']' : this.name === '{}' ? '}' : ')';
    return `${start}${this.body.map(v => v.toString()).join('')}${end}`;
  }
}

export class CSSParserFunction extends CSSParserValue {
  public name: string;
  public args: CSSParserValue[][];
  constructor(name: string, args: CSSParserValue[][]) {
    super();
    this.name = name;
    this.args = args;
  }
  toString(): string {
    return `${this.name}(${this.args.map(arg => arg.map(v => v.toString()).join('')).join(', ')})`;
  }
}

export abstract class CSSParserRule {
  abstract toString(): string;
}

export class CSSParserAtRule extends CSSParserRule {
  public name: string;
  public prelude: CSSToken[];
  public body: CSSParserRule[] | null;
  constructor(
    name: string,
    prelude: CSSToken[],
    body: CSSParserRule[] | null = null
  ) {
    super();
    this.name = name;
    this.prelude = prelude;
    this.body = body;
  }
  toString(): string {
    const preludeStr = this.prelude.map(t => t.toString()).join('');
    if (this.body === null) {
      return `@${this.name}${preludeStr};`;
    }
    return `@${this.name}${preludeStr}{${this.body.map(r => r.toString()).join('')}}`;
  }
}

export class CSSParserQualifiedRule extends CSSParserRule {
  public prelude: CSSToken[];
  public body: CSSParserRule[];
  constructor(
    prelude: CSSToken[],
    body: CSSParserRule[]
  ) {
    super();
    this.prelude = prelude;
    this.body = body;
  }
  toString(): string {
    return `${this.prelude.map(t => t.toString()).join('')}{${this.body.map(r => r.toString()).join('')}}`;
  }
}

export class CSSParserDeclaration extends CSSParserRule {
  public name: string;
  public body: CSSParserValue[];
  constructor(
    name: string,
    body: CSSParserValue[]
  ) {
    super();
    this.name = name;
    this.body = body;
  }
  toString(): string {
    return `${this.name}: ${this.body.map(v => v.toString()).join('')};`;
  }
}

/**
 * Bridge functions to convert internal AST to Parser API objects
 */

function toParserValue(val: ComponentValue): CSSParserValue | string {
  if (val.type === 'simple-block') {
    const block = val as SimpleBlock;
    const bracket = block.associatedToken.value;
    const name = bracket === '[' ? '[]' : bracket === '{' ? '{}' : '()';
    return new CSSParserBlock(name, block.value.map(v => {
      const res = toParserValue(v);
      return typeof res === 'string' ? new CSSParserToken(res) : res;
    }));
  }
  if (val.type === 'function') {
    const fn = val as CSSFunction;
    // CSS Parser API expects args to be sequence<sequence<CSSParserValue>>
    // We need to split our flat value list by commas
    const args: CSSParserValue[][] = [[]];
    for (const v of fn.value) {
      if ('type' in v && v.type === 'comma') {
        args.push([]);
      } else {
        const res = toParserValue(v);
        args[args.length - 1].push(typeof res === 'string' ? new CSSParserToken(res) : res);
      }
    }
    return new CSSParserFunction(fn.name, args);
  }
  // For tokens, we return the serialized string or a CSSStyleValue if it's a number/dimension
  return serialize([val]);
}

function toParserToken(val: ComponentValue): CSSToken {
  const res = toParserValue(val);
  if (typeof res === 'string') return new CSSParserToken(res);
  return res;
}

function tokensToPrelude(values: ComponentValue[]): CSSToken[] {
  return values
    .filter(v => v.type !== 'whitespace' && v.type !== 'comment')
    .map(toParserToken);
}

function bodyFromCssRules(r: Record<string, unknown>): CSSParserRule[] | undefined {
  if (!r.cssRules) return undefined;
  return Array.from(r.cssRules as Iterable<unknown>).map(toParserRule);
}

type StyleBag = Iterable<string> & { getPropertyValue(name: string): string };

function isStyleBag(style: unknown): style is StyleBag {
  return (
    style != null &&
    typeof style === 'object' &&
    typeof (style as StyleBag)[Symbol.iterator] === 'function' &&
    typeof (style as StyleBag).getPropertyValue === 'function'
  );
}

function styleToParserDeclarations(style: unknown): CSSParserRule[] {
  if (!isStyleBag(style)) return [];
  return Array.from(style).map((name) =>
    new CSSParserDeclaration(name, [new CSSParserToken(style.getPropertyValue(name))])
  );
}

/**
 * Reconstruct an at-rule from cssText by re-tokenizing (not slicing on the first `{`).
 * css-syntax-3 § 4.3.4 #consume-string-token / § 5.5.8 #consume-a-component-value:
 * a `{` inside a string is not the rule body delimiter.
 * css-syntax-3 § 5.5.2 #consume-an-at-rule
 */
function atRulePartsFromCssText(cssText: string): { name: string; prelude: CSSToken[]; hasBody: boolean } | null {
  const values = new Parser(tokenize(cssText)).parseComponentValues();
  let i = 0;
  while (i < values.length && (values[i].type === 'whitespace' || values[i].type === 'comment')) i++;
  if (i >= values.length || values[i].type !== 'at-keyword') return null;
  const name = String((values[i] as Token).value).toLowerCase();
  i++;
  const preludeVals: ComponentValue[] = [];
  let hasBody = false;
  for (; i < values.length; i++) {
    const v = values[i];
    if (v.type === 'semicolon') break;
    if (v.type === 'simple-block' && (v as SimpleBlock).associatedToken.type === '{') {
      hasBody = true;
      break;
    }
    preludeVals.push(v);
  }
  return { name, prelude: tokensToPrelude(preludeVals), hasBody };
}

/**
 * Reconstruct a qualified rule from cssText (keyframe selector + `{}` block).
 * css-syntax-3 § 5.5.3 #consume-a-qualified-rule
 */
function qualifiedFromCssText(cssText: string): CSSParserQualifiedRule | null {
  const values = new Parser(tokenize(cssText)).parseComponentValues();
  let i = 0;
  while (i < values.length && (values[i].type === 'whitespace' || values[i].type === 'comment')) i++;
  if (i >= values.length || values[i].type === 'at-keyword') return null;
  const preludeVals: ComponentValue[] = [];
  let bodyBlock: SimpleBlock | null = null;
  for (; i < values.length; i++) {
    const v = values[i];
    if (v.type === 'simple-block' && (v as SimpleBlock).associatedToken.type === '{') {
      bodyBlock = v as SimpleBlock;
      break;
    }
    preludeVals.push(v);
  }
  const decls = bodyBlock
    ? new Parser([]).consumeDeclarationsFromBlockContents(bodyBlock.value).map(toParserRule)
    : [];
  return new CSSParserQualifiedRule(tokensToPrelude(preludeVals), decls);
}

/**
 * css-animations-1 #keyframe-selector: `from` ≡ 0% and `to` ≡ 100%.
 * CSSKeyframeRule.keyText stores percentages (css-animations-1 #dom-csskeyframerule-keytext);
 * the Parser API qualified prelude uses the grammar keywords when the selector is an endpoint.
 */
function denormalizeKeyframeSelector(keyText: string): string {
  return keyText
    .split(',')
    .map((part) => {
      const t = part.trim();
      if (t === '0%') return 'from';
      if (t === '100%') return 'to';
      return t;
    })
    .filter((t) => t.length > 0)
    .join(', ');
}

/**
 * Map CSSKeyframeRule (CSSRule.type 8) to a qualified rule, not an at-rule.
 * css-animations-1 #CSSKeyframeRule / css-syntax-3 § 5.5.3 #consume-a-qualified-rule
 */
function cssomKeyframeToQualified(r: unknown): CSSParserQualifiedRule | null {
  const rec = r as Record<string, unknown>;
  if (r instanceof CSSKeyframeRule || typeof rec.keyText === 'string') {
    const keyText = r instanceof CSSKeyframeRule ? r.keyText : String(rec.keyText);
    const preludeText = denormalizeKeyframeSelector(keyText);
    const style = r instanceof CSSKeyframeRule ? r.style : rec.style;
    return new CSSParserQualifiedRule(
      preludeText ? [new CSSParserToken(preludeText)] : [],
      styleToParserDeclarations(style),
    );
  }
  if (typeof rec.cssText === 'string' && rec.cssText) {
    return qualifiedFromCssText(rec.cssText);
  }
  return null;
}

/**
 * Prefer CSSOM fields (name / prelude / cssRules) over slicing cssText at the first `{`.
 * cssom-1 § 6.4 #the-cssrule-interface (UNKNOWN_RULE type 0).
 * css-syntax-3 § 5.5.2 #consume-an-at-rule
 */
function cssomAtRuleFromFields(r: unknown): CSSParserAtRule | null {
  const rec = r as Record<string, unknown>;
  const cssRules = bodyFromCssRules(rec);

  if (r instanceof CSSLayerStatementRule) {
    const list = r.nameList.join(', ');
    return new CSSParserAtRule('layer', list ? [new CSSParserToken(list)] : [], null);
  }
  if (r instanceof CSSLayerBlockRule) {
    return new CSSParserAtRule('layer', r.name ? [new CSSParserToken(r.name)] : [], cssRules ?? []);
  }
  if (r instanceof CSSContainerRule) {
    const prelude = r.conditionText ? [new CSSParserToken(r.conditionText)] : [];
    return new CSSParserAtRule('container', prelude, cssRules ?? []);
  }
  if (r instanceof CSSScopeRule) {
    let preludeText = '';
    if (r.startSelector) preludeText += r.startSelector;
    if (r.endSelector) {
      if (preludeText) preludeText += ' ';
      preludeText += `to ${r.endSelector}`;
    }
    return new CSSParserAtRule('scope', preludeText ? [new CSSParserToken(preludeText)] : [], cssRules ?? []);
  }
  if (r instanceof CSSStartingStyleRule) {
    return new CSSParserAtRule('starting-style', [], cssRules ?? []);
  }
  if (r instanceof CSSMediaRule) {
    const mediaText = r.media.mediaText;
    return new CSSParserAtRule('media', mediaText ? [new CSSParserToken(mediaText)] : [], cssRules ?? []);
  }
  if (r instanceof CSSSupportsRule) {
    return new CSSParserAtRule(
      'supports',
      r.conditionText ? [new CSSParserToken(r.conditionText)] : [],
      cssRules ?? []
    );
  }
  if (r instanceof CSSKeyframesRule) {
    // css-animations-1 #CSSKeyframesRule: .name is the animation name (prelude), not the at-keyword.
    return new CSSParserAtRule(
      'keyframes',
      r.name ? [new CSSParserToken(r.name)] : [],
      cssRules ?? []
    );
  }
  if (r instanceof CSSAtRule) {
    const prelude = tokensToPrelude(r.prelude as ComponentValue[]);
    const body = r.childRules
      ? r.childRules.map(toParserRule)
      : (r.block ? (cssRules ?? []) : null);
    return new CSSParserAtRule(r.name, prelude, body);
  }

  const cssText = typeof rec.cssText === 'string' ? rec.cssText : '';
  const parts = cssText ? atRulePartsFromCssText(cssText) : null;
  if (!parts) return null;
  return new CSSParserAtRule(
    parts.name,
    parts.prelude,
    parts.hasBody ? (cssRules ?? []) : null
  );
}

// Implements: SYS-REQ-260821-NGJH, SW-REQ-260821-MZ8P, INT-REQ-260821-WTPD
// reqproof:proptest:skip recursive AST adapter into IDL parser rules; structural mapping witnessed by tests/mcdc-parser-api-toparser.test.ts
export function toParserRule(rule: unknown): CSSParserRule {
  const r = rule as Record<string, unknown>;
  // Handle internal AST at-rule
  if (r.type === 'at-rule') {
    const at = r as unknown as ASTAtRule;
    const body = at.childRules ? (at.childRules as unknown[]).map(toParserRule) : 
                 (at.block ? (at.block.value as unknown[]).map(v => {
                    const val = v as Record<string, unknown>;
                    if (val.type === 'declaration') return toParserRule(val);
                    if (val.type === 'at-rule') return toParserRule(val);
                    return null;
                 }).filter(r => r !== null) as CSSParserRule[] : null);
    
    return new CSSParserAtRule(
      at.name,
      at.prelude.map(toParserToken),
      body
    );
  }

  // css-animations-1 #CSSKeyframeRule: KEYFRAME_RULE = 8 is a qualified rule, not an at-rule.
  // css-syntax-3 § 5.5.3 #consume-a-qualified-rule
  if (r instanceof CSSKeyframeRule || r.type === 8) {
    return cssomKeyframeToQualified(r) ?? new CSSParserQualifiedRule([], []);
  }

  // Handle CSSOM at-rules (Media, Keyframes, type-0 layer/container/scope, …)
  // cssom-1 § 6.4 #the-cssrule-interface: modern at-rules use type 0 (UNKNOWN_RULE).
  if (typeof r.type === 'number' && r.type !== 1 && r.type !== 17) {
    const fromFields = cssomAtRuleFromFields(r);
    if (fromFields) return fromFields;
    if (r.type !== 0) {
      const name = (r.name as string) ||
                   (r.type === 4 ? 'media' :
                    r.type === 7 ? 'keyframes' :
                    r.type === 3 ? 'import' : 'unknown');

      return new CSSParserAtRule(
        name,
        r.media ? [new CSSParserToken((r.media as {mediaText: string}).mediaText)] :
                 (typeof r.prelude === 'string' ? [new CSSParserToken(r.prelude)] :
                  Array.isArray(r.prelude) ? tokensToPrelude(r.prelude as ComponentValue[]) : []),
        r.cssRules ? Array.from(r.cssRules as Iterable<unknown>).map(toParserRule) : null
      );
    }
  }

  // Handle internal AST declaration
  if (r.type === 'declaration') {
    const decl = r as unknown as Declaration;
    return new CSSParserDeclaration(
      decl.name,
      decl.value.map(v => {
        const res = toParserValue(v);
        return typeof res === 'string' ? new CSSParserToken(res) : res;
      })
    );
  }
  
  // Handle CSSOM style-rule or qualified rule
  if (r.type === 1 || r.type === 'style-rule' || (typeof r === 'object' && r !== null && 'selectorText' in r)) {
      const qr = r as unknown as { selectorText?: string, prelude?: ComponentValue[], cssRules?: Iterable<unknown>, style?: Iterable<string> & { getPropertyValue(n: string): string } };
      return new CSSParserQualifiedRule(
          [new CSSParserToken(qr.selectorText || serialize(qr.prelude || []))],
          qr.cssRules ? Array.from(qr.cssRules).map(toParserRule) : 
          (qr.style ? Array.from(qr.style).map(name => {
              return new CSSParserDeclaration(name, [new CSSParserToken(qr.style!.getPropertyValue(name))]);
          }) : [])
      );
  }

  // Fallback for raw ComponentValue or unknown things
  return new CSSParserRawRule(serialize(Array.isArray(r) ? r as unknown as ComponentValue[] : [r as unknown as ComponentValue]));
}

class CSSParserRawRule extends CSSParserRule {
    private val: string;
    constructor(val: string) { 
        super(); 
        this.val = val;
    }
    toString(): string { return this.val; }
}

export type CSSStringSource = string | ReadableStream<Uint8Array>;

async function sourceToString(source: CSSStringSource): Promise<string> {
  if (typeof source === 'string') return source;
  const reader = source.getReader();
  const decoder = new TextDecoder();
  let result = '';
  //mcdc:ignore:defensive while(true) F is a language literal — loop-exit false cannot occur; T (ReadableStream read) already witnessed [reviewed: agent:grok-4.6]
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode();
  return result;
}

export interface CSSParserOptions {
  atRules?: Record<string, string>;
}

/**
 * Parser API Implementation
 */

export function parseStylesheetSync(css: string, options: CSSParserOptions = {}): CSSParserRule[] {
  const tokens = tokenize(css);
  const parser = new Parser(tokens, options);
  // Using private method access for implementation
  const rules = parser.consumeListOfRules(true);
  return rules.map(toParserRule);
}

export async function parseStylesheet(css: CSSStringSource, options: CSSParserOptions = {}): Promise<CSSParserRule[]> {
  const source = await sourceToString(css);
  return parseStylesheetSync(source, options);
}

export function parseRuleListSync(css: string, options: CSSParserOptions = {}): CSSParserRule[] {
  const tokens = tokenize(css);
  const parser = new Parser(tokens, options);
  const rules = parser.consumeListOfRules(false);
  return rules.map(toParserRule);
}

export async function parseRuleList(css: CSSStringSource, options: CSSParserOptions = {}): Promise<CSSParserRule[]> {
  const source = await sourceToString(css);
  return parseRuleListSync(source, options);
}

// Implements: SYS-REQ-260821-KA02, SW-REQ-260821-2Z0N
// reqproof:proptest:skip thin pipeline delegation to tokenize, Parser.consumeRule and toParserRule; every stage carries independent coverage
export function parseRuleSync(css: string, options: CSSParserOptions = {}): CSSParserRule | null {
  const tokens = tokenize(css);
  const parser = new Parser(tokens, options);
  const rule = parser.consumeRule();
  if (!rule) return null;

  parser.ensureEOF();

  return toParserRule(rule);
}

export function parseRule(css: string, options: CSSParserOptions = {}): CSSParserRule | null {
  return parseRuleSync(css, options);
}

export function parseDeclarationListSync(css: string, options: CSSParserOptions = {}): CSSParserRule[] {
  const tokens = tokenize(css);
  const parser = new Parser(tokens, options);
  const values = parser.parseComponentValues();
  const declarations = parser.consumeDeclarationsFromBlockContents(values);
  return declarations.map(toParserRule);
}

export function parseDeclarationList(css: string, options: CSSParserOptions = {}): CSSParserRule[] {
  return parseDeclarationListSync(css, options);
}

export function parseDeclarationSync(css: string, _options: CSSParserOptions = {}): CSSParserDeclaration | null {
    const list = parseDeclarationListSync(css, _options);
    return list.length > 0 ? list[0] as CSSParserDeclaration : null;
}

export function parseDeclaration(css: string, options: CSSParserOptions = {}): CSSParserDeclaration | null {
  return parseDeclarationSync(css, options);
}

export function parseValueSync(css: string): CSSToken {
    const tokens = tokenize(css);
    const parser = new Parser(tokens);
    const value = parser.consumeComponentValue();
    return toParserToken(value);
}

export function parseValueListSync(css: string): CSSToken[] {
    const tokens = tokenize(css);
    const parser = new Parser(tokens);
    const values = parser.parseComponentValues();
    return values.map(toParserToken);
}

export function parseCommaValueListSync(css: string): CSSToken[][] {
    const tokens = tokenize(css);
    const parser = new Parser(tokens);
    const list = parser.parseCommaSeparatedListOfComponentValues();
    return list.map(subList => {
        let start = 0;
        while (start < subList.length && subList[start].type === 'whitespace') start++;
        let end = subList.length - 1;
        while (end >= start && subList[end].type === 'whitespace') end--;
        return subList.slice(start, end + 1).map(toParserToken);
    });
}

export function parseComponentValueSync(css: string, options: CSSParserOptions = {}): CSSParserValue | null {
    const tokens = tokenize(css);
    const parser = new Parser(tokens, options);
    const values = parser.parseComponentValues();
    
    const nonWsValues = values.filter(v => v.type !== 'whitespace' && v.type !== 'comment');
    
    if (nonWsValues.length === 0) {
        return null;
    }
    if (nonWsValues.length > 1) {
        throw new DOMException('Syntax error', 'SyntaxError');
    }
    
    return toParserToken(nonWsValues[0]);
}

export function parseComponentValue(css: string, options: CSSParserOptions = {}): CSSParserValue | null {
  return parseComponentValueSync(css, options);
}

function hasVarFunction(values: ComponentValue[]): boolean {
  for (const v of values) {
    if (v.type === 'function') {
      if ((v as CSSFunction).name.toLowerCase() === 'var') {
        return true;
      }
      if (hasVarFunction((v as CSSFunction).value)) {
        return true;
      }
    }
    if (v.type === 'simple-block' && hasVarFunction((v as SimpleBlock).value)) {
      return true;
    }
  }
  return false;
}

function evaluateSupportsDeclaration(property: string, value: string): boolean {
  property = property.trim();
  value = value.trim();
  if (property === '' || property === '--') return false;

  if (property.startsWith('--')) {
    if (!Parser.isValidDashedIdent(property)) return false;
    const tokens = tokenize(value);
    const componentValues = ParseHooks.parseComponentValues(tokens);
    return ParseHooks.validateCustomPropertyValue(componentValues);
  }

  const prop = property.toLowerCase();
  if (prop === 'unicode-range') return false;

  const isSupported = SUPPORTED_PROPERTIES.has(prop) || SHORTHANDS[prop] !== undefined;
  if (!isSupported) return false;

  const tokens = tokenize(value);
  if (tokens.some(t => t.type === 'bad-string' || t.type === 'bad-url')) return false;

  const componentValues = ParseHooks.parseComponentValues(tokens);
  const nonWs = componentValues.filter(v => v.type !== 'whitespace' && v.type !== 'comment');
  if (nonWs.length === 0) return false;

  if (hasVarFunction(componentValues)) {
    return true;
  }

  if (nonWs.length === 1 && nonWs[0].type === 'ident') {
    const valStr = String((nonWs[0] as Token).value).toLowerCase();
    if (['inherit', 'initial', 'unset', 'revert', 'revert-layer', 'revert-rule'].includes(valStr)) {
      return true;
    }
  }

  const shorthand = SHORTHANDS[prop];
  if (shorthand) {
    return shorthand.expand(componentValues) !== null;
  }

  const syntax = STANDARD_PROPERTIES_SYNTAX[prop];
  if (syntax) {
    return matchesSyntax(componentValues, syntax);
  }

  return true;
}

function evalSupportsInParens(item: ComponentValue): boolean {
  if (item.type === 'function' && (item as CSSFunction).name.toLowerCase() === 'selector') {
    const selValues = (item as CSSFunction).value;
    const nonWsSel = selValues.filter(v => v.type !== 'whitespace' && v.type !== 'comment');
    if (nonWsSel.length === 0) return false;
    if (selValues.some(v => v.type === 'comma')) return false;
    try {
      const selParser = new SelectorParser(selValues, { strictSupports: true });
      const list = selParser.parse();
      if (list.selectors.length !== 1 || list.selectors[0].type === 'invalid-selector') return false;
      return true;
    } catch {
      return false;
    }
  }

  if (item.type === 'simple-block' && (item as SimpleBlock).associatedToken.value === '(') {
    const blockValues = (item as SimpleBlock).value;
    const nonWsBlock = blockValues.filter(v => v.type !== 'whitespace' && v.type !== 'comment');
    if (nonWsBlock.length === 0) return false;

    const hasTopLevelOp = nonWsBlock.some(v => v.type === 'ident' && ['and', 'or', 'not'].includes(String((v as Token).value).toLowerCase()));
    if (hasTopLevelOp || (nonWsBlock.length === 1 && nonWsBlock[0].type === 'simple-block')) {
      return evalSupportsConditionValues(nonWsBlock);
    }

    const colonIdx = blockValues.findIndex(v => v.type === 'colon');
    if (colonIdx > 0) {
      const propValues = blockValues.slice(0, colonIdx).filter(v => v.type !== 'whitespace' && v.type !== 'comment');
      if (propValues.length === 1 && propValues[0].type === 'ident') {
        const propName = String((propValues[0] as Token).value);
        const valTokens = blockValues.slice(colonIdx + 1);
        const valStr = serialize(valTokens);
        return evaluateSupportsDeclaration(propName, valStr);
      }
    }
    return false;
  }

  return false;
}

function evalSupportsConditionValues(values: ComponentValue[]): boolean {
  const items = values.filter(v => v.type !== 'whitespace' && v.type !== 'comment');
  if (items.length === 0) return false;

  if (items[0].type === 'ident' && String((items[0] as Token).value).toLowerCase() === 'not') {
    if (items.length === 2) {
      return !evalSupportsInParens(items[1]);
    }
    return false;
  }

  if (items.length === 1) {
    return evalSupportsInParens(items[0]);
  }

  if (items.length % 2 === 0) return false;

  const firstOp = String((items[1] as Token).value || '').toLowerCase();
  if (firstOp !== 'and' && firstOp !== 'or') return false;

  for (let i = 1; i < items.length; i += 2) {
    const op = String((items[i] as Token).value || '').toLowerCase();
    if (op !== firstOp) return false;
  }

  const inParensItems: ComponentValue[] = [];
  for (let i = 0; i < items.length; i += 2) {
    inParensItems.push(items[i]);
  }

  if (firstOp === 'and') {
    return inParensItems.every(item => evalSupportsInParens(item));
  } else {
    return inParensItems.some(item => evalSupportsInParens(item));
  }
}

// Implements: SYS-REQ-260821-SMW6, SW-REQ-260821-HW77
// reqproof:proptest:skip grammar-evaluating predicate whose only independent oracle would reimplement the same parser; witnessed by tests/mcdc-witness-parser-api.test.ts
export function supports(propertyOrCondition: string, value?: string): boolean {
  if (typeof value === 'string') {
    return evaluateSupportsDeclaration(propertyOrCondition, value);
  }
  const condition = propertyOrCondition.trim();
  if (condition === '') return false;

  const colonIdx = condition.indexOf(':');
  if (!condition.startsWith('(') && colonIdx !== -1 && !/\b(and|or|not)\b/i.test(condition)) {
    const prop = condition.slice(0, colonIdx).trim();
    const val = condition.slice(colonIdx + 1).trim();
    if (prop && val) {
      const declRes = evaluateSupportsDeclaration(prop, val);
      if (declRes) return true;
    }
  }

  const tokens = tokenize(condition);
  const parser = new Parser(tokens);
  const componentValues = parser.parseComponentValues();
  return evalSupportsConditionValues(componentValues);
}

import { escape as cssEscape } from './css-escape.ts';

// Implements: SYS-REQ-260821-RAAM, SW-REQ-260821-3553, SYS-REQ-260821-NGJH, SYS-REQ-260821-KA02, SYS-REQ-260821-SMW6, INT-REQ-260821-ZP03, INT-REQ-260821-WTPD
export const CSS = {
    // Typed OM Factories
    ...CSSFactories,

    // Utility APIs (cssom-1 § 3 #the-css.escape()-method)
    escape: cssEscape,

    // Tooling Extensions
    resolveNestedSelector,

    // Feature Detection
    supports,

    // Parser API
    parseStylesheet,
    parseStylesheetSync,
    parseRuleList,
    parseRule,
    parseDeclarationList,
    parseDeclaration,
    parseValue: parseValueSync,
    parseValueList: parseValueListSync,
    parseCommaValueList: parseCommaValueListSync,
    parseComponentValue,
    registerProperty: (definition: PropertyDefinition) => PropertyRegistry.register(definition),
};

// WebIDL namespace @@toStringTag definition (webidl § 3.6.3, cssom-1 § 3 #namespacedef-css)
Object.defineProperty(CSS, Symbol.toStringTag, {
  value: 'CSS',
  writable: false,
  enumerable: false,
  configurable: true,
});




