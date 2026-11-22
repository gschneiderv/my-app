/*
  SequenceChef calculations.

  Every function here is pure: it takes a string and returns a value, with no
  DOM access. That keeps the maths easy to test on its own, and lets main.js
  handle only the display.
*/

// Watson-Crick pairs, used for the reverse complement.
const COMPLEMENT = { A: "T", T: "A", C: "G", G: "C" };

// Standard genetic code. A codon's index is first*16 + second*4 + third, with
// the bases in the order T, C, A, G. "*" marks a stop codon.
const BASE_ORDER = "TCAG";
const CODON_TABLE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";

// Melting temperature rules. Wallace is for short oligos; the salt-adjusted
// formula is used for longer sequences. Sodium is fixed at 50 mM.
const WALLACE_MAX_LENGTH = 14;
const SODIUM_MOLAR = 0.05;

// ---------- 1. Clean and validate ----------

/*
  Sanitises raw pasted text into a plain nucleotide string, so sequences copied
  from databases such as NCBI work without manual editing. Runs before any
  calculation, in this order:
  1. Drops FASTA header lines (starting with ">", even after leading spaces).
     This works on whole lines and comes first, so text inside a header such
     as ">seq 12 chr1" can never leak into the sequence.
  2. Strips alignment gaps ("-"), all whitespace (spaces, tabs, line breaks)
     and digits 0-9, which removes the row numbers of GenBank-style blocks.
  3. Upper-cases the rest, so "acgt" and "ACGT" are treated the same.
  Nothing else is removed on purpose: letters such as U, N or X stay, so
  validate() can still report them instead of them vanishing silently.
*/
export function cleanSequence(raw) {
  return raw
    .split(/\r\n?|\n/) // Unix (\n), Windows (\r\n) and old Mac (\r) line ends
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("")
    .replace(/[\s0-9-]+/g, "")
    .toUpperCase();
}

/*
  Strict check on the cleaned sequence: only A, T, C and G may remain
  (/^[ATCG]+$/). Anything else, such as U (RNA), N (ambiguous base) or a typo
  like X, would corrupt the melting temperature, so the pipeline stops here.

  The result carries everything the warning screen needs, so it does not have
  to scan the sequence again:
    ok            true only for a non-empty, pure A/T/C/G sequence
    empty         true when nothing is left after cleaning
    message       one-line summary, for places that show plain text
    invalidChars  each offending character once, in order of first appearance
    invalidCount  how many offending characters there are in total
    positions     1-based position of every offending character, counted in
                  the cleaned sequence (the same numbering as the results)
*/
export function validate(seq) {
  if (seq.length === 0) {
    return {
      ok: false,
      empty: true,
      message: "No DNA sequence was entered.",
      invalidChars: [],
      invalidCount: 0,
      positions: [],
    };
  }

  if (/^[ATCG]+$/.test(seq)) {
    return { ok: true, empty: false, message: "", invalidChars: [], invalidCount: 0, positions: [] };
  }

  // Only invalid input gets this far, so valid sequences pay for one regex
  // test and nothing else. for...of walks whole characters, so an emoji or
  // other two-unit character counts as one position, as the user sees it.
  const invalidChars = [];
  const positions = [];
  let position = 0;
  for (const char of seq) {
    position += 1;
    if (!"ATCG".includes(char)) {
      positions.push(position);
      if (!invalidChars.includes(char)) invalidChars.push(char);
    }
  }

  const count = positions.length;
  return {
    ok: false,
    empty: false,
    message:
      `Found ${count} invalid character${count === 1 ? "" : "s"} (${invalidChars.join(", ")}), ` +
      `first at position ${positions[0]}. Only A, T, C and G are allowed.`,
    invalidChars,
    invalidCount: count,
    positions,
  };
}

// ---------- 2. Composition ----------

// Counts each base in one pass. Only call this on a validated sequence.
export function countBases(seq) {
  const counts = { A: 0, C: 0, G: 0, T: 0 };
  for (const base of seq) {
    counts[base] += 1;
  }
  return counts;
}

// ---------- 3. Reverse complement and transcription ----------

/*
  Reverse complement: each base is replaced by its partner, and the order is
  reversed so the result still reads 5' to 3'.
*/
export function reverseComplement(seq) {
  const out = new Array(seq.length);
  for (let i = 0; i < seq.length; i++) {
    out[seq.length - 1 - i] = COMPLEMENT[seq[i]];
  }
  return out.join("");
}

// Transcription to RNA: uracil (U) takes the place of thymine (T).
export function toRna(seq) {
  return seq.replaceAll("T", "U");
}

// ---------- 4. Melting temperature ----------

/*
  Wallace rule for short sequences: Tm = 2·(A+T) + 4·(G+C).
  Salt-adjusted formula for longer ones (Marmur-Doty style):
  Tm = 81.5 + 16.6·log10[Na+] + 0.41·(%GC) − 675/N
*/
export function meltingTemperature(seq, counts) {
  const n = seq.length;
  const gc = counts.G + counts.C;
  const at = counts.A + counts.T;

  if (n < WALLACE_MAX_LENGTH) {
    return { value: 2 * at + 4 * gc, method: "Wallace rule (under 14 nt)" };
  }

  const gcPercent = (gc / n) * 100;
  const value = 81.5 + 16.6 * Math.log10(SODIUM_MOLAR) + 0.41 * gcPercent - 675 / n;
  return { value, method: "Salt-adjusted, 50 mM Na+" };
}

// ---------- 5. Coding frame ----------

// Looks up one codon's amino acid. The codon must be three valid bases.
function translateCodon(codon) {
  const index =
    BASE_ORDER.indexOf(codon[0]) * 16 +
    BASE_ORDER.indexOf(codon[1]) * 4 +
    BASE_ORDER.indexOf(codon[2]);
  return CODON_TABLE[index];
}

/*
  Longest open reading frame in one frame. An ORF runs from an ATG to the
  first stop codon in the same frame. Returns its length in amino acids (the
  codons before the stop). An ORF without a stop codon is not counted.
*/
function longestOrfInFrame(seq, offset) {
  let longest = 0;
  let orfStart = -1; // -1 when the scan is not inside an ORF

  for (let i = offset; i + 3 <= seq.length; i += 3) {
    const codon = seq.slice(i, i + 3);

    if (orfStart === -1) {
      if (codon === "ATG") orfStart = i;
    } else if (translateCodon(codon) === "*") {
      longest = Math.max(longest, (i - orfStart) / 3);
      orfStart = -1;
    }
  }

  return longest;
}

/*
  Best reading frame across all six: +1, +2, +3 on the input and -1, -2, -3 on
  the reverse complement. The frame with the longest ORF wins. Ties go to the
  frame earlier in this list.
*/
export function findCodingFrame(seq, rc) {
  const frames = [
    { label: "+1", strand: "Sense", source: seq, offset: 0 },
    { label: "+2", strand: "Sense", source: seq, offset: 1 },
    { label: "+3", strand: "Sense", source: seq, offset: 2 },
    { label: "-1", strand: "Antisense", source: rc, offset: 0 },
    { label: "-2", strand: "Antisense", source: rc, offset: 1 },
    { label: "-3", strand: "Antisense", source: rc, offset: 2 },
  ];

  let best = { label: null, strand: null, aminoAcids: 0 };
  for (const frame of frames) {
    const aminoAcids = longestOrfInFrame(frame.source, frame.offset);
    if (aminoAcids > best.aminoAcids) {
      best = { label: frame.label, strand: frame.strand, aminoAcids };
    }
  }

  return best;
}

// ---------- 6. Full pipeline ----------

/*
  Runs every step on raw input text. This is the only function main.js calls.
  Invalid input returns the validate() result as is (ok: false, plus the
  message and the details). Valid input returns the results.
*/
export function analyse(raw) {
  const seq = cleanSequence(raw);
  const check = validate(seq);
  if (!check.ok) {
    return check;
  }

  const counts = countBases(seq);
  const rc = reverseComplement(seq);

  return {
    ok: true,
    length: seq.length,
    gcPercent: ((counts.G + counts.C) / seq.length) * 100,
    reverseComplement: rc,
    rna: toRna(rc),
    melting: meltingTemperature(seq, counts),
    coding: findCodingFrame(seq, rc),
  };
}

// ---------- 7. Screen 1 input checks ----------

/*
  Splits raw text into FASTA records, so input that holds several sequences
  (for example a forward and a reverse primer) can be caught before
  cleanSequence() joins them into one. Header lines are found the same way
  cleanSequence() finds them: ">" after optional leading spaces.

  A record counts only if it has sequence text: at least one line that still
  has something left once spaces, digits and "-" are removed (what
  cleanSequence() removes). Header-only records are skipped. Text before the
  first header is a record without a header.

  Returns one entry per record, in input order:
    header  the header line without ">" and surrounding spaces, or null for
            text before the first header
    text    the record exactly as typed: its header line and the lines under
            it, up to the next header line (line breaks included)
*/
export function splitFastaRecords(raw) {
  const records = [];
  // Line ends are kept (capturing group), so each record's text can be cut
  // out of the input unchanged: lines sit at even indexes, line ends at odd.
  const parts = raw.split(/(\r\n?|\n)/);

  let current = { header: null, start: 0, hasSequence: false };
  let offset = 0;

  for (let i = 0; i < parts.length; i += 2) {
    const line = parts[i];
    const trimmed = line.trimStart();

    if (trimmed.startsWith(">")) {
      if (current.hasSequence) records.push(toRecord(raw, current, offset));
      current = { header: trimmed.slice(1).trim(), start: offset, hasSequence: false };
    } else if (!current.hasSequence && /[^\s0-9-]/.test(line)) {
      current.hasSequence = true;
    }

    offset += line.length + (parts[i + 1]?.length ?? 0);
  }

  if (current.hasSequence) records.push(toRecord(raw, current, raw.length));
  return records;
}

function toRecord(raw, record, end) {
  return { header: record.header, text: raw.slice(record.start, end) };
}

/*
  GC content, in percent, of a cleaned sequence that may still hold invalid
  characters (the live check on Screen 1 runs before validation passes).
  Only A, T, C and G are counted, so a stray N or U does not skew the share.
  For a valid sequence this equals the GC % on the results page.
  Returns null when there are no A, T, C or G bases at all.
*/
export function gcPercentOfBases(seq) {
  let gc = 0;
  let at = 0;
  for (const base of seq) {
    if (base === "G" || base === "C") gc += 1;
    else if (base === "A" || base === "T") at += 1;
  }
  return gc + at === 0 ? null : (gc / (gc + at)) * 100;
}
