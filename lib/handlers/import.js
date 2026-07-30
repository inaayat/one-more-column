import { db } from '../db.js';
import {
  badRequest,
  methodNotAllowed,
  newId,
  parseJsonBody,
  requireAuth,
  sendJson,
  touchUser,
} from '../api-helpers.js';

/** Parse simple CSV (header row + data rows). */
export function parseCsv(text) {
  const lines = String(text || '')
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (cells[i] || '').trim();
    });
    return row;
  });
  return { headers, rows };
}

function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

export async function handleImport(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (req.method !== 'POST') {
    methodNotAllowed(res, 'POST');
    return;
  }

  const body = parseJsonBody(req);
  const { cycle_id, scenario_id, csv_text, confirm } = body || {};
  if (!cycle_id || !scenario_id || !csv_text) {
    badRequest(res, 'cycle_id, scenario_id, and csv_text are required.');
    return;
  }

  const { headers, rows } = parseCsv(csv_text);
  if (!rows.length) {
    badRequest(res, 'CSV must have a header row and at least one data row.');
    return;
  }

  const normalized = rows.map((row, idx) => ({
    row: idx + 2,
    title: row.title || row.Title || row.name || `Imported row ${idx + 1}`,
    work_hours: Number(row.work_hours || row.hours || row.Work_Hours || 0),
    review_hours: Number(row.review_hours || row.Review_Hours || 0),
    due_week: row.due_week || row.due_date || row.Due_Week || null,
    phase: row.phase || row.Phase || null,
    unique_key: row.unique_key || row.key || `import-${idx + 1}`,
  }));

  if (!confirm) {
    sendJson(res, 200, {
      preview: true,
      headers,
      rows: normalized,
      count: normalized.length,
    });
    return;
  }

  await touchUser(auth);
  const inserted = [];
  for (const row of normalized) {
    const id = newId();
    await db()`
      INSERT INTO plan_items (
        id, cycle_id, scenario_id, unique_key, title, phase, source,
        work_hours, review_hours, due_week, assignee_ids, attributes
      ) VALUES (
        ${id}, ${cycle_id}, ${scenario_id}, ${row.unique_key}, ${row.title},
        ${row.phase}, 'file_import', ${row.work_hours}, ${row.review_hours},
        ${row.due_week}, ${[]}, ${JSON.stringify({})}::jsonb
      )
    `;
    inserted.push(id);
  }

  sendJson(res, 201, { imported: inserted.length, plan_item_ids: inserted });
}
