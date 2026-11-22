/*
  Cooking Temperature card and primer checklist (results page).

  main.js calls showTemperature(result) after a valid analysis and
  clearTemperature() when there is none. Changing a reaction condition
  recomputes the Tm, the Wallace reference and the checklist straight away,
  and replaces result.melting, so downloads carry the value and conditions on
  screen. All the maths is in calc.js; this file only reads inputs and draws.
*/

import {
  checkTmConditions,
  countBases,
  meltingTemperature,
  primerChecklist,
  reverseComplement,
  DEFAULT_TM_CONDITIONS,
  OLIGO_MAX_LENGTH,
  WALLACE_REFERENCE_MAX_LENGTH,
} from "./calc.js";

// Wait this long after the last change before announcing the new Tm to
// screen readers, so typing "1.5" is announced once, not three times.
const ANNOUNCE_DELAY_MS = 600;

// One entry per conditions input. name starts an error message; term is the
// same thing inside a sentence ("50 nM oligo").
const FIELDS = [
  { key: "monovalentMm", id: "tm-monovalent", name: "Na⁺/K⁺", term: "Na⁺/K⁺", unit: "mM" },
  { key: "magnesiumMm", id: "tm-magnesium", name: "Mg²⁺", term: "Mg²⁺", unit: "mM" },
  { key: "dntpMm", id: "tm-dntp", name: "dNTPs", term: "dNTPs", unit: "mM" },
  { key: "oligoNm", id: "tm-oligo", name: "Oligo", term: "oligo", unit: "nM" },
].map((field) => ({ ...field, input: document.getElementById(field.id) }));

// ---------- Element references ----------
const tmCard = document.getElementById("tm-card");
const tmNumber = document.getElementById("tm-number");
const tmNote = document.getElementById("tm-note");
const tmWallace = document.getElementById("tm-wallace");
const tmWallaceHint = document.getElementById("tm-wallace-hint");
const conditionsFieldset = document.getElementById("tm-conditions");
const conditionsError = document.getElementById("tm-conditions-error");
const defaultsText = document.getElementById("tm-defaults");
const resetButton = document.getElementById("tm-reset");
const tmLive = document.getElementById("tm-live");
const checklistSummary = document.getElementById("checklist-summary");
const checklistStrand = document.getElementById("checklist-strand");
const checklistSequence = document.getElementById("checklist-sequence");
const checklistList = document.getElementById("checklist-list");
const checklistNote = document.getElementById("checklist-note");

// The result on screen and what the Tm and the checklist need from it.
// null while there is no valid result.
let state = null;
let announceTimer = 0;

// ---------- Public API (used by main.js) ----------

/**
 * Draws the Tm card and the checklist for a valid analyse() result, using
 * the conditions currently in the inputs.
 * @param {object} result a valid result from analyse(); its melting field is
 *   replaced whenever the conditions change
 */
export function showTemperature(result) {
  const rc = result.reverseComplement;
  state = {
    result,
    // A duplex has one Tm whichever strand is named, so the reverse
    // complement (already in the result) stands in for the input here. Its
    // A+T and G+C totals are the input's too, which is all Wallace and the
    // long-duplex formula use.
    rc,
    counts: countBases(rc),
    // The checklist also needs the strand as entered, but only for oligos.
    input: rc.length <= OLIGO_MAX_LENGTH ? reverseComplement(rc) : null,
  };
  update(false);
}

/** Empties the Tm card and the checklist when there is no valid result. */
export function clearTemperature() {
  state = null;
  clearTimeout(announceTimer);
  tmCard.classList.remove("tm-card--long");
  tmNumber.textContent = "—";
  tmNote.textContent = "Not calculated";
  tmWallace.textContent = "—";
  tmWallaceHint.textContent = "";
  showChecklistNote("Not checked");
}

// ---------- Conditions ----------

function resetConditions() {
  for (const field of FIELDS) {
    field.input.value = String(DEFAULT_TM_CONDITIONS[field.key]);
    field.input.removeAttribute("aria-invalid");
  }
}

// Reads the four inputs. Returns the conditions and the first problem found,
// as a sentence ("" when there is none). An empty or out-of-range input
// becomes NaN, so calc.js gives no Tm for it.
function readConditions() {
  const conditions = {};
  let problem = "";
  for (const field of FIELDS) {
    const { input } = field;
    const ok = input.value.trim() !== "" && input.validity.valid;
    if (ok) input.removeAttribute("aria-invalid");
    else input.setAttribute("aria-invalid", "true");
    conditions[field.key] = ok ? Number(input.value) : NaN;
    if (!ok && !problem) {
      problem = `${field.name}: enter a number from ${input.min} to ${input.max} ${field.unit}.`;
    }
  }
  if (!problem) {
    const reason = checkTmConditions(conditions);
    // calc.js writes plain "Mg2+" (it also goes into exports); show "Mg²⁺" here.
    if (reason) problem = `${reason[0].toUpperCase()}${reason.slice(1).replace("Mg2+", "Mg²⁺")}.`;
  }
  return { conditions, problem };
}

// ---------- Render ----------

// Recomputes the Tm at the current conditions and redraws the card and the
// checklist. announce is true when the user changed something.
function update(announce) {
  if (!state) return;
  const { conditions, problem } = readConditions();
  const melting = meltingTemperature(state.rc, state.counts, conditions);
  state.result.melting = melting; // downloads read this

  conditionsError.textContent = problem;
  renderTemperature(melting, problem);
  renderChecklist(melting.value);

  if (announce) {
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      const value = Number.isFinite(melting.value) ? `${formatTemperature(melting.value)} °C` : "not calculated";
      tmLive.textContent = `Cooking temperature ${value}. ${checklistSummary.textContent}`;
    }, ANNOUNCE_DELAY_MS);
  }
}

// One decimal, without a trailing ".0", and a real minus sign.
function formatTemperature(value) {
  return Number(value.toFixed(1)).toString().replace("-", "−");
}

function renderTemperature(melting, problem) {
  const { value, model, wallace } = melting;
  tmNumber.textContent = Number.isFinite(value) ? formatTemperature(value) : "—";
  // A long-duplex Tm is not a primer Tm, so it gets less emphasis.
  tmCard.classList.toggle("tm-card--long", model === "long-duplex");

  let note;
  if (model === "nearest-neighbour") {
    note = "Nearest-neighbour Tm (SantaLucia 1998, Owczarzy salt correction) at the conditions below.";
  } else if (model === "long-duplex") {
    note =
      `Long-duplex estimate for the whole ${state.rc.length.toLocaleString("en-US")}-nt sequence, ` +
      `not a primer Tm. The nearest-neighbour Tm covers oligos up to ${OLIGO_MAX_LENGTH} nt.`;
  } else {
    note = problem ? "Not calculated: check the reaction conditions." : `${melting.method}.`;
  }
  if (Number.isFinite(value) && value < 0) {
    note += " Below 0 °C: too short or too AT-rich to form a stable duplex.";
  }
  tmNote.textContent = note;

  if (wallace === null) {
    tmWallace.textContent = "—";
    tmWallaceHint.textContent = `not shown above ${WALLACE_REFERENCE_MAX_LENGTH} nt, where it overestimates`;
  } else {
    tmWallace.textContent = `${wallace} °C`;
    tmWallaceHint.textContent = "2·(A+T) + 4·(G+C), a quick rule of thumb";
  }
}

function showChecklistNote(text) {
  checklistSummary.textContent = "";
  checklistStrand.hidden = true;
  checklistSequence.hidden = true;
  checklistList.hidden = true;
  checklistList.replaceChildren();
  checklistNote.hidden = false;
  checklistNote.textContent = text;
}

function renderChecklist(tm) {
  if (state.input === null) {
    showChecklistNote(
      `The checklist applies to primers, up to ${OLIGO_MAX_LENGTH} nt. ` +
        `This sequence is ${state.rc.length.toLocaleString("en-US")} nt.`,
    );
    return;
  }

  const strand = checklistStrand.querySelector("input:checked").value;
  const primer = strand === "input" ? state.input : state.rc;
  const rows = primerChecklist(primer, tm);
  const passed = rows.filter((row) => row.ok).length;

  checklistSummary.textContent = `${passed} of ${rows.length} pass`;
  checklistSequence.textContent = `5′-${primer}-3′`;
  checklistList.replaceChildren(...rows.map(renderRow));
  checklistStrand.hidden = false;
  checklistSequence.hidden = false;
  checklistList.hidden = false;
  checklistNote.hidden = true;
}

// One row: icon, then the rule and the reason. The icon is decorative; the
// "Pass" / "Warning" word is there for screen readers, so the state is never
// shown by colour or symbol alone.
function renderRow(row) {
  const item = document.createElement("li");
  item.className = `check-row ${row.ok ? "is-ok" : "is-warn"}`;

  const icon = document.createElement("span");
  icon.className = "check-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = row.ok ? "✓" : "⚠︎"; // FE0E: text glyph, not emoji

  const label = document.createElement("span");
  label.className = "check-label";
  const status = document.createElement("span");
  status.className = "sr-text";
  status.textContent = row.ok ? "Pass: " : "Warning: ";
  label.append(status, row.label);

  const detail = document.createElement("span");
  detail.className = "check-detail";
  detail.textContent = row.detail;

  const text = document.createElement("span");
  text.className = "check-text";
  text.append(label, detail);

  item.append(icon, text);
  return item;
}

// ---------- Set-up ----------
defaultsText.textContent = FIELDS.map(
  (field) => `${DEFAULT_TM_CONDITIONS[field.key]} ${field.unit} ${field.term}`,
).join(", ");
resetConditions();

conditionsFieldset.addEventListener("input", () => update(true));
resetButton.addEventListener("click", () => {
  resetConditions();
  update(true);
});
checklistStrand.addEventListener("change", () => {
  if (state) renderChecklist(state.result.melting.value);
});
