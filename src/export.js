/*
  Export formats for the results.

  Each builder takes the results object from calc.js and returns the file
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

// FASTA: one record per strand. Each header names the strand and its length.
export function toFasta(r) {
  return [
    `>Reverse_complement_DNA length=${r.length}`,
    wrap(r.reverseComplement, FASTA_LINE_WIDTH),
    `>Transcribed_RNA length=${r.rna.length}`,
    wrap(r.rna, FASTA_LINE_WIDTH),
    "",
  ].join("\n");
}

// Plain text: each strand labelled, sequence on its own line.
export function toText(r) {
  return [
    "Reverse complement (DNA, 5' to 3'):",
    r.reverseComplement,
    "",
    "Transcribed strand (RNA, 5' to 3'):",
    r.rna,
    "",
  ].join("\n");
}

// CSV: one row per strand. Bases never contain commas, so no quoting is needed.
export function toCsv(r) {
  return [
    "strand,length,sequence",
    `reverse_complement_dna,${r.length},${r.reverseComplement}`,
    `transcribed_rna,${r.rna.length},${r.rna}`,
    "",
  ].join("\n");
}

// JSON: both strands plus the calculated metrics, for use in other tools.
export function toJson(r) {
  return (
    JSON.stringify(
      {
        input_length: r.length,
        gc_percent: Number(r.gcPercent.toFixed(1)),
        melting_temperature_c: Number(r.melting.value.toFixed(1)),
        melting_method: r.melting.method,
        coding_frame: r.coding.label,
        coding_strand: r.coding.strand,
        amino_acids: r.coding.aminoAcids,
        reverse_complement_dna: r.reverseComplement,
        transcribed_rna: r.rna,
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
