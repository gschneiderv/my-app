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

// Melting temperature (section 4). The reaction conditions default to
// Primer3's: 50 mM monovalent cations (Na+/K+), 1.5 mM Mg2+, 0.6 mM dNTPs and
// 50 nM oligo. The user can change them on the results page.
export const DEFAULT_TM_CONDITIONS = Object.freeze({
  monovalentMm: 50,
  magnesiumMm: 1.5,
  dntpMm: 0.6,
  oligoNm: 50,
});

// Longest sequence treated as an oligo, inclusive. Up to this length the Tm
// uses the nearest-neighbour model and the primer checklist applies. Longer
// sequences get a long-duplex estimate instead. 60 nt is the default of
// Primer3's calc_tm (max_nn_length).
export const OLIGO_MAX_LENGTH = 60;

// Longest sequence for which the Wallace rule is shown, inclusive. 30 nt is
// the top of the usual primer range (18-30 nt). Beyond it the rule keeps
// adding 2-4 °C per base and lands far above the real Tm.
export const WALLACE_REFERENCE_MAX_LENGTH = 30;

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
  The main Tm is the nearest-neighbour model, the same one Primer3 uses:
  SantaLucia (1998) stacking energies, then the Owczarzy salt correction for
  monovalent ions and Mg2+ (Primer3's PRIMER_SALT_CORRECTIONS=2). Above
  OLIGO_MAX_LENGTH the Tm is a long-duplex estimate, as in Primer3. The
  Wallace rule stays as a quick reference (the "Cooking Temperature" pitch).

  Conditions objects use the keys of DEFAULT_TM_CONDITIONS:
    monovalentMm  Na+ and K+ together, mM
    magnesiumMm   Mg2+, mM
    dntpMm        all four dNTPs together, mM
    oligoNm       oligo (primer) concentration, nM
*/

// SantaLucia (1998) unified nearest-neighbour parameters, in 1 M NaCl. Each
// entry is [ΔH kcal/mol, ΔS cal/(K·mol)] for one stack of two base pairs,
// keyed by the top strand read 5'->3'. A stack read from the other strand is
// the same stack (CA/GT is TG/AC), so both names hold the same numbers.
const NN_STACKS = {
  AA: [-7.9, -22.2], TT: [-7.9, -22.2],
  AT: [-7.2, -20.4],
  TA: [-7.2, -21.3],
  CA: [-8.5, -22.7], TG: [-8.5, -22.7],
  GT: [-8.4, -22.4], AC: [-8.4, -22.4],
  CT: [-7.8, -21.0], AG: [-7.8, -21.0],
  GA: [-8.2, -22.2], TC: [-8.2, -22.2],
  CG: [-10.6, -27.2],
  GC: [-9.8, -24.4],
  GG: [-8.0, -19.9], CC: [-8.0, -19.9],
};

// Initiation, added once for each end of the duplex, by the pair at that end.
const NN_INIT_GC = [0.1, -2.8];
const NN_INIT_AT = [2.3, 4.1];

// Extra entropy when the sequence is its own reverse complement.
const NN_SYMMETRY_DS = -1.4;

const GAS_CONSTANT = 1.9872; // cal/(K·mol)
const KELVIN = 273.15;

/**
 * Wallace rule: Tm = 2·(A+T) + 4·(G+C), in °C. A rule of thumb for short
 * oligos that ignores salt and oligo concentration. Shown as a reference next
 * to the nearest-neighbour Tm, up to WALLACE_REFERENCE_MAX_LENGTH.
 * @param {{A: number, C: number, G: number, T: number}} counts base counts
 * @returns {number} Tm in °C
 */
export function wallaceTm(counts) {
  return 2 * (counts.A + counts.T) + 4 * (counts.G + counts.C);
}

// Free Mg2+ in mol/L. dNTPs bind Mg2+ one to one, so only the Mg2+ above the
// dNTP concentration is free (Primer3's approach). Zero when dNTPs >= Mg2+.
function freeMagnesiumMolar(conditions) {
  const { magnesiumMm, dntpMm } = conditions;
  return magnesiumMm > dntpMm ? (magnesiumMm - dntpMm) / 1000 : 0;
}

/**
 * Checks that a conditions object can give a Tm.
 * @param {{monovalentMm: number, magnesiumMm: number, dntpMm: number, oligoNm: number}} conditions
 * @returns {string} a short reason when the conditions cannot be used, or "" when they can
 */
export function checkTmConditions(conditions) {
  for (const key of Object.keys(DEFAULT_TM_CONDITIONS)) {
    const value = conditions[key];
    if (!Number.isFinite(value) || value < 0) return "every concentration must be a number of 0 or more";
  }
  if (conditions.oligoNm === 0) return "the oligo concentration must be above 0";
  if (conditions.monovalentMm === 0 && freeMagnesiumMolar(conditions) === 0) {
    return "add monovalent salt, or more Mg2+ than dNTPs";
  }
  return "";
}

/*
  Owczarzy salt correction, as Primer3 applies it. Returns the term added to
  1/Tm (in 1/K) to go from 1 M Na+ to the given ions. Concentrations are in
  mol/L. The ratio R = sqrt([free Mg2+]) / [monovalent] picks the equation:
    R < 0.22       monovalent ions dominate: Owczarzy et al. 2004, eq. 22
    0.22 <= R < 6  mixed: Owczarzy et al. 2008, eq. 16, with a, d and g
                   adjusted for the monovalent concentration
    R >= 6         Mg2+ dominates: Owczarzy et al. 2008, eq. 16
*/
function owczarzyCorrection(gcFraction, length, monovalent, magnesium) {
  const ratio = monovalent > 0 ? Math.sqrt(magnesium) / monovalent : 6;

  if (ratio < 0.22) {
    const lnMon = Math.log(monovalent);
    return (4.29 * gcFraction - 3.95) * 1e-5 * lnMon + 9.4e-6 * lnMon ** 2;
  }

  let a = 3.92e-5;
  const b = -9.11e-6;
  const c = 6.26e-5;
  let d = 1.42e-5;
  const e = -4.82e-4;
  const f = 5.25e-4;
  let g = 8.31e-5;
  if (ratio < 6) {
    const lnMon = Math.log(monovalent);
    a = 3.92e-5 * (0.843 - 0.352 * Math.sqrt(monovalent) * lnMon);
    d = 1.42e-5 * (1.279 - 4.03e-3 * lnMon - 8.03e-3 * lnMon ** 2);
    g = 8.31e-5 * (0.486 - 0.258 * lnMon + 5.25e-3 * lnMon ** 3);
  }

  const lnMg = Math.log(magnesium);
  return (
    a + b * lnMg + gcFraction * (c + d * lnMg) + (e + f * lnMg + g * lnMg ** 2) / (2 * (length - 1))
  );
}

/**
 * Nearest-neighbour Tm of an oligo paired with its exact complement:
 * SantaLucia (1998) parameters with the Owczarzy salt correction, the same
 * equations as Primer3 with PRIMER_SALT_CORRECTIONS=2. The oligo
 * concentration enters as C/4, or as C when the sequence is its own reverse
 * complement (SantaLucia 1998; Primer3 does the same).
 * Meant for oligos up to OLIGO_MAX_LENGTH. Only call it on a validated sequence.
 * @param {string} seq A/C/G/T sequence, 5'->3'
 * @param {{monovalentMm: number, magnesiumMm: number, dntpMm: number, oligoNm: number}} [conditions]
 * @returns {number} Tm in °C, or NaN for fewer than 2 nt or unusable conditions
 */
export function nearestNeighbourTm(seq, conditions = DEFAULT_TM_CONDITIONS) {
  const n = seq.length;
  if (n < 2 || checkTmConditions(conditions)) return NaN;

  let enthalpy = 0; // kcal/mol
  let entropy = 0; // cal/(K·mol)
  let gc = 0;
  for (let i = 0; i < n; i++) {
    if (seq[i] === "G" || seq[i] === "C") gc += 1;
    if (i < n - 1) {
      const [dh, ds] = NN_STACKS[seq[i] + seq[i + 1]];
      enthalpy += dh;
      entropy += ds;
    }
  }
  for (const end of [seq[0], seq[n - 1]]) {
    const [dh, ds] = end === "G" || end === "C" ? NN_INIT_GC : NN_INIT_AT;
    enthalpy += dh;
    entropy += ds;
  }

  const selfComplementary = seq === reverseComplement(seq);
  if (selfComplementary) entropy += NN_SYMMETRY_DS;
  const strandMolar = (conditions.oligoNm * 1e-9) / (selfComplementary ? 1 : 4);

  // Tm in 1 M Na+, in kelvin, then corrected to the real ions.
  const tmOneMolar = (enthalpy * 1000) / (entropy + GAS_CONSTANT * Math.log(strandMolar));
  const correction = owczarzyCorrection(
    gc / n,
    n,
    conditions.monovalentMm / 1000,
    freeMagnesiumMolar(conditions),
  );
  return 1 / (1 / tmOneMolar + correction) - KELVIN;
}

/**
 * Long-duplex Tm estimate, used by Primer3 above its nearest-neighbour limit:
 * Tm = 81.5 + 16.6·log10[Na+] + 0.41·(%GC) − 600/N. Mg2+ counts as
 * 120·sqrt([Mg2+] − [dNTPs]) mM of extra Na+ (von Ahsen et al. 2001), as in
 * Primer3. This describes a whole long duplex, not a primer.
 * @param {{A: number, C: number, G: number, T: number}} counts base counts
 * @param {number} length sequence length in nt
 * @param {{monovalentMm: number, magnesiumMm: number, dntpMm: number, oligoNm: number}} [conditions]
 *   the oligo concentration is not used
 * @returns {number} Tm in °C, or NaN for an empty sequence or unusable conditions
 */
export function longDuplexTm(counts, length, conditions = DEFAULT_TM_CONDITIONS) {
  if (length < 1 || checkTmConditions(conditions)) return NaN;
  const sodiumMm = conditions.monovalentMm + 120 * Math.sqrt(freeMagnesiumMolar(conditions) * 1000);
  const gcPercent = ((counts.G + counts.C) / length) * 100;
  return 81.5 + 16.6 * Math.log10(sodiumMm / 1000) + 0.41 * gcPercent - 600 / length;
}

// "50 mM Na+/K+, 1.5 mM Mg2+, 0.6 mM dNTPs, 50 nM oligo", for method notes.
function describeConditions(c, withOligo) {
  const parts = [`${c.monovalentMm} mM Na+/K+`, `${c.magnesiumMm} mM Mg2+`, `${c.dntpMm} mM dNTPs`];
  if (withOligo) parts.push(`${c.oligoNm} nM oligo`);
  return parts.join(", ");
}

/**
 * The Tm shown on the results page ("Cooking Temperature"), chosen by length:
 *   2 to OLIGO_MAX_LENGTH nt  nearest-neighbour Tm (nearestNeighbourTm)
 *   longer                    long-duplex estimate (longDuplexTm), not a primer Tm
 * The Wallace rule comes along as a reference up to WALLACE_REFERENCE_MAX_LENGTH.
 * Only call it on a validated sequence.
 * @param {string} seq A/C/G/T sequence
 * @param {{A: number, C: number, G: number, T: number}} [counts] base counts of seq
 * @param {{monovalentMm: number, magnesiumMm: number, dntpMm: number, oligoNm: number}} [conditions]
 * @returns {{
 *   value: number,
 *   model: "nearest-neighbour" | "long-duplex" | "none",
 *   method: string,
 *   conditions: {monovalentMm: number, magnesiumMm: number, dntpMm: number, oligoNm: number},
 *   wallace: number | null
 * }} value is the Tm in °C (NaN when model is "none"); method is a one-line
 *   description with the conditions, used in exports; wallace is null above
 *   WALLACE_REFERENCE_MAX_LENGTH
 */
export function meltingTemperature(seq, counts = countBases(seq), conditions = DEFAULT_TM_CONDITIONS) {
  const n = seq.length;
  const used = { ...conditions };
  const wallace = n <= WALLACE_REFERENCE_MAX_LENGTH ? wallaceTm(counts) : null;
  const none = (reason) => ({ value: NaN, model: "none", method: `Not calculated: ${reason}`, conditions: used, wallace });

  const problem = checkTmConditions(used);
  if (problem) return none(problem);
  if (n < 2) return none("a Tm needs at least 2 nt");

  if (n <= OLIGO_MAX_LENGTH) {
    return {
      value: nearestNeighbourTm(seq, used),
      model: "nearest-neighbour",
      method: `Nearest-neighbour (SantaLucia 1998, Owczarzy salt correction); ${describeConditions(used, true)}`,
      conditions: used,
      wallace,
    };
  }

  return {
    value: longDuplexTm(counts, n, used),
    model: "long-duplex",
    method:
      `Long-duplex estimate, not a primer Tm (81.5 + 16.6·log10[Na+] + 0.41·%GC - 600/N); ` +
      describeConditions(used, false),
    conditions: used,
    wallace,
  };
}

// ---------- 4b. Primer checklist ----------
/*
  Quick checks of a primer before ordering it. Sources: QIAGEN, PREMIER
  Biosoft and Addgene primer design guides, and Primer3's defaults.
  The self-complementarity check is a simple run search, not a folding
  (ΔG) calculation.
*/
export const PRIMER_RULES = Object.freeze({
  minLength: 18,
  maxLength: 30,
  minGcPercent: 40,
  maxGcPercent: 60,
  minTm: 52,
  maxTm: 65,
  maxGcInLastFive: 3, // G/C allowed in the last 5 bases at the 3' end
  maxRun: 4, // identical bases in a row
  maxDinucleotideRepeats: 4, // e.g. ATATATAT is 4 repeats of AT
  // A complementary run at the 3' end weighs double: 4 bases there warn,
  // elsewhere it takes 8. Primer3 allows 3 at the end and 8 anywhere.
  maxSelfComplementEnd: 3,
  maxSelfComplementAny: 7,
});

/**
 * Longest stretch of one repeated base, such as AAAAA.
 * @param {string} seq
 * @returns {{base: string, length: number, position: number}} position is 1-based (0 if seq is empty)
 */
export function longestRun(seq) {
  let best = { base: "", length: 0, position: 0 };
  let start = 0;
  for (let i = 1; i <= seq.length; i++) {
    if (i < seq.length && seq[i] === seq[start]) continue;
    if (i - start > best.length) best = { base: seq[start], length: i - start, position: start + 1 };
    start = i;
  }
  return best;
}

/**
 * Longest repeat of a two-base unit, such as ATATAT (AT three times).
 * Units of one base twice (AA) are runs, not repeats, and are left out.
 * @param {string} seq
 * @returns {{unit: string, repeats: number, position: number}} position is 1-based (0 when none)
 */
export function longestDinucleotideRepeat(seq) {
  let best = { unit: "", repeats: 0, position: 0 };
  let start = 0; // start of the current stretch where every base equals the one two places back
  for (let i = 2; i <= seq.length; i++) {
    if (i < seq.length && seq[i] === seq[i - 2]) continue;
    const repeats = Math.floor((i - start) / 2);
    if (seq[start] !== seq[start + 1] && repeats > best.repeats) {
      best = { unit: seq.slice(start, start + 2), repeats, position: start + 1 };
    }
    start = i - 1;
  }
  return best;
}

/**
 * Simple self-complementarity scan: stretches of the primer that can pair,
 * antiparallel, with another part of the same primer or with a second copy
 * (hairpins and self-dimers). O(n²), so meant for primer-length sequences.
 * @param {string} seq A/C/G/T sequence, 5'->3'
 * @returns {{
 *   longest: {length: number, position: number, partner: number},
 *   threePrime: {length: number, partner: number}
 * }} longest is the longest complementary run anywhere; threePrime is the
 *   longest one that ends at the 3' base. Positions are 1-based starts in
 *   seq; partner is where the pairing stretch starts.
 */
export function selfComplementarity(seq) {
  const n = seq.length;
  const rc = reverseComplement(seq);

  // Longest common substring of seq and its reverse complement. A stretch of
  // seq that also occurs in rc pairs with the matching stretch of seq.
  let longest = { length: 0, position: 0, partner: 0 };
  let previous = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    const row = new Array(n + 1).fill(0);
    for (let j = 1; j <= n; j++) {
      if (seq[i - 1] !== rc[j - 1]) continue;
      row[j] = previous[j - 1] + 1;
      if (row[j] > longest.length) {
        // rc[j - length, j) is the reverse complement of seq[n - j, n - j + length).
        longest = { length: row[j], position: i - row[j] + 1, partner: n - j + 1 };
      }
    }
    previous = row;
  }

  // The 3' end: the longest tail whose reverse complement occurs in seq.
  let threePrime = { length: 0, partner: 0 };
  for (let k = 1; k <= n; k++) {
    const at = seq.indexOf(reverseComplement(seq.slice(n - k)));
    if (at === -1) break;
    threePrime = { length: k, partner: at + 1 };
  }

  return { longest, threePrime };
}

function countGc(text) {
  let gc = 0;
  for (const base of text) if (base === "G" || base === "C") gc += 1;
  return gc;
}

/**
 * Primer checklist: one row per rule in PRIMER_RULES, each a pass or a
 * warning with a short reason. The sequence is read as the primer, 5'->3',
 * so the 3' checks look at its last bases.
 * @param {string} seq validated A/C/G/T sequence, 5'->3'
 * @param {number} tm Tm in °C at the current conditions (NaN if unknown)
 * @returns {Array<{id: string, label: string, ok: boolean, detail: string}> | null}
 *   null for an empty sequence or one longer than OLIGO_MAX_LENGTH, which is
 *   not a primer
 */
export function primerChecklist(seq, tm) {
  const n = seq.length;
  if (n === 0 || n > OLIGO_MAX_LENGTH) return null;
  const rules = PRIMER_RULES;
  const rows = [];

  // Length
  let detail = `${n} nt`;
  if (n < rules.minLength) detail += `, shorter than ${rules.minLength} nt`;
  if (n > rules.maxLength) detail += `, longer than ${rules.maxLength} nt`;
  rows.push({
    id: "length",
    label: `Length ${rules.minLength}–${rules.maxLength} nt`,
    ok: n >= rules.minLength && n <= rules.maxLength,
    detail,
  });

  // GC content
  const gcPercent = (countGc(seq) / n) * 100;
  detail = `${gcPercent.toFixed(1)} %`;
  if (gcPercent < rules.minGcPercent) detail += `, below ${rules.minGcPercent} %`;
  if (gcPercent > rules.maxGcPercent) detail += `, above ${rules.maxGcPercent} %`;
  rows.push({
    id: "gc",
    label: `GC content ${rules.minGcPercent}–${rules.maxGcPercent} %`,
    ok: gcPercent >= rules.minGcPercent && gcPercent <= rules.maxGcPercent,
    detail,
  });

  // Tm at the current conditions
  const tmKnown = Number.isFinite(tm);
  if (!tmKnown) detail = "No Tm at the current conditions";
  else {
    detail = `${tm.toFixed(1)} °C at the current conditions`;
    if (tm < rules.minTm) detail += `, below ${rules.minTm} °C`;
    if (tm > rules.maxTm) detail += `, above ${rules.maxTm} °C`;
  }
  rows.push({
    id: "tm",
    label: `Tm ${rules.minTm}–${rules.maxTm} °C`,
    ok: tmKnown && tm >= rules.minTm && tm <= rules.maxTm,
    detail,
  });

  // 3' GC clamp: a G or C in the last 2 bases, but not too many in the last 5
  const endTwo = countGc(seq.slice(-2));
  const endFive = countGc(seq.slice(-5));
  detail = `Ends …${seq.slice(-5)}: ${endTwo} G/C in the last 2 bases, ${endFive} in the last 5`;
  if (endTwo === 0) detail += "; no clamp";
  if (endFive > rules.maxGcInLastFive) detail += `; more than ${rules.maxGcInLastFive}`;
  rows.push({
    id: "clamp",
    label: `3′ GC clamp: 1–2 G/C at the end, at most ${rules.maxGcInLastFive} in the last 5`,
    ok: endTwo >= 1 && endFive <= rules.maxGcInLastFive,
    detail,
  });

  // Runs of one base
  const run = longestRun(seq);
  rows.push({
    id: "runs",
    label: `No run of more than ${rules.maxRun} identical bases`,
    ok: run.length <= rules.maxRun,
    detail: `Longest run: ${run.base.repeat(run.length)} (${run.length}) at position ${run.position}`,
  });

  // Dinucleotide repeats
  const repeat = longestDinucleotideRepeat(seq);
  rows.push({
    id: "repeats",
    label: `No more than ${rules.maxDinucleotideRepeats} dinucleotide repeats`,
    ok: repeat.repeats <= rules.maxDinucleotideRepeats,
    detail:
      repeat.repeats < 2
        ? "No repeated dinucleotide"
        : `Longest: ${repeat.unit} × ${repeat.repeats} at position ${repeat.position}`,
  });

  // 3' end base
  const last = seq[n - 1];
  rows.push({
    id: "end",
    label: "3′ end is not T",
    ok: last !== "T",
    detail: `Ends in ${last}`,
  });

  // Self-complementarity, weighted towards the 3' end
  const self = selfComplementarity(seq);
  const { longest, threePrime } = self;
  const span = (start, length) => `${start}–${start + length - 1}`;
  const endOk = threePrime.length <= rules.maxSelfComplementEnd;
  const anyOk = longest.length <= rules.maxSelfComplementAny;
  if (!endOk) {
    const tailStart = n - threePrime.length + 1;
    detail = `The last ${threePrime.length} bases (…${seq.slice(tailStart - 1)}) `;
    // A tail that pairs with itself is a palindrome: two copies pair at their 3' ends.
    detail +=
      threePrime.partner === tailStart
        ? "are self-complementary: primer-dimer risk"
        : `can pair with positions ${span(threePrime.partner, threePrime.length)}: primer-dimer risk`;
  } else if (!anyOk) {
    detail = `Positions ${span(longest.position, longest.length)} (${longest.length} bases) `;
    detail +=
      longest.partner === longest.position
        ? "are self-complementary"
        : `can pair with positions ${span(longest.partner, longest.length)}`;
  } else if (longest.length < 4) {
    detail = "No complementary run of 4 or more bases";
  } else {
    detail = `Longest complementary run: ${longest.length} bases; ${threePrime.length} at the 3′ end`;
  }
  rows.push({
    id: "self",
    label:
      `No self-complementary run of ${rules.maxSelfComplementEnd + 1}+ bases at the 3′ end, ` +
      `or ${rules.maxSelfComplementAny + 1}+ anywhere`,
    ok: endOk && anyOk,
    detail,
  });

  return rows;
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
    rna: toRna(seq),
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
