# Review: bugs and improvement ideas

> **Scope:** this review covers the app as it will be once the two open PRs are merged:
> `origin/main` (`dda7f0b`) + PR #3 `ticket4-sanitization` (`deeea29`) + PR #4 `ticket5-invalid-characters` (`50faf1c`).
> All `file:line` references point at that combined tree. This PR only adds this document. It does not change any app code.

## Contents

1. [Summary](#1-summary)
2. [Scope and method](#2-scope-and-method)
3. [Bugs](#3-bugs)
4. [Known issues](#4-known-issues)
5. [Accessibility](#5-accessibility)
6. [Code quality](#6-code-quality)
7. [Improvement ideas](#7-improvement-ideas)
8. [Prioritised recommendations](#8-prioritised-recommendations)
9. [Sources](#9-sources)

---

## 1. Summary

The five findings that matter most:

1. **Results for the wrong sequence (High).** If Screen 1 cannot save the input to `sessionStorage`, it still opens the results page. That page then shows the *previous* sequence's results, or a false "No DNA Sequence Found". This happens when the input is over about 5.2 million characters, and also when browser storage is blocked. → [B1](#b1-results-for-the-wrong-sequence-when-the-input-cannot-be-saved)
2. **Multi-record FASTA is silently merged (High).** Pasting `>fwd … >rev …` joins both primers into one sequence. The app then reverse-complements that merged sequence, exports it as a single record, and gives no warning. → [B2](#b2-multi-record-fasta-is-silently-concatenated)
3. **Melting temperature is too low for typical primers (High, accuracy).** For 14 nt and longer, the app uses the long-duplex %GC formula. It gives results 5–15 °C below nearest-neighbour values. Adding one base at the 13 → 14 nt threshold can drop the Tm by 14 °C. → [B3](#b3-melting-temperature-underestimates-primers-and-jumps-at-14-nt)
4. **Blank page after Back (Medium).** Click "Start New Sequence", then press the browser Back button. The results page comes back from the back/forward cache still faded out (`opacity: 0`), so the screen is empty. → [B4](#b4-blank-page-after-start-new-sequence-then-back)
5. **Long sequences push the actions out of reach (Medium).** At 100 kb the Download button sits 34,560 px down the page on desktop and 122,096 px down on a phone. At 1 Mb it is 342,280 px down. → [B5](#b5-long-sequences-make-the-actions-unreachable)

Top recommendations, all possible within the vanilla JS / no-backend rules:

- Fix B1, B2, B4 and B5 (each is small).
- Replace the Tm formula with a nearest-neighbour model that takes Na⁺/Mg²⁺ inputs.
- Add a **primer checklist** panel: length, GC %, GC clamp, runs, Tm range.
- Add the **real-time validation** that the MVP workbook lists as a must-have.

---

## 2. Scope and method

| Item | Detail |
|---|---|
| Code | Throwaway checkout: `git worktree add --detach … origin/main`, then `git merge origin/ticket4-sanitization origin/ticket5-invalid-characters`. The merge was clean. |
| Files read | `index.html`, `results.html`, `invalid.html`, every file in `src/` (`calc.js`, `export.js`, `init.js`, `main.js`, `invalid.js`, `mock-data.js`, `counter.js`, the three CSS files), `vite.config.js`, `.github/claude-instructions.md`, the MVP workbook |
| Pure-function checks | Node 24.22.1, importing `src/calc.js` and `src/export.js`. Covered: reverse complement, RNA, GC %, Tm around the 14-nt threshold, six-frame ORF edge cases, every export format, and about 30 cleaning/validation inputs (lowercase, CRLF/CR, BOM, multi-record, headers only, U/N/X, `.`/`*`, NBSP, zero-width, emoji, combining marks, full-width digits). Also timing at 100 kb, 1 Mb and 5 Mb. |
| Tm reference | Biopython 1.88 `Bio.SeqUtils.MeltingTemp` [1]. Used to confirm which formula the app applies and to compute nearest-neighbour values (SantaLucia 1998 parameters [2], Owczarzy 2008 Mg²⁺ correction [3]). |
| Browser checks | Headless Chrome 158 (`--headless=new`) driven over the DevTools protocol against `vite build` + `vite preview`, at 1440×900 and 390×844 (mobile emulation). Input was set through `sessionStorage` or the textarea. Covered: 100 kb / 1 Mb input, storage quota and storage blocked (a `sessionStorage` getter that throws), keyboard tab order and the download menu, Back/Forward, downloads (files saved and inspected), clipboard, file upload (UTF-16, Latin-1, binary, `.fas`, 20 MB), an HTML/script payload (XSS), JavaScript disabled, and a build with `--base=/my-app/`. |
| Contrast | WCAG 2 contrast ratios computed from the CSS colour tokens |
| Not verified | Real screen readers (VoiceOver/NVDA); Safari and Firefox (their bfcache and storage limits differ); a physical phone; drag-and-drop of files onto the textarea; Chrome's real "block all site data" setting (simulated as described above) |

---

## 3. Bugs

| ID | Title | Severity | Main location |
|---|---|---|---|
| [B1](#b1-results-for-the-wrong-sequence-when-the-input-cannot-be-saved) | Results for the wrong sequence when the input cannot be saved | **High** | `src/init.js:117-126` |
| [B2](#b2-multi-record-fasta-is-silently-concatenated) | Multi-record FASTA is silently concatenated | **High** | `src/calc.js:37-44` |
| [B3](#b3-melting-temperature-underestimates-primers-and-jumps-at-14-nt) | Tm underestimates primers and jumps at 14 nt | **High** (accuracy) | `src/calc.js:17-20, 141-153` |
| [B4](#b4-blank-page-after-start-new-sequence-then-back) | Blank page after "Start New Sequence" then Back | Medium | `src/main.js:230-244`, `src/style.css:638-641` |
| [B5](#b5-long-sequences-make-the-actions-unreachable) | Long sequences make the actions unreachable | Medium | `src/style.css:318-332` |
| [B6](#b6-placeholder-results-look-real-when-the-script-does-not-run) | Placeholder results look real when the script does not run | Medium | `results.html:67-136` |
| [B7](#b7-hard-coded-root-paths-break-sub-path-hosting) | Hard-coded root paths break sub-path hosting | Low | `src/init.js:126`, `src/main.js:73, 242`, `src/invalid.js:56`, `invalid.html:148` |
| [B8](#b8-reading-frame-edge-cases) | Reading-frame edge cases | Low | `src/calc.js:166-187` |
| [B9](#b9-upload-and-input-format-gaps) | Upload and input-format gaps | Low | `src/init.js:36, 54-85`, `src/calc.js:37-44` |
| [B10](#b10-unicode-edge-cases-on-the-warning-screen) | Unicode edge cases on the warning screen | Low | `src/calc.js:43, 83`, `src/invalid.js:113-116` |
| [B11](#b11-compute-time-exceeds-the-50-ms-budget-from-about-05-mb) | Compute time exceeds the 50 ms budget from about 0.5 Mb | Low | `src/main.js:58-62`, `src/calc.js:171-187` |
| [B12](#b12-results-logo-link-goes-nowhere) | Results logo link goes nowhere | Low | `results.html:33` |

Accessibility bugs are listed separately in [section 5](#5-accessibility).

### B1. Results for the wrong sequence when the input cannot be saved

**Severity:** High. The app shows another sequence's reverse complement and Tm without any warning. That is exactly the "wrong order" risk the product exists to prevent.

**Steps**
1. Process any short sequence, for example `AGCCCTCCAGGACAGGCTGCATCA`, and press Back.
2. Paste a sequence of more than about 5.2 million characters and press **Next**. Chrome accepted at most 5,242,308 characters for this key. MDN gives the limit as 5 MiB per origin [17].

**Expected:** a message on Screen 1 saying the sequence is too large, or results for the new input.

**Actual:** the results page shows the earlier 24-bp results (Input Length 24, RC `TGATGCAGCCTG…`). The console only logs `QuotaExceededError`.
- If no earlier run exists, the user lands on "No DNA Sequence Found".
- If `sessionStorage` is blocked (simulated with a getter that throws `SecurityError`), every *valid* sequence ends on "No DNA Sequence Found".

**Location:** `src/init.js:117-126` catches the write error but still navigates. `src/main.js:48-61` and `src/invalid.js:41-51` then read whatever value is left in storage.

**Fix:**
- Call `sessionStorage.removeItem(KEY)` before `setItem`, so a stale value can never survive a failed write.
- If `setItem` throws, stay on Screen 1 and show the error in `#upload-status`.
- Add an explicit input size limit, for example 1 M characters, for paste and upload.
- A more robust option is to avoid handing data between pages at all: one page that switches views.

### B2. Multi-record FASTA is silently concatenated

**Severity:** High. Researchers routinely keep a forward and a reverse primer in one FASTA block.

**Steps:** paste
```
>fwd primer
AGCTAGCTAGCTAGCTAG
>rev primer
TTTTGGGGCCCCAAAA
```

**Expected:** each record handled separately, or at least a warning such as "2 records found".

**Actual:**
- `cleanSequence` drops both header lines and joins the rest, so the input becomes `AGCTAGCTAGCTAGCTAGTTTTGGGGCCCCAAAA` (34 nt).
- Validation passes. The RC, the Tm and every export describe a sequence that does not exist.
- The FASTA export holds one record, `>Reverse_complement_DNA length=34`.

**Location:** `src/calc.js:37-44`. Headers are filtered out, then all lines are joined.

**Fix:** split the input into records at header lines.
- With more than one record, send the user to the warning screen ("Multiple sequences found"), or process the first record and say so.
- Keep the record ID so the exports can reuse it (see [Q6](#6-code-quality)).

### B3. Melting temperature underestimates primers and jumps at 14 nt

**Severity:** High (scientific accuracy). The Tm is the app's headline feature ("Cooking Temperature").

For 14 nt and longer, the app applies `Tm = 81.5 + 16.6·log10[Na⁺] + 0.41·%GC − 675/N`. That is Biopython's `Tm_GC` value set 3, attributed to Marmur & Doty 1962 and Schildkraut & Lifson 1965 [1]; Biopython reproduces the app's numbers exactly. The formula comes from long DNA duplexes. Primer3 recommends SantaLucia 1998 nearest-neighbour thermodynamics instead and uses that as its default [4]. Vendor calculators also use nearest-neighbour methods [8][9].

| Primer | nt | App | Wallace | NN, 50 mM Na⁺ | NN, 50 mM Na⁺ + 1.5 mM Mg²⁺ + 0.2 mM dNTP |
|---|---|---|---|---|---|
| MVP example `AGCCCTCCAGGACAGGCTGCATCA` | 24 | **57.4** | 78 | 65.5 | 72.9 |
| M13 fwd `GTAAAACGACGGCCAGT` | 17 | **41.9** | 52 | 51.7 | 57.4 |
| M13 rev `CAGGAAACAGCTATGAC` | 17 | **39.5** | 50 | 46.1 | 51.7 |
| T7 `TAATACGACTCACTATAGGG` | 20 | **42.6** | 56 | 46.8 | 52.6 |
| `ACGTACGTAGCTAGCTGACT` | 20 | **46.7** | 60 | 54.4 | 60.4 |

The NN columns use Biopython `Tm_NN` with the SantaLucia/Allawi unified table, 125 nM of each strand, and salt correction 5 (Na⁺ only) or 7 (Owczarzy 2008, with Mg²⁺) [1][2][3]. In PCR buffer, with Mg²⁺ present, the app is 10–15 °C low. A common rule is to anneal about 5 °C below the primer Tm [5]. Applied to the app's value, that gives an annealing temperature far too low and invites non-specific products.

The formula also changes at the threshold, so one extra base moves the result abruptly:

| Sequence | nt | Method | Tm |
|---|---|---|---|
| `ATATATATATATA` | 13 | Wallace | 26 °C |
| `ATATATATATATAT` | 14 | salt-adjusted | **11.7 °C** |
| `ACGTACGTACGTA` | 13 | Wallace | 38 °C |
| `ACGTACGTACGTAC` | 14 | salt-adjusted | 32.2 °C |

For sequences longer than primers (for example the 1,432-bp sample, or 100 kb → 80.2 °C), the big number is a whole-duplex Tm. It has no meaning for a primer order, but it gets the same emphasis.

**Location:** `src/calc.js:17-20` (constants) and `src/calc.js:141-153`.

**Fix:**
- Implement nearest-neighbour Tm (SantaLucia 1998 [2]): a 10-row table, about 40 lines of plain JS.
- Use Primer3's defaults (50 mM Na⁺, 1.5 mM Mg²⁺, 0.6 mM dNTP) [4], editable by the user, with the Mg²⁺ correction from [3].
- Keep Wallace as a secondary "rule of thumb" value, which also matches the pitch (see [Known issues](#4-known-issues)).
- Above about 60 nt, label the Tm as "not a primer Tm" or hide the big number.

### B4. Blank page after "Start New Sequence" then Back

**Severity:** Medium.

**Steps:** process a valid sequence → click **Start New Sequence** → press the browser **Back** button.

**Expected:** the previous results, or Screen 1.

**Actual:** an empty dark page. Chrome restores `results.html` from the back/forward cache with `body.is-leaving` still set, so the page is at `opacity: 0`. The buttons are still there and clickable, but invisible.

**Location:**
- `src/main.js:240` adds the class and never removes it.
- `src/style.css:638-641` defines the fade.

**Fix:** pick one.
- Listen for `pageshow` and, when `event.persisted` is true, remove `is-leaving` and re-render from storage, as web.dev recommends [18].
- Navigate with `location.replace("/")`, so the results page is not kept in history.

### B5. Long sequences make the actions unreachable

**Severity:** Medium.

**Steps:** process a 100 kb sequence (for example, one uploaded from a `.fasta` file).

**Actual:** both strands are printed in full in `<pre>` blocks that have no height limit.

| Input | Viewport | Page height | Download button at |
|---|---|---|---|
| 100 kb | 1440 px | 34,710 px | y = 34,560 |
| 100 kb | 390 px | 122,246 px | y = 122,096 |
| 1 Mb | 1440 px | 342,430 px | y = 342,280 |

Download and Start New Sequence sit below both strands. On desktop the analytics panel stays in view (sticky), but the actions do not. Load time stays acceptable (about 0.4–0.6 s).

**Location:** `src/style.css:318-332` (`.strand-body`). The actions come after both strands in `results.html:148-176`.

**Fix:**
- Give `.strand-body` a `max-height` (for example 16rem) with `overflow: auto`, plus `tabindex="0"` and a label, so keyboard users can scroll it.
- Optionally show only the first N kb, with a "Show all" control.
- Move the actions into the panel header.

### B6. Placeholder results look real when the script does not run

**Severity:** Medium. A lab tool must not show made-up numbers next to a "Validated" label.

**Steps:** open `results.html` with JavaScript disabled, or any time `main.js` fails to load or throws.

**Actual:** the page shows a complete fake result:
- the status chip reads **Validated**;
- the strands are 78-nt mock sequences;
- the metrics read 64 °C ("Wallace rule estimate…"), 1,432 bp, 53.4 % GC, +1 Sense and 110 aa;
- the header shows `Run ID: SC-9042-PROCESSED`.

This was reproduced in headless Chrome with JavaScript disabled. The same values are probably the first paint before the module runs, but that was not measured.

**Location:** `results.html:67, 86, 99, 116-136`. The run ID is at `results.html:46` (a known issue).

**Fix:**
- Ship neutral placeholders ("—", or an empty chip).
- Set "Validated" only from `showResults`.
- Add a `<noscript>` message.

### B7. Hard-coded root paths break sub-path hosting

**Severity:** Low (applies only to sub-path hosting).

**Steps:** run `vite build --base=/my-app/`, as needed for GitHub Pages project sites.

**Actual:** Vite prefixes the asset URLs (`/my-app/assets/…`). The navigation targets stay `/results.html`, `/invalid.html` and `/`, so they leave the app.

**Location:**
- `src/init.js:126`
- `src/main.js:73, 242`
- `src/invalid.js:56`
- `invalid.html:148` (`href="/"`)

**Fix:** use relative URLs (`"results.html"`, `"./"`) or `import.meta.env.BASE_URL`.

### B8. Reading-frame edge cases

**Severity:** Low (secondary metric).

These outputs were reproduced in Node:
- **An ORF that runs off the end is ignored.** For `ATGAAATAA` + `ATG` + 30×`AAA`, the result is "+1, 2 aa". The open 31-codon ORF is not counted, because ORFs without a stop codon are excluded (`src/calc.js:169`). Partial coding sequences are common when users paste fragments.
- **No minimum length.** `ATGTAA` reports Active Frame +1 with a yield of 1 aa. NCBI ORFfinder makes the user pick a minimal ORF length of 30–600 nt [11].
- These behave as documented: no ORF → "None"; inputs shorter than 3 nt → "None"; nested ATGs are measured from the first one; frames −1 to −3 read the reverse complement at offsets 0–2.

**Fix:**
- Report an open-ended ORF as "partial (no stop)".
- Add a minimum ORF length, for example 30 codons, below which "None" is shown.

### B9. Upload and input-format gaps

**Severity:** Low.

- **No file-size limit.** A 20 MB `.fasta` took about 4 s to load into the textarea, which also freezes the UI. Pressing Next afterwards triggers B1. (`src/init.js:54-85`)
- **Common FASTA extensions are rejected.** `.fas`, `.fna`, `.ffn`, `.fsa` and `.seq` get "Unsupported file type". (`src/init.js:36`, `index.html:81`)
- **Comment and GenBank lines are not removed.** Old-style FASTA `;` comment lines and the GenBank `ORIGIN` / `//` lines are flagged as invalid characters instead of being removed. GenBank-style numbered blocks *are* cleaned correctly.
- **Encodings behave correctly.** A UTF-16 file with a BOM is decoded correctly. A Latin-1 or binary file is read as text and then flagged on the warning screen, which is reasonable.

### B10. Unicode edge cases on the warning screen

**Severity:** Low (cosmetic).

- **Multi-code-point emoji are over-counted.** A family emoji (ZWJ sequence) counts as 5 positions and a flag as 2. The comment at `src/calc.js:77-79` says an emoji counts as one position "as the user sees it", which holds only for single-code-point emoji.
- **Combining marks are nearly invisible.** A combining accent (`Á`) is flagged as a tile that shows only the mark (`src/invalid.js:113-116` labels only `\p{C}` characters).
- **Upper-casing changes the length.** `toUpperCase()` turns `ß` into `SS`, so one typed character is reported as 2 invalid positions (`src/calc.js:43`).
- **Checked and fine:** no non-ASCII character upper-cases into A/C/G/T, so nothing can turn into a "valid" base by accident.

**Fix:**
- Upper-case only ASCII letters.
- Count positions with `Intl.Segmenter`.
- Label combining marks (`\p{M}`) by their code point.

### B11. Compute time exceeds the 50 ms budget from about 0.5 Mb

**Severity:** Low.

`main.js:58-59` cites a 50 ms budget. Measured values for `analyse()`:

| Input | Chrome | Node |
|---|---|---|
| 100 kb | 22 ms | 20 ms |
| 1 Mb | 106 ms | 170 ms |
| 5 Mb | — | 590 ms |

Most of the time goes to the six-frame scan, which takes a `slice()` for every codon (`src/calc.js:175-176`). Comparing character codes instead would avoid the per-codon string allocation. If the size limit from B1 is added, this matters less.

### B12. Results logo link goes nowhere

**Severity:** Low.

`results.html:33` has `<a class="brand" href="#" aria-label="SequenceChef home">`. It is focusable and announced as "home", but it only adds `#` to the URL.

**Fix:** use `href="./"`, ideally with the same storage-clearing behaviour as Start New Sequence, or make it a plain element.

### Checked and working

- **Calculations:**
  - The reverse complement of the MVP example matches the workbook (`TGATGCAGCCTGTCCTGGAGGGCT`).
  - These inputs are cleaned correctly: lowercase, CRLF, old-Mac CR, BOM, NBSP, tabs and indented headers.
  - U, N, X, `.` and `*` are flagged, with correct positions.
- **Exports:** FASTA wraps at 70 characters, which is within NCBI's recommended 80 [12]. CSV and JSON are well formed.
- **Layout and controls:**
  - No horizontal overflow at 390 px on any of the three pages.
  - Escape closes the download menu and returns focus to the button.
  - Copy writes the right strand to the clipboard.
- **XSS:** no XSS. All user-derived text goes through `textContent`. A `<img onerror>` / `<script>` payload was shown as text on the warning screen and Screen 1, and no element was created. The only `innerHTML` in the codebase is in the unused `src/counter.js`.

---

## 4. Known issues

These were already known before this review. They are listed for completeness and were not investigated further.

1. **RNA strand source.** The RNA is transcribed from the reverse complement (`src/calc.js:237`). The MVP workbook example transcribes the input strand (`AGCCCUCCAGGACAGGCUGCAUCA`).
2. **Tm method naming.** The Wallace rule is used only below 14 nt, with the salt-adjusted formula above that. The pitch says "Wallace formula". See [B3](#b3-melting-temperature-underestimates-primers-and-jumps-at-14-nt) for why the formula above 14 nt is itself a problem.
3. **Button label.** The main button says "Next: Process Sequence". The MVP calls it "Cook Sequence".
4. **Run ID.** "Run ID: SC-9042-PROCESSED" on the results page is fixed text (`results.html:46`).
5. **Position counting.** Invalid positions are counted in the cleaned sequence, not in the text the user typed.
6. **Double Back.** Pressing Back twice after a valid run can bounce from the warning page to the results.

---

## 5. Accessibility

| # | Issue | Where | Fix |
|---|---|---|---|
| A1 | **Small text below 4.5:1 contrast** on the results page (WCAG 1.4.3 [20]). `--text-muted` `#64748b` is 4.03:1 on the canvas (Run ID, step labels, footer), 3.73:1 on panels (compute time, metric labels), 3.59:1 in strand headers (5′→3′) and 3.07:1 on the Tm card (method note). The RNA tag is 3.54:1. | `src/style.css:29`, `.strand-tag--rna` | Lighten the muted token to about `#8b9bb0` (5.2–6.8:1 on all four surfaces). Use `#a78bfa` for the RNA tag text (5.5:1). |
| A2 | **Textarea placeholder at 2.45:1.** Placeholder text is covered by 1.4.3 [20]. | `src/init.css:163-167` | Use `#64748b` (4.55:1 on `#f8fafc`) |
| A3 | **Invisible tab stop.** The hidden file input is reachable with Tab. The order is textarea → sample select → *1×1 px file input* → upload button. | `index.html:81`, `.visually-hidden` | Add `tabindex="-1"` or the `hidden` attribute; `fileInput.click()` still works |
| A4 | **Download menu does not follow the menu pattern.** `role="menu"` is used without its keyboard model: focus stays on the button when the menu opens, arrow keys do nothing, and tabbing away leaves the menu open. The APG menu button pattern expects Enter/Space to open the menu and move focus to the first item [19]. | `src/main.js:173-212`, `results.html:155-166` | Implement arrow keys and focus management, or drop `role="menu"`/`menuitem` and use a simple disclosure (a list of buttons) |
| A5 | **Two buttons named "Copy",** and the "Copied!" feedback is not announced (there is no live region) | `results.html:84, 97`, `src/main.js:141-160` | `aria-label="Copy reverse complement"` and similar; announce through a polite live region |
| A6 | **`aria-label` on `<pre>`** (generic role). Screen readers do not reliably announce names on generic elements. *Not confirmed with a screen reader.* | `results.html:86, 99` | Label a `role="region"` wrapper, or rely on the visible `<h2>` |
| A7 | **Metric values use `<output>`,** which has an implicit `status` (live) role, so values may be announced on load. *Not confirmed with a screen reader.* | `results.html:124-136` | Use `<span>`, since the values are not results of a form |

Already good:
- every form control has a label;
- `lang="en"` is set;
- the textarea, select and buttons have visible focus styles;
- the upload status uses `role="status"`;
- the warning page is a separate page with its own `<title>`.

---

## 6. Code quality

These items can cause bugs later.

| # | Finding | Where |
|---|---|---|
| Q1 | **Storage handling duplicated three times.** The storage key `"sequenceChef.rawSequence"` and an identical `readSavedSequence()` are each copied into three files. A typo in one silently breaks the hand-over. | `src/init.js:33, 136`, `src/main.js:13, 48`, `src/invalid.js:18, 41` → one `src/storage.js` exporting `KEY`, `readSaved()`, `save()` |
| Q2 | **Unused Vite template files.** `src/counter.js` (with `innerHTML`), `src/assets/hero.png`, `src/assets/javascript.svg`, `src/assets/vite.svg`, and `public/icons.svg` (copied into `dist/`). | delete |
| Q3 | **Stale comments and placeholder text.** "Presentation layer only. There is no calculation logic yet…", "Integration note…", "Intentionally empty for FE-1", and the Tm note placeholder "Wallace rule estimate…". | `results.html:5-6, 57-58, 118, 198` |
| Q4 | **Misleading constant name.** `WALLACE_MAX_LENGTH = 14` is used with `<`, so Wallace applies up to 13 nt. A name like `SALT_ADJUSTED_MIN_LENGTH` would say what it does. | `src/calc.js:19, 146` |
| Q5 | **Placeholder example is not a sequence.** The textarea placeholder gives a gene *name* as its example ("e.g., HumIns_gene_v3"). Pasting that text is flagged as invalid. | `index.html:63` |
| Q6 | **Exports leave out the input.** None of the exports include the input sequence or its FASTA ID. The file name is always `sequencechef-results.*`, so two downloads cannot be told apart. | `src/export.js:22-73`, `src/main.js:198` |
| Q7 | **`design/` clutter.** It holds three `.zip` copies of the design exports and a 28-byte `screen.png` that is really the text "`<FIFE Image failed to fetch>`". | `design/stitch_…(1)/screen.png` |

---

## 7. Improvement ideas

### What the workbook says

The MVP workbook (Exercise 2) marks two features **Remove**:
- #8, "File uploader to directly parse and process large, multi-line .fasta files". A basic uploader already exists.
- #9, "Protein translation matrix". This contradicts Nice-to-have #3, "protein translation preview", so the team should settle it.

It marks **Real-time input validation** as a **Must-have** (#6). Today, validation runs only when Next is clicked.

### What primer users need

The research below covers vendor and community guidance plus established free tools.

- **Length 18–30 nt and GC 40–60 %** (Qiagen [5]). Others narrow this: 18–24 nt (Addgene [7]), 18–22 bp (Premier Biosoft [6]).
- **Tm.**
  - Target ranges: 50–60 °C (Addgene [7]), 52–58 °C (Premier [6]). Primer3 defaults to 57/60/63 °C [4].
  - Pair members should be within 5 °C of each other [6][7].
  - Anneal about 5 °C below the Tm (Qiagen [5]).
  - Vendor calculators ask for the polymerase, the primer concentration and the salt, because the Tm depends on all three [8][9].
- **3′ end.**
  - No more than 3 G/C in the last 5 bases [6].
  - No run of 3 or more G/C at the 3′ end, and no T as the last base [5].
  - Start and end with 1–2 G/C [7].
- **Runs and repeats:** at most 4 identical bases in a row, and at most 4 dinucleotide repeats [6].
- **Secondary structure:** avoid self-complementarity and complementarity between the two primers. Tolerated ΔG is about −2/−3 kcal/mol for hairpins and −5/−6 kcal/mol for dimers (3′ end / internal) [6]. Vendor tools give only a rough primer-dimer estimate [9].
- **Other numbers vendor tools report:** molecular weight, extinction coefficient, nmol/OD and µg/OD, used for resuspending an order [8][9]. OligoCalc reports MW, GC % and absorbance coefficient, with three Tm methods [16].
- **Degenerate primers** use IUPAC codes (R, Y, S, W, K, M, B, D, H, V, N) [13]. NCBI asks for IUPAC symbols in FASTA, with N for unknown bases [12].
- **GC-rich regions:** NEB defines a GC-rich template as ≥ 60 % G/C [15]. Such regions are hard to amplify and worth flagging.
- **Restriction sites** are often added to primer 5′ ends, with a 3–6 bp clamp [7]. NEBcutter is the usual site finder [14].
- **An existing all-JavaScript precedent:** the Sequence Manipulation Suite runs entirely in the browser. It includes Reverse Complement, Group DNA (ruler and grouping), ORF Finder, Translate, Primer Map, Restriction Summary, DNA Molecular Weight and PCR Primer Stats [10]. All of these are possible without a backend.

### UX

| Idea | Notes |
|---|---|
| **Live validation on Screen 1** | Show length, GC % and invalid-character count while the user types. This delivers MVP must-have #6. Debounce it, and cap it for very large inputs. |
| **Highlight invalid characters in place** | Use a mirrored `<div>` behind a transparent textarea, or a short preview under it showing about ±10 bases around each flagged position. |
| **One-click fixes on the warning page** | "Convert U → T", "Remove N/X", "Keep first record only" (for [B2](#b2-multi-record-fasta-is-silently-concatenated)). |
| **Show the processed input on the results page** | Label it 5′→3′ with its own Copy button, so the user can check what was processed. Label each output explicitly ("RNA of input strand" vs "RNA of reverse complement") to resolve known issue 1. |
| **Ctrl/Cmd + Enter to "Cook"** | Also rename the button (known issue 3). |
| **Short history** | The last 5 sequences in `localStorage`, opt-in, with a "Clear" button. Unpublished sequences can be confidential. |
| **Exports carry the input and its ID** | Name files after the FASTA ID, plus a "Copy as FASTA" option. |

### Visualisation

Everything in this table works in plain HTML/CSS/SVG/Canvas, with no library.

| Idea | How | Notes |
|---|---|---|
| Colour-coded bases | `<span>` per base with the existing `--base-a/t/c/g/u` tokens (`src/style.css:36-41`, already "for a later ticket") | Cap at about 10 kb of spans, or draw on `<canvas>` for longer inputs |
| Ruler, position numbers, 10-base groups | GenBank-style rows (`1 agcttagcta gctagctagc …`), like SMS "Group DNA" [10] | Makes the flagged positions easy to find |
| Paired strand view | Two monospace rows, 5′→3′ over 3′→5′, with optional pairing ticks | Teaches what "reverse complement" means |
| Base-composition bar | One stacked bar (A/T/C/G %) in CSS or SVG | Cheap, very readable |
| GC sliding-window chart | SVG `<polyline>`, window of 20 nt for primers or 100 nt for genes, with a band at 60 % [15] | Flags GC-rich stretches |
| Primer checklist panel | ✓/⚠ rows: length, GC %, Tm range, GC clamp, runs, dinucleotide repeats, 3′ T, simple self-complementarity | The single most useful addition for primer orders [5][6][7] |
| Six-frame ORF map | Six SVG lanes with ORF bars; the frame logic already exists in `calc.js` | Shows ORFs only, not their translation (translation is marked Remove) |

### Features drawn from the research

| Idea | Notes |
|---|---|
| **Nearest-neighbour Tm with conditions** | SantaLucia 1998 [2] plus the Mg²⁺ correction [3]. Inputs: Na⁺, Mg²⁺, dNTP and oligo concentration, with Primer3 defaults [4]. Show the method and conditions next to the number. Fixes [B3](#b3-melting-temperature-underestimates-primers-and-jumps-at-14-nt). |
| **Primer pair mode** | Forward + reverse input: ΔTm (≤ 5 °C [6][7]), a cross-complementarity scan, and a suggested annealing temperature of lower Tm − 5 °C [5]. |
| **Self-dimer / hairpin heuristic** | A plain-JS scan for complementary runs of 4 bases or more, weighted towards the 3′ end. Full ΔG folding is a much larger task. |
| **MW, extinction coefficient, nmol/OD** | Lookup tables plus arithmetic [8][9][16]. |
| **IUPAC degenerate bases** | Accept them with a warning, complement them (R↔Y, K↔M, B↔V, D↔H; S, W and N map to themselves), and report the Tm as a min–max range [13]. |
| **Restriction-site finder** | A small built-in list of common enzymes. Useful when adding sites to primers [7][14]. |

---

## 8. Prioritised recommendations

Effort: S < 1 day, M 1–3 days, L > 3 days.

| # | Idea | User value | Effort | Fits constraints | Priority |
|---|---|---|---|---|---|
| 1 | Fix B1: clear before save, block navigation on failure, size limit | Never shows another sequence's results | S | yes | **Next ticket** |
| 2 | Fix B2: detect multiple records; warn or choose | No silent merge of primers | S–M | yes | **Next ticket** |
| 3 | Nearest-neighbour Tm with Na⁺/Mg²⁺/oligo inputs; Wallace as secondary | Tm comparable to vendor tools; fixes B3 | M | yes | **Next ticket** |
| 4 | Primer checklist panel | Catches common primer mistakes before ordering | S–M | yes | **Next ticket** |
| 5 | Live validation and stats on Screen 1 | MVP must-have #6 | M | yes | **Next ticket** |
| 6 | Scrollable strand boxes, ruler, 10-base grouping | Fixes B5; easier to read | S | yes | **Next ticket** |
| 7 | Fix B4 (bfcache) and B6 (placeholder data) | No blank or fake screens | S | yes | **Next ticket** |
| 8 | Show the processed input; explicit RNA labelling | Resolves known issue 1 | S | yes | **Next ticket** |
| 9 | Contrast and keyboard fixes (A1–A5) | WCAG AA | S | yes | **Next ticket** |
| 10 | Exports with input, record ID and file name | Traceable files | S | yes | Later |
| 11 | Colour-coded bases, paired strand view, composition bar | Faster visual checking | S–M | yes | Later |
| 12 | GC sliding-window chart | Spot GC-rich regions | M | yes | Later |
| 13 | Primer pair mode (ΔTm, cross-dimer, suggested annealing temperature) | Matches real PCR set-up | M | yes | Later |
| 14 | Self-dimer / hairpin heuristic | Fewer failed primers | M | yes | Later |
| 15 | MW, extinction coefficient, nmol/OD | Needed to resuspend orders | S–M | yes | Later |
| 16 | IUPAC degenerate bases | Degenerate primers | M | yes | Later |
| 17 | Quick fixes on the warning page (U→T, strip N) | Fewer round trips | S | yes | Later |
| 18 | Opt-in local history | Convenience | S–M | yes (browser storage only) | Later |
| 19 | Restriction-site finder | Cloning primers | M | yes | Later |
| 20 | Six-frame ORF map | Context for "Active Frame" | M | yes | Later |
| 21 | Protein translation preview | Biology context | S | yes | Out of scope for the MVP (workbook "Remove" #9; contradicts Nice-to-have #3) |
| 22 | Large multi-line FASTA file processing | Batch use | M | yes | Out of scope for the MVP (workbook "Remove" #8) |
| 23 | Specificity check (BLAST / Primer-BLAST) | Off-target detection | L | needs a backend or external API | Out of scope |
| 24 | Full ΔG secondary-structure folding | Accurate dimer/hairpin ΔG | L | yes, but heavy | Out of scope |
| 25 | Automatic primer design from a template (Primer3-like) | Design, not just checking | L | heavy | Out of scope |

---

## 9. Sources

1. Biopython, `Bio.SeqUtils.MeltingTemp` API docs (Tm_Wallace, Tm_GC value sets, Tm_NN, salt corrections). https://biopython.org/docs/latest/api/Bio.SeqUtils.MeltingTemp.html
2. SantaLucia J. Jr. (1998) A unified view of polymer, dumbbell, and oligonucleotide DNA nearest-neighbor thermodynamics. *PNAS* 95:1460–1465. https://doi.org/10.1073/pnas.95.4.1460 (PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC19045)
3. Owczarzy R. et al. (2008) Predicting stability of DNA duplexes in solutions containing magnesium and monovalent cations. *Biochemistry* 47:5336–5353. https://doi.org/10.1021/bi702363u
4. Primer3 manual (default Tm formula, salt corrections, size/Tm/GC defaults). https://primer3.org/manual.html
5. QIAGEN, PCR primer design (bench guide). https://www.qiagen.com/us/knowledge-and-support/knowledge-hub/bench-guide/pcr/introduction/pcr-primer-design
6. PREMIER Biosoft, PCR primer design guidelines. http://www.premierbiosoft.com/tech_notes/PCR_Primer_Design.html
7. Addgene, Primer design protocol. https://www.addgene.org/protocols/primer-design/
8. Thermo Fisher Scientific, Tm Calculator. https://www.thermofisher.com/tmcalculator
9. Horizon Discovery (Revvity), Multiple Primer Analyzer. https://horizondiscovery.com/en/ordering-and-calculation-tools/multiple-primer-analyzer
10. Sequence Manipulation Suite 2 (JavaScript tools index). https://www.bioinformatics.org/sms2/index.html
11. NCBI ORFfinder. https://www.ncbi.nlm.nih.gov/orffinder/
12. NCBI, FASTA format for nucleotide sequences. https://www.ncbi.nlm.nih.gov/genbank/fastaformat/
13. NC-IUB, Nomenclature for incompletely specified bases in nucleic acid sequences (Cornish-Bowden 1985). https://iubmb.qmul.ac.uk/misc/naseq.html, https://doi.org/10.1093/nar/13.9.3021
14. NEBcutter 3.0. https://nc3.neb.com/NEBcutter/
15. NEB, Four tips for PCR amplification of GC-rich sequences. https://www.neb.com/en/nebinspired-blog/four-tips-for-pcr-amplification-of-gc-rich-sequences
16. Kibbe W.A. (2007) OligoCalc: an online oligonucleotide properties calculator. *Nucleic Acids Res* 35:W43–W46. https://doi.org/10.1093/nar/gkm234
17. MDN, Storage quotas and eviction criteria (Web Storage limits, `QuotaExceededError`). https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
18. web.dev, Back/forward cache (`pageshow`, `event.persisted`). https://web.dev/articles/bfcache
19. W3C WAI-ARIA Authoring Practices, Menu Button pattern. https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/
20. W3C, Understanding WCAG 2.2 SC 1.4.3 Contrast (Minimum). https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
