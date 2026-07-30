/**
 * Onboarding progress — determines nav order, redirects, and next-step highlights.
 */

export function getSetupProgress(state) {
  const hasWorkspace = state.workspaces.length > 0 && Boolean(state.activeWorkspaceId);
  const hasCycle = state.cycles.length > 0 && Boolean(state.activeCycleId);
  const hasResources = state.resources.length > 0;
  const hasPlanItems = state.planItems.length > 0;

  const steps = [
    {
      id: 'workspace',
      label: 'Create workspace',
      done: hasWorkspace,
      route: 'settings',
      anchor: 'setup-workspace',
    },
    {
      id: 'cycle',
      label: 'Add planning cycle',
      done: hasCycle,
      route: 'settings',
      anchor: 'setup-cycle',
    },
    {
      id: 'people',
      label: 'Add team members',
      done: hasResources,
      route: 'settings',
      anchor: 'setup-people',
    },
    {
      id: 'plan',
      label: 'Build your plan',
      done: hasPlanItems,
      route: 'planner',
      anchor: null,
    },
    {
      id: 'capacity',
      label: 'Review capacity',
      done: hasPlanItems,
      route: 'capacity',
      anchor: null,
    },
  ];

  const nextStep = steps.find((s) => !s.done) || null;
  const setupComplete = hasWorkspace && hasCycle && hasResources;
  const onboardingComplete = setupComplete && hasPlanItems;

  return {
    steps,
    nextStep,
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
  if (!progress.setupComplete) return 'settings';
  if (!progress.onboardingComplete && progress.nextStep) return progress.nextStep.route;
  return 'planner';
}

const GATED_ROUTES = new Set(['planner', 'plan', 'capacity']);

export function resolveRoute(route, state) {
  const progress = getSetupProgress(state);
  const normalized = normalizeRoute(route);
  if (!progress.setupComplete && GATED_ROUTES.has(normalized)) return 'settings';
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

  if (!progress.setupComplete) {
    return [setup, planner, capacity];
  }

  return [planner, capacity, setup];
}
