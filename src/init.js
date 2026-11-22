/*
  SequenceChef, Screen 1 (User Initialization) behaviour.

  This file handles the screen: typing, file loading, test samples, the live
  check under the text area and navigation. Every number it shows comes from
  calc.js. On "Next" it runs the clean + validate steps from calc.js to
  choose the next page: the results, or the "Invalid Characters Detected"
  warning when there is something to fix.

  Some input never leaves this screen, because the next pages could not
  show correct results for it. Next then stays here and a notice under the
  text area says why: the input is too large, it holds more than one FASTA
  record, or it could not be saved for the next page.
*/

import { MOCK_SEQUENCES } from "./mock-data.js";
import { cleanSequence, validate, splitFastaRecords, gcPercentOfBases } from "./calc.js";
import { readSaved, save } from "./storage.js";

// ---------- 1. Element references ----------
// Grab every element once at load time instead of querying again on each event.
const textarea = document.getElementById("sequence-input");
const fileInput = document.getElementById("file-input");
const uploadButton = document.getElementById("upload-button");
const uploadStatus = document.getElementById("upload-status");
const nextButton = document.getElementById("next-button");
const sampleSelect = document.getElementById("sample-select");
const noticeBox = document.getElementById("input-notice-box");
const inputNotice = document.getElementById("input-notice");
const keepFirstButton = document.getElementById("keep-first-button");
const inputStats = document.getElementById("input-stats");
const inputAnnounce = document.getElementById("input-announce");

// Fill the sample picker from the dataset, so adding a sample to mock-data.js
// is enough to make it appear here.
for (const sample of MOCK_SEQUENCES) {
  const option = document.createElement("option");
  option.value = sample.id;
  option.textContent = `${sample.name} (${sample.length} bp)`;
  sampleSelect.appendChild(option);
}

// Accepted file extensions. Must match the `accept` attribute in index.html.
const ALLOWED_EXTENSIONS = [".fasta", ".fa", ".txt"];

/*
  Largest input accepted, counted in characters of the raw text (headers and
  line breaks included), because the raw text is what gets saved for the
  next page. Chrome's sessionStorage took at most about 5.2 million
  characters (measured in the code review), and a browser that counts
  2 bytes per character against a 5 MB quota would take about 2.6 million.
  One million stays well below both, keeps the results page calculations
  around 100 ms, and is far more than any primer or gene this tool is for.
*/
const MAX_INPUT_CHARS = 1_000_000;

/*
  Live check: it runs this long after the last keystroke, so fast typing
  does not redo the work on every key. Above LIVE_CHECK_MAX_CHARS the stats
  are skipped (typing in a box that large is slow already) and the line says
  so; the size and record checks still run, and Next checks everything.
  At this size cleaning and validating take well under 10 ms.
*/
const LIVE_CHECK_DELAY_MS = 200;
const LIVE_CHECK_MAX_CHARS = 200_000;

// How many different invalid characters the live check names ("U, X, N").
const MAX_LISTED_CHARS = 3;

// Why the text could not be saved for the next page (reasons from storage.js).
const SAVE_ERRORS = {
  quota: "It does not fit in this browser's storage. Try a shorter sequence.",
  blocked:
    "This browser is blocking site storage, which SequenceChef needs to pass your " +
    "sequence to the next page. Allow site data for this site (it is often off in " +
    "private windows) and press Next again.",
};

// ---------- 2. Enable or disable the Next button ----------
// The button is only useful once there is something to process, so it stays
// disabled until the text area has non-whitespace content.
function updateNextButton() {
  nextButton.disabled = textarea.value.trim() === "";
}

textarea.addEventListener("input", () => {
  updateNextButton();
  scheduleCheck();
});

// ---------- 3. Upload from file ----------
// The visible link cannot open a file picker by itself, so it forwards the
// click to the hidden <input type="file">.
uploadButton.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];

  // The user opened the picker and cancelled: nothing to do.
  if (!file) return;

  // Check the extension before reading, so the user gets feedback right away.
  const name = file.name.toLowerCase();
  const isAllowed = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!isAllowed) {
    showStatus(`Unsupported file type. Use ${ALLOWED_EXTENSIONS.join(", ")}.`, true);
    fileInput.value = ""; // clear the picker so the same file can be chosen again
    return;
  }

  // FileReader is the built-in browser API for reading local files as text.
  // It runs asynchronously, so the text is placed in the box inside onload.
  const reader = new FileReader();

  reader.onload = () => {
    textarea.value = reader.result;
    updateNextButton();
    checkInput();
    showStatus(`Loaded ${file.name}`, false);
  };

  reader.onerror = () => {
    showStatus("Could not read that file. Try again.", true);
  };

  reader.readAsText(file);
  fileInput.value = ""; // allow re-selecting the same file later
});

// ---------- 3b. Test samples ----------
// Choosing a sample copies its sequence into the text area and enables Next.
// The placeholder option has an empty value, so it does nothing.
sampleSelect.addEventListener("change", () => {
  const sample = MOCK_SEQUENCES.find((s) => s.id === sampleSelect.value);
  if (!sample) return;

  textarea.value = sample.sequence;
  updateNextButton();
  checkInput();
  showStatus(`Loaded ${sample.name}`, false);
  sampleSelect.value = ""; // reset so choosing the same sample again still fires "change"
});

// Shows a short message under the upload link. `isError` switches the colour.
function showStatus(message, isError) {
  uploadStatus.textContent = message;
  uploadStatus.classList.toggle("is-error", isError);
}

// ---------- 4. Live check and the checks that keep the input here ----------
/*
  Runs a short time after the user stops typing, straight away when the
  text is replaced (file, sample, restore, "Keep first record only"), and
  again on Next. Updates the stats line and the notice under the text area.
  Returns true when the input must not go to the next page.

  This is extra feedback only: invalid characters do not block Next, which
  still opens the warning page with the full details.
*/
let checkTimer = 0;

function scheduleCheck() {
  clearTimeout(checkTimer);
  checkTimer = setTimeout(checkInput, LIVE_CHECK_DELAY_MS);
}

function checkInput() {
  clearTimeout(checkTimer); // a pending run would only repeat this one
  const raw = textarea.value;

  if (raw.trim() === "") {
    showStats([]);
    announce("");
    setInvalid(false);
    clearNotice();
    return false;
  }

  // A plain length check, so even a huge paste is never scanned.
  if (raw.length > MAX_INPUT_CHARS) {
    return block(
      "Input too large.",
      `It has ${formatNumber(raw.length)} characters (headers and line breaks included). ` +
        `The limit is ${formatNumber(MAX_INPUT_CHARS)}. Shorten it to continue.`,
    );
  }

  /*
    Several FASTA records would be merged into one sequence by
    cleanSequence(), giving results for a sequence that does not exist
    (review B2). Never merge silently: stop here and offer to keep the first
    record. Text without any ">" is always a single record, so it is not
    scanned at all.
  */
  const records = raw.includes(">") ? splitFastaRecords(raw) : [];
  if (records.length > 1) {
    return block(
      `${formatNumber(records.length)} records detected`,
      "– SequenceChef processes one sequence at a time. Remove the extra records, or keep only the first.",
      { offerKeepFirst: true },
    );
  }

  clearNotice();
  updateStats(raw);
  return false;
}

/*
  Keeps the input on this screen: shows why in the notice and hides the
  stats, which would describe text that cannot go on (for several records,
  a merged sequence that does not exist). Always returns true.
*/
function block(title, detail, options) {
  showStats([]);
  announce("");
  setInvalid(true);
  showNotice(title, detail, options);
  return true;
}

// aria-invalid tells screen readers the text has a problem. The CSS gives
// the text area an amber border in the same state.
function setInvalid(isInvalid) {
  if (isInvalid) textarea.setAttribute("aria-invalid", "true");
  else textarea.removeAttribute("aria-invalid");
}

/*
  The stats line: cleaned length, GC content and invalid characters. It uses
  the same cleanSequence() and validate() as the next pages, so the numbers
  match what Next will find.
*/
function updateStats(raw) {
  if (raw.length > LIVE_CHECK_MAX_CHARS) {
    showStats(
      [],
      `Live check paused above ${formatNumber(LIVE_CHECK_MAX_CHARS)} characters. ` +
        "The full check runs when you press Next.",
    );
    announce("");
    setInvalid(false);
    return;
  }

  const seq = cleanSequence(raw);
  const check = validate(seq);

  if (check.empty) {
    showStats([], "No bases yet. Header lines, spaces and numbers are ignored.");
    announce("");
    setInvalid(false);
    return;
  }

  const gc = gcPercentOfBases(seq);
  const invalidCount = check.invalidCount;
  showStats([
    { label: "Length", value: `${formatNumber(seq.length)} bp` },
    { label: "GC", value: gc === null ? "–" : `${gc.toFixed(1)} %` },
    {
      label: "Invalid",
      value: invalidCount === 0 ? "0" : `${formatNumber(invalidCount)} (${listChars(check.invalidChars)})`,
      flagged: invalidCount > 0,
    },
  ]);

  setInvalid(invalidCount > 0);

  // Screen readers hear when invalid characters appear or are all gone, but
  // not every new length or GC value.
  if (invalidCount > 0) announce(`Invalid characters: ${listChars(check.invalidChars)}.`);
  else if (inputAnnounce.textContent !== "") announce("No invalid characters.");
}

// items: [{ label, value, flagged }]. An optional note follows them.
function showStats(items, note = "") {
  const nodes = items.map(({ label, value, flagged = false }) => {
    const item = document.createElement("span");
    item.className = flagged ? "input-stat is-flagged" : "input-stat";
    const name = document.createElement("span");
    name.className = "input-stat-label";
    name.textContent = label;
    const amount = document.createElement("span");
    amount.className = "input-stat-value";
    amount.textContent = value; // user characters: textContent, never innerHTML
    item.append(name, " ", amount);
    return item;
  });

  if (note) {
    const text = document.createElement("span");
    text.className = "input-stats-note";
    text.textContent = note;
    nodes.push(text);
  }

  // Spaces between the items keep the words apart when a screen reader reads
  // the line as the text area's description. The flex layout ignores them.
  inputStats.replaceChildren(...nodes.flatMap((node, i) => (i === 0 ? [node] : [" ", node])));
}

// Only a changed message is written, so the same one is not read twice.
function announce(message) {
  if (inputAnnounce.textContent !== message) inputAnnounce.textContent = message;
}

// ["U", "X", "N", "B", "Z"] -> "U, X, N +2 more"
function listChars(chars) {
  const shown = chars.slice(0, MAX_LISTED_CHARS).map(charLabel);
  const rest = chars.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} +${rest} more` : shown.join(", ");
}

// Same rule as the warning page: an invisible character (a control or
// zero-width mark) is shown by its Unicode code, e.g. "U+200B".
function charLabel(char) {
  if (!/\p{C}/u.test(char)) return char;
  return `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;
}

/*
  The notice is a live region (role="status" in index.html), so a new
  message is announced. Setting the same text again is skipped, so it is
  not read out again on every keystroke.
  kind "error" (amber) means Next will not continue; "info" (green)
  confirms an action and does not block anything.
*/
function showNotice(title, detail, { kind = "error", offerKeepFirst = false } = {}) {
  const isError = kind === "error";
  noticeBox.classList.toggle("is-error", isError);
  noticeBox.classList.toggle("is-info", !isError);
  keepFirstButton.hidden = !offerKeepFirst;

  if (inputNotice.textContent === `${title} ${detail}`) return;
  const strong = document.createElement("strong");
  strong.textContent = title;
  inputNotice.replaceChildren(strong, ` ${detail}`);
}

function clearNotice() {
  noticeBox.classList.remove("is-error", "is-info");
  keepFirstButton.hidden = true;
  inputNotice.replaceChildren();
}

/*
  "Keep first record only": replaces the text with the first record, exactly
  as typed (header line included), and drops the rest. The button hides once
  there is a single record, so focus moves to the text area instead of being
  lost with it.
*/
keepFirstButton.addEventListener("click", () => {
  const records = splitFastaRecords(textarea.value);
  if (records.length > 1) {
    textarea.value = records[0].text.trimEnd();
    updateNextButton();
    if (!checkInput()) {
      const removed = records.length - 1;
      showNotice(
        "Kept the first record.",
        `Removed ${formatNumber(removed)} other record${removed === 1 ? "" : "s"}.`,
        { kind: "info" },
      );
    }
  } else {
    checkInput(); // the text changed since the notice appeared
  }

  textarea.focus();
  textarea.setSelectionRange(0, 0);
  textarea.scrollTop = 0;
});

// 1234567 -> "1,234,567", the same format as the other screens.
function formatNumber(n) {
  return n.toLocaleString("en-US");
}

// ---------- 5. Next: save the input and open the right screen ----------
/*
  The text is saved exactly as typed (not trimmed or cleaned), so coming back
  from the warning screen shows the user their own text, not a changed copy.
  Valid input goes to the results. Anything else, including input that is
  empty once headers and spaces are removed, goes to the warning screen.

  If the text cannot be saved, the user stays here with a notice. Moving on
  anyway would let the next page show an earlier sequence's results, or a
  false "No DNA Sequence Found" (review B1). In both blocked cases focus goes
  back to the text area, which the notice describes (aria-describedby).
*/
nextButton.addEventListener("click", () => {
  const raw = textarea.value;
  if (raw.trim() === "") return; // guard: the button should already be disabled

  if (checkInput()) {
    textarea.focus();
    return;
  }

  // The raw text goes to the next screen through sessionStorage (storage.js).
  const saved = save(raw);
  if (!saved.ok) {
    showNotice("Your sequence was not sent for processing.", SAVE_ERRORS[saved.reason]);
    textarea.focus();
    return;
  }

  const check = validate(cleanSequence(raw));
  window.location.href = check.ok ? "/results.html" : "/invalid.html";
});

// ---------- 6. Initial state ----------
/*
  Restore the last text the user sent on, so "Go Back & Edit Sequence" lands
  here with the text intact. "Start New Sequence" on the results page clears
  the key, so that path still opens an empty box. If the browser has already
  put a value back in the box (back button), that value is kept.
*/
const saved = readSaved();
if (saved !== "" && textarea.value === "") {
  textarea.value = saved;
  showStatus("Restored your previous sequence", false);
  // Ready to edit, with the caret at the start so a long sequence opens at the top.
  textarea.setSelectionRange(0, 0);
  textarea.focus();
}

// Sync the button and the checks with whatever is in the box when the page loads.
updateNextButton();
checkInput();
