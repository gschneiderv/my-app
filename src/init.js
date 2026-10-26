/*
  SequenceChef, Screen 1 (User Initialization) behaviour.

  This file only handles the screen: typing, file loading, test samples and
  navigation. It does not validate or process the sequence. Those functions
  come in the calculation ticket and will read the value that this file stores.
*/

import { MOCK_SEQUENCES } from "./mock-data.js";

// ---------- 1. Element references ----------
// Grab every element once at load time instead of querying again on each event.
const textarea = document.getElementById("sequence-input");
const fileInput = document.getElementById("file-input");
const uploadButton = document.getElementById("upload-button");
const uploadStatus = document.getElementById("upload-status");
const nextButton = document.getElementById("next-button");
const sampleSelect = document.getElementById("sample-select");

// Fill the sample picker from the dataset, so adding a sample to mock-data.js
// is enough to make it appear here.
for (const sample of MOCK_SEQUENCES) {
  const option = document.createElement("option");
  option.value = sample.id;
  option.textContent = `${sample.name} (${sample.length} bp)`;
  sampleSelect.appendChild(option);
}

// Key used to hand the sequence to the next screen (read by the results page later).
const STORAGE_KEY = "sequenceChef.rawSequence";

// Accepted file extensions. Must match the `accept` attribute in index.html.
const ALLOWED_EXTENSIONS = [".fasta", ".fa", ".txt"];

// ---------- 2. Enable or disable the Next button ----------
// The button is only useful once there is something to process, so it stays
// disabled until the text area has non-whitespace content.
function updateNextButton() {
  nextButton.disabled = textarea.value.trim() === "";
}

textarea.addEventListener("input", updateNextButton);

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
  showStatus(`Loaded ${sample.name}`, false);
  sampleSelect.value = ""; // reset so choosing the same sample again still fires "change"
});

// Shows a short message under the upload link. `isError` switches the colour.
function showStatus(message, isError) {
  uploadStatus.textContent = message;
  uploadStatus.classList.toggle("is-error", isError);
}

// ---------- 4. Next: pass the input on and open the results screen ----------
nextButton.addEventListener("click", () => {
  const sequence = textarea.value.trim();
  if (sequence === "") return; // guard: the button should already be disabled

  // sessionStorage can throw in private mode or when storage is blocked.
  // Wrap it so the screen still moves on if saving fails.
  try {
    sessionStorage.setItem(STORAGE_KEY, sequence);
  } catch (error) {
    console.warn("Could not save the sequence for the next screen.", error);
  }

  window.location.href = "/results.html";
});

// ---------- 5. Initial state ----------
// Browsers can keep form values after a reload (back button), so sync the
// button with whatever is in the box when the page loads.
updateNextButton();
