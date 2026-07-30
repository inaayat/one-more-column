/** Plan Builder + Dependencies view helpers (H2 / C2). */

import { getSetupProgress } from './setup.js';

export function renderSetupProgressBanner(state) {
  const progress = getSetupProgress(state);
  if (progress.onboardingComplete) return '';

  const stepItems = progress.steps
    .map((step, i) => {
      const isCurrent = progress.nextStep?.id === step.id;
      const cls = [
        'setup-progress-step',
        step.done ? 'done' : '',
        isCurrent ? 'current' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<li class="${cls}">
        <span class="setup-progress-num" aria-hidden="true">${step.done ? '✓' : i + 1}</span>
        <span>${step.label}</span>
      </li>`;
    })
    .join('');

  const title = !progress.planningReady
    ? 'Start here'
    : progress.nextStep?.id === 'plan'
      ? 'What are you actually planning?'
      : progress.setupComplete
        ? 'You are almost done'
        : 'Almost there';
  const intro = !progress.planningReady
    ? '<p class="omc-lead">Name your plan in step 1 — workspace, dates, and how you track work. Then click <strong>Create the plan</strong>.</p>'
    : progress.nextStep?.id === 'plan'
      ? '<p class="omc-lead">Setup basics are done. Open <strong>Planner</strong> and add rows for what you are actually trying to get done — deliverables, reviews, meetings, anything with hours and due dates.</p>'
      : '<p class="omc-lead">Add your work in <strong>Planner</strong>, add people in step 2 if you have not yet, then check <strong>Capacity</strong>.</p>';
  const lead = progress.nextStep
    ? `<p class="setup-progress-lead"><strong>Do this next:</strong> ${progress.nextStep.label}</p>`
    : '';

  return `
    <section class="panel setup-progress-banner" aria-label="Setup progress">
      <h2 class="setup-progress-title">${title}</h2>
      ${intro}
      <ol class="setup-progress-steps">${stepItems}</ol>
      ${lead}
    </section>
  `;
}

export function setupSectionClass(progress, anchor) {
  const isCurrent = progress.nextStep?.anchor === anchor;
  return `panel setup-section${isCurrent ? ' setup-section-current' : ''}`;
}

export function renderPlanningCta(state) {
  const progress = getSetupProgress(state);
  if (!progress.planningReady) return '';

  const isCurrent = progress.nextStep?.id === 'plan';
  const hasRows = progress.hasPlanItems;

  return `
    <section id="setup-planning" class="panel setup-planning-cta${isCurrent ? ' setup-section-current' : ''}">
      <h2 class="omc-section-title">What are you actually planning?</h2>
      <p class="omc-lead">This is the main event — list the work: deliverables, reviews, meetings, ad-hoc tasks. Each row needs a title, hours, and due date.</p>
      ${hasRows
        ? `<p class="omc-lead"><span class="badge badge-ok">${state.planItems.length} row(s) in Planner</span> — <a href="#/planner">keep adding or editing</a>.</p>`
        : `<div class="btn-row"><a class="btn btn-refresh-solid" href="#/planner">Open Planner →</a></div>`}
      ${!progress.teamReady ? '<p class="omc-lead setup-planning-note">You can plan before adding your team. Add people in step 2 when you are ready to check capacity.</p>' : ''}
    </section>
  `;
}

export function renderHomeView({ state, escapeHtml }) {
  const progress = getSetupProgress(state);
  const cycle = state.cycles.find((c) => c.id === state.activeCycleId);
  const workspace = state.workspaces.find((w) => w.id === state.activeWorkspaceId);

  const setupStatus = progress.onboardingComplete
    ? '<span class="badge badge-ok">Ready to plan</span>'
    : progress.planningReady
      ? progress.hasPlanItems
        ? '<span class="badge">Check capacity</span>'
        : '<span class="badge badge-warn">List your work</span>'
      : '<span class="badge badge-warn">Finish setup first</span>';

  const nextStep = progress.nextStep
    ? { href: `#/${progress.nextStep.route}`, label: progress.nextStep.label }
    : { href: '#/capacity', label: 'View your capacity grid' };

  const secondaryCta = progress.planningReady
    ? { href: '#/preferences', label: 'Settings' }
    : { href: '#/settings', label: 'Open Setup' };

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
          ${cycle ? ` · ${escapeHtml(cycle.name)}` : ''}
        </span>
      </div>
      <div class="btn-row home-cta">
        <a class="btn btn-refresh-solid" href="${nextStep.href}">${escapeHtml(nextStep.label)}</a>
        <a class="btn btn-ghost" href="${secondaryCta.href}">${escapeHtml(secondaryCta.label)}</a>
      </div>
    </section>

    <section class="panel home-guide">
      <h2 class="omc-section-title">How to use this tool</h2>
      <p class="omc-lead">Name your plan in <strong>Setup</strong>, then list your actual work in <strong>Planner</strong>. Add people when you are ready to check <strong>Capacity</strong>.</p>

      <ol class="guide-steps">
        <li class="guide-step${progress.nextStep?.id === 'name-plan' ? ' guide-step-current' : ''}">
          <div class="guide-step-head">
            <span class="guide-step-num">1</span>
            <h3>Name your plan</h3>
          </div>
          <p>Start on <a href="#/settings">Setup</a>. Pick a <strong>workspace</strong> (existing or new), then name the plan with <strong>start</strong> and <strong>end</strong> dates and choose how to <strong>track work</strong> — by day, week, or month.</p>
        </li>

        <li class="guide-step${progress.nextStep?.id === 'plan' ? ' guide-step-current' : ''}">
          <div class="guide-step-head">
            <span class="guide-step-num">2</span>
            <h3>What are you actually planning?</h3>
          </div>
          <p>Open <a href="#/planner">Planner</a> and add rows — deliverables, reviews, meetings, anything with hours and a due date.</p>
          <ul class="guide-tips">
            <li><strong>Title</strong> — what needs to be done.</li>
            <li><strong>Type</strong> — general, deliverable, review, meeting, admin, or other.</li>
            <li><strong>Work hours</strong> and <strong>due week</strong> — drive the capacity grid.</li>
          </ul>
        </li>

        <li class="guide-step${progress.nextStep?.id === 'people' ? ' guide-step-current' : ''}">
          <div class="guide-step-head">
            <span class="guide-step-num">3</span>
            <h3>Add your team (for capacity)</h3>
          </div>
          <p>Back on <a href="#/settings">Setup</a>, add one row per person — name, role, and standard hours.</p>
          <ul class="guide-tips">
            <li><strong>Who</strong>, <strong>role</strong>, and <strong>std h/wk</strong> — that's all you need to start.</li>
            <li>Add PTO and other details later under <strong>Settings</strong> in the nav.</li>
            <li>You can list work in Planner before your team is complete.</li>
          </ul>
        </li>

        <li class="guide-step">
          <div class="guide-step-head">
            <span class="guide-step-num">4</span>
            <h3>Model blockers (optional)</h3>
          </div>
          <p>If something cannot start until something else is done, add a <strong>gate</strong> on that row in Planner.</p>
        </li>

        <li class="guide-step${progress.nextStep?.id === 'capacity' ? ' guide-step-current' : ''}">
          <div class="guide-step-head">
            <span class="guide-step-num">5</span>
            <h3>Check capacity</h3>
          </div>
          <p>Open <a href="#/capacity">Capacity</a> to see hours per person, per week.</p>
          <ul class="guide-tips">
            <li><span class="legend-dot ok"></span> <strong>Green</strong> — room left.</li>
            <li><span class="legend-dot warn"></span> <strong>Yellow</strong> — getting tight.</li>
            <li><span class="legend-dot bad"></span> <strong>Red</strong> — overloaded.</li>
            <li>Use <strong>team tabs</strong> to focus on one group. Open gates from Planner show at the top when something is still waiting.</li>
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

export function openGatesBlock(state, escapeHtml) {
  const open = (state.dependencies || []).filter(
    (d) => d.status === 'open' || d.status === 'blocked',
  );
  if (!open.length) return '';

  const items = open
    .map((d) => {
      const task = escapeHtml(d.to_title || 'Task');
      const label = escapeHtml(d.label || 'Gate');
      const due = d.meta?.due_date ? String(d.meta.due_date).slice(0, 10) : 'no date set';
      return `<li><strong>${task}</strong> — ${label} (by ${due})</li>`;
    })
    .join('');

  return `<div class="assumptions-panel"><strong>Still waiting on</strong><ul>${items}</ul><p class="omc-lead" style="margin-top:8px">These come from gates in Planner — not a separate list.</p></div>`;
}

/** @deprecated assumptions live in Planner gates now */
export function assumptionsBlock(assumptions, escapeHtml) {
  return '';
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

export function renderPlannerView({ state, escapeHtml, cycleOptions, scenarioOptionsHtml }) {
  const activeScenario = state.scenarios.find((s) => s.id === state.activeScenarioId);
  const isLivePlan = activeScenario?.status === 'active';
  const depsByItem = new Map();
  for (const dep of state.dependencies || []) {
    if (!depsByItem.has(dep.to_plan_item_id)) depsByItem.set(dep.to_plan_item_id, []);
    depsByItem.get(dep.to_plan_item_id).push(dep);
  }
  const readinessByItem = new Map(
    (state.readiness || []).map((r) => [r.plan_item_id, r]),
  );

  const itemOptions = (currentId, selectedId = '') =>
    state.planItems
      .filter((p) => p.id !== currentId)
      .map(
        (p) =>
          `<option value="${escapeAttr(p.id)}"${p.id === selectedId ? ' selected' : ''}>${escapeAttr(p.title)}</option>`,
      )
      .join('');

  const depTypeOptions = (selected) =>
    [
      ['input_ready', 'Something must be ready'],
      ['handoff_chain', 'Handoff from someone'],
      ['external_flag', 'Team agreement'],
      ['phase_gate', 'Phase milestone'],
      ['staffing', 'Need a person'],
      ['review_lag', 'Review after work'],
      ['blackout', 'Blackout period'],
    ]
      .map(([v, label]) => `<option value="${v}"${selected === v ? ' selected' : ''}>${label}</option>`)
      .join('');

  const taskTypeOptions = (selected = 'general') =>
    [
      ['general', 'General'],
      ['deliverable', 'Deliverable'],
      ['review', 'Review'],
      ['meeting', 'Meeting'],
      ['admin', 'Admin'],
      ['other', 'Other'],
    ]
      .map(([v, label]) => `<option value="${v}"${selected === v ? ' selected' : ''}>${label}</option>`)
      .join('');

  const statusOptions = (selected) =>
    ['open', 'met', 'waived', 'blocked']
      .map((s) => `<option value="${s}"${selected === s ? ' selected' : ''}>${s}</option>`)
      .join('');

  const rows = state.planItems
    .map((item, index) => {
      const attrs = item.attributes || {};
      const deps = depsByItem.get(item.id) || [];
      const primary = deps[0] || null;
      const extra = deps.slice(1);
      const ready = readinessByItem.get(item.id);
      const readyLabel = ready?.blocked
        ? `<span class="badge badge-warn">Blocked</span>`
        : ready?.ready_to_start
          ? `<span class="badge badge-ok">${escapeHtml(String(ready.ready_to_start).slice(0, 10))}</span>`
          : '—';

      const extraRows = extra
        .map(
          (dep) => `<tr class="planner-subrow" data-dep-id="${escapeAttr(dep.id)}" data-parent-id="${escapeAttr(item.id)}">
            <td></td>
            <td colspan="2" class="planner-sub-indent">↳ Gate</td>
            <td colspan="2"></td>
            <td>
              <select class="field-input field-sm" data-field="from_plan_item_id">
                <option value="">—</option>
                ${itemOptions(item.id, dep.from_plan_item_id || '')}
              </select>
            </td>
            <td><input class="field-input field-sm" data-field="label" value="${escapeAttr(dep.label || '')}" placeholder="Gate name" /></td>
            <td><input class="field-input field-sm" data-field="dep_due" type="date" value="${dep.meta?.due_date ? String(dep.meta.due_date).slice(0, 10) : ''}" /></td>
            <td><select class="field-input field-sm" data-field="dep_status">${statusOptions(dep.status)}</select></td>
            <td><select class="field-input field-sm" data-field="dep_type">${depTypeOptions(dep.dep_type)}</select></td>
            <td></td>
            <td><button type="button" class="btn btn-ghost btn-sm btn-delete-dep">×</button></td>
          </tr>`,
        )
        .join('');

      return `<tr class="planner-row" data-id="${escapeAttr(item.id)}" data-dep-id="${escapeAttr(primary?.id || '')}">
        <td class="planner-num">${index + 1}</td>
        <td><input class="field-input field-sm" data-field="title" value="${escapeAttr(item.title)}" /></td>
        <td><select class="field-input field-sm" data-field="task_type">${taskTypeOptions(attrs.task_type || 'general')}</select></td>
        <td><input class="field-input field-sm" data-field="duration_days" type="number" step="0.5" min="0" value="${attrs.duration_days ?? ''}" placeholder="—" /></td>
        <td><input class="field-input field-sm" data-field="work_hours" type="number" step="0.5" value="${item.work_hours ?? 0}" /></td>
        <td><input class="field-input field-sm" data-field="start_date" type="date" value="${attrs.start_date ? String(attrs.start_date).slice(0, 10) : ''}" /></td>
        <td><input class="field-input field-sm" data-field="due_week" type="date" value="${item.due_week ? String(item.due_week).slice(0, 10) : ''}" /></td>
        <td>
          <select class="field-input field-sm" data-field="from_plan_item_id">
            <option value="">—</option>
            ${itemOptions(item.id, primary?.from_plan_item_id || '')}
          </select>
        </td>
        <td><input class="field-input field-sm" data-field="label" value="${escapeAttr(primary?.label || '')}" placeholder="What must be ready?" /></td>
        <td><input class="field-input field-sm" data-field="dep_due" type="date" value="${primary?.meta?.due_date ? String(primary.meta.due_date).slice(0, 10) : ''}" /></td>
        <td><select class="field-input field-sm" data-field="dep_status">${statusOptions(primary?.status || 'open')}</select></td>
        <td><select class="field-input field-sm" data-field="dep_type">${depTypeOptions(primary?.dep_type || 'input_ready')}</select></td>
        <td class="planner-ready">${readyLabel}</td>
        <td><input class="field-input field-sm" data-field="phase" value="${escapeAttr(item.phase || '')}" /></td>
        <td class="planner-actions">
          <button type="button" class="btn btn-ghost btn-sm btn-add-gate" title="Add another gate">+</button>
          ${primary?.id ? '<button type="button" class="btn btn-ghost btn-sm btn-delete-dep" title="Remove gate">×</button>' : ''}
          <button type="button" class="btn btn-ghost btn-sm btn-delete-item" title="Remove row">×</button>
        </td>
      </tr>${extraRows}`;
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
          <h1 class="omc-title">Planner</h1>
          <p class="omc-lead">One list for all work — deliverables, reviews, meetings, anything else. Use <strong>Type</strong> to label rows. Use <strong>Gate</strong> for what must happen first (including team agreements).</p>
        </div>
        <div class="btn-row">
          <select id="cycle-select" class="field-input">${cycleOptions(state.activeCycleId)}</select>
          <select id="scenario-select" class="field-input">${scenarioOptionsHtml}</select>
        </div>
      </div>

      <div class="planner-toolbar">
        <div class="view-toggle" role="group" aria-label="Plan mode">
          <button type="button" class="view-toggle-btn${!isLivePlan ? ' active' : ''}" id="mode-draft">Working draft</button>
          <button type="button" class="view-toggle-btn${isLivePlan ? ' active' : ''}" id="mode-live">Live plan</button>
        </div>
        <div class="btn-row">
          <button type="button" class="btn btn-ghost btn-sm" id="create-scenario">New draft</button>
          <button type="button" class="btn btn-ghost btn-sm" id="delete-scenario"${(state.scenarios?.length || 0) <= 1 ? ' disabled' : ''} title="Delete this scenario">Delete scenario</button>
          <button type="button" class="btn btn-ghost btn-sm" id="finalize-scenario"${isLivePlan ? ' disabled' : ''}>Mark as live plan</button>
          <button type="button" class="btn btn-ghost btn-sm" id="export-plan">Export CSV</button>
          <button type="button" class="btn btn-ghost btn-sm" id="check-drift">Check drift</button>
          <button type="button" class="btn btn-refresh-solid btn-sm" id="save-planner">Save plan</button>
        </div>
      </div>
      <p class="planner-mode-note omc-lead">
        ${isLivePlan
          ? '<strong>Live plan</strong> — this is the version you are working from. You can still change it anytime; click Save plan when you are done editing.'
          : '<strong>Draft</strong> — try ideas here first. When you are happy, click Mark as live plan.'}
      </p>

      ${!state.planItems?.length ? `
      <div class="planner-welcome">
        <h2 class="omc-section-title">What are you actually planning?</h2>
        <p class="omc-lead">Add your first row below — title, type, hours, due date. List everything you need to get done this period; capacity checks come after.</p>
      </div>` : ''}

      <div class="form-grid planner-quick-add" style="margin-bottom:14px">
        <label class="field field-span-2">
          <span class="field-label">Quick add row</span>
          <input id="new-item-title" class="field-input" placeholder="Task title" />
        </label>
        <label class="field">
          <span class="field-label">Type</span>
          <select id="new-item-type" class="field-input">
            <option value="general">General</option>
            <option value="deliverable">Deliverable</option>
            <option value="review">Review</option>
            <option value="meeting">Meeting</option>
            <option value="admin">Admin</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">Days</span>
          <input id="new-item-days" class="field-input" type="number" step="0.5" placeholder="5" />
        </label>
        <label class="field">
          <span class="field-label">Work hours</span>
          <input id="new-item-hours" class="field-input" type="number" value="8" />
        </label>
        <label class="field">
          <span class="field-label">Due</span>
          <input id="new-item-due" class="field-input" type="date" />
        </label>
        <div class="field" style="align-self:end">
          <button type="button" class="btn btn-refresh-solid" id="add-plan-item">Add row</button>
        </div>
      </div>

      <details class="planner-import">
        <summary>Import from CSV</summary>
        <div class="form-grid" style="margin-top:10px">
          <label class="field field-span-2">
            <span class="field-label">CSV (title, work_hours, due_week, phase)</span>
            <textarea id="import-csv" class="field-input" rows="3" placeholder="title,work_hours,due_week,phase&#10;Task A,8,2026-01-12,Phase 1"></textarea>
          </label>
          <div class="field" style="align-self:end">
            <button type="button" class="btn btn-ghost" id="preview-import">Preview CSV</button>
          </div>
        </div>
        ${importPreview}
      </details>

      <div class="cap-scroll planner-scroll">
        <table class="data-table planner-table" id="planner-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Type</th>
              <th>Days</th>
              <th>Work h</th>
              <th>Start</th>
              <th>Due</th>
              <th>Predecessor</th>
              <th>Gate</th>
              <th>Gate due</th>
              <th>Status</th>
              <th>Gate type</th>
              <th>Ready</th>
              <th>Phase</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="15">No rows yet — add your first task above.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `;
}

/** @deprecated use renderPlannerView */
export function renderPlanView(props) {
  return renderPlannerView(props);
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
