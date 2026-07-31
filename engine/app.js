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
  taskTypesApi,
} from './api.js';
import {
  renderShell,
  renderContext,
  escapeHtml,
  toast,
  confirmDialog,
  promptDialog,
  withBusy,
  captureFocus,
  restoreFocus,
} from './shell.js';
import {
  renderPlansView,
  renderPlannerView,
  renderCapacityView,
  renderAlertsView,
  renderTeamView,
  renderTaskTypesView,
  renderRulesView,
  renderGuideView,
  planOptions,
  workspaceOptions,
} from './views.js';
import { renderWizard, blankWizard, validateStep } from './wizard.js';
import { getInitialRoute, resolveRoute, navItems, normalizeRoute } from './setup.js';

const APP_PATH = '/one-more-column/';
const WORKSPACE_KEY = 'omc_active_workspace_id';
const SCENARIO_KEY = 'omc_active_scenario_id';

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
  taskTypes: [],
  policy: null,
  capacity: null,
  planItems: [],
  dependencies: [],
  readiness: [],
  importPreview: null,
  importCsvText: '',
  importSectionOpen: false,
  importTaskTypeId: '',
  changelog: [],
  alerts: [],
  alertCounts: { high: 0, medium: 0, low: 0 },
  activeTeamFilter: '',
  capacityGranularity: 'week',
  /** Set after a server reload so the next render doesn't re-read the old DOM. */
  skipCapture: false,

  /** Rows whose detail drawer is open, kept across re-renders. */
  expandedRows: new Set(),
  /** Task types whose gate-template drawer is open. */
  expandedTaskTypes: new Set(),
  /** Unsaved edits pending in the planner grid / team table / task types. */
  isDirty: false,
  teamDirty: false,
  taskTypesDirty: false,
  redirectedFrom: null,
  wizard: blankWizard(),
};

/* ── Routing ──────────────────────────────────────────────────────────── */

function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, '') || '';
  return normalizeRoute(hash.split('?')[0] || 'planner');
}

function navigate(route) {
  location.hash = `#/${route}`;
}

/* ── Capturing in-flight edits ────────────────────────────────────────
   render() replaces innerHTML wholesale. Before it does, anything the user has
   typed but not saved has to be pulled back into state, or deleting one row
   silently discards every edit made to the others. */

function captureGridEdits() {
  for (const row of document.querySelectorAll('.planner-row[data-id]')) {
    const item = state.planItems.find((p) => p.id === row.dataset.id);
    if (!item) continue;
    const read = (field) => row.querySelector(`[data-field="${field}"]`)?.value;

    item.title = read('title') ?? item.title;
    item.work_hours = Number(read('work_hours') ?? item.work_hours) || 0;
    item.due_week = read('due_week') || null;
    item.attributes = { ...(item.attributes || {}) };
    const startDate = read('start_date');
    if (startDate !== undefined) item.attributes.start_date = startDate || null;
    const taskType = read('task_type');
    if (taskType !== undefined) item.attributes.task_type = taskType;
  }

  // Detail drawers carry duration/phase plus the gate rows.
  for (const drawer of document.querySelectorAll('.gate-drawer[data-drawer-for]')) {
    const item = state.planItems.find((p) => p.id === drawer.dataset.drawerFor);
    if (!item) continue;
    const days = drawer.querySelector('[data-field="duration_days"]')?.value;
    const phase = drawer.querySelector('[data-field="phase"]')?.value;
    item.attributes = { ...(item.attributes || {}) };
    if (days !== undefined) {
      item.attributes.duration_days = days === '' ? undefined : Number(days);
    }
    if (phase !== undefined) item.phase = phase || null;

    for (const gate of drawer.querySelectorAll('.gate-item[data-dep-id]')) {
      const dep = state.dependencies.find((d) => d.id === gate.dataset.depId);
      if (!dep) continue;
      const read = (field) => gate.querySelector(`[data-field="${field}"]`)?.value;
      dep.label = read('label') ?? dep.label;
      dep.from_plan_item_id = read('from_plan_item_id') || null;
      dep.status = read('dep_status') ?? dep.status;
      dep.dep_type = read('dep_type') ?? dep.dep_type;
      const due = read('dep_due');
      if (due !== undefined) dep.meta = due ? { ...(dep.meta || {}), due_date: due } : {};
    }
  }
}

function captureTeamEdits() {
  for (const row of document.querySelectorAll('.table tbody tr[data-id]')) {
    const resource = state.resources.find((r) => r.id === row.dataset.id);
    if (!resource) continue;
    const name = row.querySelector('[data-field="name"]')?.value;
    const team = row.querySelector('[data-field="team"]')?.value;
    const hours = row.querySelector('[data-field="weekly_hours"]')?.value;
    if (name === undefined && hours === undefined) continue;

    if (name !== undefined) resource.name = name;
    if (team !== undefined) resource.team = team || null;
    if (hours !== undefined) {
      const weekly = Number(hours) || 0;
      if (resource.profiles?.length) resource.profiles[0].weekly_hours = weekly;
      else resource.profiles = [{ weekly_hours: weekly }];
    }
  }
}

function captureTaskTypeEdits() {
  for (const row of document.querySelectorAll('#task-types-table tbody tr[data-id]')) {
    const type = state.taskTypes.find((t) => t.id === row.dataset.id);
    if (!type) continue;
    const label = row.querySelector('[data-field="label"]')?.value;
    if (label !== undefined) type.label = label;
  }

  for (const row of document.querySelectorAll('#task-types-table tr[data-step-id]')) {
    const type = state.taskTypes.find((t) => t.id === row.dataset.typeId);
    if (!type) continue;
    const step = (type.gate_templates || []).find((s) => s.id === row.dataset.stepId);
    if (!step) continue;
    const label = row.querySelector('[data-step-field="label"]')?.value;
    const days = row.querySelector('[data-step-field="duration_days"]')?.value;
    const dayKind = row.querySelector('[data-step-field="day_kind"]')?.value;
    const depType = row.querySelector('[data-step-field="dep_type"]')?.value;
    if (label !== undefined) step.label = label;
    if (days !== undefined) step.duration_days = Number(days) || 1;
    if (dayKind !== undefined) step.day_kind = dayKind;
    if (depType !== undefined) step.dep_type = depType;
  }

  for (const row of document.querySelectorAll('#task-types-table tr[data-field-id]')) {
    const type = state.taskTypes.find((t) => t.id === row.dataset.typeId);
    if (!type) continue;
    const field = (type.fields || []).find((f) => f.id === row.dataset.fieldId);
    if (!field) continue;
    const label = row.querySelector('[data-custom-field="label"]')?.value;
    const fieldType = row.querySelector('[data-custom-field="field_type"]')?.value;
    const optionsRaw = row.querySelector('[data-custom-field="options"]')?.value;
    const required = row.querySelector('[data-custom-field="required"]')?.checked;
    if (label !== undefined) field.label = label;
    if (fieldType !== undefined) field.field_type = fieldType;
    if (optionsRaw !== undefined) {
      field.options = optionsRaw
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
    }
    if (required !== undefined) field.required = Boolean(required);
  }
}

/** Client-side mirror of the server slugify used for field keys. */
function slugifyFieldKey(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64);
}

function captureWizardFields() {
  const wizard = state.wizard;
  const val = (id) => document.getElementById(id)?.value;
  if (wizard.step === 1) {
    wizard.name = val('wiz-name') ?? wizard.name;
    wizard.start = val('wiz-start') ?? wizard.start;
    wizard.end = val('wiz-end') ?? wizard.end;
    wizard.newWorkspaceName = val('wiz-new-workspace') ?? wizard.newWorkspaceName;
  } else if (wizard.step === 2) {
    wizard.person = {
      name: val('wiz-person-name') ?? wizard.person.name,
      role: val('wiz-person-role') ?? wizard.person.role,
      hours: val('wiz-person-hours') ?? wizard.person.hours,
    };
  }
}

function captureAll() {
  const route = currentRoute();

  // The pasted-CSV textarea is pure scratch input the server never populates,
  // so unlike grid/team/wizard state there is no "stale vs fresh" conflict —
  // capture it unconditionally or a re-render triggered by anything else
  // (adding a row, previewing the import) silently empties it, which is what
  // made "Import them" a no-op: the textarea it read from had already been
  // recreated blank by the time the button was clicked.
  if (route === 'planner') {
    const csv = document.getElementById('import-csv');
    if (csv) state.importCsvText = csv.value;
    const typeSel = document.getElementById('import-task-type');
    if (typeSel) state.importTaskTypeId = typeSel.value || '';
  }

  // After a reload the DOM still holds the pre-reload markup, so capturing from
  // it would write stale values straight back over the fresh server data.
  if (state.skipCapture) {
    state.skipCapture = false;
    return;
  }
  if (route === 'planner') captureGridEdits();
  if (route === 'team') captureTeamEdits();
  if (route === 'task-types') captureTaskTypeEdits();
  if (route === 'plans' && state.wizard.open) captureWizardFields();
}

/** Persists pending grid edits before any action that reloads from the server. */
async function flushPendingEdits() {
  captureGridEdits();
  if (state.isDirty) await savePlannerGrid({ silent: true });
}

function markDirty() {
  if (state.isDirty) return;
  state.isDirty = true;
  const save = document.getElementById('save-planner');
  if (save) save.disabled = false;
  const bar = save?.closest('.btn-row');
  if (bar && !bar.querySelector('.dirty-flag')) {
    bar.insertAdjacentHTML('afterbegin', '<span class="dirty-flag">Unsaved changes</span>');
  }
}

function markTeamDirty() {
  if (state.teamDirty) return;
  state.teamDirty = true;
  const save = document.getElementById('save-team');
  if (save) save.disabled = false;
  const bar = save?.closest('.btn-row');
  if (bar && !bar.querySelector('.dirty-flag')) {
    bar.insertAdjacentHTML('afterbegin', '<span class="dirty-flag">Unsaved changes</span>');
  }
}

function markTaskTypesDirty() {
  if (state.taskTypesDirty) return;
  state.taskTypesDirty = true;
  const save = document.getElementById('save-task-types');
  if (save) save.disabled = false;
  const bar = save?.closest('.btn-row');
  if (bar && !bar.querySelector('.dirty-flag')) {
    bar.insertAdjacentHTML('afterbegin', '<span class="dirty-flag">Unsaved changes</span>');
  }
}

/* ── Data loading ─────────────────────────────────────────────────────── */

function persistWorkspace() {
  if (state.activeWorkspaceId) localStorage.setItem(WORKSPACE_KEY, state.activeWorkspaceId);
}

async function loadWorkspaces() {
  const { workspaces } = await workspacesApi.list(state.token);
  state.workspaces = workspaces;

  const stored = localStorage.getItem(WORKSPACE_KEY);
  if (stored && workspaces.some((w) => w.id === stored)) {
    state.activeWorkspaceId = stored;
  } else if (workspaces.length) {
    state.activeWorkspaceId = workspaces[0].id;
    persistWorkspace();
  } else {
    state.activeWorkspaceId = null;
  }
}

async function loadCoreData() {
  const token = state.token;
  if (!state.activeWorkspaceId) {
    Object.assign(state, {
      cycles: [],
      resources: [],
      teams: [],
      taskTypes: [],
      policy: null,
      planItems: [],
      scenarios: [],
      activeScenarioId: null,
      activeCycleId: null,
    });
    return;
  }

  const [{ cycles }, { resources, teams }, { task_types }] = await Promise.all([
    cyclesApi.list(token, state.activeWorkspaceId),
    resourcesApi.list(token, state.activeWorkspaceId),
    taskTypesApi.list(token, state.activeWorkspaceId),
  ]);
  state.cycles = cycles;
  state.resources = resources;
  state.teams = teams;
  state.taskTypes = task_types || [];
  state.teamDirty = false;
  state.taskTypesDirty = false;
  state.skipCapture = true;

  if (state.activeCycleId && !cycles.some((c) => c.id === state.activeCycleId)) {
    state.activeCycleId = null;
    state.activeScenarioId = null;
  }
  if (!state.activeCycleId && cycles.length) state.activeCycleId = cycles[0].id;

  if (state.activeCycleId) {
    const { policy } = await policyApi.get(token, state.activeCycleId);
    state.policy = policy;
    const tracking = policy?.config?.tracking_granularity;
    if (tracking === 'month' || tracking === 'week') state.capacityGranularity = tracking;
    else if (tracking === 'day') state.capacityGranularity = 'week';
    await loadScenarioData();
  }
}

async function loadScenarioData() {
  const token = state.token;
  if (!state.activeCycleId) return;

  const { scenarios } = await scenariosApi.list(token, state.activeCycleId);
  state.scenarios = scenarios;

  const stored = localStorage.getItem(SCENARIO_KEY);
  if (stored && scenarios.some((s) => s.id === stored)) {
    state.activeScenarioId = stored;
  } else if (state.activeScenarioId && scenarios.some((s) => s.id === state.activeScenarioId)) {
    // keep the current selection
  } else if (scenarios.length) {
    const active = scenarios.find((s) => s.status === 'active') || scenarios[0];
    state.activeScenarioId = active.id;
    localStorage.setItem(SCENARIO_KEY, active.id);
  } else {
    state.activeScenarioId = null;
  }

  if (state.activeScenarioId) {
    const { plan_items } = await planItemsApi.list(token, { scenario: state.activeScenarioId });
    state.planItems = plan_items;
    await loadDependencies();
  } else {
    state.planItems = [];
    state.dependencies = [];
    state.readiness = [];
  }
  state.isDirty = false;
  state.skipCapture = true;
}

async function loadDependencies() {
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

async function loadCapacity(mode, granularity = state.capacityGranularity) {
  if (!state.activeCycleId) {
    state.capacity = null;
    return;
  }
  const resolvedMode = mode || document.getElementById('cap-mode')?.value || 'due';
  state.capacity = await capacityApi.get(state.token, {
    cycle: state.activeCycleId,
    scenario: state.activeScenarioId || undefined,
    team: state.activeTeamFilter || undefined,
    mode: resolvedMode,
    granularity,
  });
  state.capacityGranularity = granularity;
}

async function loadAlerts() {
  if (!state.activeCycleId) {
    state.alerts = [];
    state.alertCounts = { high: 0, medium: 0, low: 0 };
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

/** Loads whatever the given route needs beyond core data. */
async function loadForRoute(route) {
  if (route === 'capacity') await loadCapacity();
  if (route === 'alerts') await loadAlerts();
  if (route === 'rules') await loadChangelog();
}

/* ── Saving ───────────────────────────────────────────────────────────── */

async function savePlannerGrid({ silent = false } = {}) {
  captureGridEdits();

  const plan_items = state.planItems.map((item) => ({
    id: item.id,
    title: item.title,
    phase: item.phase || null,
    work_hours: Number(item.work_hours) || 0,
    due_week: item.due_week || null,
    attributes: item.attributes || {},
  }));

  const dependencies = state.dependencies.map((dep) => ({
    id: dep.id,
    from_plan_item_id: dep.from_plan_item_id || null,
    dep_type: dep.dep_type,
    label: dep.label || null,
    status: dep.status,
    meta: dep.meta || {},
  }));

  if (plan_items.length) await planItemsApi.patch(state.token, plan_items);
  if (dependencies.length) await dependenciesApi.patch(state.token, dependencies);

  state.isDirty = false;
  await loadScenarioData();
  if (!silent) toast('Plan saved');
}

async function saveTeam() {
  captureTeamEdits();
  const resources = state.resources.map((r) => ({
    id: r.id,
    name: r.name,
    team: r.team || null,
    weekly_hours: Number(r.profiles?.[0]?.weekly_hours) || null,
  }));
  if (resources.length) await resourcesApi.patch(state.token, state.activeWorkspaceId, resources);
  state.teamDirty = false;
  await loadCoreData();
  toast('Team saved');
}

async function saveTaskTypes() {
  captureTaskTypeEdits();
  for (const type of state.taskTypes) {
    await taskTypesApi.patch(state.token, state.activeWorkspaceId, {
      id: type.id,
      label: type.label,
      gate_templates: (type.gate_templates || []).map((s, i) => ({
        id: s.id,
        label: s.label,
        duration_days: Number(s.duration_days) || 1,
        day_kind: s.day_kind || 'business',
        dep_type: s.dep_type || 'input_ready',
        seq: i + 1,
      })),
      fields: (type.fields || []).map((f, i) => ({
        id: f.id,
        key: f.key,
        label: f.label,
        field_type: f.field_type || 'text',
        options: f.field_type === 'select' ? f.options || [] : null,
        required: Boolean(f.required),
        seq: i + 1,
      })),
    });
  }
  state.taskTypesDirty = false;
  await loadCoreData();
  toast('Task types saved');
}

/* ── Wizard ───────────────────────────────────────────────────────────── */

function openWizard() {
  state.wizard = blankWizard();
  state.wizard.open = true;
  state.redirectedFrom = null;
  render();
}

function closeWizard() {
  state.wizard.open = false;
  render();
}

async function createPlanFromWizard(button) {
  const wizard = state.wizard;
  const errors = validateStep(wizard, 1);
  if (Object.keys(errors).length) {
    wizard.errors = errors;
    wizard.step = 1;
    render();
    toast('Some details still need fixing', 'error');
    return;
  }

  await withBusy(button, 'Creating…', async () => {
    let workspaceId = state.activeWorkspaceId;
    if (wizard.useNewWorkspace) {
      const { workspace } = await workspacesApi.create(state.token, {
        name: wizard.newWorkspaceName.trim(),
        profile: 'default',
      });
      workspaceId = workspace.id;
    }
    state.activeWorkspaceId = workspaceId;
    persistWorkspace();

    const result = await cyclesApi.create(state.token, workspaceId, {
      name: wizard.name.trim(),
      cycle_type: 'custom',
      start_date: wizard.start,
      end_date: wizard.end,
      policy: { tracking_granularity: wizard.granularity },
    });
    state.activeCycleId = result.cycle.id;
    state.activeScenarioId = result.default_scenario_id || null;
    if (state.activeScenarioId) localStorage.setItem(SCENARIO_KEY, state.activeScenarioId);

    for (const person of wizard.people) {
      await resourcesApi.create(state.token, workspaceId, {
        name: person.name,
        team: person.role || null,
        weekly_hours: Number(person.hours) || 32,
      });
    }

    state.wizard = blankWizard();
    await loadWorkspaces();
    await loadCoreData();
    toast(`"${result.cycle.name}" is ready`);
    navigate('planner');
    render();
  });
}

function wireWizardEvents() {
  const wizard = state.wizard;

  const rerender = () => {
    captureWizardFields();
    render();
  };

  document.getElementById('wiz-show-workspace')?.addEventListener('click', () => {
    captureWizardFields();
    wizard.showWorkspace = true;
    render();
  });

  document.querySelectorAll('[data-ws-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      captureWizardFields();
      wizard.useNewWorkspace = btn.dataset.wsMode === 'new';
      render();
    });
  });

  document.getElementById('wiz-workspace')?.addEventListener('change', (e) => {
    state.activeWorkspaceId = e.target.value;
    persistWorkspace();
  });

  document.querySelectorAll('input[name="wiz-granularity"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      captureWizardFields();
      wizard.granularity = radio.value;
      render();
    });
  });

  // Keep the plain-English summary in step with what's typed, but only once
  // the field is actually done being edited. A native date input reports
  // `change` mid-keystroke while a segment is still incomplete — most often
  // while typing the year, since it needs 4 digits against 2 for month/day.
  // Re-rendering on that recreates the <input>, which resets focus to its
  // first segment: type "2026" and after the first "2" the next keystroke
  // lands back on the month instead of continuing the year. `blur` only fires
  // once the user actually leaves the field, so no re-render happens mid-type.
  ['wiz-name', 'wiz-start', 'wiz-end'].forEach((id) => {
    document.getElementById(id)?.addEventListener('blur', rerender);
  });

  document.getElementById('wiz-next')?.addEventListener('click', () => {
    captureWizardFields();
    const errors = validateStep(wizard, wizard.step);
    wizard.errors = errors;
    if (Object.keys(errors).length) {
      render();
      return;
    }
    wizard.step = Math.min(wizard.step + 1, 3);
    render();
  });

  document.getElementById('wiz-back')?.addEventListener('click', () => {
    captureWizardFields();
    wizard.step = Math.max(1, wizard.step - 1);
    render();
  });

  document.getElementById('wiz-skip')?.addEventListener('click', () => {
    captureWizardFields();
    wizard.person = { name: '', role: '', hours: '32' };
    wizard.step = 3;
    // render() re-captures from the DOM before repainting (see captureAll());
    // without this the still-stale inputs above would immediately overwrite
    // the reset we just made.
    state.skipCapture = true;
    render();
  });

  document.getElementById('wiz-add-person')?.addEventListener('click', () => {
    captureWizardFields();
    const person = wizard.person;
    if (!person.name.trim()) {
      document.getElementById('wiz-person-name')?.focus();
      return;
    }
    wizard.people.push({
      name: person.name.trim(),
      role: person.role.trim(),
      hours: Number(person.hours) || 32,
    });
    wizard.person = { name: '', role: '', hours: '32' };
    // Same reason as wiz-skip above: skip the auto-recapture so the form
    // actually clears instead of refilling itself from the old DOM values.
    state.skipCapture = true;
    render();
    document.getElementById('wiz-person-name')?.focus();
  });

  document.querySelectorAll('[data-remove-person]').forEach((btn) => {
    btn.addEventListener('click', () => {
      captureWizardFields();
      wizard.people.splice(Number(btn.dataset.removePerson), 1);
      render();
    });
  });

  document.getElementById('wiz-create')?.addEventListener('click', (e) => {
    guard(() => createPlanFromWizard(e.currentTarget));
  });

  document.getElementById('wiz-cancel')?.addEventListener('click', closeWizard);
}

/* ── Shared event helpers ─────────────────────────────────────────────── */

/** Runs an async handler, surfacing failures as a toast instead of a crash.
 *  fn is invoked synchronously so handlers can still read event.currentTarget,
 *  which the browser nulls out once dispatch finishes. */
function guard(fn) {
  const onError = (err) => {
    console.error(err);
    toast(err.message || 'Something went wrong', 'error');
  };
  try {
    return Promise.resolve(fn()).catch(onError);
  } catch (err) {
    onError(err);
    return Promise.resolve();
  }
}

function wireContextEvents() {
  document.getElementById('ctx-cycle')?.addEventListener('change', (e) => {
    guard(async () => {
      await flushPendingEdits();
      state.activeCycleId = e.target.value || null;
      state.activeScenarioId = null;
      localStorage.removeItem(SCENARIO_KEY);
      await loadCoreData();
      await loadForRoute(currentRoute());
      render();
    });
  });

  const switchWorkspace = (workspaceId) =>
    guard(async () => {
      if (!workspaceId || workspaceId === state.activeWorkspaceId) return;
      await flushPendingEdits();
      state.activeWorkspaceId = workspaceId;
      state.activeCycleId = null;
      state.activeScenarioId = null;
      state.capacity = null;
      localStorage.removeItem(SCENARIO_KEY);
      persistWorkspace();
      await loadCoreData();
      await loadForRoute(currentRoute());
      render();
    });

  document.getElementById('ctx-workspace')?.addEventListener('change', (e) =>
    switchWorkspace(e.target.value),
  );
  document.getElementById('plans-workspace')?.addEventListener('change', (e) =>
    switchWorkspace(e.target.value),
  );
}

/* ── Plans view events ────────────────────────────────────────────────── */

function wirePlansEvents() {
  document.getElementById('new-plan')?.addEventListener('click', openWizard);
  document.getElementById('new-plan-empty')?.addEventListener('click', openWizard);

  document.querySelectorAll('[data-open-plan]').forEach((btn) => {
    btn.addEventListener('click', () =>
      guard(async () => {
        state.activeCycleId = btn.dataset.openPlan;
        state.activeScenarioId = null;
        localStorage.removeItem(SCENARIO_KEY);
        await loadCoreData();
        toast('Plan opened');
        navigate('planner');
      }),
    );
  });

  document.querySelectorAll('[data-delete-plan]').forEach((btn) => {
    btn.addEventListener('click', () =>
      guard(async () => {
        const id = btn.dataset.deletePlan;
        const cycle = state.cycles.find((c) => c.id === id);
        const ok = await confirmDialog({
          title: `Delete "${cycle?.name || 'this plan'}"?`,
          body: 'Its work items, versions, and gates go with it. This cannot be undone.',
          confirmLabel: 'Delete plan',
          danger: true,
        });
        if (!ok) return;

        await cyclesApi.delete(state.token, state.activeWorkspaceId, id);
        state.cycles = state.cycles.filter((c) => c.id !== id);
        if (state.activeCycleId === id) {
          state.activeCycleId = state.cycles[0]?.id ?? null;
          state.activeScenarioId = null;
          localStorage.removeItem(SCENARIO_KEY);
        }
        await loadCoreData();
        toast('Plan deleted');
        render();
      }),
    );
  });

  document.getElementById('delete-workspace')?.addEventListener('click', () =>
    guard(async () => {
      if (state.workspaces.length <= 1) {
        toast('You need at least one workspace', 'warn');
        return;
      }
      const workspace = state.workspaces.find((w) => w.id === state.activeWorkspaceId);
      const ok = await confirmDialog({
        title: `Delete "${workspace?.name || 'this workspace'}"?`,
        body: 'Every plan and every person in it will be deleted too. This cannot be undone.',
        confirmLabel: 'Delete workspace',
        danger: true,
      });
      if (!ok) return;

      await workspacesApi.delete(state.token, state.activeWorkspaceId);
      localStorage.removeItem(WORKSPACE_KEY);
      state.activeCycleId = null;
      state.activeScenarioId = null;
      await loadWorkspaces();
      await loadCoreData();
      toast('Workspace deleted');
      render();
    }),
  );
}

/* ── Planner events ───────────────────────────────────────────────────── */

function wirePlannerEvents() {
  const table = document.querySelector('.planner-table');
  table?.addEventListener('input', markDirty);
  table?.addEventListener('change', markDirty);

  document.getElementById('save-planner')?.addEventListener('click', (e) =>
    guard(() => withBusy(e.currentTarget, 'Saving…', () => savePlannerGrid()).then(render)),
  );

  document.querySelectorAll('[data-toggle-row]').forEach((btn) => {
    btn.addEventListener('click', () => {
      captureGridEdits();
      const id = btn.dataset.toggleRow;
      if (state.expandedRows.has(id)) state.expandedRows.delete(id);
      else state.expandedRows.add(id);
      render();
    });
  });

  document.querySelectorAll('[data-add-gate]').forEach((btn) => {
    btn.addEventListener('click', () =>
      guard(async () => {
        await flushPendingEdits();
        await dependenciesApi.create(state.token, {
          cycle_id: state.activeCycleId,
          to_plan_item_id: btn.dataset.addGate,
          dep_type: 'input_ready',
          label: '',
        });
        state.expandedRows.add(btn.dataset.addGate);
        await loadScenarioData();
        render();
      }),
    );
  });

  document.querySelectorAll('[data-apply-gate-template]').forEach((btn) => {
    btn.addEventListener('click', () =>
      guard(async () => {
        captureGridEdits();
        const itemId = btn.dataset.applyGateTemplate;
        const taskTypeId = btn.dataset.taskTypeId;
        const item = state.planItems.find((p) => p.id === itemId);
        const today = new Date().toISOString().slice(0, 10);
        const defaultAnchor =
          (item?.attributes?.start_date && String(item.attributes.start_date).slice(0, 10)) || today;

        const result = await promptDialog({
          title: 'Apply gate template',
          body: 'Due dates are chained from this anchor — each step starts after the previous one finishes. You can edit any gate afterward.',
          label: 'Anchor date',
          value: defaultAnchor,
          confirmLabel: 'Create gates',
          inputType: 'date',
        });
        if (!result) return;

        await flushPendingEdits();
        const { count } = await dependenciesApi.applyGateTemplate(state.token, {
          plan_item_id: itemId,
          task_type_id: taskTypeId,
          anchor_date: result.value,
        });
        state.expandedRows.add(itemId);
        await loadScenarioData();
        toast(`Added ${count} gate${count === 1 ? '' : 's'}`);
        render();
      }),
    );
  });

  document.querySelectorAll('[data-delete-gate]').forEach((btn) => {
    btn.addEventListener('click', () =>
      guard(async () => {
        await flushPendingEdits();
        await dependenciesApi.delete(state.token, btn.dataset.deleteGate);
        await loadScenarioData();
        toast('Gate removed');
        render();
      }),
    );
  });

  document.querySelectorAll('[data-delete-item]').forEach((btn) => {
    btn.addEventListener('click', () =>
      guard(async () => {
        const id = btn.dataset.deleteItem;
        const item = state.planItems.find((p) => p.id === id);
        const ok = await confirmDialog({
          title: 'Delete this row?',
          body: `"${escapeHtml(item?.title || 'Untitled')}" and any gates on it will be removed.`,
          confirmLabel: 'Delete row',
          danger: true,
        });
        if (!ok) return;
        await flushPendingEdits();
        await planItemsApi.delete(state.token, id);
        state.expandedRows.delete(id);
        await loadScenarioData();
        toast('Row deleted');
        render();
      }),
    );
  });

  document.getElementById('add-plan-item')?.addEventListener('click', (e) =>
    guard(async () => {
      const title = document.getElementById('new-item-title')?.value?.trim();
      if (!title) {
        document.getElementById('new-item-title')?.focus();
        toast('Give the row a name first', 'warn');
        return;
      }
      await withBusy(e.currentTarget, 'Adding…', async () => {
        await flushPendingEdits();
        await planItemsApi.create(state.token, {
          cycle_id: state.activeCycleId,
          scenario_id: state.activeScenarioId,
          title,
          work_hours: Number(document.getElementById('new-item-hours')?.value || 0),
          due_week: document.getElementById('new-item-due')?.value || null,
          attributes: { task_type: document.getElementById('new-item-type')?.value || 'general' },
        });
        await loadScenarioData();
        render();
        document.getElementById('new-item-title')?.focus();
      });
    }),
  );

  const switchScenario = (mode) =>
    guard(async () => {
      await flushPendingEdits();
      if (mode === 'live') {
        const live = state.scenarios.find((s) => s.status === 'active');
        if (!live) {
          toast('No live plan yet — mark a draft as live first', 'warn');
          return;
        }
        state.activeScenarioId = live.id;
      } else {
        const draft = state.scenarios.find((s) => s.status !== 'active');
        if (!draft) {
          toast('No drafts yet — create one with "New draft"', 'warn');
          return;
        }
        state.activeScenarioId = draft.id;
      }
      localStorage.setItem(SCENARIO_KEY, state.activeScenarioId);
      await loadScenarioData();
      render();
    });

  document.getElementById('mode-draft')?.addEventListener('click', () => switchScenario('draft'));
  document.getElementById('mode-live')?.addEventListener('click', () => switchScenario('live'));

  document.getElementById('scenario-select')?.addEventListener('change', (e) =>
    guard(async () => {
      await flushPendingEdits();
      state.activeScenarioId = e.target.value || null;
      if (state.activeScenarioId) localStorage.setItem(SCENARIO_KEY, state.activeScenarioId);
      await loadScenarioData();
      render();
    }),
  );

  document.getElementById('create-scenario')?.addEventListener('click', () =>
    guard(async () => {
      const result = await promptDialog({
        title: 'New draft',
        body: 'A draft is a scratch copy of this plan. Nothing in it counts until you make it live.',
        label: 'Draft name',
        placeholder: 'e.g. What if we hire two more',
        confirmLabel: 'Create draft',
        checkbox: state.activeScenarioId
          ? { label: 'Start from a copy of the current rows', checked: true }
          : null,
      });
      if (!result) return;

      await flushPendingEdits();
      const { scenario } = await scenariosApi.create(state.token, {
        cycle_id: state.activeCycleId,
        name: result.value,
        status: 'draft',
        clone_from_scenario_id: result.checked ? state.activeScenarioId : undefined,
      });
      state.activeScenarioId = scenario.id;
      localStorage.setItem(SCENARIO_KEY, scenario.id);
      await loadScenarioData();
      toast(`Draft "${scenario.name}" created`);
      render();
    }),
  );

  document.getElementById('finalize-scenario')?.addEventListener('click', () =>
    guard(async () => {
      const ok = await confirmDialog({
        title: 'Make this the live plan?',
        body: 'This becomes the version everyone works from.',
        confirmLabel: 'Make it live',
      });
      if (!ok) return;
      await flushPendingEdits();
      await scenariosApi.patch(state.token, { id: state.activeScenarioId, status: 'active' });
      await loadScenarioData();
      toast('This is now the live plan');
      render();
    }),
  );

  document.getElementById('delete-scenario')?.addEventListener('click', () =>
    guard(async () => {
      if (state.scenarios.length <= 1) return;
      const scenario = state.scenarios.find((s) => s.id === state.activeScenarioId);
      const ok = await confirmDialog({
        title: `Delete "${scenario?.name || 'this version'}"?`,
        body: 'Its rows and gates go with it. This cannot be undone.',
        confirmLabel: 'Delete version',
        danger: true,
      });
      if (!ok) return;

      await scenariosApi.delete(state.token, state.activeScenarioId);
      state.scenarios = state.scenarios.filter((s) => s.id !== state.activeScenarioId);
      const next = state.scenarios.find((s) => s.status === 'active') || state.scenarios[0];
      state.activeScenarioId = next?.id ?? null;
      if (state.activeScenarioId) localStorage.setItem(SCENARIO_KEY, state.activeScenarioId);
      else localStorage.removeItem(SCENARIO_KEY);
      await loadScenarioData();
      toast('Version deleted');
      render();
    }),
  );

  document.getElementById('preview-import')?.addEventListener('click', () =>
    guard(async () => {
      const csv_text = document.getElementById('import-csv')?.value;
      if (!csv_text?.trim()) {
        toast('Paste some CSV first', 'warn');
        return;
      }
      const task_type_id = document.getElementById('import-task-type')?.value || '';
      state.importTaskTypeId = task_type_id;
      state.importPreview = await importApi.preview(state.token, {
        cycle_id: state.activeCycleId,
        scenario_id: state.activeScenarioId,
        csv_text,
        ...(task_type_id ? { task_type_id } : {}),
      });
      // Keep the section open so the preview appears next to the CSV that
      // produced it, instead of the disclosure snapping shut on render.
      state.importSectionOpen = true;
      render();
    }),
  );

  document.getElementById('confirm-import')?.addEventListener('click', () =>
    guard(async () => {
      const csv_text = document.getElementById('import-csv')?.value;
      if (!csv_text) {
        toast('Paste some CSV first', 'warn');
        return;
      }
      const task_type_id =
        state.importTaskTypeId || document.getElementById('import-task-type')?.value || '';
      await importApi.commit(state.token, {
        cycle_id: state.activeCycleId,
        scenario_id: state.activeScenarioId,
        csv_text,
        ...(task_type_id ? { task_type_id } : {}),
      });
      state.importPreview = null;
      // captureAll() unconditionally re-reads #import-csv on every render (see
      // its comment), so clearing state.importCsvText alone would just get
      // immediately overwritten by that re-read of the still-stale textarea.
      // Clear the field itself; the next capture picks up the empty value.
      const csvField = document.getElementById('import-csv');
      if (csvField) csvField.value = '';
      await loadScenarioData();
      toast('Rows imported');
      render();
    }),
  );

  document.getElementById('cancel-import')?.addEventListener('click', () => {
    state.importPreview = null;
    render();
  });

  document.getElementById('import-task-type')?.addEventListener('change', (e) => {
    state.importTaskTypeId = e.target.value || '';
    state.importPreview = null;
    render();
  });

  document.getElementById('import-disclosure')?.addEventListener('toggle', (e) => {
    state.importSectionOpen = e.target.open;
  });

  document.getElementById('export-plan')?.addEventListener('click', () =>
    guard(() => downloadExport('plan')),
  );

  document.getElementById('check-drift')?.addEventListener('click', () =>
    guard(async () => {
      const data = await exportApi.drift(state.token, {
        cycle: state.activeCycleId,
        scenario: state.activeScenarioId,
      });
      toast(
        `Since your last import: ${data.added} added, ${data.modified} changed, ${data.removed} removed`,
        'ok',
        5000,
      );
    }),
  );
}

/* ── Capacity events ──────────────────────────────────────────────────── */

function wireCapacityEvents() {
  document.querySelectorAll('.pill-tab[data-team]').forEach((tab) => {
    tab.addEventListener('click', () =>
      guard(async () => {
        state.activeTeamFilter = tab.dataset.team || '';
        await loadCapacity();
        render();
      }),
    );
  });

  document.getElementById('cap-mode')?.addEventListener('change', (e) =>
    guard(async () => {
      await loadCapacity(e.target.value);
      render();
    }),
  );

  document.getElementById('cap-granularity-week')?.addEventListener('click', () =>
    guard(async () => {
      await loadCapacity(null, 'week');
      render();
    }),
  );

  document.getElementById('cap-granularity-month')?.addEventListener('click', () =>
    guard(async () => {
      await loadCapacity(null, 'month');
      render();
    }),
  );

  document.getElementById('refresh-capacity')?.addEventListener('click', (e) =>
    guard(() =>
      withBusy(e.currentTarget, 'Refreshing…', async () => {
        await loadCapacity();
        render();
      }),
    ),
  );

  document.getElementById('export-capacity')?.addEventListener('click', () =>
    guard(() => downloadExport('capacity')),
  );
}

/* ── Team events ──────────────────────────────────────────────────────── */

function wireTeamEvents() {
  const table = document.querySelector('.table');
  table?.addEventListener('input', markTeamDirty);
  table?.addEventListener('change', markTeamDirty);

  document.getElementById('save-team')?.addEventListener('click', (e) =>
    guard(() => withBusy(e.currentTarget, 'Saving…', saveTeam).then(render)),
  );

  document.getElementById('add-resource')?.addEventListener('click', (e) =>
    guard(async () => {
      const name = document.getElementById('new-resource-name')?.value?.trim();
      if (!name) {
        document.getElementById('new-resource-name')?.focus();
        toast('Give the person a name first', 'warn');
        return;
      }
      await withBusy(e.currentTarget, 'Adding…', async () => {
        captureTeamEdits();
        if (state.teamDirty) await saveTeam();
        await resourcesApi.create(state.token, state.activeWorkspaceId, {
          name,
          team: document.getElementById('new-resource-team')?.value?.trim() || null,
          weekly_hours: Number(document.getElementById('new-resource-hours')?.value || 32),
        });
        await loadCoreData();
        render();
        document.getElementById('new-resource-name')?.focus();
      });
    }),
  );

  document.querySelectorAll('[data-delete-resource]').forEach((btn) => {
    btn.addEventListener('click', () =>
      guard(async () => {
        const id = btn.dataset.deleteResource;
        const resource = state.resources.find((r) => r.id === id);
        const ok = await confirmDialog({
          title: `Remove ${resource?.name || 'this person'}?`,
          body: 'Their time off goes too, and they disappear from the capacity grid.',
          confirmLabel: 'Remove',
          danger: true,
        });
        if (!ok) return;
        await resourcesApi.delete(state.token, state.activeWorkspaceId, id);
        state.teamDirty = false;
        await loadCoreData();
        toast('Person removed');
        render();
      }),
    );
  });

  document.getElementById('add-pto')?.addEventListener('click', (e) =>
    guard(async () => {
      const start = document.getElementById('pto-start')?.value;
      const end = document.getElementById('pto-end')?.value;
      if (!start || !end) {
        toast('Pick both a start and an end date', 'warn');
        return;
      }
      if (end < start) {
        toast('The end date is before the start date', 'warn');
        return;
      }
      await withBusy(e.currentTarget, 'Saving…', async () => {
        await timeOffApi.create(state.token, state.activeWorkspaceId, {
          resource_id: document.getElementById('pto-resource')?.value,
          start_date: start,
          end_date: end,
          hours_per_day: document.getElementById('pto-hours')?.value || null,
          reason: 'PTO',
        });
        await loadCoreData();
        toast('Time off booked');
        render();
      });
    }),
  );

  document.querySelectorAll('[data-delete-pto]').forEach((btn) => {
    btn.addEventListener('click', () =>
      guard(async () => {
        await timeOffApi.delete(state.token, btn.dataset.deletePto);
        await loadCoreData();
        toast('Time off removed');
        render();
      }),
    );
  });
}

/* ── Task type events ─────────────────────────────────────────────────── */

function wireTaskTypesEvents() {
  const table = document.getElementById('task-types-table');
  table?.addEventListener('input', markTaskTypesDirty);
  table?.addEventListener('change', (e) => {
    markTaskTypesDirty();
    // Field-type changes enable/disable the options input — re-render so that
    // (and the summary counts) stay in sync with what the user just picked.
    if (e.target?.matches?.('[data-custom-field="field_type"]')) {
      captureTaskTypeEdits();
      render();
    }
  });

  document.getElementById('save-task-types')?.addEventListener('click', (e) =>
    guard(() => withBusy(e.currentTarget, 'Saving…', saveTaskTypes).then(render)),
  );

  document.getElementById('add-task-type')?.addEventListener('click', (e) =>
    guard(async () => {
      const label = document.getElementById('new-task-type-label')?.value?.trim();
      if (!label) {
        document.getElementById('new-task-type-label')?.focus();
        toast('Give the type a name first', 'warn');
        return;
      }
      await withBusy(e.currentTarget, 'Adding…', async () => {
        captureTaskTypeEdits();
        if (state.taskTypesDirty) await saveTaskTypes();
        const { task_type } = await taskTypesApi.create(state.token, state.activeWorkspaceId, {
          label,
        });
        state.expandedTaskTypes.add(task_type.id);
        await loadCoreData();
        render();
        document.getElementById('new-task-type-label')?.focus();
      });
    }),
  );

  document.querySelectorAll('[data-toggle-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      captureTaskTypeEdits();
      const id = btn.dataset.toggleType;
      if (state.expandedTaskTypes.has(id)) state.expandedTaskTypes.delete(id);
      else state.expandedTaskTypes.add(id);
      render();
    });
  });

  document.querySelectorAll('[data-delete-task-type]').forEach((btn) => {
    btn.addEventListener('click', () =>
      guard(async () => {
        const id = btn.dataset.deleteTaskType;
        const type = state.taskTypes.find((t) => t.id === id);
        const ok = await confirmDialog({
          title: `Delete ${type?.label || 'this type'}?`,
          body: 'Its gate template and custom fields go too. Existing plan rows keep their type key, but the dropdown option disappears.',
          confirmLabel: 'Delete type',
          danger: true,
        });
        if (!ok) return;
        await taskTypesApi.delete(state.token, state.activeWorkspaceId, id);
        state.expandedTaskTypes.delete(id);
        state.taskTypesDirty = false;
        await loadCoreData();
        toast('Type deleted');
        render();
      }),
    );
  });

  document.querySelectorAll('[data-add-step]').forEach((btn) => {
    btn.addEventListener('click', () =>
      guard(async () => {
        const typeId = btn.dataset.addStep;
        const labelInput = document.querySelector(`[data-new-step-label="${typeId}"]`);
        const label = labelInput?.value?.trim();
        if (!label) {
          labelInput?.focus();
          toast('Give the step a name first', 'warn');
          return;
        }
        captureTaskTypeEdits();
        const type = state.taskTypes.find((t) => t.id === typeId);
        if (!type) return;
        const days = Number(document.querySelector(`[data-new-step-days="${typeId}"]`)?.value) || 7;
        const dayKind =
          document.querySelector(`[data-new-step-kind="${typeId}"]`)?.value || 'business';
        if (!type.gate_templates) type.gate_templates = [];
        type.gate_templates.push({
          id: crypto.randomUUID(),
          task_type_id: typeId,
          seq: type.gate_templates.length + 1,
          label,
          duration_days: days,
          day_kind: dayKind,
          dep_type: 'input_ready',
        });
        state.expandedTaskTypes.add(typeId);
        markTaskTypesDirty();
        // Persist immediately so a refresh doesn't lose the new step, matching
        // how team PTO creates server-side rather than only dirty-tracking.
        await saveTaskTypes();
        render();
      }),
    );
  });

  document.querySelectorAll('[data-delete-step]').forEach((btn) => {
    btn.addEventListener('click', () =>
      guard(async () => {
        captureTaskTypeEdits();
        const typeId = btn.dataset.typeId;
        const stepId = btn.dataset.deleteStep;
        const type = state.taskTypes.find((t) => t.id === typeId);
        if (!type) return;
        type.gate_templates = (type.gate_templates || []).filter((s) => s.id !== stepId);
        markTaskTypesDirty();
        await saveTaskTypes();
        toast('Step removed');
        render();
      }),
    );
  });

  document.querySelectorAll('[data-add-field]').forEach((btn) => {
    btn.addEventListener('click', () =>
      guard(async () => {
        const typeId = btn.dataset.addField;
        const labelInput = document.querySelector(`[data-new-field-label="${typeId}"]`);
        const label = labelInput?.value?.trim();
        if (!label) {
          labelInput?.focus();
          toast('Give the field a label first', 'warn');
          return;
        }
        captureTaskTypeEdits();
        const type = state.taskTypes.find((t) => t.id === typeId);
        if (!type) return;
        const fieldType =
          document.querySelector(`[data-new-field-type="${typeId}"]`)?.value || 'text';
        if (!type.fields) type.fields = [];
        type.fields.push({
          id: crypto.randomUUID(),
          task_type_id: typeId,
          key: slugifyFieldKey(label) || `field_${type.fields.length + 1}`,
          label,
          field_type: fieldType,
          options: fieldType === 'select' ? [] : null,
          required: false,
          seq: type.fields.length + 1,
        });
        state.expandedTaskTypes.add(typeId);
        markTaskTypesDirty();
        await saveTaskTypes();
        render();
      }),
    );
  });

  document.querySelectorAll('[data-delete-field]').forEach((btn) => {
    btn.addEventListener('click', () =>
      guard(async () => {
        captureTaskTypeEdits();
        const typeId = btn.dataset.typeId;
        const fieldId = btn.dataset.deleteField;
        const type = state.taskTypes.find((t) => t.id === typeId);
        if (!type) return;
        type.fields = (type.fields || []).filter((f) => f.id !== fieldId);
        markTaskTypesDirty();
        await saveTaskTypes();
        toast('Field removed');
        render();
      }),
    );
  });
}

/* ── Rules events ─────────────────────────────────────────────────────── */

function wireRulesEvents() {
  document.getElementById('save-policy')?.addEventListener('click', (e) =>
    guard(() =>
      withBusy(e.currentTarget, 'Saving…', async () => {
        await savePolicy({});
        toast('Rules saved');
        render();
      }),
    ),
  );

  document.querySelectorAll('[data-granularity]').forEach((btn) => {
    btn.addEventListener('click', () =>
      guard(async () => {
        await savePolicy({ tracking_granularity: btn.dataset.granularity });
        state.capacityGranularity = btn.dataset.granularity === 'day' ? 'week' : btn.dataset.granularity;
        toast(`Now tracking by ${btn.dataset.granularity}`);
        render();
      }),
    );
  });
}

async function savePolicy(overrides) {
  if (!state.activeCycleId) return;
  const existing = state.policy?.config || {};
  const num = (id, fallback) => {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const value = Number(el.value);
    return Number.isFinite(value) ? value : fallback;
  };

  const config = {
    ...existing,
    weekly_capacity_default: num('policy-weekly', existing.weekly_capacity_default ?? 32),
    review_ratio: num('policy-review', existing.review_ratio ?? 0.35),
    overload_threshold: num('policy-threshold', existing.overload_threshold ?? 1),
    alert_proximity_days: num('policy-proximity', existing.alert_proximity_days ?? 14),
    band_yellow_remaining: num('policy-yellow', existing.band_yellow_remaining ?? 8),
    review_floor_hours: num('policy-review-floor', existing.review_floor_hours ?? 0),
    ...overrides,
  };

  const { policy } = await policyApi.update(state.token, state.activeCycleId, config);
  state.policy = policy;
}

/* ── Export ───────────────────────────────────────────────────────────── */

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
  toast('CSV downloaded');
}

/* ── Render ───────────────────────────────────────────────────────────── */

function renderSignIn(auth) {
  const loginHref = `/account.html?next=${encodeURIComponent(location.pathname || APP_PATH)}`;
  return `
    <div class="signin-wrap">
      <div class="signin">
        <div class="signin-brand">
          <img src="./icon.svg" alt="" width="30" height="30" />
          <h1>One More Column</h1>
        </div>
        <p class="page-lead">Capacity planning that doesn't need another spreadsheet.</p>
        ${auth.needsReauth
          ? '<div class="notice notice-warn"><strong>Your session expired.</strong> Sign in again to pick up where you left off.</div>'
          : ''}
        <p class="page-lead">Use the same account as the rest of inaayat.xyz.</p>
        <a class="btn btn-primary btn-lg" href="${loginHref}">Sign in</a>
        <a class="sidebar-link" style="color:var(--muted)" href="/">← beep boop</a>
      </div>
    </div>`;
}

function render() {
  const root = document.getElementById('app-root');
  const requested = currentRoute();

  captureAll();

  const { route, redirectedFrom } = resolveRoute(requested, state);
  if (route !== requested) {
    state.redirectedFrom = redirectedFrom;
    navigate(route);
    return;
  }

  const focus = captureFocus();

  // The wizard takes over the Plans page when there is nothing to list, so the
  // first thing a new user sees is the thing they came to do.
  const showWizard = route === 'plans' && (state.wizard.open || !state.cycles.length);
  if (showWizard) state.wizard.open = true;

  let body;
  if (route === 'plans') {
    body = showWizard
      ? renderWizard({ state })
      : renderPlansView({ state, redirectedFrom: state.redirectedFrom });
  } else if (route === 'planner') body = renderPlannerView({ state });
  else if (route === 'capacity') body = renderCapacityView({ state });
  else if (route === 'alerts') body = renderAlertsView({ state });
  else if (route === 'team') body = renderTeamView({ state });
  else if (route === 'task-types') body = renderTaskTypesView({ state });
  else if (route === 'rules') body = renderRulesView({ state });
  else body = renderGuideView({ state });

  root.innerHTML = renderShell({
    body,
    activeRoute: route,
    navItems: navItems(state),
    context: renderContext({
      state,
      planOptions: planOptions(state.cycles, state.activeCycleId),
      workspaceOptions: workspaceOptions(state.workspaces, state.activeWorkspaceId),
      showSwitchers: !showWizard,
    }),
    user: state.me?.user || state.auth?.user || {},
    narrow: route === 'guide' || showWizard,
  });

  wireAuthLink(state.auth);
  wireContextEvents();

  if (route === 'plans' && showWizard) wireWizardEvents();
  else if (route === 'plans') wirePlansEvents();
  else if (route === 'planner') wirePlannerEvents();
  else if (route === 'capacity') wireCapacityEvents();
  else if (route === 'team') wireTeamEvents();
  else if (route === 'task-types') wireTaskTypesEvents();
  else if (route === 'rules') wireRulesEvents();
  else if (route === 'alerts') {
    document.getElementById('refresh-alerts')?.addEventListener('click', (e) =>
      guard(() =>
        withBusy(e.currentTarget, 'Refreshing…', async () => {
          await loadAlerts();
          render();
        }),
      ),
    );
  }

  restoreFocus(focus);
  state.redirectedFrom = null;
}

/* ── Boot ─────────────────────────────────────────────────────────────── */

async function boot() {
  const root = document.getElementById('app-root');
  const auth = await initAuth();
  state.auth = auth;

  if (auth.configured && auth.user && !auth.token) await refreshToken(auth);

  try {
    if (!auth.signedIn || !auth.token) {
      root.innerHTML = renderSignIn(auth);
      wireAuthLink(auth);
      return;
    }

    state.token = auth.token;
    state.me = await meApi.get(auth.token);
    await loadWorkspaces();
    await loadCoreData();

    // Alerts drive the sidebar badge, so they load once up front.
    if (state.activeCycleId) await loadAlerts().catch(() => {});

    const emptyHash = !location.hash || location.hash === '#/' || location.hash === '#';
    if (emptyHash) {
      location.replace(`#/${getInitialRoute(state)}`);
    } else {
      const { route } = resolveRoute(currentRoute(), state);
      if (route !== currentRoute()) location.replace(`#/${route}`);
    }

    window.addEventListener('hashchange', () =>
      guard(async () => {
        await loadForRoute(currentRoute());
        render();
      }),
    );

    // Nothing autosaves, so warn before a reload throws away pending edits.
    window.addEventListener('beforeunload', (e) => {
      if (!state.isDirty && !state.teamDirty) return;
      e.preventDefault();
      e.returnValue = '';
    });

    await loadForRoute(currentRoute());
    render();
  } catch (err) {
    console.error(err);
    if (err.status === 401 && auth.configured) {
      auth.signedIn = false;
      auth.needsReauth = !!auth.user;
      root.innerHTML = renderSignIn(auth);
      wireAuthLink(auth);
      return;
    }
    root.innerHTML = `
      <div class="signin-wrap">
        <div class="signin">
          <h1>Something went wrong</h1>
          <div class="notice notice-error">${escapeHtml(err.message || 'Unknown error')}</div>
          <a class="btn btn-ghost" href="${APP_PATH}">Reload</a>
        </div>
      </div>`;
  }
}

boot();
