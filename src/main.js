/*
  Entry point for the results screen (results.html).

  Calculation is not connected yet, so the only behaviour here is returning
  to Screen 1. Once the calculation ticket lands, the reverse complement, RNA
  transcription and Tm results will be written into the strand <code> blocks
  and metric cells in results.html, using the ids added at that point.
*/

// Must match STORAGE_KEY in src/init.js. This is the sequence Screen 1 saved.
const STORAGE_KEY = "sequenceChef.rawSequence";

// ---------- 1. "Start New Sequence" ----------
// Clears the saved input, fades the page out, then opens Screen 1 with an
// empty text area. The results shown here are placeholders, so there is no
// result state to reset beyond the saved sequence.
const newSequenceButton = document.getElementById("new-sequence-button");

newSequenceButton.addEventListener("click", () => {
  // sessionStorage can throw when storage is blocked. If clearing fails, still
  // navigate: Screen 1 starts empty anyway.
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
