/*
  Entry point for the results screen (results.html).

  Reads the sequence that Screen 1 saved, runs the calculations in calc.js,
  and writes the results into the page. Also handles copying, downloading,
  and "Start New Sequence".
*/

import { analyse, cleanSequence } from "./calc.js";
import { EXPORT_FORMATS } from "./export.js";
import { showStrands } from "./strand-view.js";

// Must match STORAGE_KEY in src/init.js. This is the sequence Screen 1 saved.
const STORAGE_KEY = "sequenceChef.rawSequence";

// How long the "Copied!" label stays before it reverts, in milliseconds.
const COPY_FEEDBACK_MS = 1800;

// ---------- 1. Element references ----------
// Looked up once, so the render functions below do not query the page again.
const dashboard = document.getElementById("dashboard");
const statusChip = document.getElementById("status-chip");
const computeMs = document.getElementById("compute-ms");
const resultError = document.getElementById("result-error");
const inputCard = document.getElementById("input-card");
const rcCard = document.getElementById("rc-card");
const rnaCard = document.getElementById("rna-card");
const inputSequence = document.getElementById("input-sequence");
const rcSequence = document.getElementById("rc-sequence");
const rnaSequence = document.getElementById("rna-sequence");
const copyInputButton = document.getElementById("copy-input-button");
const copyRcButton = document.getElementById("copy-rc-button");
const copyRnaButton = document.getElementById("copy-rna-button");
const copyStatus = document.getElementById("copy-status");
const tmNumber = document.getElementById("tm-number");
const tmNote = document.getElementById("tm-note");
const metricLength = document.getElementById("metric-length");
const metricGc = document.getElementById("metric-gc");
const metricFrame = document.getElementById("metric-frame");
const metricStrand = document.getElementById("metric-strand");
const metricYield = document.getElementById("metric-yield");
const downloadButton = document.getElementById("download-button");
const downloadMenu = document.getElementById("download-menu");
const downloadWrapper = downloadButton.parentElement;
const newSequenceButton = document.getElementById("new-sequence-button");

// The most recent valid result. Copy and download read from here.
// It is null when the input is invalid, so nothing can be exported then.
let current = null;

// ---------- 2. Read the saved sequence ----------
// sessionStorage can throw when storage is blocked. In that case treat it as
// empty, so the user gets the "enter a sequence" screen instead of a broken page.
function readSavedSequence() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch (error) {
    console.warn("Could not read the saved sequence.", error);
    return "";
  }
}

// ---------- 3. Run the pipeline and time it ----------
// The timer covers only the calculation, not the page drawing, so it matches
// the 50 ms budget in the acceptance criteria.
// shownRaw is the saved text the page is showing. It lets a page restored
// from the back/forward cache skip the work when nothing has changed.
let shownRaw = null;

function render() {
  const raw = readSavedSequence();
  if (raw !== shownRaw) {
    shownRaw = raw;
    const start = performance.now();
    const result = analyse(raw);
    computeMs.textContent = (performance.now() - start).toFixed(1);

    if (!result.ok) {
      // Screen 1 already sends invalid or empty input to the warning screen,
      // so this only happens when results.html is opened directly (a
      // bookmark, a reload, or Back after "Start New Sequence" cleared the
      // input). With nothing saved, Screen 1 is the place to start; anything
      // else goes to the warning screen. replace() keeps this page out of
      // the history, so Back does not bounce the user here again. The page
      // stays faded out if it was, so it does not flash before it leaves.
      showError(result.message);
      window.location.replace(raw === "" ? "/" : "/invalid.html");
      return;
    }
    showResults(result, raw);
  }
  document.body.classList.remove("is-leaving");
}

render();

// B4: Chrome keeps this page in the back/forward cache. After "Start New
// Sequence" and the browser's Back button, it comes back exactly as it was
// left: faded out by .is-leaving, with the old results. Render it again from
// storage, the same as a fresh load, so the screen always matches the saved
// input (and what a reload would show).
window.addEventListener("pageshow", (event) => {
  if (event.persisted) render();
});

// ---------- 4. Render: valid input ----------
// `raw` is the saved text. The cleaned input is shown and exported next to
// the results, so the user can check what was processed.
function showResults(r, raw) {
  current = { ...r, input: cleanSequence(raw) };

  dashboard.hidden = false;
  resultError.hidden = true;
  inputCard.hidden = false;
  rcCard.hidden = false;
  rnaCard.hidden = false;

  statusChip.textContent = "Validated";
  statusChip.classList.remove("is-error");

  showStrands([
    [inputSequence, current.input],
    [rcSequence, r.reverseComplement],
    [rnaSequence, r.rna],
  ]);
  copyInputButton.disabled = false;
  copyRcButton.disabled = false;
  copyRnaButton.disabled = false;
  downloadButton.disabled = false;

  // Round to one decimal. Short sequences give whole numbers, which print as "24".
  tmNumber.textContent = Number(r.melting.value.toFixed(1)).toString();
  tmNote.textContent = r.melting.method;

  metricLength.textContent = r.length.toLocaleString("en-US");
  metricGc.textContent = r.gcPercent.toFixed(1);

  if (r.coding.label) {
    metricFrame.textContent = r.coding.label;
    metricStrand.textContent = r.coding.strand;
  } else {
    // No ATG...stop open reading frame was found in any of the six frames.
    metricFrame.textContent = "None";
    metricStrand.textContent = "";
  }
  metricYield.textContent = r.coding.aminoAcids;
}

// ---------- 5. Render: invalid or missing input ----------
// Hides the strands and shows the message. Metrics show a dash, so no stale
// numbers from an earlier run are left on screen.
function showError(message) {
  current = null;

  dashboard.hidden = false;
  resultError.textContent = message;
  resultError.hidden = false;
  inputCard.hidden = true;
  rcCard.hidden = true;
  rnaCard.hidden = true;

  statusChip.textContent = "Invalid input";
  statusChip.classList.add("is-error");

  copyInputButton.disabled = true;
  copyRcButton.disabled = true;
  copyRnaButton.disabled = true;
  downloadButton.disabled = true;

  tmNumber.textContent = "—";
  tmNote.textContent = "Not calculated";
  metricLength.textContent = "—";
  metricGc.textContent = "—";
  metricFrame.textContent = "—";
  metricStrand.textContent = "";
  metricYield.textContent = "—";
}

// ---------- 6. Copy a strand ----------
// Writes the plain strand (no row numbers or spaces) to the clipboard. The
// button shows the outcome briefly, then returns to "Copy". Its accessible
// name ("Copy reverse complement") does not change, so the outcome is also
// announced through the #copy-status live region.
async function copyStrand(button, text, name) {
  // Store the original label once, so repeated clicks do not capture "Copied!".
  if (!button.dataset.idle) button.dataset.idle = button.textContent;

  try {
    await navigator.clipboard.writeText(text);
    flashLabel(button, "Copied!");
    announce(`${name} copied.`);
  } catch (error) {
    console.warn("Clipboard write failed.", error);
    flashLabel(button, "Copy failed");
    announce(`${name}: copy failed.`);
  }
}

// Clearing the live region first, then writing on a later tick, makes screen
// readers announce the message even when it is the same as the last one.
function announce(message) {
  copyStatus.textContent = "";
  setTimeout(() => {
    copyStatus.textContent = message;
  }, 100);
}

function flashLabel(button, label) {
  button.textContent = label;
  clearTimeout(button.resetTimer);
  button.resetTimer = setTimeout(() => {
    button.textContent = button.dataset.idle;
  }, COPY_FEEDBACK_MS);
}

copyInputButton.addEventListener("click", () => {
  if (current) copyStrand(copyInputButton, current.input, "Input sequence");
});

copyRcButton.addEventListener("click", () => {
  if (current) copyStrand(copyRcButton, current.reverseComplement, "Reverse complement");
});

copyRnaButton.addEventListener("click", () => {
  if (current) copyStrand(copyRnaButton, current.rna, "RNA");
});

// ---------- 7. Download menu ----------
// Builds one menu item per format in EXPORT_FORMATS. Each item downloads the
// file in that format.
for (const format of EXPORT_FORMATS) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "menu-item";
  item.setAttribute("role", "menuitem");
  item.textContent = `${format.label} (.${format.extension})`;
  item.dataset.format = format.id;
  downloadMenu.appendChild(item);
}

function setMenuOpen(open) {
  downloadMenu.hidden = !open;
  downloadButton.setAttribute("aria-expanded", String(open));
}

downloadButton.addEventListener("click", () => {
  setMenuOpen(downloadMenu.hidden); // toggle
});

// Choosing an item saves the file, then closes the menu.
downloadMenu.addEventListener("click", (event) => {
  const item = event.target.closest("[data-format]");
  if (!item || !current) return;

  const format = EXPORT_FORMATS.find((f) => f.id === item.dataset.format);
  saveFile(format.build(current), format.mime, `sequencechef-results.${format.extension}`);
  setMenuOpen(false);
});

// Closes the menu when the user clicks anywhere else, or presses Escape.
document.addEventListener("click", (event) => {
  if (!downloadWrapper.contains(event.target)) setMenuOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !downloadMenu.hidden) {
    setMenuOpen(false);
    downloadButton.focus();
  }
});

// Saves text as a file through a temporary link. The object URL is released
// after the click has been handled.
function saveFile(contents, mime, filename) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- 8. "Start New Sequence" ----------
// Clears the saved input, fades the page out, then opens Screen 1 with an
// empty text area.
newSequenceButton.addEventListener("click", () => {
  // If clearing fails, still navigate: Screen 1 starts empty anyway.
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Could not clear the saved sequence.", error);
  }

  // The fade lasts 200ms (see body.is-leaving in style.css). Navigating after
  // it finishes avoids a flash of the next page.
  document.body.classList.add("is-leaving");
  setTimeout(() => {
    window.location.href = "/";
  }, 200);
});
