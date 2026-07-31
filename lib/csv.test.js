/**
 * Regression coverage for the CSV/TSV parser. The reported bug: pasting a
 * range copied out of a spreadsheet (tab-separated clipboard content) into
 * the comma-only parser collapsed every column into one compound header key,
 * so every row silently fell back to every default at once — titles read
 * "Imported row N", hours read 0, dates were blank, with no error at all.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseCsv } from './csv.js';

test('parses standard comma-separated input', () => {
  const { headers, rows } = parseCsv(
    'title,work_hours,due_week,phase\nTask A,8,2026-01-12,Phase 1',
  );
  assert.deepEqual(headers, ['title', 'work_hours', 'due_week', 'phase']);
  assert.equal(rows[0].title, 'Task A');
  assert.equal(rows[0].work_hours, '8');
  assert.equal(rows[0].due_week, '2026-01-12');
});

test('detects and parses tab-separated input (spreadsheet paste)', () => {
  const tsv = 'title\twork_hours\tdue_week\tphase\nTask A\t8\t2026-01-12\tPhase 1';
  const { headers, rows } = parseCsv(tsv);
  // Before the fix: headers === ['title\twork_hours\tdue_week\tphase'] (one
  // compound key) and rows[0] held the entire line under that single key.
  assert.deepEqual(headers, ['title', 'work_hours', 'due_week', 'phase']);
  assert.equal(rows[0].title, 'Task A');
  assert.equal(rows[0].work_hours, '8');
  assert.equal(rows[0].due_week, '2026-01-12');
});

test('detects semicolon-separated input', () => {
  const { rows } = parseCsv('title;work_hours;due_week\nTask A;8;2026-01-12');
  assert.equal(rows[0].title, 'Task A');
  assert.equal(rows[0].work_hours, '8');
});

test('header lookups are case- and spacing-insensitive', () => {
  const { rows } = parseCsv('Title,Work Hours,Due Week\nTask A,8,2026-01-12');
  // Both the literal and a normalized ("workhours") key should resolve.
  assert.equal(rows[0]['Title'], 'Task A');
  assert.equal(rows[0]['workhours'], '8');
  assert.equal(rows[0]['dueweek'], '2026-01-12');
});

test('quoted commas inside a cell do not split the column, even with tab detection active', () => {
  const { rows } = parseCsv('title,phase\n"Task, with a comma",Phase 1');
  assert.equal(rows[0].title, 'Task, with a comma');
  assert.equal(rows[0].phase, 'Phase 1');
});

test('a single line with no data rows produces no rows', () => {
  const { rows } = parseCsv('title,work_hours,due_week');
  assert.deepEqual(rows, []);
});
