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
import { computeReadyToStart } from '../../engines/ready_to_start.js';

const VALID_TYPES = new Set([
  'input_ready',
  'handoff_chain',
  'review_lag',
  'phase_gate',
  'staffing',
  'external_flag',
  'blackout',
  'evidence_ready',
  'sample_chain',
]);

const VALID_STATUS = new Set(['open', 'met', 'waived', 'blocked']);

export async function handleDependencies(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (req.method === 'GET') return listDependencies(res, req);
  if (req.method === 'POST') return createDependency(req, res, auth);
  if (req.method === 'PATCH') return patchDependencies(req, res, auth);
  if (req.method === 'DELETE') return deleteDependency(req, res, auth);
  methodNotAllowed(res, 'GET, POST, PATCH, or DELETE');
}

async function listDependencies(res, req) {
  const cycleId = String(req.query?.cycle || '').trim();
  const scenarioId = String(req.query?.scenario || '').trim();
  if (!cycleId) {
    badRequest(res, 'cycle query param is required.');
    return;
  }

  let deps;
  if (scenarioId) {
    deps = await db()`
      SELECT d.*, pf.title AS from_title, pt.title AS to_title
      FROM dependencies d
      LEFT JOIN plan_items pf ON pf.id = d.from_plan_item_id
      JOIN plan_items pt ON pt.id = d.to_plan_item_id
      WHERE d.cycle_id = ${cycleId} AND pt.scenario_id = ${scenarioId}
      ORDER BY d.created_at ASC
    `;
  } else {
    deps = await db()`
      SELECT d.*, pf.title AS from_title, pt.title AS to_title
      FROM dependencies d
      LEFT JOIN plan_items pf ON pf.id = d.from_plan_item_id
      JOIN plan_items pt ON pt.id = d.to_plan_item_id
      WHERE d.cycle_id = ${cycleId}
      ORDER BY d.created_at ASC
    `;
  }

  let readiness = null;
  if (scenarioId) {
    const items = await db()`
      SELECT id, title, due_week, attributes
      FROM plan_items WHERE scenario_id = ${scenarioId}
    `;
    const policyRows = await db()`
      SELECT config FROM planning_policies
      WHERE cycle_id = ${cycleId}
      ORDER BY version DESC LIMIT 1
    `;
    const policy = policyRows[0]?.config || {};
    readiness = items.map((item) => {
      const itemDeps = deps.filter((d) => d.to_plan_item_id === item.id);
      const result = computeReadyToStart(item, itemDeps, policy);
      return {
        plan_item_id: item.id,
        title: item.title,
        ready_to_start: result.ready_date,
        blocked: result.blocked,
        blockers: result.blockers,
      };
    });
  }

  sendJson(res, 200, { dependencies: deps, readiness });
}

async function createDependency(req, res, auth) {
  const body = parseJsonBody(req);
  if (!body?.cycle_id || !body?.to_plan_item_id) {
    badRequest(res, 'cycle_id and to_plan_item_id are required.');
    return;
  }
  const depType = body.dep_type || 'input_ready';
  if (!VALID_TYPES.has(depType)) {
    badRequest(res, `dep_type must be one of: ${[...VALID_TYPES].join(', ')}`);
    return;
  }

  await touchUser(auth);
  const id = newId();
  await db()`
    INSERT INTO dependencies (
      id, cycle_id, from_plan_item_id, to_plan_item_id, dep_type, status, label, meta
    ) VALUES (
      ${id},
      ${body.cycle_id},
      ${body.from_plan_item_id || null},
      ${body.to_plan_item_id},
      ${depType},
      ${body.status || 'open'},
      ${body.label || null},
      ${JSON.stringify(body.meta || {})}::jsonb
    )
  `;

  const rows = await db()`SELECT * FROM dependencies WHERE id = ${id}`;
  sendJson(res, 201, { dependency: rows[0] });
}

async function patchDependencies(req, res, auth) {
  const body = parseJsonBody(req);
  const updates = Array.isArray(body?.dependencies) ? body.dependencies : body?.id ? [body] : [];
  if (!updates.length) {
    badRequest(res, 'Provide dependencies[] or a single dependency with id.');
    return;
  }

  await touchUser(auth);
  const patched = [];

  for (const dep of updates) {
    if (!dep.id) continue;
    if (dep.status && !VALID_STATUS.has(dep.status)) continue;
    if (dep.dep_type && !VALID_TYPES.has(dep.dep_type)) continue;

    await db()`
      UPDATE dependencies SET
        from_plan_item_id = COALESCE(${dep.from_plan_item_id ?? null}, from_plan_item_id),
        dep_type = COALESCE(${dep.dep_type ?? null}, dep_type),
        status = COALESCE(${dep.status ?? null}, status),
        label = COALESCE(${dep.label ?? null}, label),
        meta = COALESCE(${dep.meta ? JSON.stringify(dep.meta) : null}::jsonb, meta),
        updated_at = now()
      WHERE id = ${dep.id}
    `;
    const rows = await db()`SELECT * FROM dependencies WHERE id = ${dep.id}`;
    if (rows[0]) patched.push(rows[0]);
  }

  sendJson(res, 200, { dependencies: patched });
}

async function deleteDependency(req, res, auth) {
  const id = String(req.query?.id || parseJsonBody(req)?.id || '').trim();
  if (!id) {
    badRequest(res, 'id query param is required.');
    return;
  }

  await touchUser(auth);
  await db()`DELETE FROM dependencies WHERE id = ${id}`;
  sendJson(res, 200, { deleted: id });
}
