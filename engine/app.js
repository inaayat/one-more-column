import { initAuth, wireAuthLink, refreshToken } from './auth.js';
import {
  meApi,
  workspacesApi,
  cyclesApi,
  scenariosApi,
  policyApi,
  resourcesApi,
  planItemsApi,
  dependenciesApi,
  importApi,
  capacityApi,
  assumptionsApi,
  changelogApi,
  alertsApi,
  exportApi,
  timeOffApi,
} from './api.js';
import {
  scenarioOptions,
  renderPlanView,
  renderDependenciesView,
  renderAlertsView,
  assumptionsBlock,
  teamTabs,
  capacityCellClass,
} from './views.js';

const APP_PATH = '/one-more-column/';
const WORKSPACE_STORAGE_KEY = 'omc_active_workspace_id';
const SCENARIO_STORAGE_KEY = 'omc_active_scenario_id';

const state = {
  auth: null,
  me: null,
  token: null,
  workspaces: [],
  activeWorkspaceId: null,
  cycles: [],
  activeCycleId: null,
  scenarios: [],
  activeScenarioId: null,
  resources: [],
  teams: [],
  policy: null,
  capacity: null,
  planItems: [],
  dependencies: [],
  readiness: [],
  importPreview: null,
  assumptions: [],
  changelog: [],
  alerts: [],
  alertCounts: { high: 0, medium: 0, low: 0 },
  activeTeamFilter: '',
  drift: null,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initials(name, email) {
  const source = (name || email || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, '') || 'home';
  return hash.split('?')[0];
}

function navigate(route) {
  location.hash = `#/${route}`;
}

function activeWorkspace() {
  return state.workspaces.find((w) => w.id === state.activeWorkspaceId) || null;
}

function persistActiveWorkspace() {
  if (state.activeWorkspaceId) {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, state.activeWorkspaceId);
  }
}

function workspaceOptions(selectedId) {
  if (!state.workspaces.length) {
    return '<option value="">No workspaces</option>';
  }
  return state.workspaces
    .map(
      (w) =>
        `<option value="${escapeHtml(w.id)}"${w.id === selectedId ? ' selected' : ''}>${escapeHtml(w.name)}</option>`,
    )
    .join('');
}

function renderShell({ body, activeNav = 'home' }) {
  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'plan', label: 'Plan' },
    { id: 'dependencies', label: 'Dependencies' },
    { id: 'capacity', label: 'Capacity' },
    { id: 'alerts', label: 'Alerts' },
    { id: 'settings', label: 'Settings' },
  ];
  const nav = navItems
    .map(
      (item) =>
        `<a href="#/${item.id}" class="nav-link${activeNav === item.id ? ' active' : ''}">${item.label}</a>`,
    )
    .join('');

  const user = state.me?.user || state.auth?.user || {};
  const displayName = user.name || user.email || 'Signed in';
  const avatar = initials(user.name, user.email);

  return `
    <header class="app-header">
      <div class="header-inner">
        <div class="header-brand">
          <div class="brand-mark" aria-hidden="true">OMC</div>
          <div>
            <div class="app-name">One More Column</div>
            <div class="app-sub">Flexible capacity planning</div>
          </div>
        </div>
        <nav class="header-nav" aria-label="Main">${nav}</nav>
        <div class="header-actions">
          <label class="workspace-switcher">
            <span class="sr-only">Workspace</span>
            <select id="workspace-select" class="field-input field-sm workspace-select" title="Switch workspace">
              ${workspaceOptions(state.activeWorkspaceId)}
            </select>
          </label>
          <a href="/" class="btn btn-ghost btn-sm">← inaayat.xyz</a>
          <span class="auth-chip">
            <span class="auth-avatar">${escapeHtml(avatar)}</span>
            <span>${escapeHtml(displayName)}</span>
          </span>
          <a href="/account.html" class="btn btn-ghost btn-sm" id="nav-auth-link">Log out</a>
        </div>
      </div>
    </header>
    <main class="main">
      <div class="content content-wide">${body}</div>
    </main>
  `;
}

function renderSignInPrompt(auth) {
  const loginHref = `/account.html?next=${encodeURIComponent(location.pathname || APP_PATH)}`;
  const reauthNote = auth.needsReauth
    ? '<div class="token-banner expired"><div><strong>Session expired.</strong> Sign in again to continue.</div></div>'
    : '';

  return `
    ${reauthNote}
    <section class="panel">
      <h1 class="omc-title">One More Column</h1>
      <p class="omc-lead">Sign in with the same account you use for AMC A-Lister.</p>
      <p style="margin-top:16px">
        <a class="btn btn-refresh-solid" href="${loginHref}">Sign in</a>
      </p>
    </section>
  `;
}

function cycleOptions(selectedId) {
  if (!state.cycles.length) {
    return '<option value="">No cycles yet</option>';
  }
  return state.cycles
    .map((c) => {
      const typeLabel = c.cycle_type && c.cycle_type !== 'annual' ? ` (${c.cycle_type})` : '';
      return `<option value="${escapeHtml(c.id)}"${c.id === selectedId ? ' selected' : ''}>${escapeHtml(c.name)}${escapeHtml(typeLabel)}</option>`;
    })
    .join('');
}

function renderHome() {
  const cycle = state.cycles.find((c) => c.id === state.activeCycleId);
  const workspace = activeWorkspace();
  return renderShell({
    activeNav: 'home',
    body: `
      <div class="token-banner valid">
        <span aria-hidden="true">✓</span>
        <div><strong>C1 + H3 + C4 ready.</strong> Capacity bands, assumptions, PTO overlay, alerts, and CSV export are live.</div>
      </div>
      <section class="panel">
        <h1 class="omc-title">Welcome back</h1>
        <p class="omc-lead">Each workspace has its own people pool and planning cycles. Switch workspaces in the header.</p>
        <dl class="omc-identity">
          <div><dt>Workspace</dt><dd>${escapeHtml(workspace?.name || 'None — create one in Settings')}</dd></div>
          <div><dt>Active cycle</dt><dd>${escapeHtml(cycle?.name || 'None — create one in Settings')}</dd></div>
          <div><dt>Resources</dt><dd>${state.resources.length}</dd></div>
          <div><dt>Teams</dt><dd>${state.teams.length ? escapeHtml(state.teams.join(', ')) : '—'}</dd></div>
          <div><dt>Manual tasks</dt><dd>${state.planItems.length}</dd></div>
        </dl>
        <div class="btn-row" style="margin-top:16px">
          <a class="btn btn-refresh-solid" href="#/capacity">View capacity</a>
          <a class="btn btn-ghost" href="#/settings">Manage settings</a>
        </div>
      </section>
    `,
  });
}

function renderCapacity() {
  const grid = state.capacity;
  if (!state.activeCycleId) {
    return renderShell({
      activeNav: 'capacity',
      body: `<section class="panel"><p class="omc-lead">Create a planning cycle in Settings first.</p></section>`,
    });
  }

  if (!grid) {
    return renderShell({
      activeNav: 'capacity',
      body: `<section class="panel"><p class="omc-lead">Loading capacity…</p></section>`,
    });
  }

  const weekHeaders = grid.weeks
    .map((w) => `<th class="cap-week">${escapeHtml(formatWeekLabel(w))}</th>`)
    .join('');

  const rows = grid.rows
    .map((row) => {
      const cells = row.weeks
        .map((cell) => {
          const cls = capacityCellClass(cell);
          return `<td class="${cls}" title="Cap ${cell.capacity}h / Load ${cell.load}h / Rem ${cell.remaining}h">
            <span class="cap-load">${cell.load || '—'}</span>
            <span class="cap-rem">${cell.remaining}</span>
          </td>`;
        })
        .join('');
      return `<tr>
        <th class="cap-person">${escapeHtml(row.name)}<span class="cap-team">${escapeHtml(row.team || '')}</span></th>
        ${cells}
      </tr>`;
    })
    .join('');

  return renderShell({
    activeNav: 'capacity',
    body: `
      <section class="panel">
        <div class="panel-head">
          <div>
            <h1 class="omc-title">Capacity</h1>
            <p class="omc-lead">${escapeHtml(grid.cycle?.name || '')} · ${escapeHtml(grid.mode)} mode · ${grid.rows.length} people</p>
          </div>
          <div class="btn-row">
            <select id="cycle-select" class="field-input">${cycleOptions(state.activeCycleId)}</select>
            <select id="scenario-select" class="field-input">${scenarioOptions(state.scenarios, state.activeScenarioId)}</select>
            <select id="cap-mode" class="field-input">
              <option value="due"${grid.mode === 'due' ? ' selected' : ''}>Due week</option>
              <option value="spread"${grid.mode === 'spread' ? ' selected' : ''}>Spread</option>
            </select>
            <button type="button" class="btn btn-ghost btn-sm" id="export-capacity">Export CSV</button>
            <button type="button" class="btn btn-ghost btn-sm" id="refresh-capacity">Refresh</button>
          </div>
        </div>
        ${assumptionsBlock(grid.assumptions || state.assumptions, escapeHtml)}
        ${teamTabs(grid.teams || state.teams, state.activeTeamFilter, escapeHtml)}
        <div class="cap-legend">
          <span><span class="legend-dot ok"></span> Green — comfortable</span>
          <span><span class="legend-dot warn"></span> Yellow — tight</span>
          <span><span class="legend-dot bad"></span> Red — overloaded</span>
          <span class="cap-legend-note">Cells show load (top) and remaining hours (bottom)</span>
        </div>
        <div class="cap-scroll">
          <table class="cap-table">
            <thead><tr><th class="cap-person">Person</th>${weekHeaders}</tr></thead>
            <tbody>${rows || '<tr><td colspan="99">No active resources. Add people in Settings.</td></tr>'}</tbody>
          </table>
        </div>
      </section>
    `,
  });
}

function renderSettings() {
  const policy = state.policy?.config || {};
  const resourceRows = state.resources
    .map(
      (r) => `
      <tr data-id="${escapeHtml(r.id)}">
        <td><input class="field-input field-sm" data-field="name" value="${escapeHtml(r.name)}" /></td>
        <td><input class="field-input field-sm" data-field="team" value="${escapeHtml(r.team || '')}" placeholder="Team" /></td>
        <td><input class="field-input field-sm" data-field="weekly_hours" type="number" step="0.5" placeholder="32" value="${r.profiles?.[0]?.weekly_hours ?? ''}" /></td>
        <td><label class="check-label"><input type="checkbox" data-field="active" ${r.active ? 'checked' : ''} /> Active</label></td>
      </tr>`,
    )
    .join('');

  const taskRows = state.planItems
    .map(
      (t) => `
      <tr>
        <td>${escapeHtml(t.title)}</td>
        <td>${t.work_hours ?? 0}h</td>
        <td>${t.due_week || '—'}</td>
        <td>${(t.assignee_ids || []).length} assignee(s)</td>
      </tr>`,
    )
    .join('');

  return renderShell({
    activeNav: 'settings',
    body: `
      <section class="panel" style="margin-bottom:16px">
        <h2 class="omc-section-title">Workspace</h2>
        <p class="omc-lead" style="margin-bottom:12px">Workspaces isolate resource pools and cycles. People persist across cycles within a workspace and can be edited anytime.</p>
        <div class="form-grid">
          <label class="field">
            <span class="field-label">Active workspace</span>
            <select id="workspace-select-settings" class="field-input">${workspaceOptions(state.activeWorkspaceId)}</select>
          </label>
          <label class="field">
            <span class="field-label">New workspace name</span>
            <input id="new-workspace-name" class="field-input" placeholder="BP SOX" />
          </label>
          <label class="field">
            <span class="field-label">Profile</span>
            <input id="new-workspace-profile" class="field-input" placeholder="default" value="default" />
          </label>
          <div class="field" style="align-self:end">
            <button type="button" class="btn btn-refresh-solid" id="create-workspace">Create workspace</button>
          </div>
        </div>
      </section>

      <section class="panel" style="margin-bottom:16px">
        <h2 class="omc-section-title">Planning cycle</h2>
        <div class="form-grid">
          <label class="field">
            <span class="field-label">Active cycle</span>
            <select id="cycle-select" class="field-input">${cycleOptions(state.activeCycleId)}</select>
          </label>
          <label class="field">
            <span class="field-label">New cycle name</span>
            <input id="new-cycle-name" class="field-input" placeholder="FY26 SOX" />
          </label>
          <label class="field">
            <span class="field-label">Cycle type</span>
            <select id="new-cycle-type" class="field-input">
              <option value="annual">Annual</option>
              <option value="quarter">Quarter</option>
              <option value="sprint">Sprint</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Start date</span>
            <input id="new-cycle-start" class="field-input" type="date" />
          </label>
          <label class="field">
            <span class="field-label">End date</span>
            <input id="new-cycle-end" class="field-input" type="date" />
          </label>
          <div class="field" style="align-self:end">
            <button type="button" class="btn btn-refresh-solid" id="create-cycle">Create cycle</button>
          </div>
        </div>
      </section>

      <section class="panel" style="margin-bottom:16px">
        <h2 class="omc-section-title">Policy</h2>
        <div class="form-grid">
          <label class="field">
            <span class="field-label">Default weekly hours</span>
            <input id="policy-weekly" class="field-input" type="number" value="${policy.weekly_capacity_default ?? 32}" />
          </label>
          <label class="field">
            <span class="field-label">Review ratio</span>
            <input id="policy-review" class="field-input" type="number" step="0.01" value="${policy.review_ratio ?? 0.35}" />
          </label>
          <label class="field">
            <span class="field-label">Overload threshold</span>
            <input id="policy-threshold" class="field-input" type="number" step="0.05" value="${policy.overload_threshold ?? 1}" />
          </label>
          <label class="field">
            <span class="field-label">Alert proximity (days)</span>
            <input id="policy-proximity" class="field-input" type="number" value="${policy.alert_proximity_days ?? 14}" />
          </label>
          <label class="field">
            <span class="field-label">Yellow band (h remaining)</span>
            <input id="policy-yellow" class="field-input" type="number" value="${policy.band_yellow_remaining ?? 8}" />
          </label>
          <label class="field">
            <span class="field-label">Review floor hours</span>
            <input id="policy-review-floor" class="field-input" type="number" step="0.5" value="${policy.review_floor_hours ?? 0}" />
          </label>
          <div class="field" style="align-self:end">
            <button type="button" class="btn btn-ghost" id="save-policy">Save policy</button>
          </div>
        </div>
      </section>

      <section class="panel" style="margin-bottom:16px">
        <h2 class="omc-section-title">Assumptions</h2>
        <div class="form-grid" style="margin-bottom:10px">
          <label class="field field-span-2">
            <span class="field-label">New assumption</span>
            <input id="new-assumption" class="field-input" placeholder="Review ratio held at 35% for Q1" />
          </label>
          <div class="field" style="align-self:end">
            <button type="button" class="btn btn-refresh-solid" id="add-assumption">Add</button>
          </div>
        </div>
        <ul class="assumptions-list">
          ${(state.assumptions || []).map((a) => `<li>${escapeHtml(a.text)} <button type="button" class="btn btn-ghost btn-sm btn-del-assumption" data-id="${escapeHtml(a.id)}">Remove</button></li>`).join('') || '<li class="omc-lead">None yet.</li>'}
        </ul>
      </section>

      <section class="panel" style="margin-bottom:16px">
        <h2 class="omc-section-title">PTO / time off</h2>
        <div class="form-grid">
          <label class="field">
            <span class="field-label">Person</span>
            <select id="pto-resource" class="field-input">
              ${state.resources.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span class="field-label">Start</span>
            <input id="pto-start" class="field-input" type="date" />
          </label>
          <label class="field">
            <span class="field-label">End</span>
            <input id="pto-end" class="field-input" type="date" />
          </label>
          <label class="field">
            <span class="field-label">Hours/day (blank = full)</span>
            <input id="pto-hours" class="field-input" type="number" step="0.5" />
          </label>
          <div class="field" style="align-self:end">
            <button type="button" class="btn btn-refresh-solid" id="add-pto">Add PTO</button>
          </div>
        </div>
      </section>

      <section class="panel" style="margin-bottom:16px">
        <h2 class="omc-section-title">Changelog</h2>
        <ul class="changelog-list">
          ${(state.changelog || []).slice(0, 15).map((e) => `<li><span class="mono">${escapeHtml(new Date(e.created_at).toLocaleString())}</span> — ${escapeHtml(e.summary)}</li>`).join('') || '<li class="omc-lead">No changes logged yet.</li>'}
        </ul>
      </section>

      <section class="panel" style="margin-bottom:16px">
        <div class="panel-head">
          <h2 class="omc-section-title">Resources & teams</h2>
          <button type="button" class="btn btn-ghost btn-sm" id="save-resources">Save changes</button>
        </div>
        <div class="form-grid" style="margin-bottom:12px">
          <label class="field">
            <span class="field-label">Add person</span>
            <input id="new-resource-name" class="field-input" placeholder="Name" />
          </label>
          <label class="field">
            <span class="field-label">Team</span>
            <input id="new-resource-team" class="field-input" placeholder="BP" />
          </label>
          <label class="field">
            <span class="field-label">Weekly hours</span>
            <input id="new-resource-hours" class="field-input" type="number" value="32" />
          </label>
          <div class="field" style="align-self:end">
            <button type="button" class="btn btn-refresh-solid" id="add-resource">Add</button>
          </div>
        </div>
        <table class="data-table" id="resources-table">
          <thead><tr><th>Name</th><th>Team</th><th>Weekly h</th><th>Active</th></tr></thead>
          <tbody>${resourceRows || '<tr><td colspan="4">No resources yet.</td></tr>'}</tbody>
        </table>
      </section>

      <section class="panel">
        <h2 class="omc-section-title">Manual tasks</h2>
        <div class="form-grid" style="margin-bottom:12px">
          <label class="field field-span-2">
            <span class="field-label">Title</span>
            <input id="new-task-title" class="field-input" placeholder="Ad-hoc review" />
          </label>
          <label class="field">
            <span class="field-label">Work hours</span>
            <input id="new-task-hours" class="field-input" type="number" value="8" />
          </label>
          <label class="field">
            <span class="field-label">Due week</span>
            <input id="new-task-due" class="field-input" type="date" />
          </label>
          <label class="field field-span-2">
            <span class="field-label">Assignees</span>
            <select id="new-task-assignees" class="field-input" multiple size="3">
              ${state.resources.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join('')}
            </select>
          </label>
          <div class="field" style="align-self:end">
            <button type="button" class="btn btn-refresh-solid" id="add-task">Add task</button>
          </div>
        </div>
        <table class="data-table">
          <thead><tr><th>Title</th><th>Hours</th><th>Due week</th><th>Assignees</th></tr></thead>
          <tbody>${taskRows || '<tr><td colspan="4">No manual tasks yet.</td></tr>'}</tbody>
        </table>
      </section>
    `,
  });
}

function renderPlan() {
  return renderShell({
    activeNav: 'plan',
    body: renderPlanView({
      state,
      escapeHtml,
      cycleOptions,
      scenarioOptionsHtml: scenarioOptions(state.scenarios, state.activeScenarioId),
    }),
  });
}

function renderDependencies() {
  return renderShell({
    activeNav: 'dependencies',
    body: renderDependenciesView({
      state,
      escapeHtml,
      cycleOptions,
      scenarioOptionsHtml: scenarioOptions(state.scenarios, state.activeScenarioId),
    }),
  });
}

function formatWeekLabel(isoDate) {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

async function loadWorkspaces() {
  const { workspaces } = await workspacesApi.list(state.token);
  state.workspaces = workspaces;

  const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY);
  if (stored && workspaces.some((w) => w.id === stored)) {
    state.activeWorkspaceId = stored;
  } else if (workspaces.length) {
    state.activeWorkspaceId = workspaces[0].id;
    persistActiveWorkspace();
  } else {
    state.activeWorkspaceId = null;
  }
}

async function loadCoreData() {
  const token = state.token;
  if (!state.activeWorkspaceId) {
    state.cycles = [];
    state.resources = [];
    state.teams = [];
    state.policy = null;
    state.planItems = [];
    state.scenarios = [];
    state.activeScenarioId = null;
    state.activeCycleId = null;
    return;
  }

  const [{ cycles }, { resources, teams }] = await Promise.all([
    cyclesApi.list(token, state.activeWorkspaceId),
    resourcesApi.list(token, state.activeWorkspaceId),
  ]);
  state.cycles = cycles;
  state.resources = resources;
  state.teams = teams;

  if (state.activeCycleId && !cycles.some((c) => c.id === state.activeCycleId)) {
    state.activeCycleId = null;
    state.activeScenarioId = null;
  }
  if (!state.activeCycleId && cycles.length) {
    state.activeCycleId = cycles[0].id;
  }
  if (state.activeCycleId) {
    const { policy } = await policyApi.get(token, state.activeCycleId);
    state.policy = policy;
    await loadScenarioData();
  }
}

async function loadScenarioData() {
  const token = state.token;
  if (!state.activeCycleId) return;

  const { scenarios } = await scenariosApi.list(token, state.activeCycleId);
  state.scenarios = scenarios;

  const stored = localStorage.getItem(SCENARIO_STORAGE_KEY);
  if (stored && scenarios.some((s) => s.id === stored)) {
    state.activeScenarioId = stored;
  } else if (state.activeScenarioId && scenarios.some((s) => s.id === state.activeScenarioId)) {
    // keep current
  } else if (scenarios.length) {
    const active = scenarios.find((s) => s.status === 'active') || scenarios[0];
    state.activeScenarioId = active.id;
    localStorage.setItem(SCENARIO_STORAGE_KEY, active.id);
  } else {
    state.activeScenarioId = null;
  }

  if (state.activeScenarioId) {
    const { plan_items } = await planItemsApi.list(token, { scenario: state.activeScenarioId });
    state.planItems = plan_items;
  } else {
    state.planItems = [];
  }

  if (currentRoute() === 'dependencies' && state.activeCycleId && state.activeScenarioId) {
    const { dependencies, readiness } = await dependenciesApi.list(token, {
      cycle: state.activeCycleId,
      scenario: state.activeScenarioId,
    });
    state.dependencies = dependencies;
    state.readiness = readiness;
  }
}

async function loadCapacity(mode = 'due') {
  if (!state.activeCycleId) {
    state.capacity = null;
    return;
  }
  state.capacity = await capacityApi.get(state.token, {
    cycle: state.activeCycleId,
    scenario: state.activeScenarioId || undefined,
    team: state.activeTeamFilter || undefined,
    mode,
  });
  state.assumptions = state.capacity?.assumptions || state.assumptions;
}

async function loadAlerts() {
  if (!state.activeCycleId) {
    state.alerts = [];
    return;
  }
  const data = await alertsApi.list(state.token, {
    cycle: state.activeCycleId,
    scenario: state.activeScenarioId || undefined,
  });
  state.alerts = data.alerts;
  state.alertCounts = data.counts;
}

async function loadChangelog() {
  if (!state.activeCycleId) {
    state.changelog = [];
    return;
  }
  const { changelog } = await changelogApi.list(state.token, state.activeCycleId);
  state.changelog = changelog;
}

async function downloadExport(type) {
  const url = exportApi.downloadUrl({
    type,
    cycle: state.activeCycleId,
    scenario: state.activeScenarioId,
    team: state.activeTeamFilter,
    mode: document.getElementById('cap-mode')?.value || 'due',
  });
  const res = await fetch(url, { headers: { Authorization: `Bearer ${state.token}` } });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${type}-export.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function wireCycleScenarioEvents() {
  document.getElementById('cycle-select')?.addEventListener('change', async (e) => {
    state.activeCycleId = e.target.value || null;
    state.activeScenarioId = null;
    await refreshView();
  });

  document.getElementById('scenario-select')?.addEventListener('change', async (e) => {
    state.activeScenarioId = e.target.value || null;
    if (state.activeScenarioId) localStorage.setItem(SCENARIO_STORAGE_KEY, state.activeScenarioId);
    await loadScenarioData();
    if (currentRoute() === 'capacity') await loadCapacity(document.getElementById('cap-mode')?.value || 'due');
    if (currentRoute() === 'dependencies') {
      const { dependencies, readiness } = await dependenciesApi.list(state.token, {
        cycle: state.activeCycleId,
        scenario: state.activeScenarioId,
      });
      state.dependencies = dependencies;
      state.readiness = readiness;
    }
    render();
  });
}

function wireWorkspaceEvents() {
  const onSwitch = async (workspaceId) => {
    if (!workspaceId || workspaceId === state.activeWorkspaceId) return;
    state.activeWorkspaceId = workspaceId;
    state.activeCycleId = null;
    state.activeScenarioId = null;
    state.capacity = null;
    persistActiveWorkspace();
    await refreshView();
  };

  document.getElementById('workspace-select')?.addEventListener('change', (e) => onSwitch(e.target.value));
  document.getElementById('workspace-select-settings')?.addEventListener('change', (e) => onSwitch(e.target.value));

  document.getElementById('create-workspace')?.addEventListener('click', async () => {
    const name = document.getElementById('new-workspace-name')?.value?.trim();
    if (!name) return;
    const profile = document.getElementById('new-workspace-profile')?.value?.trim() || 'default';
    const { workspace } = await workspacesApi.create(state.token, { name, profile });
    state.activeWorkspaceId = workspace.id;
    state.activeCycleId = null;
    persistActiveWorkspace();
    await refreshView();
  });
}

function wireSettingsEvents() {
  wireWorkspaceEvents();

  document.getElementById('create-cycle')?.addEventListener('click', async () => {
    if (!state.activeWorkspaceId) return;
    const name = document.getElementById('new-cycle-name')?.value?.trim();
    if (!name) return;
    const result = await cyclesApi.create(state.token, state.activeWorkspaceId, {
      name,
      cycle_type: document.getElementById('new-cycle-type')?.value || 'annual',
      start_date: document.getElementById('new-cycle-start')?.value || null,
      end_date: document.getElementById('new-cycle-end')?.value || null,
    });
    state.activeCycleId = result.cycle.id;
    state.activeScenarioId = result.default_scenario_id;
    await refreshView();
  });

  document.getElementById('cycle-select')?.addEventListener('change', async (e) => {
    state.activeCycleId = e.target.value || null;
    state.activeScenarioId = null;
    await refreshView();
  });

  document.getElementById('save-policy')?.addEventListener('click', async () => {
    if (!state.activeCycleId) return;
    const config = {
      weekly_capacity_default: Number(document.getElementById('policy-weekly').value),
      review_ratio: Number(document.getElementById('policy-review').value),
      overload_threshold: Number(document.getElementById('policy-threshold').value),
      alert_proximity_days: Number(document.getElementById('policy-proximity').value),
      band_yellow_remaining: Number(document.getElementById('policy-yellow').value),
      review_floor_hours: Number(document.getElementById('policy-review-floor').value),
      spread_lag_weeks: state.policy?.config?.spread_lag_weeks ?? 0,
      working_days_per_week: state.policy?.config?.working_days_per_week ?? 5,
      band_red_remaining: state.policy?.config?.band_red_remaining ?? 0,
      review_lag_days: state.policy?.config?.review_lag_days ?? 7,
    };
    const { policy } = await policyApi.update(state.token, state.activeCycleId, config);
    state.policy = policy;
    await refreshView();
  });

  document.getElementById('add-assumption')?.addEventListener('click', async () => {
    const text = document.getElementById('new-assumption')?.value?.trim();
    if (!text || !state.activeCycleId) return;
    await assumptionsApi.create(state.token, { cycle_id: state.activeCycleId, text });
    await refreshView();
  });

  document.querySelectorAll('.btn-del-assumption').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await assumptionsApi.delete(state.token, btn.dataset.id);
      await refreshView();
    });
  });

  document.getElementById('add-pto')?.addEventListener('click', async () => {
    if (!state.activeWorkspaceId) return;
    await timeOffApi.create(state.token, state.activeWorkspaceId, {
      resource_id: document.getElementById('pto-resource')?.value,
      start_date: document.getElementById('pto-start')?.value,
      end_date: document.getElementById('pto-end')?.value,
      hours_per_day: document.getElementById('pto-hours')?.value || null,
      reason: 'PTO',
    });
    await refreshView();
  });

  document.getElementById('add-resource')?.addEventListener('click', async () => {
    const name = document.getElementById('new-resource-name')?.value?.trim();
    if (!name) return;
    await resourcesApi.create(state.token, state.activeWorkspaceId, {
      name,
      team: document.getElementById('new-resource-team')?.value?.trim() || null,
      weekly_hours: Number(document.getElementById('new-resource-hours')?.value || 32),
    });
    await refreshView();
  });

  document.getElementById('save-resources')?.addEventListener('click', async () => {
    const rows = [...document.querySelectorAll('#resources-table tbody tr[data-id]')];
    const resources = rows.map((row) => ({
      id: row.dataset.id,
      name: row.querySelector('[data-field="name"]')?.value,
      team: row.querySelector('[data-field="team"]')?.value || null,
      active: row.querySelector('[data-field="active"]')?.checked,
      weekly_hours: Number(row.querySelector('[data-field="weekly_hours"]')?.value || 0) || null,
    }));
    await resourcesApi.patch(state.token, state.activeWorkspaceId, resources);
    await refreshView();
  });

  document.getElementById('add-task')?.addEventListener('click', async () => {
    if (!state.activeCycleId) return;
    const title = document.getElementById('new-task-title')?.value?.trim();
    if (!title) return;
    const assigneeSelect = document.getElementById('new-task-assignees');
    const assignee_ids = [...assigneeSelect.selectedOptions].map((o) => o.value);
    if (!state.activeScenarioId) await loadScenarioData();
    await planItemsApi.create(state.token, {
      cycle_id: state.activeCycleId,
      scenario_id: state.activeScenarioId,
      title,
      work_hours: Number(document.getElementById('new-task-hours')?.value || 0),
      due_week: document.getElementById('new-task-due')?.value || null,
      assignee_ids,
    });
    await refreshView();
  });
}

function wirePlanEvents() {
  wireWorkspaceEvents();
  wireCycleScenarioEvents();

  document.getElementById('add-plan-item')?.addEventListener('click', async () => {
    if (!state.activeCycleId || !state.activeScenarioId) return;
    const title = document.getElementById('new-item-title')?.value?.trim();
    if (!title) return;
    await planItemsApi.create(state.token, {
      cycle_id: state.activeCycleId,
      scenario_id: state.activeScenarioId,
      title,
      phase: document.getElementById('new-item-phase')?.value?.trim() || null,
      work_hours: Number(document.getElementById('new-item-hours')?.value || 0),
      due_week: document.getElementById('new-item-due')?.value || null,
    });
    await loadScenarioData();
    render();
  });

  document.getElementById('save-plan-items')?.addEventListener('click', async () => {
    const rows = [...document.querySelectorAll('#plan-items-table tbody tr[data-id]')];
    const plan_items = rows.map((row) => ({
      id: row.dataset.id,
      title: row.querySelector('[data-field="title"]')?.value,
      phase: row.querySelector('[data-field="phase"]')?.value || null,
      work_hours: Number(row.querySelector('[data-field="work_hours"]')?.value || 0),
      review_hours: Number(row.querySelector('[data-field="review_hours"]')?.value || 0),
      due_week: row.querySelector('[data-field="due_week"]')?.value || null,
    }));
    await planItemsApi.patch(state.token, plan_items);
    await loadScenarioData();
    render();
  });

  document.querySelectorAll('.btn-delete-item').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.closest('tr')?.dataset?.id;
      if (!id) return;
      await planItemsApi.delete(state.token, id);
      await loadScenarioData();
      render();
    });
  });

  document.getElementById('create-scenario')?.addEventListener('click', async () => {
    const name = prompt('Scenario name (e.g. Draft v2):');
    if (!name || !state.activeCycleId) return;
    const clone = state.activeScenarioId
      ? confirm('Clone plan items from current scenario?')
      : false;
    await scenariosApi.create(state.token, {
      cycle_id: state.activeCycleId,
      name,
      clone_from_scenario_id: clone ? state.activeScenarioId : undefined,
    });
    await loadScenarioData();
    render();
  });

  document.getElementById('preview-import')?.addEventListener('click', async () => {
    const csv_text = document.getElementById('import-csv')?.value;
    if (!csv_text || !state.activeCycleId || !state.activeScenarioId) return;
    state.importPreview = await importApi.preview(state.token, {
      cycle_id: state.activeCycleId,
      scenario_id: state.activeScenarioId,
      csv_text,
    });
    render();
  });

  document.getElementById('confirm-import')?.addEventListener('click', async () => {
    const csv_text = document.getElementById('import-csv')?.value;
    if (!csv_text) return;
    await importApi.commit(state.token, {
      cycle_id: state.activeCycleId,
      scenario_id: state.activeScenarioId,
      csv_text,
    });
    state.importPreview = null;
    await loadScenarioData();
    render();
  });

  document.getElementById('cancel-import')?.addEventListener('click', () => {
    state.importPreview = null;
    render();
  });

  document.getElementById('export-plan')?.addEventListener('click', async () => {
    try {
      await downloadExport('plan');
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById('check-drift')?.addEventListener('click', async () => {
    const data = await exportApi.drift(state.token, {
      cycle: state.activeCycleId,
      scenario: state.activeScenarioId,
    });
    state.drift = data;
    alert(`Drift vs last import: +${data.added} / ~${data.modified} / -${data.removed}`);
  });
}

function wireAlertsEvents() {
  wireWorkspaceEvents();
  wireCycleScenarioEvents();
  document.getElementById('refresh-alerts')?.addEventListener('click', async () => {
    await loadAlerts();
    render();
  });
}

function renderAlerts() {
  return renderShell({
    activeNav: 'alerts',
    body: renderAlertsView({
      state,
      escapeHtml,
      cycleOptions,
      scenarioOptionsHtml: scenarioOptions(state.scenarios, state.activeScenarioId),
    }),
  });
}

function wireDependencyEvents() {
  wireWorkspaceEvents();
  wireCycleScenarioEvents();

  document.getElementById('add-dependency')?.addEventListener('click', async () => {
    if (!state.activeCycleId) return;
    const toId = document.getElementById('new-dep-to')?.value;
    if (!toId) return;
    const fromId = document.getElementById('new-dep-from')?.value || null;
    await dependenciesApi.create(state.token, {
      cycle_id: state.activeCycleId,
      to_plan_item_id: toId,
      from_plan_item_id: fromId,
      dep_type: document.getElementById('new-dep-type')?.value,
      label: document.getElementById('new-dep-label')?.value?.trim() || null,
    });
    await loadScenarioData();
    render();
  });

  document.getElementById('save-dependencies')?.addEventListener('click', async () => {
    const rows = [...document.querySelectorAll('#dependencies-table tbody tr[data-id]')];
    const dependencies = rows.map((row) => ({
      id: row.dataset.id,
      status: row.querySelector('[data-field="status"]')?.value,
    }));
    await dependenciesApi.patch(state.token, dependencies);
    await loadScenarioData();
    render();
  });

  document.querySelectorAll('.btn-delete-dep').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.closest('tr')?.dataset?.id;
      if (!id) return;
      await dependenciesApi.delete(state.token, id);
      await loadScenarioData();
      render();
    });
  });
}

function wireCapacityEvents() {
  wireWorkspaceEvents();
  wireCycleScenarioEvents();

  document.querySelectorAll('.team-tab').forEach((tab) => {
    tab.addEventListener('click', async () => {
      state.activeTeamFilter = tab.dataset.team || '';
      const mode = document.getElementById('cap-mode')?.value || 'due';
      await loadCapacity(mode);
      render();
    });
  });

  document.getElementById('export-capacity')?.addEventListener('click', async () => {
    try {
      await downloadExport('capacity');
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById('cap-mode')?.addEventListener('change', async (e) => {
    await loadCapacity(e.target.value);
    render();
  });
  document.getElementById('refresh-capacity')?.addEventListener('click', async () => {
    const mode = document.getElementById('cap-mode')?.value || 'due';
    await loadCapacity(mode);
    render();
  });
}

async function refreshView() {
  await loadCoreData();
  const route = currentRoute();
  if (route === 'capacity') {
    const mode = document.getElementById('cap-mode')?.value || 'due';
    await loadCapacity(mode);
  }
  if (route === 'dependencies') await loadScenarioData();
  if (route === 'alerts') await loadAlerts();
  if (route === 'settings') await loadChangelog();
  if (state.activeCycleId) {
    const { assumptions } = await assumptionsApi.list(state.token, state.activeCycleId);
    state.assumptions = assumptions;
  }
  render();
}

function render() {
  const root = document.getElementById('app-root');
  const route = currentRoute();
  let html;
  if (route === 'plan') html = renderPlan();
  else if (route === 'dependencies') html = renderDependencies();
  else if (route === 'alerts') html = renderAlerts();
  else if (route === 'capacity') html = renderCapacity();
  else if (route === 'settings') html = renderSettings();
  else html = renderHome();
  root.innerHTML = html;
  wireAuthLink(state.auth);

  if (route === 'settings') wireSettingsEvents();
  else if (route === 'plan') wirePlanEvents();
  else if (route === 'dependencies') wireDependencyEvents();
  else if (route === 'capacity') wireCapacityEvents();
  else if (route === 'alerts') wireAlertsEvents();
  else wireWorkspaceEvents();
}

async function boot() {
  const root = document.getElementById('app-root');
  const auth = await initAuth();
  state.auth = auth;

  if (auth.configured && auth.user && !auth.token) {
    await refreshToken(auth);
  }

  try {
    if (!auth.signedIn || !auth.token) {
      root.innerHTML = renderSignInPrompt(auth);
      wireAuthLink(auth);
      return;
    }

    state.token = auth.token;
    state.me = await meApi.get(auth.token);
    await loadWorkspaces();
    await loadCoreData();

    window.addEventListener('hashchange', async () => {
      const route = currentRoute();
      if (route === 'capacity') await loadCapacity('due');
      if (route === 'dependencies') await loadScenarioData();
      if (route === 'alerts') await loadAlerts();
      render();
    });

    const route = currentRoute();
    if (route === 'capacity') await loadCapacity('due');
    if (route === 'dependencies') await loadScenarioData();
    if (route === 'alerts') await loadAlerts();
    if (state.activeCycleId) {
      const { assumptions } = await assumptionsApi.list(state.token, state.activeCycleId);
      state.assumptions = assumptions;
    }
    render();
  } catch (err) {
    console.error(err);
    if (err.status === 401 && auth.configured) {
      auth.signedIn = false;
      auth.needsReauth = !!auth.user;
      root.innerHTML = renderSignInPrompt(auth);
      wireAuthLink(auth);
      return;
    }
    root.innerHTML = `<section class="panel"><p class="omc-error">${escapeHtml(err.message || 'Something went wrong.')}</p></section>`;
    wireAuthLink(auth);
  }
}

boot();
