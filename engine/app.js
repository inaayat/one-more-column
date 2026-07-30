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
  changelogApi,
  alertsApi,
  exportApi,
  timeOffApi,
} from './api.js';
import {
  scenarioOptions,
  renderHomeView,
  renderSetupProgressBanner,
  setupSectionClass,
  renderPlanningCta,
  renderPlannerView,
  renderDependenciesView,
  renderAlertsView,
  openGatesBlock,
  teamTabs,
  capacityCellClass,
} from './views.js';
import { getSetupProgress, getInitialRoute, resolveRoute, navItems, normalizeRoute } from './setup.js';

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
  changelog: [],
  alerts: [],
  alertCounts: { high: 0, medium: 0, low: 0 },
  activeTeamFilter: '',
  capacityGranularity: 'week',
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
  const hash = location.hash.replace(/^#\/?/, '') || '';
  const route = hash.split('?')[0] || 'planner';
  return normalizeRoute(route);
}

function navigate(route) {
  location.hash = `#/${route}`;
}

function activeWorkspace() {
  return state.workspaces.find((w) => w.id === state.activeWorkspaceId) || null;
}

function confirmDelete(label) {
  return window.confirm(`Delete ${label}? This cannot be undone.`);
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

function renderShell({ body, activeNav = 'planner' }) {
  const items = navItems(state);
  const nav = items
    .map((item) => {
      const cls = [
        'nav-link',
        activeNav === item.id ? 'active' : '',
        item.highlight ? 'nav-link-next' : '',
      ]
        .filter(Boolean)
        .join(' ');
      const dot = item.highlight ? '<span class="nav-link-dot" aria-hidden="true"></span>' : '';
      return `<a href="#/${item.id}" class="${cls}">${item.label}${dot}</a>`;
    })
    .join('');

  const user = state.me?.user || state.auth?.user || {};
  const displayName = user.name || user.email || 'Signed in';
  const avatar = initials(user.name, user.email);

  const contentClass =
    activeNav === 'settings' ? 'content content-setup' : 'content content-wide';

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
      <div class="${contentClass}">${body}</div>
    </main>
  `;
}

function renderSignInPrompt(auth) {
  const loginHref = `/account.html?next=${encodeURIComponent(location.pathname || APP_PATH)}`;
  const reauthNote = auth.needsReauth
    ? '<div class="token-banner expired"><div><strong>Session expired.</strong> Sign in again to continue.</div></div>'
    : '';

  return `
    <main class="main">
      <div class="content content-centered">
        ${reauthNote}
        <section class="panel">
          <h1 class="omc-title">One More Column</h1>
          <p class="omc-lead">Sign in with the same account you use for AMC A-Lister.</p>
          <p style="margin-top:16px">
            <a class="btn btn-refresh-solid" href="${loginHref}">Sign in</a>
          </p>
        </section>
      </div>
    </main>
  `;
}

function cycleOptions(selectedId) {
  if (!state.cycles.length) {
    return '<option value="">No period yet — create one in Setup</option>';
  }
  return state.cycles
    .map((c) => {
      const typeLabel = c.cycle_type && c.cycle_type !== 'annual' ? ` (${c.cycle_type})` : '';
      return `<option value="${escapeHtml(c.id)}"${c.id === selectedId ? ' selected' : ''}>${escapeHtml(c.name)}${escapeHtml(typeLabel)}</option>`;
    })
    .join('');
}

function renderHome() {
  return renderShell({
    activeNav: 'home',
    body: renderHomeView({ state, escapeHtml }),
  });
}

function renderCapacity() {
  const grid = state.capacity;
  if (!state.activeCycleId) {
    return renderShell({
      activeNav: 'capacity',
      body: `<section class="panel"><p class="omc-lead">Finish setup first — add a time period on the Setup page.</p></section>`,
    });
  }

  if (!grid) {
    return renderShell({
      activeNav: 'capacity',
      body: `<section class="panel"><p class="omc-lead">Loading capacity…</p></section>`,
    });
  }

  const granularity = grid.granularity || state.capacityGranularity || 'week';
  const periodHeaders = grid.weeks
    .map((w) => `<th class="cap-week">${escapeHtml(formatPeriodLabel(w, granularity))}</th>`)
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
            <p class="omc-lead">See how many hours each person has each week or month. Green means they have room; red means they are overloaded.</p>
          </div>
          <div class="btn-row">
            <select id="cycle-select" class="field-input">${cycleOptions(state.activeCycleId)}</select>
            <select id="scenario-select" class="field-input">${scenarioOptions(state.scenarios, state.activeScenarioId)}</select>
            <div class="view-toggle view-toggle-sm" role="group" aria-label="Time granularity">
              <button type="button" class="view-toggle-btn${granularity === 'week' ? ' active' : ''}" id="cap-granularity-week">Weeks</button>
              <button type="button" class="view-toggle-btn${granularity === 'month' ? ' active' : ''}" id="cap-granularity-month">Months</button>
            </div>
            <select id="cap-mode" class="field-input">
              <option value="due"${grid.mode === 'due' ? ' selected' : ''}>Due week</option>
              <option value="spread"${grid.mode === 'spread' ? ' selected' : ''}>Spread</option>
            </select>
            <button type="button" class="btn btn-ghost btn-sm" id="export-capacity">Export CSV</button>
            <button type="button" class="btn btn-ghost btn-sm" id="refresh-capacity">Refresh</button>
          </div>
        </div>
        ${openGatesBlock(state, escapeHtml)}
        ${teamTabs(grid.teams || state.teams, state.activeTeamFilter, escapeHtml)}
        <div class="cap-legend">
          <span><span class="legend-dot ok"></span> Green — comfortable</span>
          <span><span class="legend-dot warn"></span> Yellow — tight</span>
          <span><span class="legend-dot bad"></span> Red — overloaded</span>
          <span class="cap-legend-note">Cells show load (top) and remaining hours (bottom)</span>
        </div>
        <div class="cap-scroll">
          <table class="cap-table">
            <thead><tr><th class="cap-person">Person</th>${periodHeaders}</tr></thead>
            <tbody>${rows || '<tr><td colspan="99">No active resources. Add people in Settings.</td></tr>'}</tbody>
          </table>
        </div>
      </section>
    `,
  });
}

function formatPtoChip(entry, escapeHtml) {
  const start = String(entry.start_date).slice(0, 10);
  const end = String(entry.end_date).slice(0, 10);
  const hrs = entry.hours_per_day != null ? `${entry.hours_per_day}h/day` : 'full day';
  return `<span class="pto-chip">${escapeHtml(start)} → ${escapeHtml(end)} (${escapeHtml(hrs)}) <button type="button" class="btn btn-ghost btn-sm btn-del-pto" data-id="${escapeHtml(entry.id)}" title="Remove PTO">×</button></span>`;
}

function renderSettings() {
  const policy = state.policy?.config || {};
  const progress = getSetupProgress(state);
  const resourceRows = state.resources
    .map(
      (r) => `
      <tr data-id="${escapeHtml(r.id)}">
        <td><input class="field-input field-sm" data-field="name" value="${escapeHtml(r.name)}" /></td>
        <td><input class="field-input field-sm" data-field="team" value="${escapeHtml(r.team || '')}" placeholder="Team" /></td>
        <td><input class="field-input field-sm" data-field="weekly_hours" type="number" step="0.5" placeholder="32" value="${r.profiles?.[0]?.weekly_hours ?? ''}" /></td>
        <td class="pto-cell">${(r.time_off || []).map((t) => formatPtoChip(t, escapeHtml)).join('') || '<span class="omc-lead">—</span>'}</td>
        <td><label class="check-label"><input type="checkbox" data-field="active" ${r.active ? 'checked' : ''} /> Active</label></td>
        <td><button type="button" class="btn btn-ghost btn-sm btn-delete-resource" title="Remove person">×</button></td>
      </tr>`,
    )
    .join('');

  return renderShell({
    activeNav: 'settings',
    body: `
      ${renderSetupProgressBanner(state)}
      <div class="setup-steps-row">
      <section id="setup-workspace" class="${setupSectionClass(progress, 'setup-workspace')}">
        <h2 class="omc-section-title">1. Name your team area</h2>
        <p class="omc-lead" style="margin-bottom:12px">A workspace is your team’s own planning space — separate from other teams. If you already see a name below (like “Default workspace”), you can keep it and move to step 2.</p>
        <div class="form-grid setup-form-grid">
          <label class="field">
            <span class="field-label">Your team area</span>
            <select id="workspace-select-settings" class="field-input">${workspaceOptions(state.activeWorkspaceId)}</select>
          </label>
          <label class="field">
            <span class="field-label">Or create a new one</span>
            <input id="new-workspace-name" class="field-input" placeholder="e.g. Engineering team" />
          </label>
          <label class="field">
            <span class="field-label">Type (optional)</span>
            <input id="new-workspace-profile" class="field-input" placeholder="default" value="default" title="Leave as default unless you were told otherwise" />
          </label>
          <div class="field" style="align-self:end">
            <button type="button" class="btn btn-refresh-solid" id="create-workspace">Create team area</button>
          </div>
        </div>
        ${state.workspaces.length > 1 && state.activeWorkspaceId ? `
        <div class="btn-row" style="margin-top:12px">
          <button type="button" class="btn btn-ghost btn-sm" id="delete-workspace">Delete this team area</button>
        </div>` : ''}
      </section>

      <section id="setup-cycle" class="${setupSectionClass(progress, 'setup-cycle')}">
        <h2 class="omc-section-title">2. Choose the time period</h2>
        <p class="omc-lead" style="margin-bottom:12px">What stretch of time is this plan for? A quarter, a sprint, or a full year. Pick start and end dates so the calendar lines up.</p>
        <div class="form-grid setup-form-grid">
          <label class="field">
            <span class="field-label">Current period</span>
            <select id="cycle-select" class="field-input">${cycleOptions(state.activeCycleId)}</select>
          </label>
          <label class="field">
            <span class="field-label">Name this period</span>
            <input id="new-cycle-name" class="field-input" placeholder="e.g. Q1 2026" />
          </label>
          <label class="field">
            <span class="field-label">Kind of period</span>
            <select id="new-cycle-type" class="field-input">
              <option value="annual">Full year</option>
              <option value="quarter">Quarter</option>
              <option value="sprint">Sprint (short)</option>
              <option value="custom">Other</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Starts</span>
            <input id="new-cycle-start" class="field-input" type="date" />
          </label>
          <label class="field">
            <span class="field-label">Ends</span>
            <input id="new-cycle-end" class="field-input" type="date" />
          </label>
          <div class="field" style="align-self:end">
            <button type="button" class="btn btn-refresh-solid" id="create-cycle">Create this period</button>
          </div>
        </div>
        ${state.activeCycleId ? `
        <div class="btn-row" style="margin-top:12px">
          <button type="button" class="btn btn-ghost btn-sm" id="delete-cycle">Delete this period</button>
        </div>` : ''}
      </section>

      <section id="setup-people" class="${setupSectionClass(progress, 'setup-people')}">
        <div class="panel-head">
          <h2 class="omc-section-title">3. Add your team (for capacity)</h2>
          <button type="button" class="btn btn-ghost btn-sm" id="save-resources">Save names</button>
        </div>
        <p class="omc-lead" style="margin-bottom:12px">Who will do the work? Add names and weekly hours so Capacity can show overload. You can skip this until after you list work in Planner.</p>
        <div class="form-grid setup-form-grid" style="margin-bottom:12px">
          <label class="field">
            <span class="field-label">Name</span>
            <input id="new-resource-name" class="field-input" placeholder="e.g. Alex" />
          </label>
          <label class="field">
            <span class="field-label">Team (optional)</span>
            <input id="new-resource-team" class="field-input" placeholder="e.g. Engineering" />
          </label>
          <label class="field">
            <span class="field-label">Hours per week</span>
            <input id="new-resource-hours" class="field-input" type="number" value="32" />
          </label>
          <label class="field">
            <span class="field-label">PTO starts (optional)</span>
            <input id="new-resource-pto-start" class="field-input" type="date" />
          </label>
          <label class="field">
            <span class="field-label">PTO ends (optional)</span>
            <input id="new-resource-pto-end" class="field-input" type="date" />
          </label>
          <label class="field">
            <span class="field-label">PTO hours/day (blank = full)</span>
            <input id="new-resource-pto-hours" class="field-input" type="number" step="0.5" />
          </label>
          <div class="field" style="align-self:end">
            <button type="button" class="btn btn-refresh-solid" id="add-resource">Add person</button>
          </div>
        </div>
        ${state.resources.length ? `
        <details class="setup-pto-more">
          <summary class="omc-lead">Add PTO for someone already listed</summary>
          <div class="form-grid setup-form-grid" style="margin-top:10px">
            <label class="field">
              <span class="field-label">Person</span>
              <select id="pto-resource" class="field-input">
                ${state.resources.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join('')}
              </select>
            </label>
            <label class="field">
              <span class="field-label">Starts</span>
              <input id="pto-start" class="field-input" type="date" />
            </label>
            <label class="field">
              <span class="field-label">Ends</span>
              <input id="pto-end" class="field-input" type="date" />
            </label>
            <label class="field">
              <span class="field-label">Hours/day (blank = full)</span>
              <input id="pto-hours" class="field-input" type="number" step="0.5" />
            </label>
            <div class="field" style="align-self:end">
              <button type="button" class="btn btn-ghost" id="add-pto">Add PTO</button>
            </div>
          </div>
        </details>
        ` : ''}
        <div class="setup-table-scroll">
        <table class="data-table" id="resources-table">
          <thead><tr><th>Name</th><th>Team</th><th>Weekly h</th><th>PTO</th><th>Active</th><th></th></tr></thead>
          <tbody>${resourceRows || '<tr><td colspan="6">No one added yet — use the form above.</td></tr>'}</tbody>
        </table>
        </div>
      </section>
      </div>

      ${renderPlanningCta(state)}

      <p class="setup-optional-label omc-lead">Optional — you can skip these until later</p>

      <div class="setup-optional-row setup-optional-row-2">
      <section class="panel">
        <h2 class="omc-section-title">Planning rules</h2>
        <p class="omc-lead" style="margin-bottom:12px">Defaults for hours and overload warnings. Most people can leave these as-is.</p>
        <div class="form-grid setup-form-grid">
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

      <section class="panel">
        <h2 class="omc-section-title">Changelog</h2>
        <ul class="changelog-list">
          ${(state.changelog || []).slice(0, 15).map((e) => `<li><span class="mono">${escapeHtml(new Date(e.created_at).toLocaleString())}</span> — ${escapeHtml(e.summary)}</li>`).join('') || '<li class="omc-lead">No changes logged yet.</li>'}
        </ul>
      </section>
      </div>
    `,
  });
}

function renderPlanner() {
  return renderShell({
    activeNav: 'planner',
    body: renderPlannerView({
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

function formatPeriodLabel(key, granularity = 'week') {
  if (granularity === 'month' && /^\d{4}-\d{2}$/.test(key)) {
    const [year, month] = key.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  return formatWeekLabel(key);
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

async function loadPlannerData() {
  if (!state.activeCycleId || !state.activeScenarioId) {
    state.dependencies = [];
    state.readiness = [];
    return;
  }
  const { dependencies, readiness } = await dependenciesApi.list(state.token, {
    cycle: state.activeCycleId,
    scenario: state.activeScenarioId,
  });
  state.dependencies = dependencies;
  state.readiness = readiness;
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
    await loadPlannerData();
  } else {
    state.planItems = [];
    state.dependencies = [];
    state.readiness = [];
  }
}

async function loadCapacity(mode = 'due', granularity = state.capacityGranularity) {
  if (!state.activeCycleId) {
    state.capacity = null;
    return;
  }
  state.capacity = await capacityApi.get(state.token, {
    cycle: state.activeCycleId,
    scenario: state.activeScenarioId || undefined,
    team: state.activeTeamFilter || undefined,
    mode,
    granularity,
  });
  state.capacityGranularity = granularity;
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
    if (currentRoute() === 'capacity') {
      await loadCapacity(
        document.getElementById('cap-mode')?.value || 'due',
        state.capacityGranularity,
      );
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

  document.getElementById('delete-workspace')?.addEventListener('click', async () => {
    if (!state.activeWorkspaceId || state.workspaces.length <= 1) return;
    const name = activeWorkspace()?.name || 'this team area';
    if (!confirmDelete(name)) return;
    await workspacesApi.delete(state.token, state.activeWorkspaceId);
    state.activeWorkspaceId = null;
    state.activeCycleId = null;
    state.activeScenarioId = null;
    localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    await refreshView();
  });

  document.getElementById('delete-cycle')?.addEventListener('click', async () => {
    if (!state.activeWorkspaceId || !state.activeCycleId) return;
    const cycle = state.cycles.find((c) => c.id === state.activeCycleId);
    if (!confirmDelete(cycle?.name || 'this period')) return;
    await cyclesApi.delete(state.token, state.activeWorkspaceId, state.activeCycleId);
    state.activeCycleId = null;
    state.activeScenarioId = null;
    await refreshView();
  });

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
    if (getSetupProgress(state).planningReady) navigate('planner');
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

  document.getElementById('add-pto')?.addEventListener('click', async () => {
    if (!state.activeWorkspaceId) return;
    const start = document.getElementById('pto-start')?.value;
    const end = document.getElementById('pto-end')?.value;
    if (!start || !end) return;
    await timeOffApi.create(state.token, state.activeWorkspaceId, {
      resource_id: document.getElementById('pto-resource')?.value,
      start_date: start,
      end_date: end,
      hours_per_day: document.getElementById('pto-hours')?.value || null,
      reason: 'PTO',
    });
    await refreshView();
  });

  document.querySelectorAll('.btn-del-pto').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirmDelete('this PTO entry')) return;
      await timeOffApi.delete(state.token, btn.dataset.id);
      await refreshView();
    });
  });

  document.querySelectorAll('.btn-delete-resource').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('tr');
      const id = row?.dataset?.id;
      const name = row?.querySelector('[data-field="name"]')?.value?.trim() || 'this person';
      if (!id || !confirmDelete(name)) return;
      await resourcesApi.delete(state.token, state.activeWorkspaceId, id);
      await refreshView();
    });
  });

  document.getElementById('add-resource')?.addEventListener('click', async () => {
    const name = document.getElementById('new-resource-name')?.value?.trim();
    if (!name) return;
    const { resource } = await resourcesApi.create(state.token, state.activeWorkspaceId, {
      name,
      team: document.getElementById('new-resource-team')?.value?.trim() || null,
      weekly_hours: Number(document.getElementById('new-resource-hours')?.value || 32),
    });
    const ptoStart = document.getElementById('new-resource-pto-start')?.value;
    const ptoEnd = document.getElementById('new-resource-pto-end')?.value;
    if (resource?.id && ptoStart && ptoEnd) {
      await timeOffApi.create(state.token, state.activeWorkspaceId, {
        resource_id: resource.id,
        start_date: ptoStart,
        end_date: ptoEnd,
        hours_per_day: document.getElementById('new-resource-pto-hours')?.value || null,
        reason: 'PTO',
      });
    }
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

}

function wirePlannerEvents() {
  wireWorkspaceEvents();
  wireCycleScenarioEvents();

  async function switchScenarioMode(mode) {
    if (!state.scenarios.length) return;
    if (mode === 'live') {
      const live = state.scenarios.find((s) => s.status === 'active');
      if (live) state.activeScenarioId = live.id;
    } else {
      const draft = state.scenarios.find((s) => s.status === 'draft') || state.scenarios[0];
      state.activeScenarioId = draft.id;
    }
    if (state.activeScenarioId) localStorage.setItem(SCENARIO_STORAGE_KEY, state.activeScenarioId);
    await loadScenarioData();
    render();
  }

  document.getElementById('mode-draft')?.addEventListener('click', () => switchScenarioMode('draft'));
  document.getElementById('mode-live')?.addEventListener('click', () => switchScenarioMode('live'));

  document.getElementById('delete-scenario')?.addEventListener('click', async () => {
    if (!state.activeScenarioId || state.scenarios.length <= 1) return;
    const scenario = state.scenarios.find((s) => s.id === state.activeScenarioId);
    if (!confirmDelete(`scenario "${scenario?.name || 'scenario'}"`)) return;
    await scenariosApi.delete(state.token, state.activeScenarioId);
    state.activeScenarioId = null;
    localStorage.removeItem(SCENARIO_STORAGE_KEY);
    await loadScenarioData();
    render();
  });

  document.getElementById('finalize-scenario')?.addEventListener('click', async () => {
    if (!state.activeScenarioId) return;
    await scenariosApi.patch(state.token, { id: state.activeScenarioId, status: 'active' });
    await loadScenarioData();
    render();
  });

  document.getElementById('add-plan-item')?.addEventListener('click', async () => {
    if (!state.activeCycleId || !state.activeScenarioId) return;
    const title = document.getElementById('new-item-title')?.value?.trim();
    if (!title) return;
    const days = document.getElementById('new-item-days')?.value;
    const taskType = document.getElementById('new-item-type')?.value || 'general';
    const attributes = { task_type: taskType };
    if (days) attributes.duration_days = Number(days);
    await planItemsApi.create(state.token, {
      cycle_id: state.activeCycleId,
      scenario_id: state.activeScenarioId,
      title,
      work_hours: Number(document.getElementById('new-item-hours')?.value || 0),
      due_week: document.getElementById('new-item-due')?.value || null,
      attributes,
    });
    await loadScenarioData();
    render();
  });

  document.getElementById('save-planner')?.addEventListener('click', async () => {
    await savePlannerGrid();
  });

  document.querySelectorAll('.planner-row').forEach((row) => {
    row.querySelector('.btn-delete-item')?.addEventListener('click', async () => {
      const id = row.dataset.id;
      const title = row.querySelector('[data-field="title"]')?.value?.trim() || 'this row';
      if (!id || !confirmDelete(title)) return;
      await planItemsApi.delete(state.token, id);
      await loadScenarioData();
      render();
    });
    row.querySelector('.btn-delete-dep')?.addEventListener('click', async () => {
      const id = row.dataset.depId;
      if (!id || !confirmDelete('this gate')) return;
      await dependenciesApi.delete(state.token, id);
      await loadScenarioData();
      render();
    });
    row.querySelector('.btn-add-gate')?.addEventListener('click', async () => {
      const toId = row.dataset.id;
      if (!toId || !state.activeCycleId) return;
      await dependenciesApi.create(state.token, {
        cycle_id: state.activeCycleId,
        to_plan_item_id: toId,
        dep_type: 'input_ready',
        label: 'New gate',
      });
      await loadScenarioData();
      render();
    });
  });

  document.querySelectorAll('.planner-subrow .btn-delete-dep').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.closest('tr')?.dataset?.depId;
      if (!id || !confirmDelete('this gate')) return;
      await dependenciesApi.delete(state.token, id);
      await loadScenarioData();
      render();
    });
  });

  document.getElementById('create-scenario')?.addEventListener('click', async () => {
    const name = prompt('Draft name (e.g. What-if v2):');
    if (!name || !state.activeCycleId) return;
    const clone = state.activeScenarioId ? confirm('Copy rows from current view?') : false;
    const { scenario } = await scenariosApi.create(state.token, {
      cycle_id: state.activeCycleId,
      name,
      status: 'draft',
      clone_from_scenario_id: clone ? state.activeScenarioId : undefined,
    });
    state.activeScenarioId = scenario.id;
    localStorage.setItem(SCENARIO_STORAGE_KEY, scenario.id);
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

async function savePlannerGrid() {
  const plan_items = [];
  const depCreates = [];
  const depPatches = [];

  for (const row of document.querySelectorAll('.planner-row')) {
    const id = row.dataset.id;
    if (!id) continue;
    const attrs = {};
    const days = row.querySelector('[data-field="duration_days"]')?.value;
    const start = row.querySelector('[data-field="start_date"]')?.value;
    const taskType = row.querySelector('[data-field="task_type"]')?.value;
    if (days) attrs.duration_days = Number(days);
    if (start) attrs.start_date = start;
    if (taskType) attrs.task_type = taskType;

    plan_items.push({
      id,
      title: row.querySelector('[data-field="title"]')?.value,
      phase: row.querySelector('[data-field="phase"]')?.value || null,
      work_hours: Number(row.querySelector('[data-field="work_hours"]')?.value || 0),
      due_week: row.querySelector('[data-field="due_week"]')?.value || null,
      attributes: attrs,
    });

    const depPayload = readDepFields(row);
    if (depPayload) {
      if (row.dataset.depId) {
        depPatches.push({ id: row.dataset.depId, ...depPayload });
      } else {
        depCreates.push({ to_plan_item_id: id, ...depPayload });
      }
    }
  }

  for (const row of document.querySelectorAll('.planner-subrow')) {
    const depPayload = readDepFields(row);
    if (!depPayload || !row.dataset.depId) continue;
    depPatches.push({ id: row.dataset.depId, ...depPayload });
  }

  if (plan_items.length) await planItemsApi.patch(state.token, plan_items);
  for (const dep of depCreates) {
    await dependenciesApi.create(state.token, {
      cycle_id: state.activeCycleId,
      to_plan_item_id: dep.to_plan_item_id,
      from_plan_item_id: dep.from_plan_item_id,
      dep_type: dep.dep_type,
      label: dep.label,
      status: dep.status,
      meta: dep.meta,
    });
  }
  if (depPatches.length) await dependenciesApi.patch(state.token, depPatches);

  await loadScenarioData();
  render();
}

function readDepFields(row) {
  const label = row.querySelector('[data-field="label"]')?.value?.trim();
  const fromId = row.querySelector('[data-field="from_plan_item_id"]')?.value || null;
  const depDue = row.querySelector('[data-field="dep_due"]')?.value || null;
  const depType = row.querySelector('[data-field="dep_type"]')?.value || 'input_ready';
  const status = row.querySelector('[data-field="dep_status"]')?.value || 'open';
  if (!label && !fromId && !depDue) return null;
  return {
    from_plan_item_id: fromId,
    dep_type: depType,
    label: label || null,
    status,
    meta: depDue ? { due_date: depDue } : {},
  };
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
      await loadCapacity(mode, state.capacityGranularity);
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
    await loadCapacity(e.target.value, state.capacityGranularity);
    render();
  });
  document.getElementById('cap-granularity-week')?.addEventListener('click', async () => {
    const mode = document.getElementById('cap-mode')?.value || 'due';
    await loadCapacity(mode, 'week');
    render();
  });
  document.getElementById('cap-granularity-month')?.addEventListener('click', async () => {
    const mode = document.getElementById('cap-mode')?.value || 'due';
    await loadCapacity(mode, 'month');
    render();
  });
  document.getElementById('refresh-capacity')?.addEventListener('click', async () => {
    const mode = document.getElementById('cap-mode')?.value || 'due';
    await loadCapacity(mode, state.capacityGranularity);
    render();
  });
}

async function refreshView() {
  await loadCoreData();
  const route = currentRoute();
  if (route === 'capacity') {
    const mode = document.getElementById('cap-mode')?.value || 'due';
    await loadCapacity(mode, state.capacityGranularity);
  }
  if (route === 'settings') await loadChangelog();
  render();
}

function render() {
  const root = document.getElementById('app-root');
  const rawRoute = currentRoute();
  const route = resolveRoute(rawRoute, state);
  if (route !== rawRoute) {
    navigate(route);
    return;
  }

  let html;
  if (route === 'planner') html = renderPlanner();
  else if (route === 'capacity') html = renderCapacity();
  else if (route === 'settings') html = renderSettings();
  else html = renderPlanner();
  root.innerHTML = html;
  wireAuthLink(state.auth);

  if (route === 'settings') {
    wireSettingsEvents();
    scrollToSetupStep();
  } else if (route === 'planner') wirePlannerEvents();
  else if (route === 'capacity') wireCapacityEvents();
  else wireWorkspaceEvents();
}

function scrollToSetupStep() {
  const anchor = getSetupProgress(state).nextStep?.anchor;
  if (!anchor) return;
  requestAnimationFrame(() => {
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
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

    const emptyHash = !location.hash || location.hash === '#/' || location.hash === '#';
    if (emptyHash) {
      location.replace(`#/${getInitialRoute(state)}`);
    } else {
      const resolved = resolveRoute(currentRoute(), state);
      if (resolved !== currentRoute()) location.replace(`#/${resolved}`);
    }

    window.addEventListener('hashchange', async () => {
      const route = currentRoute();
      if (route === 'capacity') await loadCapacity('due', state.capacityGranularity);
      render();
    });

    const route = currentRoute();
    if (route === 'capacity') await loadCapacity('due', state.capacityGranularity);
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
