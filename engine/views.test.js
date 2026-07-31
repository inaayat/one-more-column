/**
 * View-layer smoke tests.
 *
 * Every view is a pure function of state, so they can be rendered in Node
 * without a DOM. These catch the failures that used to only show up in the
 * browser: a view throwing on an empty workspace, an object stringifying into
 * the markup, user data escaping into live HTML, or a route resolving somewhere
 * unexpected.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

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
import { renderShell, renderContext } from './shell.js';
import {
  navItems,
  resolveRoute,
  getInitialRoute,
  normalizeRoute,
  getSetupProgress,
} from './setup.js';

const emptyState = {
  workspaces: [{ id: 'w1', name: 'Default workspace' }],
  activeWorkspaceId: 'w1',
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
  changelog: [],
  alerts: [],
  alertCounts: { high: 0, medium: 0, low: 0 },
  activeTeamFilter: '',
  capacityGranularity: 'week',
  expandedRows: new Set(),
  expandedTaskTypes: new Set(),
  isDirty: false,
  teamDirty: false,
  taskTypesDirty: false,
  wizard: blankWizard(),
};

const fullState = {
  ...emptyState,
  workspaces: [
    { id: 'w1', name: 'Default workspace' },
    { id: 'w2', name: 'Finance' },
  ],
  cycles: [
    { id: 'c1', name: 'Q1 2026', start_date: '2026-01-05', end_date: '2026-04-03' },
    { id: 'c2', name: 'Q2 2026', start_date: '2026-04-06', end_date: '2026-07-03' },
  ],
  activeCycleId: 'c1',
  scenarios: [
    { id: 's1', name: 'Baseline', status: 'active' },
    { id: 's2', name: 'What if', status: 'draft' },
  ],
  activeScenarioId: 's1',
  resources: [
    {
      id: 'r1',
      // Deliberately hostile: an apostrophe plus a script tag.
      name: `O'Brien <script>alert(1)</script>`,
      team: 'Analyst',
      profiles: [{ weekly_hours: 32 }],
      time_off: [{ id: 't1', start_date: '2026-02-02', end_date: '2026-02-06', hours_per_day: null }],
    },
    { id: 'r2', name: 'Sam Lee', team: null, profiles: [], time_off: [] },
  ],
  teams: ['Analyst'],
  taskTypes: [
    {
      id: 'tt1',
      key: 'general',
      label: 'General',
      gate_templates: [],
    },
    {
      id: 'tt2',
      key: 'deliverable',
      label: 'Deliverable',
      gate_templates: [
        {
          id: 'gs1',
          label: 'Obtain population',
          duration_days: 7,
          day_kind: 'business',
          dep_type: 'input_ready',
        },
      ],
    },
    {
      id: 'tt3',
      key: 'control_testing',
      label: 'Control Testing',
      gate_templates: [
        { id: 'gs2', label: 'Obtain population', duration_days: 7, day_kind: 'business', dep_type: 'input_ready' },
        { id: 'gs3', label: 'Select samples', duration_days: 7, day_kind: 'business', dep_type: 'sample_chain' },
        { id: 'gs4', label: 'Get sample support', duration_days: 7, day_kind: 'business', dep_type: 'input_ready' },
      ],
    },
  ],
  policy: { config: { tracking_granularity: 'week', weekly_capacity_default: 32 } },
  planItems: [
    {
      id: 'p1',
      title: 'Draft "the" forecast & review',
      work_hours: 8,
      due_week: '2026-01-12',
      phase: 'Phase 1',
      attributes: { task_type: 'deliverable', duration_days: 5, start_date: '2026-01-06' },
    },
    { id: 'p2', title: 'Second item', work_hours: 0, due_week: null, phase: null, attributes: {} },
  ],
  dependencies: [
    {
      id: 'd1',
      to_plan_item_id: 'p1',
      from_plan_item_id: 'p2',
      dep_type: 'input_ready',
      label: 'Data handed over',
      status: 'open',
      meta: { due_date: '2026-01-08' },
    },
  ],
  readiness: [
    { plan_item_id: 'p1', title: 'Draft', ready_to_start: '2026-01-09', blocked: true, blockers: [] },
  ],
  capacity: {
    granularity: 'week',
    mode: 'due',
    teams: ['Analyst'],
    weeks: ['2026-01-05', '2026-01-12'],
    rows: [
      {
        resource_id: 'r1',
        name: "O'Brien",
        team: 'Analyst',
        weeks: [
          { week: '2026-01-05', load: 8, capacity: 32, remaining: 24, band: 'green' },
          { week: '2026-01-12', load: 40, capacity: 32, remaining: -8, band: 'red', overloaded: true },
        ],
      },
    ],
  },
  changelog: [{ created_at: '2026-01-02T10:00:00Z', summary: 'Created plan' }],
  alerts: [
    { type: 'overload', severity: 'high', message: 'Overloaded', resource_name: 'x', week: '2026-01-12' },
    { type: 'due_proximity', severity: 'medium', message: 'Due soon', due_week: '2026-01-12' },
    { type: 'gate_proximity', severity: 'low', message: 'Gate due' },
  ],
  alertCounts: { high: 1, medium: 1, low: 1 },
  expandedRows: new Set(['p1']),
  expandedTaskTypes: new Set(['tt3']),
  isDirty: true,
  teamDirty: true,
  taskTypesDirty: false,
};

const views = {
  plans: (s) => renderPlansView({ state: s, redirectedFrom: 'capacity' }),
  planner: (s) => renderPlannerView({ state: s }),
  capacity: (s) => renderCapacityView({ state: s }),
  alerts: (s) => renderAlertsView({ state: s }),
  team: (s) => renderTeamView({ state: s }),
  'task-types': (s) => renderTaskTypesView({ state: s }),
  rules: (s) => renderRulesView({ state: s }),
  guide: (s) => renderGuideView({ state: s }),
};

function shellFor(body, state, route) {
  return renderShell({
    body,
    activeRoute: route,
    navItems: navItems(state),
    context: renderContext({
      state,
      planOptions: planOptions(state.cycles, state.activeCycleId),
      workspaceOptions: workspaceOptions(state.workspaces, state.activeWorkspaceId),
      showSwitchers: true,
    }),
    user: { name: 'Test User', email: 't@example.com' },
  });
}

for (const [label, state] of [['empty', emptyState], ['populated', fullState]]) {
  for (const [name, render] of Object.entries(views)) {
    test(`${name} renders with ${label} state`, () => {
      const body = render(state);
      assert.equal(typeof body, 'string');
      assert.ok(body.trim().length > 0, 'produced no output');
      assert.ok(!body.includes('[object Object]'), 'an object leaked into the markup');
      assert.ok(shellFor(body, state, name).includes('sidebar'), 'shell lost its sidebar');
    });
  }
}

test('wizard renders every step, for a first plan and an additional one', () => {
  for (const base of [emptyState, fullState]) {
    for (let step = 1; step <= 3; step += 1) {
      const state = { ...base, wizard: { ...blankWizard(), open: true, step, showWorkspace: true } };
      const out = renderWizard({ state });
      assert.ok(out.includes('wizard-step'), `step ${step} lost its progress chips`);
    }
  }
});

test('wizard validation catches every bad field at once', () => {
  const wizard = {
    ...blankWizard(),
    name: '   ',
    start: '2026-05-01',
    end: '2026-01-01', // before the start
    useNewWorkspace: true,
    newWorkspaceName: '',
  };
  const errors = validateStep(wizard, 1);
  assert.deepEqual(Object.keys(errors).sort(), ['end', 'name', 'newWorkspaceName']);

  wizard.errors = errors;
  const out = renderWizard({ state: { ...emptyState, wizard: { ...wizard, open: true, step: 1, showWorkspace: true } } });
  assert.ok(out.includes('field-error'), 'errors were not shown inline');
});

test('wizard only offers granularities the capacity grid can draw', () => {
  // lib/handlers/capacity.js coerces anything that is not `month` to `week`.
  const out = renderWizard({ state: { ...emptyState, wizard: { ...blankWizard(), open: true, step: 1 } } });
  assert.ok(out.includes('value="week"'));
  assert.ok(out.includes('value="month"'));
  assert.ok(!out.includes('value="day"'), 'day tracking is not implemented server-side');
});

test('legacy hashes still resolve', () => {
  assert.equal(normalizeRoute('home'), 'guide');
  assert.equal(normalizeRoute('settings'), 'plans');
  assert.equal(normalizeRoute('preferences'), 'rules');
  assert.equal(normalizeRoute('dependencies'), 'planner');
  assert.equal(normalizeRoute('nonsense'), 'planner');
});

test('routes needing a plan redirect, and say where they came from', () => {
  const { route, redirectedFrom } = resolveRoute('capacity', emptyState);
  assert.equal(route, 'plans');
  assert.equal(redirectedFrom, 'capacity');

  // The guide never needs a plan.
  assert.equal(resolveRoute('guide', emptyState).route, 'guide');
  // With a plan in place, nothing is gated.
  assert.equal(resolveRoute('capacity', fullState).route, 'capacity');
  assert.equal(resolveRoute('capacity', fullState).redirectedFrom, null);
});

test('onboarding sends new users to Plans and returning users to Planner', () => {
  assert.equal(getInitialRoute(emptyState), 'plans');
  assert.equal(getInitialRoute(fullState), 'planner');
  assert.equal(getSetupProgress(emptyState).nextStep.id, 'plan');
  assert.equal(getSetupProgress(fullState).capacityReady, true);
});

test('user-supplied text is escaped, not executed', () => {
  const team = renderTeamView({ state: fullState });
  assert.ok(!team.includes('<script>'), 'raw script tag survived into the team view');
  assert.ok(team.includes('&lt;script&gt;'), 'the script tag was not escaped');

  const planner = renderPlannerView({ state: fullState });
  assert.ok(!planner.includes('<script>'), 'raw script tag survived into the planner');
});

test('planner shows Apply gate template when the row type has steps', () => {
  const planner = renderPlannerView({ state: fullState });
  assert.ok(planner.includes('data-apply-gate-template="p1"'), 'deliverable with a template should offer Apply');
  assert.ok(planner.includes('Control Testing'), 'custom types appear in the type dropdown');
});

test('task types view lists nested gate steps for an expanded type', () => {
  const out = renderTaskTypesView({ state: fullState });
  assert.ok(out.includes('Control Testing'));
  assert.ok(out.includes('Obtain population'));
  assert.ok(out.includes('Select samples'));
  assert.ok(out.includes('data-add-step="tt3"'));
});

test('task-types route is gated until a plan exists', () => {
  assert.equal(resolveRoute('task-types', emptyState).route, 'plans');
  assert.equal(resolveRoute('task-types', fullState).route, 'task-types');
  assert.ok(navItems(fullState).some((n) => n.id === 'task-types'));
});

test('gated nav items render as text, not as links that bounce', () => {
  const shell = shellFor('', emptyState, 'plans');
  assert.ok(!shell.includes('href="#/capacity"'), 'a locked route was still clickable');
  assert.ok(shell.includes('aria-disabled="true"'));

  const unlocked = shellFor('', fullState, 'planner');
  assert.ok(unlocked.includes('href="#/capacity"'), 'capacity should be reachable once a plan exists');
});

test('capacity explains itself rather than rendering an empty grid', () => {
  const noTeam = renderCapacityView({ state: { ...fullState, resources: [], capacity: null } });
  assert.ok(noTeam.includes('href="#/team"'), 'should point at the page that fixes it');

  const noWork = renderCapacityView({ state: { ...fullState, planItems: [], capacity: null } });
  assert.ok(noWork.includes('href="#/planner"'), 'should point at the page that fixes it');
});
