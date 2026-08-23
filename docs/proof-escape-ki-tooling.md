# Escape analysis — tooling & trust-boundary KIs (KI-15, KI-20, KI-23…KI-30)

Batch A2 filing companion to `docs/proof-escape-ki-16-22.md`. Ten confirmed
tooling/trust-boundary findings escaped every active Proof layer. This document
answers, per finding: which check/requirement/obligation/signal **should** have
caught it, **why it escaped**, whether the correction belongs in the
**overlay/model** or the **Proof engine**, and an engine regression idea where
the engine genuinely failed.

All HEAD line references verified at `83ce08f` on branch `CSSOmNom/Audit`.

---

## Scope facts this analysis rests on (`proof.yaml` inspected)

1. `verification_scope.completeness.production_include` is **`src/**` only**;
   `production_exclude` explicitly names `tests/**`, `dist/**`, **`scripts/**`**,
   `fuzz/**`, `proof/**` so the `verification_scope_complete` check does not
   even *report* those trees as missing production coverage. Every
   production-universe consumer (orphan detection, MC/DC
   (`js_glob: 'src/**/*.ts'`), sink probing) inherits that blindness.
2. `verification_scope.include` (autolink annotation walk) covers
   `src/**`, `tests/**`, `README.md`, `docs/**`, `proof/reproducers/**` —
   **`scripts/**` is absent**, so `// Verifies:` annotations inside runner
   scripts could not have bound anything anyway.
3. `checks.security_surface_covered` is **left disabled**, and the disabling
   comment is itself the smoking gun for the systemic cause below:
   > "Hunt (2026-08-21) with --set enabled=true found scripts/wpt/node/run.ts
   > egress (WPT runner), not CSS url() in src/**. scripts/ is tooling, not
   > production_include."
   The engine already *saw* one of these holes once and the finding was
   scoped away rather than governed.
4. No requirement carried `component: wpt_runner`, `wptfyi_ingest`,
   `fixture_extraction`, `wpt_browser_cli`, `safe_exec_kernel`, or
   `ci_policy_guard` before this batch — the tooling face of the project had
   zero owners in the model.

---

## Per-finding escape analysis

### KI-15 — `getScriptContent` reads/vm-executes `<script src>` outside WPT root

- **Should have caught:** a `security_surface_covered`-style file-read/exec
  sink probe (`fs.readFileSync` fed by `path.join(WPT_ROOT, …)`), or a
  `script_path_contained` obligation on a `wpt_runner` requirement. The scan
  writeup itself prescribes the right systematic signal: "a systematic pass
  over every `path.join(WPT_ROOT, userControlled)` site in `scripts/wpt/**`".
- **Why it escaped:** systemic cause — **`production_include=src/**` excludes
  `scripts/**` from every production-scoped check entirely** (facts #1/#3):
  the 2026-08-21 hunt reached this exact file and the hit was discarded as
  out-of-scope instead of forcing ownership. Secondarily, README's WPT
  Conformance section documents the runner but no requirement owned it, so no
  obligation checklist ever asked "is fixture-loaded script content contained?"
- **Correction locus:** **model/overlay** — done here (SYS-REQ-260823-2P2Q +
  registry domains); plus an **engine** extension adding a
  `path_containment` sink family (external-string `path.join`/`resolve`
  without a `path.relative` guard) so the next such join cannot land ungoverned.
- **Engine regression idea:** flag *excluded* trees whose contents contain
  sink-shaped tokens (`path.join(<ROOT>`, `readFileSync`, `execSync`) as an
  "excluded-tree blind spot" informational — exclusion should cost visibility,
  not erase the asset.

### KI-20 — fixture extractors eval/vm vendored submodule JS

- **Should have caught:** a catalog `code_injection` security class bound to a
  `fixture_extraction` requirement; failing that, plain static lint — the sink
  carries `// eslint-disable-next-line no-eval` *in the source*
  (`extract_nv_cssom.ts:54`), so a lint-based signal existed and was
  consciously suppressed at the exact line.
- **Why it escaped:** **`production_include=src/**` excludes `scripts/**`**
  from all governance; additionally `pnpm run fixtures:generate` was mentally
  classified as an "offline maintainer step" with no trust-boundary threat
  model for vendored submodule content (the boundary moved upstream without the
  model noticing). Sibling extractors (`extract_csstree.ts`,
  `extract_postcss.ts`) already use data-only `JSON.parse`, proving the safe
  pattern was known and simply never made obligatory.
- **Correction locus:** **model/overlay** (SYS-REQ-260823-AKDT encodes "vendored
  content is data"); **engine** optionally gains a `code_injection` sink family
  matching `eval(` / `vm.runInContext` / `runInNewContext` over non-literal
  input — notably none of the four shipped families
  (egress/authz/secret/crypto) includes dynamic code execution today.
- **Engine regression idea:** treat `eslint-disable` of security-relevant rules
  (`no-eval`) as a reviewable event signal rather than dead text.

### KI-23 — `--browser` interpolates into `dist/report-${browser}.json`

- **Should have caught:** the missing `path_containment` sink family applied to
  the interpolated `path.resolve` templates at `scripts/wpt/browser/run.ts:64-66`;
  or an operator-CLI trust-boundary rule: any argv-derived value interpolated
  into a filesystem path requires validation or containment.
- **Why it escaped:** **`production_include=src/**` excludes `scripts/**`**;
  and the project's threat model (prior KIs, hazards, obligations) treats
  **CSS text** as the only attacker-controlled boundary. There is no modeled
  adversary for "operator CLI whose arguments arrive from wrappers, CI
  matrices, or compromised state" — a **missing trust-boundary threat model
  for operator CLIs**.
- **Correction locus:** **model/overlay** (SYS-REQ-260823-ZM55); engine
  `path_containment` family would generalize.
- **Engine regression idea:** none beyond the shared sink family — the engine
  behaved to spec; the spec was silent here.

### KI-24 — sandbox.fetch `/interfaces/` join escapes WPT root

- **Should have caught:** identical to KI-15 — same file, sibling join; the
  scan remediation explicitly says to cover both joins in one pass.
- **Why it escaped:** **`production_include=src/**` excludes `scripts/**`**;
  the fetch bridge is a hand-written local-disk optimization with no owning
  requirement, so nobody asked what else `idlFileName` could contain. Also a
  sub-case of the missing operator-CLI/tooling threat model: fixture JS was
  granted a filesystem bridge without a containment contract.
- **Correction locus:** **model/overlay** (SYS-REQ-260823-KYB6) + shared
  engine `path_containment` family.
- **Engine regression idea:** cluster rule — when one sink in a file is
  governed, propose sibling sinks in the same function/file for review
  (the two joins sit ~50 lines apart).

### KI-25 — sandbox.fetch falls through to host fetch (SSRF egress)

- **Should have caught:** this is the **strongest pure-engine candidate**: the
  `security_surface_covered` **egress sink family greps exactly for `fetch`**,
  and the vulnerable statement IS a bare `return fetch(input, init)`
  (`scripts/wpt/node/run.ts:158`). Had scripts been in scope and the gate on,
  run.ts would have been flagged as an ungoverned egress surface.
- **Why it escaped:** twice over — first the gate is **disabled**, second even
  enabled it scopes to `production_include=src/**` and **`scripts/**` is
  excluded**; proof.yaml's own comment records the hunt finding exactly this
  file's egress and setting it aside. No modeled boundary between vm-sandbox
  page JS and the host network stack existed in any requirement.
- **Correction locus:** split — **engine** must learn to probe sinks outside
  `production_include` (or grow a documented tooling scope), because a config
  flag silently narrowing a security gate is how this class escapes;
  **model/overlay** now supplies the owner (SYS-REQ-260823-7TCQ).
- **Engine regression idea:** regression-test the gate itself: seed a repo
  fixture with a `fetch` sink under an excluded tree and assert the gate can
  be configured to see it ("gate visibility is independent of completeness
  scoping").

### KI-26 — `--cache-path` writes to unconstrained `path.resolve` destinations

- **Should have caught:** `path_containment` sink family (external-string
  `path.resolve` feeding `mkdirSync`/`writeFileSync`, `fetch-wptfyi.ts:224-226`);
  or the operator-CLI trust-boundary rule (same as KI-23).
- **Why it escaped:** **`production_include=src/**` excludes `scripts/**`**;
  plus the missing operator-CLI threat model — `cachePath` is documented as an
  operator convenience, and "operator" was implicitly trusted end-to-end even
  though the value flows in from wrappers/state in practice.
- **Correction locus:** **model/overlay** (SYS-REQ-260823-MPS4) + engine
  `path_containment` family.
- **Engine regression idea:** shared with KI-23 — one containment family covers
  both write sinks.

### KI-27 — API-provided results URLs fetched without host allowlist

- **Should have caught:** the egress sink family again — `fetchFn(downloadUrl)`
  (`fetch-wptfyi.ts:189`) is a variable-target fetch, precisely what an egress
  probe exists to surface; an allowlist obligation (`egress_allowlisted_hosts`)
  on a `wptfyi_ingest` requirement.
- **Why it escaped:** **disabled gate + `production_include=src/**` excludes
  `scripts/**`** (identical double-cause to KI-25); additionally the dataflow
  ("bytes from API response become URLs this process dereferences") spans two
  functions, and no modeled requirement covered second-hop trust at all — the
  runs API was treated as ground truth rather than as attacker-influencable
  input.
- **Correction locus:** **model/overlay** (SYS-REQ-260823-Z8HR names the
  allowlist set explicitly); engine-side the same visibility fix as KI-25.
- **Engine regression idea:** taint-style pairing signal — when a sink argument
  traces to a *response* field rather than a literal/config constant, mark it
  for allowlist review even inside governed files.

### KI-28 — `getGitNotesLog` interpolates into `execSync`

- **Should have caught:** a `command_injection` sink family (shell-executed
  string built by template interpolation over parameters); or an audit of the
  kernel against its own AGENTS.md contract. Note the irony that makes this
  escape special: `safe-child-process.ts` sits on the guard's own
  `ALLOWED_FILES` exemption list, so the file guaranteed to contain
  child_process usage was also exempted from every scan that looks for it.
- **Why it escaped:** **`production_include=src/**` excludes `scripts/**`**;
  the **ALLOWED_FILES carve-out removed scrutiny exactly where child_process
  lives** (trust was placed in a filename, not a pattern — `execGit`/`addGitNote`
  do it right, `getGitNotesLog` does not, and nothing distinguished them);
  and no requirement owned the kernel's behavior.
- **Correction locus:** **model/overlay** (SYS-REQ-260823-0A2D pins the argv
  pattern as the contract); **engine**: add shell-interpolation to sink
  families and audit exemption-list files *more*, not less.
- **Engine regression idea:** policy-gate self-audit — evidence profiles that
  periodically re-verify allowed files still uphold the policy they are
  exempted for (here: "all exec in safe-child-process.ts is argv-form").

### KI-29 — `gunzipSync` without `maxOutputLength`

- **Should have caught:** a resource-budget obligation on the ingest path
  (`decompressed_output_budget_bytes`, now SYS-REQ-260823-JS16); catalog
  already has `resource_exhaustion` (KI-16…KI-19 used it library-side), but no
  scan looked for uncapped inflation in tooling.
- **Why it escaped:** **`production_include=src/**` excludes `scripts/**`**;
  plus a **crash-freedom-vs-budget mismatch** specific to this finding: every
  prior availability tripwire (KI-18 nesting RangeError, KI-17 expansion,
  KI-19 cartesian growth) fired because the failure mode *crashed or timed out*
  observably. `gunzipSync` without a cap does not crash — it silently
  allocates and returns, so "no crash observed" read as "budget respected".
  The existing obligation shapes asked for crash-freedom; none demanded a
  numeric output ceiling at an inflate boundary. The silent
  catch-to-raw-bytes fallback (:83-85) compounded the invisibility by turning
  even hard errors into normal-looking output.
- **Correction locus:** both — **model/overlay** now carries the numeric domain
  (5 MiB demonstrated from 5128 bytes, 1022.4x; budget leg 655360 bytes;
  ceiling 33554432); **engine/catalog** should grow an inflate/expand sink
  family keyed on `gunzip|inflate|brotliDecompress` + missing
  `maxOutputLength`.
- **Engine regression idea:** budget-obligation lint — where a requirement
  declares a `_bounded`/`_budget` output variable, require at least one
  in-scope call site enforcing a matching cap option.

### KI-30 — `check-safe-exec` literal-only import ban

- **Should have caught:** nothing in Proof could — this is a **meta-finding:
  the enforcement gate itself is the defect**, and no check audits a checker.
  The honest answer is that only adversarial testing of the guard (seeded
  violation fixtures, i.e. what the reproducer now does) could catch it.
- **Why it escaped:** **`production_include=src/**` excludes `scripts/**`**
  so the guard's logic was never in any verification universe; deeper, the
  project had no notion of *negative-testing a control* — AGENTS.md states the
  Safe Subprocess Execution mandate ("Direct imports … are banned and enforced
  via pnpm run check:safe-exec") but nothing verified the *enforcement matches
  the wording* ("direct imports" ≠ "all acquisitions"). A literal-regex
  detector was accepted as fulfilling a semantic contract.
- **Correction locus:** **model/overlay** (SYS-REQ-260823-486K requires
  detection across acquisition forms); **engine** gains a generalizable idea:
  controls-as-code under test — any check script that gates CI should accept
  seeded-violation fixture suites as its own evidence profile.
- **Engine regression idea:** for each repo-defined policy gate, run a
  mutation pass (literal → computed specifier; static → dynamic) over its
  detector and require the detector to fail loudly on known mutations.

---

## Summary — would `security_surface_covered` or extended `production_include`
## have caught these?

Answered against how the configs actually scope, per `proof help
security_surface` and `proof.yaml` at HEAD `83ce08f`.

**Enabling `security_surface_covered` alone: catches none of the ten today.**
Two independent reasons: (a) the check is disabled in this repo, and its
documented rationale records that a hunt *did* find scripts/wpt/node/run.ts
egress and dismissed it; (b) more fundamentally, the gate probes "**in-scope
production source files**", and scope = `completeness.production_include` =
`src/**`. With `scripts/**` in `production_exclude`, enabling the flag scans
the same src-only universe it always did — the ten findings stay invisible.
The flag is a severity upgrade for sinks *already in scope*, not a scope
widener.

**Extending `production_include` to include `scripts/**`: would likely have
caught 2 of 10 directly (KI-25, KI-27), pressured the file containing 2 more
(KI-15, KI-24), and missed the rest.** Honest accounting:

| KI | Caught if scripts were production-in-scope AND gate enabled? | Why |
|----|--------------------------------------------------------------|-----|
| KI-15 | Indirectly | File-level flagging comes from sink families; `readFileSync(path.join(...))` is not a shipped family — no direct hit. But governance pressure on run.ts would surface it in review. |
| KI-20 | No | No shipped sink family matches `eval`/`vm.*`; needs a new `code_injection` family. |
| KI-23 | No | Path interpolation is not a sink family; needs `path_containment`. |
| KI-24 | Indirectly | Same file as KI-15's join; same reasoning. |
| KI-25 | **Yes** | Bare `fetch(...)` matches the shipped **egress** family; run.ts becomes an ungoverned security surface → release-blocking ERROR. |
| KI-26 | No | Write-containment not a family; needs `path_containment`. |
| KI-27 | **Yes** | Variable-target `fetchFn(downloadUrl)` matches **egress**; flagged ungoverned. |
| KI-28 | No | Shell-built `execSync` is not a family; needs `command_injection`. |
| KI-29 | No | Uncapped inflate not a family; needs decompression-budget probe. |
| KI-30 | No | Meta-gap: no scanner audits a checker; needs control negative-testing. |

Caveats on the two "Yes" rows: ownership alone is not a fix — the gate then
hands each file to `negative_path_witness_required`, which demands a
security-classed requirement with a witnessed reject path; without the model
side (this batch's reqs) the gate would have been satisfied by paperwork unless
the class genuinely matched. That is why the durable correction is **both**:
scope/families in the engine, owners and numeric domains in the overlay — which
is what batch A2 landed.

**Systemic causes named, for the record:** (1) `production_include=src/**`
excluded `scripts/**` from every production-scoped check — applies to all ten;
(2) missing trust-boundary threat model for operator CLIs and maintainer
tooling — KI-20 (vendored content as trusted), KI-23/KI-26 (argv as trusted),
KI-27 (API response fields as trusted), KI-28 (kernel params as trusted),
KI-15/KI-24/KI-25 (fixture JS granted host bridges without contracts);
(3) crash-freedom-vs-budget mismatch — KI-29 (silent allocation vs observable
crash); (4) enforcement-gate self-trust — KI-30 (and KI-28's ALLOWED_FILES
carve-out as its sibling failure mode).
