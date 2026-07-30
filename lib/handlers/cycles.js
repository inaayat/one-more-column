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
import { DEFAULT_POLICY_CONFIG } from '../default-policy.js';

export async function handleCycles(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (req.method === 'GET') return listCycles(res);
  if (req.method === 'POST') return createCycle(req, res, auth);
  methodNotAllowed(res, 'GET or POST');
}

async function listCycles(res) {
  const cycles = await db()`
    SELECT id, name, profile, status, start_date, end_date, created_at, updated_at
    FROM planning_cycles
    ORDER BY created_at DESC
  `;
  sendJson(res, 200, { cycles });
}

async function createCycle(req, res, auth) {
  const body = parseJsonBody(req);
  if (!body?.name?.trim()) {
    badRequest(res, 'name is required.');
    return;
  }

  await touchUser(auth);
  const cycleId = newId();
  const scenarioId = newId();
  const policyId = newId();

  await db()`
    INSERT INTO planning_cycles (id, name, profile, status, start_date, end_date)
    VALUES (
      ${cycleId},
      ${body.name.trim()},
      ${body.profile || 'default'},
      ${body.status || 'active'},
      ${body.start_date || null},
      ${body.end_date || null}
    )
  `;

  await db()`
    INSERT INTO scenarios (id, cycle_id, name, status)
    VALUES (${scenarioId}, ${cycleId}, ${body.scenario_name || 'Default'}, 'active')
  `;

  const config = { ...DEFAULT_POLICY_CONFIG, ...(body.policy || {}) };
  await db()`
    INSERT INTO planning_policies (id, cycle_id, version, config, created_by)
    VALUES (${policyId}, ${cycleId}, 1, ${JSON.stringify(config)}::jsonb, ${auth.sub})
  `;

  const rows = await db()`
    SELECT id, name, profile, status, start_date, end_date, created_at, updated_at
    FROM planning_cycles WHERE id = ${cycleId}
  `;

  sendJson(res, 201, {
    cycle: rows[0],
    default_scenario_id: scenarioId,
    policy: { version: 1, config },
  });
}
