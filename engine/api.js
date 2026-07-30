export async function apiFetch(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function withToken(token) {
  return (path, opts = {}) => apiFetch(path, { ...opts, token });
}

export const meApi = {
  get: (token) => apiFetch('/api/omc-me', { token }),
};

export const cyclesApi = {
  list: (token) => apiFetch('/api/omc-cycles', { token }),
  create: (token, body) => apiFetch('/api/omc-cycles', { method: 'POST', body, token }),
};

export const policyApi = {
  get: (token, cycleId) => apiFetch(`/api/omc-policy?cycle=${encodeURIComponent(cycleId)}`, { token }),
  update: (token, cycleId, config) =>
    apiFetch(`/api/omc-policy?cycle=${encodeURIComponent(cycleId)}`, {
      method: 'PUT',
      body: { config },
      token,
    }),
};

export const resourcesApi = {
  list: (token, { team, active } = {}) => {
    const params = new URLSearchParams();
    if (team) params.set('team', team);
    if (active === false) params.set('active', 'false');
    const qs = params.toString();
    return apiFetch(`/api/omc-resources${qs ? `?${qs}` : ''}`, { token });
  },
  create: (token, body) => apiFetch('/api/omc-resources', { method: 'POST', body, token }),
  patch: (token, resources) =>
    apiFetch('/api/omc-resources', { method: 'PATCH', body: { resources }, token }),
};

export const planItemsApi = {
  list: (token, { cycle, scenario } = {}) => {
    const params = new URLSearchParams();
    if (cycle) params.set('cycle', cycle);
    if (scenario) params.set('scenario', scenario);
    return apiFetch(`/api/omc-plan-items?${params}`, { token });
  },
  create: (token, body) => apiFetch('/api/omc-plan-items', { method: 'POST', body, token }),
  patch: (token, plan_items) =>
    apiFetch('/api/omc-plan-items', { method: 'PATCH', body: { plan_items }, token }),
};

export const capacityApi = {
  get: (token, { cycle, scenario, team, mode } = {}) => {
    const params = new URLSearchParams({ cycle });
    if (scenario) params.set('scenario', scenario);
    if (team) params.set('team', team);
    if (mode) params.set('mode', mode);
    return apiFetch(`/api/omc-capacity?${params}`, { token });
  },
};

export { withToken };
