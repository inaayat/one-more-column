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

export async function handleScenarios(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (req.method === 'GET') return listScenarios(res, req);
  if (req.method === 'POST') return createScenario(req, res, auth);
  methodNotAllowed(res, 'GET or POST');
}

async function listScenarios(res, req) {
  const cycleId = String(req.query?.cycle || '').trim();
  if (!cycleId) {
    badRequest(res, 'cycle query param is required.');
    return;
  }

  const scenarios = await db()`
    SELECT s.id, s.cycle_id, s.name, s.status, s.created_at,
      (SELECT count(*)::int FROM plan_items p WHERE p.scenario_id = s.id) AS plan_item_count
    FROM scenarios s
    WHERE s.cycle_id = ${cycleId}
    ORDER BY s.created_at ASC
  `;
  sendJson(res, 200, { scenarios });
}

async function createScenario(req, res, auth) {
  const body = parseJsonBody(req);
  const cycleId = body?.cycle_id;
  const name = body?.name?.trim();
  if (!cycleId || !name) {
    badRequest(res, 'cycle_id and name are required.');
    return;
  }

  const cycleRows = await db()`SELECT id FROM planning_cycles WHERE id = ${cycleId}`;
  if (!cycleRows.length) {
    sendJson(res, 404, { error: 'Cycle not found.' });
    return;
  }

  await touchUser(auth);
  const scenarioId = newId();

  await db()`
    INSERT INTO scenarios (id, cycle_id, name, status)
    VALUES (${scenarioId}, ${cycleId}, ${name}, ${body.status || 'draft'})
  `;

  const cloneFrom = body.clone_from_scenario_id;
  if (cloneFrom) {
    const sourceItems = await db()`
      SELECT unique_key, title, phase, source, work_hours, review_hours, due_week, assignee_ids, attributes
      FROM plan_items WHERE scenario_id = ${cloneFrom}
    `;
    for (const item of sourceItems) {
      await db()`
        INSERT INTO plan_items (
          id, cycle_id, scenario_id, unique_key, title, phase, source,
          work_hours, review_hours, due_week, assignee_ids, attributes
        ) VALUES (
          ${newId()}, ${cycleId}, ${scenarioId},
          ${item.unique_key}, ${item.title}, ${item.phase}, ${item.source},
          ${item.work_hours}, ${item.review_hours}, ${item.due_week},
          ${item.assignee_ids}, ${item.attributes}
        )
      `;
    }
  }

  const rows = await db()`
    SELECT id, cycle_id, name, status, created_at
    FROM scenarios WHERE id = ${scenarioId}
  `;
  sendJson(res, 201, { scenario: rows[0] });
}
