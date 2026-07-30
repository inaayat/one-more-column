import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeWeeklyCapacity,
  enumerateWeeks,
  weekStart,
} from './availability.js';
import { buildCapacityGrid, computeWeeklyLoad } from './capacity.js';

test('weekStart returns Monday', () => {
  assert.equal(weekStart('2026-01-14').toISOString().slice(0, 10), '2026-01-12');
});

test('enumerateWeeks spans range', () => {
  const weeks = enumerateWeeks('2026-01-01', '2026-01-20');
  assert.ok(weeks.length >= 3);
  assert.equal(weeks[0], '2025-12-29');
});

test('computeWeeklyCapacity applies profiles and time off', () => {
  const resources = [
    {
      id: 'r1',
      active: true,
      profiles: [{ effective_from: '2026-01-01', weekly_hours: 40 }],
      time_off: [{ start_date: '2026-01-12', end_date: '2026-01-14', hours_per_day: 8 }],
    },
  ];
  const weeks = ['2026-01-12'];
  const matrix = computeWeeklyCapacity(resources, weeks, { weekly_capacity_default: 32 });
  const capacity = matrix.get('r1').get('2026-01-12');
  assert.equal(capacity, 16);
});

test('computeWeeklyLoad allocates due-week hours', () => {
  const items = [
    {
      work_hours: 10,
      review_hours: 0,
      due_week: '2026-01-12',
      assignee_ids: ['r1', 'r2'],
    },
  ];
  const load = computeWeeklyLoad(items, 'due', { review_ratio: 0.35 });
  assert.equal(load.get('r1').get('2026-01-12'), 6.75);
  assert.equal(load.get('r2').get('2026-01-12'), 6.75);
});

test('buildCapacityGrid marks overload', () => {
  const resources = [{ id: 'r1', name: 'Alex', team: 'BP', active: true }];
  const weeks = ['2026-01-12'];
  const capacityMatrix = new Map([['r1', new Map([['2026-01-12', 10]])]]);
  const loadMatrix = new Map([['r1', new Map([['2026-01-12', 12]])]]);
  const grid = buildCapacityGrid({
    resources,
    weeks,
    capacityMatrix,
    loadMatrix,
    policy: { overload_threshold: 1.0 },
  });
  assert.equal(grid.rows[0].weeks[0].overloaded, true);
  assert.equal(grid.rows[0].weeks[0].remaining, -2);
});
