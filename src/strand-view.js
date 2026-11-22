/*
  Sequence display for the results page (results.html).

  Each strand box shows its sequence GenBank-style: the position of the
  row's first base on the left, then the bases in groups of 10. Rows are as
  long as the box allows (10 to 60 bases), so phones get short rows and wide
  screens get the usual 60:

     1 AGCCCTCCAG GACAGGCTGC ATCA

  Speed: a 1 Mb sequence is 100,000 groups, so there is no element per base
  or per row. The rows are joined into text blocks of 500 rows each. A block
  uses content-visibility: auto (style.css), so the browser only lays out
  the blocks near the visible part of the box. Find in page, selection and
  screen readers still see every block.

  The position numbers sit in their own column (.strand-ruler), so selecting
  bases never picks them up. The Copy buttons copy the plain sequence (see
  main.js). Selecting bases and pressing Ctrl+C / Cmd+C also gives the plain
  sequence, without the spaces and line breaks of the layout.
*/

// Bases per group, and the most groups per row (GenBank uses 6 x 10 = 60).
const GROUP = 10;
const MAX_GROUPS = 6;

// Rows per text block. Small enough to lay out quickly, large enough to keep
// the element count low (a 1 Mb sequence at 20 bases per row is 100 blocks).
const BLOCK_ROWS = 500;

/*
  Splits a sequence into rows of `perRow` bases (a multiple of 10), grouped
  by 10. Returns two arrays with one entry per row:
    numbers  the 1-based position of the row's first base
    rows     the row's bases, with a space between groups
  Pure function, so it can be tested and timed on its own.
*/
export function formatRows(seq, perRow) {
  const count = Math.ceil(seq.length / perRow);
  const numbers = new Array(count);
  const rows = new Array(count);

  for (let row = 0; row < count; row++) {
    const start = row * perRow;
    const end = Math.min(start + perRow, seq.length);
    let line = seq.slice(start, Math.min(start + GROUP, end));
    for (let i = start + GROUP; i < end; i += GROUP) {
      line += " " + seq.slice(i, Math.min(i + GROUP, end));
    }
    numbers[row] = start + 1;
    rows[row] = line;
  }

  return { numbers, rows };
}

// ---------- Drawing into the page ----------

let panels = []; // one { box, ruler, text, seq } per strand on screen
let perRow = 0; // bases per row currently drawn (0 = not drawn yet)
let charWidth = 0; // width of one monospace character in CSS pixels (0 = measure again)
const wired = new WeakSet(); // boxes that already have their listeners

// The boxes change width with the window, and the analytics panel moves
// below the results under 1024px. Redraw on the next frame, so drawing never
// triggers another resize notification within the same frame.
let frame = 0;
const observer = new ResizeObserver(() => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(draw);
});

// JetBrains Mono loads after the first draw. Measure again once it is in.
document.fonts?.addEventListener("loadingdone", () => {
  charWidth = 0;
  draw();
});

/*
  Shows the given sequences. `entries` is a list of [element, sequence],
  where element is the .strand-text column inside a .strand-body box that
  also holds a .strand-ruler column for the position numbers.
*/
export function showStrands(entries) {
  panels = entries.map(([text, seq]) => {
    const box = text.parentElement;
    if (!wired.has(box)) {
      wired.add(box);
      box.addEventListener("copy", copyPlainSelection);
      observer.observe(box);
    }
    return { box, ruler: box.querySelector(".strand-ruler"), text, seq };
  });
  perRow = 0; // new sequences: always draw
  draw();
}

// Draws only when the row length changes, so a resize within the same
// layout costs nothing.
function draw() {
  if (panels.length === 0 || panels[0].box.clientWidth === 0) return; // not visible yet
  const next = fittingRowLength(panels[0]);

  // Skipped blocks have no width of their own. A fixed ruler width keeps
  // the bases from shifting sideways while the box scrolls.
  for (const { ruler, seq } of panels) {
    ruler.style.minWidth = `${Math.ceil(String(seq.length).length * charWidth)}px`;
  }

  if (next === perRow) return;
  perRow = next;

  const rowHeight = parseFloat(getComputedStyle(panels[0].box).lineHeight);
  for (const panel of panels) {
    const { numbers, rows } = formatRows(panel.seq, perRow);
    fillBlocks(panel.ruler, numbers, rowHeight);
    fillBlocks(panel.text, rows, rowHeight);
  }

  // Only a box that scrolls needs to be a tab stop (so keyboard users can
  // scroll it with the arrow keys). Short sequences add no extra stops.
  for (const { box } of panels) {
    const scrolls = box.scrollHeight > box.clientHeight || box.scrollWidth > box.clientWidth;
    if (scrolls) box.setAttribute("tabindex", "0");
    else box.removeAttribute("tabindex");
  }
}

// Replaces the column's content with blocks of BLOCK_ROWS lines. Each block
// declares its exact height, so the ruler and the bases stay row-aligned
// even while the browser skips blocks that are out of view.
function fillBlocks(column, lines, rowHeight) {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < lines.length; i += BLOCK_ROWS) {
    const block = document.createElement("div");
    const part = lines.slice(i, i + BLOCK_ROWS);
    block.className = "strand-block";
    block.style.containIntrinsicBlockSize = `${part.length * rowHeight}px`;
    block.textContent = part.join("\n");
    fragment.appendChild(block);
  }
  column.replaceChildren(fragment);
}

// How many bases fit on one row of the box: whole groups, 1 to 6 of them.
function fittingRowLength({ box, seq }) {
  if (!charWidth) charWidth = measureCharWidth(box);
  const style = getComputedStyle(box);
  const inner = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const numberWidth = String(seq.length).length * charWidth;
  const gap = parseFloat(style.columnGap) || 0;
  const columns = Math.floor((inner - numberWidth - gap) / charWidth);
  // A row of g groups takes 10g bases plus (g - 1) spaces = 11g - 1 columns.
  const groups = Math.floor((columns + 1) / (GROUP + 1));
  return Math.max(1, Math.min(groups, MAX_GROUPS)) * GROUP;
}

// Measures one character of the box's font with a hidden probe. The probe
// is placed next to the columns, not inside them, so the sequence is not
// laid out again.
function measureCharWidth(box) {
  const probe = document.createElement("span");
  probe.textContent = "0".repeat(100);
  probe.style.cssText = "position: absolute; visibility: hidden; white-space: pre;";
  box.appendChild(probe);
  const width = probe.getBoundingClientRect().width / 100;
  probe.remove();
  return width;
}

// Ctrl+C / Cmd+C on a selection inside one box: copy the bases only.
function copyPlainSelection(event) {
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  // Leave selections that reach outside this box (headings etc.) alone.
  if (!event.currentTarget.contains(selection.getRangeAt(0).commonAncestorContainer)) return;
  // Sequences never contain digits, so this also drops any position number.
  event.clipboardData.setData("text/plain", selection.toString().replace(/[\s\d]+/g, ""));
  event.preventDefault();
}
