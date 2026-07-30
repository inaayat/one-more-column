/**
 * Onboarding progress — determines nav order, redirects, and next-step highlights.
 */

export function getSetupProgress(state) {
  const hasWorkspace = state.workspaces.length > 0 && Boolean(state.activeWorkspaceId);
  const hasCycle = state.cycles.length > 0 && Boolean(state.activeCycleId);
  const hasResources = state.resources.length > 0;
  const hasPlanItems = state.planItems.length > 0;

  /** Workspace + period — enough to open Planner and list work. */
  const planningReady = hasWorkspace && hasCycle;
  /** Full team roster — needed for meaningful capacity checks. */
  const teamReady = hasResources;
  const setupComplete = planningReady && teamReady;
  const onboardingComplete = planningReady && hasPlanItems;

  const steps = [
    {
      id: 'name-plan',
      label: 'Name your plan',
      done: planningReady,
      route: 'settings',
      anchor: 'setup-plan',
    },
    {
      id: 'plan',
      label: 'What are you actually planning?',
      done: hasPlanItems,
      route: 'planner',
      anchor: 'setup-planning',
    },
    {
      id: 'people',
      label: 'Add your team (for capacity)',
      done: hasResources,
      route: 'settings',
      anchor: 'setup-people',
    },
    {
      id: 'capacity',
      label: 'See who has time left',
      done: hasPlanItems && hasResources,
      route: 'capacity',
      anchor: null,
    },
  ];

  const nextStep = steps.find((s) => !s.done) || null;

  return {
    steps,
    nextStep,
    planningReady,
    teamReady,
    setupComplete,
    onboardingComplete,
    hasWorkspace,
    hasCycle,
    hasResources,
    hasPlanItems,
  };
}

export function getInitialRoute(state) {
  const progress = getSetupProgress(state);
  if (!progress.planningReady) return 'settings';
  if (!progress.hasPlanItems) return 'planner';
  return 'planner';
}

const GATED_ROUTES = new Set(['planner', 'plan', 'capacity']);

export function resolveRoute(route, state) {
  const progress = getSetupProgress(state);
  const normalized = normalizeRoute(route);
  if (!progress.planningReady && GATED_ROUTES.has(normalized)) return 'settings';
  return normalized;
}

/** Map legacy routes to current views. */
export function normalizeRoute(route) {
  if (route === 'plan' || route === 'dependencies' || route === 'home') return 'planner';
  if (route === 'alerts') return 'capacity';
  return route;
}

export function navItems(state) {
  const progress = getSetupProgress(state);
  const setup = {
    id: 'settings',
    label: progress.setupComplete ? 'Settings' : 'Setup',
    highlight: progress.nextStep?.route === 'settings',
  };
  const planner = {
    id: 'planner',
    label: 'Planner',
    highlight: progress.nextStep?.route === 'planner',
  };
  const capacity = {
    id: 'capacity',
    label: 'Capacity',
    highlight: progress.nextStep?.route === 'capacity',
  };

  if (!progress.planningReady) {
    return [setup, planner, capacity];
  }

  return [planner, capacity, setup];
}
