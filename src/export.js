/*
  Export formats for the results.

  Each builder takes the results object from calc.js, plus two fields that
  main.js adds: `input` (the cleaned input sequence) and `fastaId` (from
  fastaId() below, "" when the input had no header). It returns the file
  contents as a string. There is no DOM access here, so the formats can be
  tested on their own.
*/

// FASTA convention: sequence lines wrapped at 70 characters.
const FASTA_LINE_WIDTH = 70;

// Splits a sequence into fixed-width lines.
function wrap(seq, width) {
  const lines = [];
  for (let i = 0; i < seq.length; i += width) {
    lines.push(seq.slice(i, i + width));
  }
  return lines.join("\n");
}

// Used when the input had no FASTA header.
const DEFAULT_RECORD_ID = "sequence";

/*
  FASTA ID of the raw input: the first word of the first ">" header line,
  or "" when there is no header. ">NM_000207.3 Homo sapiens insulin" gives
  "NM_000207.3". Only the first header counts.
*/
export function fastaId(raw) {
  const match = /^[^\S\r\n]*>[^\S\r\n]*(\S*)/m.exec(raw);
  return match ? match[1] : "";
}

/*
  Download file name without the extension: the FASTA ID made safe for a
  file name (letters, digits, ".", "_" and "-" only, at most 60 characters),
  then "-results". Without a usable ID: "sequencechef-results".
*/
export function downloadBaseName(id) {
  const safe = id
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .slice(0, 60)
    .replace(/^[._-]+|[._-]+$/g, ""); // no hidden ".file" names, no dangling separators
  return `${safe || "sequencechef"}-results`;
}

// FASTA: one record per strand. The input keeps its own ID; the other
// records add a suffix, so every ID in the file is unique.
export function toFasta(r) {
  const id = r.fastaId || DEFAULT_RECORD_ID;
  return [
    `>${id} cleaned input DNA, 5'-3', length=${r.length}`,
    wrap(r.input, FASTA_LINE_WIDTH),
    `>${id}_revcomp reverse complement DNA, 5'-3', length=${r.length}`,
    wrap(r.reverseComplement, FASTA_LINE_WIDTH),
    `>${id}_rna RNA of the input strand (T to U), 5'-3', length=${r.rna.length}`,
    wrap(r.rna, FASTA_LINE_WIDTH),
    "",
  ].join("\n");
}

// Plain text: the FASTA ID (if any), then each strand labelled, sequence on
// its own line.
export function toText(r) {
  return [
    ...(r.fastaId ? [`FASTA ID: ${r.fastaId}`, ""] : []),
    "Input (DNA, cleaned, 5' to 3'):",
    r.input,
    "",
    "Reverse complement (DNA, 5' to 3'):",
    r.reverseComplement,
    "",
    "RNA of the input strand (T to U, 5' to 3'):",
    r.rna,
    "",
  ].join("\n");
}

// CSV field: quoted when it holds a comma, a quote or a line break. Only the
// FASTA ID can; bases never do.
function csvField(value) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

// CSV: one row per strand.
export function toCsv(r) {
  const id = csvField(r.fastaId);
  return [
    "fasta_id,strand,length,sequence",
    `${id},input_dna,${r.length},${r.input}`,
    `${id},reverse_complement_dna,${r.length},${r.reverseComplement}`,
    `${id},rna_from_input_strand,${r.rna.length},${r.rna}`,
    "",
  ].join("\n");
}

// JSON: the input, both strands and the calculated metrics, for use in other tools.
export function toJson(r) {
  return (
    JSON.stringify(
      {
        fasta_id: r.fastaId || null,
        input_length: r.length,
        gc_percent: Number(r.gcPercent.toFixed(1)),
        melting_temperature_c: Number(r.melting.value.toFixed(1)),
        melting_method: r.melting.method,
        coding_frame: r.coding.label,
        coding_strand: r.coding.strand,
        amino_acids: r.coding.aminoAcids,
        input_dna: r.input,
        reverse_complement_dna: r.reverseComplement,
        rna_from_input_strand: r.rna,
      },
      null,
      2,
    ) + "\n"
  );
}

// The download menu is built from this list, so a new format is one entry here.
export const EXPORT_FORMATS = [
  { id: "fasta", label: "FASTA", extension: "fasta", mime: "text/plain", build: toFasta },
  { id: "txt", label: "Plain text", extension: "txt", mime: "text/plain", build: toText },
  { id: "csv", label: "CSV", extension: "csv", mime: "text/csv", build: toCsv },
  { id: "json", label: "JSON", extension: "json", mime: "application/json", build: toJson },
];
