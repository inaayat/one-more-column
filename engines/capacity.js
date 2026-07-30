/**
 * Pure capacity engine: allocate plan item hours to assignee weeks.
 */
import { formatWeekKey, weekStart } from './availability.js';

/**
 * @param {object[]} planItems
 * @param {'due'|'spread'} mode
 * @param {object} policy
 * @returns {Map<string, Map<string, number>>} resourceId → weekKey → load hours
 */
export function computeWeeklyLoad(planItems, mode = 'due', policy = {}) {
  const matrix = new Map();

  for (const item of planItems || []) {
    const assignees = item.assignee_ids?.length ? item.assignee_ids : [];
    if (!assignees.length) continue;

    const work = Number(item.work_hours || 0);
    const review = Number(item.review_hours || 0);
    const ratio = Number(policy.review_ratio ?? 0.35);
    const derivedReview = review > 0 ? review : work * ratio;
    const totalHours = work + derivedReview;

    if (totalHours <= 0) continue;

    const dueWeek = item.due_week ? formatWeekKey(item.due_week) : null;
    if (!dueWeek) continue;

    const perPerson = totalHours / assignees.length;
    const targetWeeks =
      mode === 'spread'
        ? spreadWeeks(dueWeek, Number(policy.spread_lag_weeks ?? 0))
        : [dueWeek];

    const perWeek = perPerson / targetWeeks.length;
    for (const assigneeId of assignees) {
      if (!matrix.has(assigneeId)) matrix.set(assigneeId, new Map());
      const weekMap = matrix.get(assigneeId);
      for (const weekKey of targetWeeks) {
        weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + perWeek);
      }
    }
  }

  return matrix;
}

function spreadWeeks(dueWeek, lagWeeks) {
  const weeks = [];
  const base = weekStart(dueWeek);
  const startLag = Math.max(0, lagWeeks);
  for (let i = startLag; i >= 0; i -= 1) {
    const d = new Date(base.getTime());
    d.setUTCDate(d.getUTCDate() - i * 7);
    weeks.push(formatWeekKey(d));
  }
  return weeks.length ? weeks : [formatWeekKey(base)];
}

/**
 * Merge capacity and load into a person-week grid.
 */
export function buildCapacityGrid({
  resources,
  weeks,
  capacityMatrix,
  loadMatrix,
  policy = {},
}) {
  const threshold = Number(policy.overload_threshold ?? 1.0);
  const rows = [];

  for (const resource of resources) {
    if (resource.active === false) continue;
    const capacityWeeks = capacityMatrix.get(resource.id) || new Map();
    const loadWeeks = loadMatrix.get(resource.id) || new Map();
    const weekCells = weeks.map((weekKey) => {
      const capacity = round(capacityWeeks.get(weekKey) ?? 0);
      const load = round(loadWeeks.get(weekKey) ?? 0);
      const remaining = round(capacity - load);
      const utilization = capacity > 0 ? load / capacity : load > 0 ? Infinity : 0;
      return {
        week: weekKey,
        capacity,
        load,
        remaining,
        overloaded: capacity > 0 ? utilization > threshold : load > 0,
      };
    });

    rows.push({
      resource_id: resource.id,
      name: resource.name,
      team: resource.team,
      weeks: weekCells,
      totals: {
        capacity: round(weekCells.reduce((s, c) => s + c.capacity, 0)),
        load: round(weekCells.reduce((s, c) => s + c.load, 0)),
        remaining: round(weekCells.reduce((s, c) => s + c.remaining, 0)),
      },
    });
  }

  return { weeks, rows, mode: 'due', threshold };
}

function round(n) {
  return Math.round(n * 100) / 100;
}
