/**
 * Routing, onboarding progress, and sidebar nav.
 *
 * Route names describe what the page is for. The old pair — `settings` labelled
 * "Setup" sitting next to `preferences` labelled "Settings" — inverted labels
 * and routes against each other, so both names are retired here and aliased.
 */

export const ROUTES = ['planner', 'capacity', 'alerts', 'team', 'task-types', 'plans', 'rules', 'guide'];

/** Routes that need a workspace + plan before they can show anything. */
const NEEDS_PLAN = new Set(['planner', 'capacity', 'alerts', 'team', 'task-types', 'rules']);

const LEGACY_ROUTES = {
  home: 'guide',
  settings: 'plans',
  preferences: 'rules',
  plan: 'planner',
  dependencies: 'planner',
  setup: 'plans',
};

export function normalizeRoute(route) {
  const mapped = LEGACY_ROUTES[route] || route;
  return ROUTES.includes(mapped) ? mapped : 'planner';
}

export function getSetupProgress(state) {
  const hasWorkspace = state.workspaces.length > 0 && Boolean(state.activeWorkspaceId);
  const hasPlan = state.cycles.length > 0 && Boolean(state.activeCycleId);
  const hasTeam = state.resources.length > 0;
  const hasWork = state.planItems.length > 0;

  /** Workspace + plan — the minimum needed to open Planner and list work. */
  const planReady = hasWorkspace && hasPlan;
  /** Work listed and people to do it — the minimum for capacity to mean anything. */
  const capacityReady = planReady && hasWork && hasTeam;

  const steps = [
    { id: 'plan', label: 'Create a plan', done: planReady, route: 'plans' },
    { id: 'work', label: 'List the work', done: hasWork, route: 'planner' },
    { id: 'team', label: 'Add your team', done: hasTeam, route: 'team' },
    { id: 'capacity', label: 'Check capacity', done: capacityReady, route: 'capacity' },
  ];

  return {
    steps,
    nextStep: steps.find((s) => !s.done) || null,
    planReady,
    capacityReady,
    hasWorkspace,
    hasPlan,
    hasTeam,
    hasWork,
  };
}

export function getInitialRoute(state) {
  return getSetupProgress(state).planReady ? 'planner' : 'plans';
}

/**
 * Resolves a requested route to one the current data can actually render.
 * Returns the reason so the destination can explain the redirect rather than
 * silently bouncing the user, which is what the old version did.
 */
export function resolveRoute(route, state) {
  const normalized = normalizeRoute(route);
  const progress = getSetupProgress(state);
  if (!progress.planReady && NEEDS_PLAN.has(normalized)) {
    return { route: 'plans', redirectedFrom: normalized };
  }
  return { route: normalized, redirectedFrom: null };
}

export function navItems(state) {
  const progress = getSetupProgress(state);
  const next = progress.nextStep?.route;
  const locked = !progress.planReady;
  const lockedTitle = 'Create a plan first';

  return [
    {
      id: 'planner',
      label: 'Planner',
      locked,
      lockedHint: 'needs a plan',
      lockedTitle,
      next: next === 'planner',
    },
    {
      id: 'capacity',
      label: 'Capacity',
      locked,
      lockedHint: 'needs a plan',
      lockedTitle,
      next: next === 'capacity',
    },
    {
      id: 'alerts',
      label: 'Alerts',
      locked,
      lockedHint: 'needs a plan',
      lockedTitle,
      count: state.alertCounts?.high || 0,
      urgent: (state.alertCounts?.high || 0) > 0,
    },
    {
      id: 'team',
      label: 'Team',
      locked,
      lockedHint: 'needs a plan',
      lockedTitle,
      next: next === 'team',
    },
    {
      id: 'task-types',
      label: 'Task types',
      locked,
      lockedHint: 'needs a plan',
      lockedTitle,
    },
    { id: 'plans', label: 'Plans', next: next === 'plans' },
    { id: 'rules', label: 'Settings', locked, lockedHint: 'needs a plan', lockedTitle },
    { id: 'guide', label: 'How it works' },
  ];
}
