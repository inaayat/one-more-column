/**
 * Pure CSV/TSV parsing — no DB or auth dependency, so it can be unit tested
 * (and imported) without pulling in @neondatabase/serverless, matching how
 * engines/ keeps pure logic separate from lib/handlers/'s I/O code.
 */

/**
 * Detects which single character separates columns by counting occurrences
 * (outside quotes) in the header line. Pasting a range out of Excel/Sheets
 * puts tab-separated text on the clipboard, not comma-separated — without
 * this, every column after the first silently vanishes into one compound
 * header key and every row falls back to its placeholder default (this was
 * the reported bug: titles read "Imported row N", hours read 0, dates were
 * blank, because none of the expected field names ever matched).
 */
export function detectDelimiter(headerLine) {
  const candidates = [',', '\t', ';'];
  let best = ',';
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = countOutsideQuotes(headerLine, candidate);
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

function countOutsideQuotes(line, char) {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === '"') inQuotes = !inQuotes;
    else if (line[i] === char && !inQuotes) count += 1;
  }
  return count;
}

/** Lowercases and strips spaces/underscores so "Work Hours", "work_hours",
 *  and "WORK HOURS" all match the same lookup key. */
export function normalizeHeaderKey(key) {
  return String(key).trim().toLowerCase().replace(/[\s_]+/g, '');
}

/** Parse simple CSV/TSV (header row + data rows). Delimiter is auto-detected
 *  per parseCsv call from the header line — see detectDelimiter(). */
export function parseCsv(text) {
  const lines = String(text || '')
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter);
  const normalizedHeaders = headers.map((h) => normalizeHeaderKey(h));
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, delimiter);
    const row = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (cells[i] || '').trim();
    });
    // Also index by normalized key so lookups don't depend on exact case,
    // spacing, or underscore placement in the pasted header row.
    normalizedHeaders.forEach((h, i) => {
      if (!(h in row)) row[h] = (cells[i] || '').trim();
    });
    return row;
  });
  return { headers, rows };
}

export function splitCsvLine(line, delimiter = ',') {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}
