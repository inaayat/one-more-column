/** Plan Builder + Dependencies view helpers (H2 / C2). */

export function renderHomeView({ state, escapeHtml }) {
  const cycle = state.cycles.find((c) => c.id === state.activeCycleId);
  const workspace = state.workspaces.find((w) => w.id === state.activeWorkspaceId);
  const hasWorkspace = Boolean(workspace);
  const hasCycle = Boolean(cycle);
  const hasResources = state.resources.length > 0;
  const hasPlanItems = state.planItems.length > 0;
  const setupComplete = hasWorkspace && hasCycle && hasResources;

  const setupStatus = setupComplete
    ? '<span class="badge badge-ok">Ready to plan</span>'
    : '<span class="badge badge-warn">Finish setup first</span>';

  const nextStep = !hasWorkspace
    ? { href: '#/settings', label: 'Create a workspace in Settings' }
    : !hasCycle
      ? { href: '#/settings', label: 'Add a planning cycle' }
      : !hasResources
        ? { href: '#/settings', label: 'Add your team members' }
        : !hasPlanItems
          ? { href: '#/plan', label: 'Add your first plan items' }
          : { href: '#/capacity', label: 'View your capacity grid' };

  return `
    <section class="panel home-hero">
      <p class="home-eyebrow">Getting started</p>
      <h1 class="omc-title">Plan your work in one place</h1>
      <p class="omc-lead home-intro">
        One More Column helps you list what needs to get done, spread hours across weeks,
        and see who still has room — without juggling another spreadsheet.
      </p>
      <div class="home-status">
        ${setupStatus}
        <span class="home-status-detail">
          ${escapeHtml(workspace?.name || 'No workspace')}
          ${hasCycle ? ` · ${escapeHtml(cycle.name)}` : ''}
        </span>
      </div>
      <div class="btn-row home-cta">
        <a class="btn btn-refresh-solid" href="${nextStep.href}">${escapeHtml(nextStep.label)}</a>
        <a class="btn btn-ghost" href="#/plan">Open Plan</a>
      </div>
    </section>

    <section class="panel home-guide">
      <h2 class="omc-section-title">How to use this tool</h2>
      <p class="omc-lead">Follow these steps once per workspace. After that, you mostly live on <strong>Plan</strong> and <strong>Capacity</strong>.</p>

      <ol class="guide-steps">
        <li class="guide-step">
          <div class="guide-step-head">
            <span class="guide-step-num">1</span>
            <h3>Set up your workspace</h3>
          </div>
          <p>Go to <a href="#/settings">Settings</a>. A <strong>workspace</strong> is your team's own pool of people and plans — separate from other teams.</p>
          <ul class="guide-tips">
            <li>Create a workspace (for example, <em>Engineering</em> or <em>Design</em>).</li>
            <li>Add a <strong>planning cycle</strong> for the time period you're planning (quarter, sprint, or year).</li>
          </ul>
        </li>

        <li class="guide-step">
          <div class="guide-step-head">
            <span class="guide-step-num">2</span>
            <h3>Add your people</h3>
          </div>
          <p>Still in <a href="#/settings">Settings</a>, add everyone who will carry work in this workspace.</p>
          <ul class="guide-tips">
            <li>Give each person a <strong>weekly capacity</strong> (default is 32 hours).</li>
            <li>Optional: add <strong>time off</strong> so capacity reflects PTO and holidays.</li>
            <li>Assign a <strong>team</strong> name if you want to filter the capacity view later.</li>
          </ul>
        </li>

        <li class="guide-step">
          <div class="guide-step-head">
            <span class="guide-step-num">3</span>
            <h3>List the work</h3>
          </div>
          <p>Open <a href="#/plan">Plan</a> and add tasks for the active cycle and scenario.</p>
          <ul class="guide-tips">
            <li><strong>Title</strong> — what needs to be done.</li>
            <li><strong>Work hours</strong> — effort to complete it. Review hours can be entered or derived from your policy.</li>
            <li><strong>Due week</strong> — when the work should land. Hours count toward that week on the capacity grid.</li>
            <li>Already have a spreadsheet? Paste CSV on the Plan page or use <strong>Export CSV</strong> to download what you have.</li>
          </ul>
        </li>

        <li class="guide-step">
          <div class="guide-step-head">
            <span class="guide-step-num">4</span>
            <h3>Model blockers (optional)</h3>
          </div>
          <p>If something cannot start until something else is done, use <a href="#/dependencies">Dependencies</a>.</p>
          <ul class="guide-tips">
            <li>Add a gate (for example, <em>Prerequisite complete</em>) on the plan item it blocks.</li>
            <li>Mark gates <strong>met</strong> when they're done — readiness dates update automatically.</li>
          </ul>
        </li>

        <li class="guide-step">
          <div class="guide-step-head">
            <span class="guide-step-num">5</span>
            <h3>Check capacity</h3>
          </div>
          <p>Open <a href="#/capacity">Capacity</a> to see hours per person, per week.</p>
          <ul class="guide-tips">
            <li><span class="legend-dot ok"></span> <strong>Green</strong> — room left.</li>
            <li><span class="legend-dot warn"></span> <strong>Yellow</strong> — getting tight.</li>
            <li><span class="legend-dot bad"></span> <strong>Red</strong> — overloaded.</li>
            <li>Use <strong>team tabs</strong> to focus on one group. Document cycle assumptions at the top of the page.</li>
          </ul>
        </li>

        <li class="guide-step">
          <div class="guide-step-head">
            <span class="guide-step-num">6</span>
            <h3>Watch for problems</h3>
          </div>
          <p><a href="#/alerts">Alerts</a> surfaces overloads, due dates coming up soon, and readiness gaps — no external tools required.</p>
          <p class="guide-note">Use <strong>scenarios</strong> on the Plan page to try a "what if" version without overwriting your baseline.</p>
        </li>
      </ol>
    </section>

    <section class="panel home-quickref">
      <h2 class="omc-section-title">Quick reference</h2>
      <div class="quickref-grid">
        <div class="quickref-card">
          <h3>Switch workspace</h3>
          <p>Use the dropdown in the top-right header. Each workspace keeps its own people and cycles.</p>
        </div>
        <div class="quickref-card">
          <h3>Switch cycle or scenario</h3>
          <p>Pick them on Plan, Capacity, or Dependencies. Your choice stays until you change it.</p>
        </div>
        <div class="quickref-card">
          <h3>Import vs export</h3>
          <p><strong>Import</strong> adds rows from CSV. <strong>Export</strong> downloads your current plan or capacity. <strong>Check drift</strong> compares today to your last import.</p>
        </div>
        <div class="quickref-card">
          <h3>Where data lives</h3>
          <p>Everything you enter is saved in the app. There is no live sync with Jira or other tools in this version.</p>
        </div>
      </div>
    </section>
  `;
}

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
