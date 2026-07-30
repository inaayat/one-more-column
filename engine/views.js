/** Plan Builder + Dependencies view helpers (H2 / C2). */

export function renderAlertsView({ state, escapeHtml, cycleOptions, scenarioOptionsHtml }) {
  const groups = { high: [], medium: [], low: [] };
  for (const alert of state.alerts || []) {
    groups[alert.severity]?.push(alert);
  }

  const renderGroup = (title, items, cls) => {
    if (!items.length) return '';
    const rows = items
      .map(
        (a) => `<tr>
          <td><span class="badge ${cls}">${escapeHtml(a.type)}</span></td>
          <td>${escapeHtml(a.message)}</td>
          <td>${escapeHtml(a.team || a.week || a.due_week || '—')}</td>
        </tr>`,
      )
      .join('');
    return `<h3 class="omc-section-title">${title} (${items.length})</h3>
      <table class="data-table" style="margin-bottom:16px"><tbody>${rows}</tbody></table>`;
  };

  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h1 class="omc-title">Alerts</h1>
          <p class="omc-lead">Overload, due-date proximity, and readiness gaps — from Postgres only.</p>
        </div>
        <div class="btn-row">
          <select id="cycle-select" class="field-input">${cycleOptions(state.activeCycleId)}</select>
          <select id="scenario-select" class="field-input">${scenarioOptionsHtml}</select>
          <button type="button" class="btn btn-ghost btn-sm" id="refresh-alerts">Refresh</button>
        </div>
      </div>
      <div class="alert-summary">
        <span class="badge badge-warn">High: ${state.alertCounts?.high ?? 0}</span>
        <span class="badge">Medium: ${state.alertCounts?.medium ?? 0}</span>
        <span class="badge badge-ok">Low: ${state.alertCounts?.low ?? 0}</span>
      </div>
      ${renderGroup('High severity', groups.high, 'badge-warn')}
      ${renderGroup('Medium severity', groups.medium, '')}
      ${renderGroup('Low severity', groups.low, 'badge-ok')}
      ${!state.alerts?.length ? '<p class="omc-lead">No alerts for this cycle/scenario.</p>' : ''}
    </section>
  `;
}

export function assumptionsBlock(assumptions, escapeHtml) {
  if (!assumptions?.length) {
    return '<p class="omc-lead assumptions-panel">No assumptions documented for this cycle.</p>';
  }
  const items = assumptions
    .map((a) => `<li>${escapeHtml(a.text)}</li>`)
    .join('');
  return `<div class="assumptions-panel"><strong>Assumptions</strong><ul>${items}</ul></div>`;
}

export function teamTabs(teams, activeTeam, escapeHtml) {
  const tabs = [
    `<button type="button" class="team-tab${!activeTeam ? ' active' : ''}" data-team="">All</button>`,
    ...teams.map(
      (t) =>
        `<button type="button" class="team-tab${activeTeam === t ? ' active' : ''}" data-team="${escapeAttr(t)}">${escapeHtml(t)}</button>`,
    ),
  ];
  return `<div class="team-tabs">${tabs.join('')}</div>`;
}

export function capacityCellClass(cell) {
  if (cell.band === 'red' || cell.overloaded) return 'cap-cell cap-band-red';
  if (cell.band === 'yellow') return 'cap-cell cap-band-yellow';
  return 'cap-cell cap-band-green';
}

export function scenarioOptions(scenarios, selectedId) {
  if (!scenarios?.length) return '<option value="">No scenarios</option>';
  return scenarios
    .map(
      (s) =>
        `<option value="${escapeAttr(s.id)}"${s.id === selectedId ? ' selected' : ''}>${escapeAttr(s.name)} (${s.status})</option>`,
    )
    .join('');
}

export function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

export function renderPlanView({ state, escapeHtml, cycleOptions, scenarioOptionsHtml }) {
  const rows = state.planItems
    .map((item) => {
      const assigneeCount = (item.assignee_ids || []).length;
      return `<tr data-id="${escapeAttr(item.id)}">
        <td><input class="field-input field-sm" data-field="title" value="${escapeAttr(item.title)}" /></td>
        <td><input class="field-input field-sm" data-field="phase" value="${escapeAttr(item.phase || '')}" /></td>
        <td><input class="field-input field-sm" data-field="work_hours" type="number" step="0.5" value="${item.work_hours ?? 0}" /></td>
        <td><input class="field-input field-sm" data-field="review_hours" type="number" step="0.5" value="${item.review_hours ?? 0}" /></td>
        <td><input class="field-input field-sm" data-field="due_week" type="date" value="${item.due_week ? String(item.due_week).slice(0, 10) : ''}" /></td>
        <td>${assigneeCount}</td>
        <td><span class="badge">${escapeHtml(item.source || 'manual')}</span></td>
        <td><button type="button" class="btn btn-ghost btn-sm btn-delete-item">Delete</button></td>
      </tr>`;
    })
    .join('');

  const importPreview = state.importPreview
    ? `<div class="import-preview">
        <p><strong>Import preview:</strong> ${state.importPreview.count} rows</p>
        <button type="button" class="btn btn-refresh-solid btn-sm" id="confirm-import">Commit import</button>
        <button type="button" class="btn btn-ghost btn-sm" id="cancel-import">Cancel</button>
      </div>`
    : '';

  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h1 class="omc-title">Plan Builder</h1>
          <p class="omc-lead">Author plan items for the active cycle and scenario.</p>
        </div>
        <div class="btn-row">
          <select id="cycle-select" class="field-input">${cycleOptions(state.activeCycleId)}</select>
          <select id="scenario-select" class="field-input">${scenarioOptionsHtml}</select>
          <button type="button" class="btn btn-ghost btn-sm" id="create-scenario">New scenario</button>
          <button type="button" class="btn btn-ghost btn-sm" id="export-plan">Export CSV</button>
          <button type="button" class="btn btn-ghost btn-sm" id="check-drift">Check drift</button>
        </div>
      </div>

      <div class="form-grid" style="margin-bottom:14px">
        <label class="field field-span-2">
          <span class="field-label">Title</span>
          <input id="new-item-title" class="field-input" placeholder="Control test work" />
        </label>
        <label class="field">
          <span class="field-label">Phase</span>
          <input id="new-item-phase" class="field-input" placeholder="Phase 1" />
        </label>
        <label class="field">
          <span class="field-label">Work hours</span>
          <input id="new-item-hours" class="field-input" type="number" value="8" />
        </label>
        <label class="field">
          <span class="field-label">Due week</span>
          <input id="new-item-due" class="field-input" type="date" />
        </label>
        <div class="field" style="align-self:end">
          <button type="button" class="btn btn-refresh-solid" id="add-plan-item">Add item</button>
        </div>
      </div>

      <div class="form-grid" style="margin-bottom:14px">
        <label class="field field-span-2">
          <span class="field-label">CSV import (title, work_hours, due_week, phase)</span>
          <textarea id="import-csv" class="field-input" rows="4" placeholder="title,work_hours,due_week,phase&#10;Control A,8,2026-01-12,Phase 1"></textarea>
        </label>
        <div class="field" style="align-self:end">
          <button type="button" class="btn btn-ghost" id="preview-import">Preview CSV</button>
        </div>
      </div>
      ${importPreview}

      <div class="panel-head">
        <h2 class="omc-section-title">Plan items (${state.planItems.length})</h2>
        <button type="button" class="btn btn-ghost btn-sm" id="save-plan-items">Save changes</button>
      </div>
      <div class="cap-scroll">
        <table class="data-table" id="plan-items-table">
          <thead>
            <tr>
              <th>Title</th><th>Phase</th><th>Work h</th><th>Review h</th><th>Due week</th><th>Assignees</th><th>Source</th><th></th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="8">No plan items yet.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `;
}

export function renderDependenciesView({ state, escapeHtml, cycleOptions, scenarioOptionsHtml }) {
  const depRows = (state.dependencies || [])
    .map(
      (d) => `<tr data-id="${escapeAttr(d.id)}">
        <td>${escapeHtml(d.label || d.dep_type)}</td>
        <td>${escapeHtml(d.from_title || '—')}</td>
        <td>${escapeHtml(d.to_title || '—')}</td>
        <td><span class="badge">${escapeHtml(d.dep_type)}</span></td>
        <td>
          <select class="field-input field-sm" data-field="status">
            ${['open', 'met', 'waived', 'blocked']
              .map(
                (s) =>
                  `<option value="${s}"${d.status === s ? ' selected' : ''}>${s}</option>`,
              )
              .join('')}
          </select>
        </td>
        <td><button type="button" class="btn btn-ghost btn-sm btn-delete-dep">Delete</button></td>
      </tr>`,
    )
    .join('');

  const readinessRows = (state.readiness || [])
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.title)}</td>
        <td>${r.ready_to_start || '—'}</td>
        <td>${r.blocked ? '<span class="badge badge-warn">Blocked</span>' : '<span class="badge badge-ok">Ready</span>'}</td>
        <td>${escapeHtml((r.blockers || []).map((b) => b.label).join(', ') || '—')}</td>
      </tr>`,
    )
    .join('');

  const planOptions = state.planItems
    .map((p) => `<option value="${escapeAttr(p.id)}">${escapeAttr(p.title)}</option>`)
    .join('');

  return `
    <section class="panel" style="margin-bottom:16px">
      <div class="panel-head">
        <div>
          <h1 class="omc-title">Dependencies & Readiness</h1>
          <p class="omc-lead">Model gates that block ready-to-start dates.</p>
        </div>
        <div class="btn-row">
          <select id="cycle-select" class="field-input">${cycleOptions(state.activeCycleId)}</select>
          <select id="scenario-select" class="field-input">${scenarioOptionsHtml}</select>
        </div>
      </div>

      <div class="form-grid" style="margin-bottom:12px">
        <label class="field">
          <span class="field-label">Label</span>
          <input id="new-dep-label" class="field-input" placeholder="PBC received" />
        </label>
        <label class="field">
          <span class="field-label">Type</span>
          <select id="new-dep-type" class="field-input">
            <option value="evidence_ready">Evidence ready</option>
            <option value="sample_chain">Sample chain</option>
            <option value="review_lag">Review lag</option>
            <option value="phase_gate">Phase gate</option>
            <option value="staffing">Staffing</option>
            <option value="external_flag">External flag</option>
            <option value="blackout">Blackout</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">Blocks item</span>
          <select id="new-dep-to" class="field-input">${planOptions}</select>
        </label>
        <label class="field">
          <span class="field-label">Predecessor (optional)</span>
          <select id="new-dep-from" class="field-input">
            <option value="">—</option>${planOptions}
          </select>
        </label>
        <div class="field" style="align-self:end">
          <button type="button" class="btn btn-refresh-solid" id="add-dependency">Add gate</button>
        </div>
      </div>

      <div class="panel-head">
        <h2 class="omc-section-title">Dependency gates</h2>
        <button type="button" class="btn btn-ghost btn-sm" id="save-dependencies">Save status</button>
      </div>
      <table class="data-table" id="dependencies-table">
        <thead><tr><th>Label</th><th>From</th><th>Blocks</th><th>Type</th><th>Status</th><th></th></tr></thead>
        <tbody>${depRows || '<tr><td colspan="6">No dependencies yet.</td></tr>'}</tbody>
      </table>
    </section>

    <section class="panel">
      <h2 class="omc-section-title">Readiness summary</h2>
      <table class="data-table">
        <thead><tr><th>Plan item</th><th>Ready to start</th><th>Status</th><th>Blockers</th></tr></thead>
        <tbody>${readinessRows || '<tr><td colspan="4">Add plan items and dependencies.</td></tr>'}</tbody>
      </table>
    </section>
  `;
}
