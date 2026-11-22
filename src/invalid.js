/*
  SequenceChef, "Invalid Characters Detected" screen (invalid.html).

  Screen 1 sends the user here when the cleaned sequence is empty or contains
  anything other than A, T, C and G. This file reads the raw text Screen 1
  saved, runs the same clean + validate steps from calc.js, and fills in what
  was found: which characters, how many, and where.

  It works from the raw text rather than from a stored result, so what it
  shows always matches the text Screen 1 will restore. The saved text is
  never removed here: "Go Back & Edit Sequence" is a plain link to Screen 1,
  which puts the text back in the box.
*/

import { cleanSequence, validate } from "./calc.js";
import { readSaved } from "./storage.js";

// Caps keep the card compact when the input is very wrong, for example a
// protein sequence pasted by mistake (up to 20 distinct letters). Five tiles
// plus "+N more" still fit on one row of the card.
const MAX_TOKENS = 5;
const MAX_POSITIONS = 5;

// Joins "5", "9", "12" as "5, 9, and 12" (built into the browser).
const listFormat = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

// ---------- 1. Element references ----------
const copyInvalid = document.getElementById("copy-invalid");
const copyEmpty = document.getElementById("copy-empty");
const infoGrid = document.getElementById("info-grid");
const offendingCard = document.getElementById("offending-card");
const foundCount = document.getElementById("found-count");
const positionsText = document.getElementById("positions-text");
const tokenList = document.getElementById("token-list");

// ---------- 2. Read the saved input ----------
// readSaved() (src/storage.js) returns "" when storage is blocked, so the
// page shows the "enter a sequence" message instead of breaking.

// ---------- 3. Validate and choose what to show ----------
const check = validate(cleanSequence(readSaved()));

if (check.ok) {
  // Nothing to fix (the page was opened directly with a valid sequence
  // saved). replace() keeps this page out of the history.
  window.location.replace("/results.html");
} else if (check.empty) {
  showEmpty();
} else {
  showInvalid(check);
}

// ---------- 4. Render: nothing left after cleaning ----------
// Same calm screen, but it asks for a sequence. There are no tokens to list,
// so only the accepted alphabet is shown.
function showEmpty() {
  copyInvalid.hidden = true;
  copyEmpty.hidden = false;
  offendingCard.hidden = true;
  infoGrid.classList.add("is-single");
  document.title = "SequenceChef - No Sequence Found";
}

// ---------- 5. Render: characters outside A, T, C, G ----------
// textContent (never innerHTML) because the characters come from user input.
function showInvalid({ invalidChars, invalidCount, positions }) {
  foundCount.textContent = `${invalidCount.toLocaleString("en-US")} Found`;
  positionsText.textContent = describePositions(positions);

  for (const char of invalidChars.slice(0, MAX_TOKENS)) {
    addListItem("token token--flagged", tokenLabel(char));
  }

  // The count of hidden characters is the last item, right after the tiles.
  const notShown = invalidChars.length - MAX_TOKENS;
  if (notShown > 0) addListItem("token-more", `+${notShown} more`);
}

function addListItem(className, text) {
  const item = document.createElement("li");
  item.className = className;
  item.textContent = text;
  tokenList.appendChild(item);
}

/*
  "Position 5 flagged", "Positions 5 and 9 flagged",
  "Positions 5, 9, and 12 flagged", "Positions 1, 2, 3, 4, 5, and 14 more flagged".
  Positions count bases in the cleaned sequence, which is how a base position
  is normally read in a FASTA record.
*/
function describePositions(positions) {
  const shown = positions.slice(0, MAX_POSITIONS).map((n) => n.toLocaleString("en-US"));
  const rest = positions.length - shown.length;
  if (rest > 0) shown.push(`${rest.toLocaleString("en-US")} more`);

  const noun = positions.length === 1 ? "Position" : "Positions";
  return `${noun} ${listFormat.format(shown)} flagged`;
}

// An invisible character (a control or zero-width mark) would show as an
// empty tile, so it is shown by its Unicode code instead, e.g. "U+200B".
function tokenLabel(char) {
  if (!/\p{C}/u.test(char)) return char;
  return `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;
}
