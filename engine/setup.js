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
      label: 'Add plan items',
      done: hasPlanItems,
      route: 'plan',
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

/** First page a signed-in user should see. */
export function getInitialRoute(state) {
  const progress = getSetupProgress(state);
  if (!progress.setupComplete) return 'settings';
  if (!progress.onboardingComplete && progress.nextStep) return progress.nextStep.route;
  return 'home';
}

/** Routes that require workspace + cycle + people before access. */
const GATED_ROUTES = new Set(['plan', 'dependencies', 'capacity', 'alerts']);

export function resolveRoute(route, state) {
  const progress = getSetupProgress(state);
  if (!progress.setupComplete && GATED_ROUTES.has(route)) return 'settings';
  return route;
}

export function navItems(state) {
  const progress = getSetupProgress(state);
  const setup = {
    id: 'settings',
    label: progress.setupComplete ? 'Settings' : 'Setup',
    highlight: progress.nextStep?.route === 'settings',
  };
  const home = { id: 'home', label: 'Home', highlight: false };
  const plan = { id: 'plan', label: 'Plan', highlight: progress.nextStep?.route === 'plan' };
  const dependencies = { id: 'dependencies', label: 'Dependencies', highlight: false };
  const capacity = { id: 'capacity', label: 'Capacity', highlight: progress.nextStep?.route === 'capacity' };
  const alerts = { id: 'alerts', label: 'Alerts', highlight: false };

  if (!progress.setupComplete) {
    return [setup, home, plan, dependencies, capacity, alerts];
  }

  return [home, plan, capacity, dependencies, alerts, setup];
}
