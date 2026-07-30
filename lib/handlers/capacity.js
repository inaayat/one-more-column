import { db } from '../db.js';
import { badRequest, requireAuth, sendJson } from '../api-helpers.js';
import { DEFAULT_POLICY_CONFIG } from '../default-policy.js';
import { computeWeeklyCapacity, enumerateWeeks } from '../../engines/availability.js';
import { buildCapacityGrid, computeWeeklyLoad } from '../../engines/capacity.js';

export async function handleCapacity(req, res) {
  const auth = await requireAuth(req, res, { methods: ['GET'] });
  if (!auth) return;

  const cycleId = String(req.query?.cycle || '').trim();
  if (!cycleId) {
    badRequest(res, 'cycle query param is required.');
    return;
  }

  const scenarioId = String(req.query?.scenario || '').trim();
  const team = String(req.query?.team || '').trim();
  const mode = req.query?.mode === 'spread' ? 'spread' : 'due';

  const cycleRows = await db()`
    SELECT id, name, profile, status, start_date, end_date
    FROM planning_cycles WHERE id = ${cycleId}
  `;
  if (!cycleRows.length) {
    sendJson(res, 404, { error: 'Cycle not found.' });
    return;
  }
  const cycle = cycleRows[0];

  let scenario = null;
  if (scenarioId) {
    const rows = await db()`SELECT id, name, status FROM scenarios WHERE id = ${scenarioId}`;
    scenario = rows[0] || null;
  } else {
    const rows = await db()`
      SELECT id, name, status FROM scenarios
      WHERE cycle_id = ${cycleId} AND status = 'active'
      ORDER BY created_at LIMIT 1
    `;
    scenario = rows[0] || null;
  }
  if (!scenario) {
    sendJson(res, 404, { error: 'No scenario found for cycle.' });
    return;
  }

  const policyRows = await db()`
    SELECT config FROM planning_policies
    WHERE cycle_id = ${cycleId}
    ORDER BY version DESC LIMIT 1
  `;
  const policy = { ...DEFAULT_POLICY_CONFIG, ...(policyRows[0]?.config || {}) };

  const resourceRows = team
    ? await db()`
        SELECT id, name, email, team, active, jira_account_id
        FROM resources WHERE active = true AND team = ${team}
        ORDER BY name
      `
    : await db()`
        SELECT id, name, email, team, active, jira_account_id
        FROM resources WHERE active = true
        ORDER BY team NULLS LAST, name
      `;

  const ids = resourceRows.map((r) => r.id);
  let profiles = [];
  let timeOff = [];
  if (ids.length) {
    profiles = await db()`
      SELECT resource_id, effective_from, weekly_hours, daily_hours
      FROM resource_profiles WHERE resource_id = ANY(${ids})
    `;
    timeOff = await db()`
      SELECT resource_id, start_date, end_date, hours_per_day, reason
      FROM resource_time_off WHERE resource_id = ANY(${ids})
    `;
  }

  const resources = resourceRows.map((r) => ({
    ...r,
    profiles: profiles.filter((p) => p.resource_id === r.id),
    time_off: timeOff.filter((t) => t.resource_id === r.id),
  }));

  const startDate = cycle.start_date || defaultRangeStart();
  const endDate = cycle.end_date || defaultRangeEnd();
  const weeks = enumerateWeeks(startDate, endDate);

  const planItems = await db()`
    SELECT id, title, work_hours, review_hours, due_week, assignee_ids
    FROM plan_items
    WHERE scenario_id = ${scenario.id}
  `;

  const capacityMatrix = computeWeeklyCapacity(resources, weeks, policy);
  const loadMatrix = computeWeeklyLoad(planItems, mode, policy);
  const grid = buildCapacityGrid({ resources, weeks, capacityMatrix, loadMatrix, policy });
  grid.mode = mode;
  grid.cycle = { id: cycle.id, name: cycle.name };
  grid.scenario = scenario;
  grid.team = team || null;
  grid.policy = policy;

  sendJson(res, 200, grid);
}

function defaultRangeStart() {
  const d = new Date();
  d.setUTCMonth(0, 1);
  return d.toISOString().slice(0, 10);
}

function defaultRangeEnd() {
  const d = new Date();
  d.setUTCMonth(11, 31);
  return d.toISOString().slice(0, 10);
}
