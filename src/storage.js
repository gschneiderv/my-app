/*
  SequenceChef, hand-over of the raw input between pages.

  Screen 1 saves the text exactly as typed. The results page and the warning
  page read it back, and Screen 1 reads it again so "Go Back & Edit Sequence"
  restores the text. The key and the error handling live here, once, so the
  three pages cannot drift apart.

  sessionStorage can throw at any time: when the browser blocks site storage
  (SecurityError, even on just reading the `sessionStorage` property) or when
  a value does not fit (QuotaExceededError). Every access is wrapped, and
  save() reports failure instead of throwing, so the caller decides what to do.
*/

export const STORAGE_KEY = "sequenceChef.rawSequence";

// Returns the saved text, or "" when there is none or storage is blocked.
export function readSaved() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch (error) {
    console.warn("Could not read the saved sequence.", error);
    return "";
  }
}

/*
  Saves the raw text for the next page. The old value is removed first, so a
  failed write can never leave an earlier sequence behind for the next page
  to show by mistake.

  Returns { ok: true }, or { ok: false, reason } where reason is:
    "quota"    the text does not fit in the browser's storage
    "blocked"  the browser does not allow site storage at all
*/
export function save(raw) {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.setItem(STORAGE_KEY, raw);
    return { ok: true };
  } catch (error) {
    console.warn("Could not save the sequence for the next screen.", error);
    return { ok: false, reason: isQuotaError(error) ? "quota" : "blocked" };
  }
}

// Removes the saved text. Returns false if storage is blocked.
export function clear() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.warn("Could not clear the saved sequence.", error);
    return false;
  }
}

// Chrome, Safari and current Firefox use "QuotaExceededError". Older Firefox
// versions used "NS_ERROR_DOM_QUOTA_REACHED".
function isQuotaError(error) {
  return error?.name === "QuotaExceededError" || error?.name === "NS_ERROR_DOM_QUOTA_REACHED";
}
