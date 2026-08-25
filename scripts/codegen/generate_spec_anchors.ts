/** @license Copyright 2026 Google LLC. SPDX-License-Identifier: Apache-2.0 */
// Spec anchor inventory generator.
//
// Parses the local Bikeshed sources (submodules/csswg-drafts/<spec>/Overview.bs)
// and emits every linkable normative anchor into src/data/gen/spec-anchors.json.
// This inventory is the ground-truth side of the spec-anchor coverage check
// (tests/spec-anchor-coverage.test.ts): repo citation tokens are joined against
// these anchors to find normative sections with zero citations anywhere —
// the "gap radar" that retrospectively predicts where unmodeled bugs emerge
// (validated against KI-112..126, see docs/proof-escape-ki-*.md).
//
// Supported Bikeshed heading/definition syntaxes:
//   1. ATX headings:       `## Title ### {#anchor}`
//   2. Underline headings: `Title {#anchor}` followed by a `=====` / `-----` line
//   3. Preprocessed HTML:  `<hN id="anchor">Title</hN>` (possibly multi-line)
//   4. <dfn> definitions:  Bikeshed auto-slugs exported dfns into linkable
//      anchors at build time (e.g. `<dfn export>parse a CSS declaration
//      block</dfn>` -> #parse-a-css-declaration-block). Repo citations target
//      this kind heavily (it owns #serialize-a-css-declaration-block), so dfn
//      slugs are first-class inventory members.
//
// <wpt> fixture-link extraction is deliberately out of scope for v1.
//
// Determinism contract: output contains NO wall-clock timestamp and is fully
// derived from submodule content — two runs over identical inputs are
// byte-identical (specs sorted by id, anchors sorted per spec).
import fs from 'node:fs';
import path from 'node:path';

const OUTPUT_PATH = 'src/data/gen/spec-anchors.json';

interface AnchorEntry {
    anchor: string;
    title: string;
    kind: 'heading' | 'dfn';
}

const SPECS = [
    'css-backgrounds-3',
    'css-fonts-4',
    'css-nesting-1',
    'css-syntax-3',
    'css-values-4',
    'cssom-1',
    'mediaqueries-4',
    'selectors-4',
] as const;

function specPath(spec: string): string {
    return path.join('submodules', 'csswg-drafts', spec, 'Overview.bs');
}

/** Strip Bikeshed/HTML inline markup from a heading/dfn title, collapse whitespace. */
function cleanTitle(raw: string): string {
    return raw
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/<<([^>]+)>>/g, '$1') // <<type>> grammar terms
        .replace(/<[^>]+>/g, '') // inline html tags
        .replace(/\{\{([^}|]+)(?:\|[^}]*)?\}\}/g, '$1') // {{CSSStyleRule}} cross-refs
        .replace(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, '$1') // [[RFC2119]] refs
        .replace(/\[= ?([^\]=]+?) ?=\]/g, '$1') // [= term =]
        .replace(/`([^`]*)`/g, '$1') // `code`
        .replace(/\*\*?([^*]+)\*\*?/g, '$1') // *em*
        .replace(/\{#[^}]*\}/g, '')
        .replace(/#{1,6}\s*$/, '')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

/**
 * Bikeshed-style slugify for dfn-generated anchors: lowercase, strip
 * punctuation, whitespace runs -> '-'.
 */
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/<[^>]+>/g, ' ')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

/** Extract all anchors (headings + dfn slugs) from one Overview.bs source. */
export function extractAnchors(text: string): AnchorEntry[] {
    const lines = text.split('\n');
    const out: AnchorEntry[] = [];
    const seen = new Set<string>();
    const push = (anchor: string, title: string, kind: 'heading' | 'dfn'): void => {
        if (!anchor) return;
        if (seen.has(anchor)) return; // first definition wins
        seen.add(anchor);
        out.push({ anchor, title: cleanTitle(title), kind });
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 1. ATX headings: "### Serializing Media Feature Values ### {#serializing-media-feature-values}"
        let m = /^#{1,6}\s+(.+?)\s*\{#([A-Za-z0-9._%-]+)\}\s*$/.exec(line);
        if (m) {
            push(m[2], m[1], 'heading');
            continue;
        }

        // 2. Underline-style headings: next line is all '=' or '-' (>= 3 chars).
        m = /^(.+?)\s*\{#([A-Za-z0-9._%-]+)\}\s*$/.exec(line);
        if (m && i + 1 < lines.length && /^[=-]{3,}\s*$/.test(lines[i + 1])) {
            push(m[2], m[1], 'heading');
            continue;
        }

        // 3. Preprocessed HTML headings, possibly multi-line:
        //    <h3 id="escaping">\nEscaping</h3>
        m = /<h([1-6])\s+id=['"]([^'"]+)['"]\s*>/.exec(line);
        if (m) {
            const close = new RegExp(`</h${m[1]}>`);
            let buf = line.slice(m.index + m[0].length);
            let j = i;
            while (!close.test(buf) && j + 1 < lines.length && j - i < 8) {
                j += 1;
                buf += '\n' + lines[j];
            }
            const t = close.exec(buf);
            push(m[2], t ? buf.slice(0, t.index) : buf, 'heading');
        }
    }

    // 4. <dfn> definitions -> build-time anchors. Scan raw text so multi-line
    //    dfns work. Scoped dfns (`for=`) slug as `<for>-<term>`, matching
    //    Bikeshed's build-time anchor generation.
    const dfnRe = /<dfn([^>]*)>([\s\S]*?)<\/dfn>/g;
    let dm: RegExpExecArray | null;
    while ((dm = dfnRe.exec(text)) !== null) {
        const attrs = dm[1] ?? '';
        const body = dm[2];
        const forM = /(?:^|\s)for\s*=\s*["']?([^"'\s>]+)/.exec(attrs);
        const slug = slugify(body);
        if (!slug || !/^[a-z0-9-]{6,}$/.test(slug)) continue;
        push(forM ? `${slugify(forM[1])}-${slug}` : slug, (forM ? `[for=${forM[1]}] ` : '') + body, 'dfn');
    }

    // Code-unit ordering (NOT localeCompare): keeps the emitted JSON
    // byte-identical across machines/locales.
    return out.sort(
        (a, b) => (a.anchor < b.anchor ? -1 : a.anchor > b.anchor ? 1 : a.kind.localeCompare(b.kind)),
    );
}

function main(): void {
    const specs: Record<string, { file: string; anchors: AnchorEntry[] }> = {};
    let total = 0;

    for (const spec of SPECS) {
        const rel = specPath(spec);
        if (!fs.existsSync(rel)) {
            console.error(`Error: Spec file not found at ${rel}. Is the csswg-drafts submodule checked out?`);
            process.exit(1);
        }
        const anchors = extractAnchors(fs.readFileSync(rel, 'utf8'));
        if (anchors.length === 0) {
            console.error(`Error: Parsed 0 anchors from ${rel}; extraction regexes may be outdated.`);
            process.exit(1);
        }
        specs[spec] = { file: rel.replace(/\\/g, '/'), anchors };
        total += anchors.length;
        console.log(`  ${spec.padEnd(20)} ${String(anchors.length).padStart(5)} anchors`);
    }

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ specs }, null, 2) + '\n', 'utf8');
    console.log(`Generated ${OUTPUT_PATH} with ${total} anchors across ${SPECS.length} specs.`);
}

main();
