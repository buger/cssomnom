/** @license Copyright 2026 Google LLC. SPDX-License-Identifier: Apache-2.0 */
// CSSOM domain dictionary generator (ste-dictionary/v1).
//
// Emits src/data/gen/ste-domain-dict.json, a project domain dictionary in the
// ASD-STE100 `ste-dictionary/v1` JSON format (schema, entries with
// word/part_of_speech/approved/forms/technical_name — the loader is
// ste-repo internal/dictionary/dictionary.go). Feed it to the STE100 engine
// (`--dictionary`) so technical identifiers in campaign prose stop being
// flagged as non-approved words: the largest false-positive class after the
// dictionary-vocabulary mismatch itself.
//
// Entry classes (all approved, all part_of_speech noun unless noted):
//   1. exported-api  — every runtime export of src/index.ts, extracted by
//      dynamically importing the barrel (resolves `export *` chains).
//      Uppercase-initial exports (classes, const CSS) are nouns; lowercase
//      exports (functions: parse, tokenize, serialize, ...) are verbs —
//      they appear in prose as actions, and the engine's sentence-length
//      rule keys on approved verbs.
//   2. internal-atom — internal identifiers the campaign's prose cites
//      (consumeRule, parseResolutionToDpi, prelude, longhands, ...). Curated
//      list, but every entry is asserted to occur in src/ so renames fail
//      the generator loudly instead of rotting the dictionary.
//   3. css-domain    — property names (STANDARD_PROPERTIES_SYNTAX keys),
//      pseudo-class/element names (PSEUDO_CLASSES/PSEUDO_ELEMENTS), unit
//      names (UNITS), at-rule names (parsed from Parser.AT_RULE_HANDLERS +
//      MARGIN_RULE_NAMES + the encoding-only @charset), math functions
//      (MATH_FUNCTIONS), and a small curated functional-notation list
//      (calc, var, env, url, attr, counter(s), min, max, clamp, steps,
//      cubic-bezier) that has no single generated source table.
//   4. forms — conservative regular plurals (+s / consonant+y -> ies),
//      generated ONLY for lowercase kebab noun vocabularies (properties,
//      functional notations) where the plural is unambiguous. Skipped for
//      s/x/z/ch/sh endings (ambiguous or already plural: steps, media) and
//      for every CamelCase identifier, so the engine's FormApproved()
//      plural handling stays exact instead of stemmer-guessed.
//
// Determinism contract: no wall-clock input; every collection is sorted in
// code-unit order (never localeCompare) — two runs over identical sources
// are byte-identical.
import fs from 'node:fs';
import path from 'node:path';

const OUTPUT_PATH = 'src/data/gen/ste-domain-dict.json';
const PARSER_PATH = 'src/parser.ts';

interface DictEntry {
    word: string;
    part_of_speech: 'noun' | 'verb';
    approved: boolean;
    forms?: string[];
    technical_name?: boolean;
    /** Provenance class; stripped from the emitted JSON. */
    src: 'exported-api' | 'internal-atom' | 'css-domain';
}

/** Curated internal atom vocabulary (see class 2 in the header comment). */
const INTERNAL_ATOMS = [
    // Parser/consumer pipeline identifiers (verb-prefixed, >=8 uses in src/).
    'parseComponentValues',
    'parseNumeric',
    'serializeIdentifier',
    'parseRuleInBlock',
    'parseMathFunction',
    'consumeToken',
    'consumeDeclarationsFromBlockContents',
    'consumeComponentValue',
    'serializeMediaQuery',
    'consumeRule',
    'consumeListOfRules',
    'normalizeAngleUnits',
    'serializeGroupingRule',
    'parseOffsetCoord',
    'parseMediaInParens',
    // Campaign-spec atoms cited by name in prose and tests.
    'parseResolutionToDpi',
    'parseHslComponents',
    'normalizeKeyframeSelector',
    'consumeEscapedCodePoint',
    'consumeUnicodeRangeToken',
    'getAtRuleHandler',
    'handlePropertyRule',
    'tryParsePosition',
    'isElementDisabled',
    // CSSOM attribute/state nouns that appear verbatim in prose.
    'cssText',
    'selectorText',
    'mediaText',
    'cssRules',
    'prelude',
    'longhands',
    'shorthand',
    'componentValues',
    'unitToBase',
    'ParseHooks',
    'getPropertyValue',
    'tokenizer',
    'serializer',
    'cascade',
    'stylesheet',
] as const;

/**
 * Functional notations with no single generated source table (math functions
 * live in MATH_FUNCTIONS; these are grammar productions spread across
 * css-values-4/css-variables-1/selectors-4). Intentionally curated, not
 * hardcoding generated data.
 */
const FUNCTIONAL_NOTATIONS = [
    'attr',
    'calc',
    'counter',
    'counters',
    'cubic-bezier',
    'env',
    'linear',
    'max',
    'min',
    'minmax',
    'steps',
    'symbols',
    'url',
    'var',
] as const;

/** At-rules handled outside AT_RULE_HANDLERS (encoding sniff / keyframes). */
const EXTRA_AT_RULES = ['charset', 'keyframes'] as const;

/**
 * Conservative regular plural: consonant+y -> ies, else +s. Returns null for
 * endings where the plural is ambiguous or the base may already be plural
 * (s/x/z/ch/sh) — the engine's FormApproved() then simply treats such a
 * surface form as unapproved, which is the honest answer.
 */
function regularPlural(word: string): string | null {
    if (!/^[a-z][a-z-]*$/.test(word)) return null; // lowercase kebab nouns only
    const last = word.slice(-1);
    const last2 = word.slice(-2);
    if (last === 'y' && !/[aeiou]/.test(word.slice(-2, -1))) return `${word.slice(0, -1)}ies`;
    if (['s', 'x', 'z'].includes(last) || ['ch', 'sh'].includes(last2)) return null;
    return `${word}s`;
}

/** Extract at-rule names from Parser.AT_RULE_HANDLERS + MARGIN_RULE_NAMES source. */
function extractAtRuleNames(parserSrc: string): string[] {
    const blockFor = (name: string, terminator: '\n  };' | '\n  ]);'): string => {
        const start = parserSrc.indexOf(`readonly ${name}`);
        if (start < 0) return '';
        const brace = parserSrc.indexOf('= {', start);
        if (brace < 0) return '';
        const end = parserSrc.indexOf(terminator, brace);
        return end < 0 ? '' : parserSrc.slice(start, end);
    };
    // Handler table: `media: (parser, rule, ...) => ...` / `'font-face': ...`
    const handlers = [
        ...blockFor('AT_RULE_HANDLERS', '\n  };').matchAll(/(?:^|\n)\s+'?([a-z][a-z-]*)'?:/g),
    ].map(m => m[1]);
    // Margin-name Set: one or more quoted names per line, no colons.
    const margins = [...blockFor('MARGIN_RULE_NAMES', '\n  ]);').matchAll(/'([a-z][a-z-]*)'/g)].map(m => m[1]);
    const names = new Set([...handlers, ...margins, ...EXTRA_AT_RULES]);
    // Sanity gate mirroring generate_spec_anchors: an empty/wrong extraction
    // must fail the generator instead of emitting a silently gutted dict.
    if (handlers.length < 10 || margins.length < 10 || names.size < 25) {
        console.error(
            `Error: extracted too few at-rule names (handlers=${handlers.length}, margins=${margins.length}); ` +
                'Parser.AT_RULE_HANDLERS layout may have changed.',
        );
        process.exit(1);
    }
    return [...names];
}

async function main(): Promise<void> {
    // 1. Exported API surface — dynamic import resolves export * chains.
    const barrel = (await import('../../src/index.ts')) as Record<string, unknown>;
    const exports = Object.keys(barrel).sort();
    if (exports.length < 50) {
        console.error(`Error: only ${exports.length} exports found on src/index.ts; barrel layout may have changed.`);
        process.exit(1);
    }

    // 2. CSS domain vocabularies from the generated data tables.
    const { STANDARD_PROPERTIES_SYNTAX } = await import('../../src/data/gen/standard-syntax.ts');
    const { PSEUDO_CLASSES, PSEUDO_ELEMENTS } = await import('../../src/data/gen/selectors.ts');
    const { UNITS } = await import('../../src/data/gen/units.ts');
    const { MATH_FUNCTIONS } = await import('../../src/data/gen/math-functions.ts');
    const atRules = extractAtRuleNames(fs.readFileSync(PARSER_PATH, 'utf8'));

    const propertyNames = Object.keys(STANDARD_PROPERTIES_SYNTAX);
    if (propertyNames.length < 400 || PSEUDO_CLASSES.size < 40 || UNITS.length < 40) {
        console.error('Error: generated data tables look truncated; refusing to emit a gutted dictionary.');
        process.exit(1);
    }

    // 3. Internal atoms must exist in src/ (guards against silent rot).
    const srcRoot = path.join('src');
    const srcFiles: string[] = [];
    const walk = (dir: string): void => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) walk(p);
            else if (p.endsWith('.ts')) srcFiles.push(p);
        }
    };
    walk(srcRoot);
    const corpus = srcFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');
    for (const atom of INTERNAL_ATOMS) {
        if (!new RegExp(`\\b${atom}\\b`).test(corpus)) {
            console.error(`Error: internal atom "${atom}" no longer occurs in src/; update INTERNAL_ATOMS.`);
            process.exit(1);
        }
    }

    // Assemble entries, deduping case-insensitively (the loader lowercases
    // keys) and uniting forms when a word occurs in more than one class.
    const entries = new Map<string, DictEntry>();
    const add = (word: string, pos: 'noun' | 'verb', src: DictEntry['src'], withForms: boolean): void => {
        const key = word.toLowerCase();
        const prev = entries.get(key);
        const form = withForms ? regularPlural(word) : null;
        if (prev) {
            if (form && !prev.forms?.includes(form)) prev.forms = [...(prev.forms ?? []), form].sort();
            return;
        }        entries.set(key, {
            word,
            part_of_speech: pos,
            approved: true,
            // Field order mirrors the loader's Entry struct (dictionary.go).
            ...(form ? { forms: [form] } : {}),
            technical_name: true,
            src,
        });
    };

    for (const name of exports) add(name, /^[A-Z]/.test(name) ? 'noun' : 'verb', 'exported-api', false);
    for (const atom of INTERNAL_ATOMS) add(atom, 'noun', 'internal-atom', false);
    for (const p of propertyNames) add(p, 'noun', 'css-domain', true);
    for (const p of PSEUDO_CLASSES) add(p, 'noun', 'css-domain', false);
    for (const p of PSEUDO_ELEMENTS) add(p, 'noun', 'css-domain', false);
    for (const a of atRules) add(a, 'noun', 'css-domain', false);
    for (const u of UNITS) add(u, 'noun', 'css-domain', false);
    for (const f of MATH_FUNCTIONS) add(f, 'noun', 'css-domain', true);
    for (const f of FUNCTIONAL_NOTATIONS) add(f, 'noun', 'css-domain', true);

    // Code-unit ordering (NOT localeCompare): byte-identical across machines.
    const sorted = [...entries.values()].sort((a, b) => (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));

    const byClass = { 'exported-api': 0, 'internal-atom': 0, 'css-domain': 0 } as Record<DictEntry['src'], number>;
    for (const e of sorted) byClass[e.src]++;

    const output = {
        schema: 'ste-dictionary/v1',
        note: 'cssomnom domain dictionary: exported API surface, internal parser/CSSOM atoms, and CSS domain vocabulary (properties, selectors, at-rules, units, functions). Generated by scripts/codegen/generate_ste_domain_dict.ts; do not edit.',
        // Canonical field order mirrors the loader's Entry struct; forms
        // unioned across classes may otherwise append out of struct order.
        entries: sorted.map(e => ({
            word: e.word,
            part_of_speech: e.part_of_speech,
            approved: e.approved,
            ...(e.forms ? { forms: e.forms } : {}),
            technical_name: e.technical_name,
        })),
    };

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');

    console.log(`Generated ${OUTPUT_PATH} with ${sorted.length} entries:`);
    console.log(`  exported-api  ${String(byClass['exported-api']).padStart(5)}`);
    console.log(`  internal-atom ${String(byClass['internal-atom']).padStart(5)}`);
    console.log(`  css-domain    ${String(byClass['css-domain']).padStart(5)}`);
}

main();
