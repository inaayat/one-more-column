import { initAuth, wireAuthLink, refreshToken } from './auth.js';
import { meApi } from './api.js';

const APP_PATH = '/one-more-column/';

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

function renderShell({ body }) {
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
        <div class="header-actions">
          <a href="/" class="btn btn-ghost btn-sm">← inaayat.xyz</a>
          <a href="/account.html" class="btn btn-ghost btn-sm" id="nav-auth-link">Log in</a>
        </div>
      </div>
    </header>
    <main class="main">
      <div class="content">${body}</div>
    </main>
  `;
}

function renderSignInPrompt(auth) {
  const loginHref = `/account.html?next=${encodeURIComponent(location.pathname || APP_PATH)}`;
  const reauthNote = auth.needsReauth
    ? '<div class="token-banner expired"><div><strong>Session expired.</strong> Sign in again to continue.</div></div>'
    : '';

  return renderShell({
    body: `
      ${reauthNote}
      <section class="panel">
        <h1 class="omc-title">One More Column</h1>
        <p class="omc-lead">Hosted capacity planner on inaayat.xyz. Sign in with the same account you use for AMC A-Lister.</p>
        <ul class="omc-bullets">
          <li>Same Neon Auth identity (<code>auth.sub</code>) as other inaayat.xyz apps</li>
          <li>Planning UI shell with design tokens from the blank template</li>
          <li>Stub <code>/api/omc-me</code> verifies JWT and syncs your user row</li>
        </ul>
        <p style="margin-top:16px">
          <a class="btn btn-refresh-solid" href="${loginHref}">Sign in</a>
        </p>
      </section>
    `,
  });
}

function renderSignedIn(auth, me) {
  const user = me.user || auth.user || {};
  const displayName = user.name || user.email || 'Signed in';
  const avatar = initials(user.name, user.email);

  return renderShell({
    body: `
      <div class="token-banner valid">
        <span aria-hidden="true">✓</span>
        <div><strong>H0 skeleton ready.</strong> Your Neon Auth identity matches AMC A-Lister (<code>sub</code> below).</div>
      </div>
      <section class="panel">
        <h1 class="omc-title">Welcome back</h1>
        <p class="omc-lead">Authenticated via Neon Auth. Capacity planning features land in H1+.</p>
        <div class="auth-chip" style="margin:14px 0">
          <span class="auth-avatar">${escapeHtml(avatar)}</span>
          <span>${escapeHtml(displayName)}</span>
        </div>
        <dl class="omc-identity">
          <div><dt>User id (<code>sub</code>)</dt><dd class="mono">${escapeHtml(user.id || me.auth?.sub || '')}</dd></div>
          <div><dt>Email</dt><dd>${escapeHtml(user.email || '—')}</dd></div>
          <div><dt>Name</dt><dd>${escapeHtml(user.name || '—')}</dd></div>
          <div><dt>Last seen</dt><dd>${escapeHtml(user.last_seen_at ? new Date(user.last_seen_at).toLocaleString() : '—')}</dd></div>
        </dl>
      </section>
    `,
  });
}

async function boot() {
  const root = document.getElementById('app-root');
  const auth = await initAuth();

  if (auth.configured && auth.user && !auth.token) {
    await refreshToken(auth);
  }

  try {
    if (!auth.signedIn || !auth.token) {
      root.innerHTML = renderSignInPrompt(auth);
      wireAuthLink(auth);
      return;
    }

    const me = await meApi.get(auth.token);
    root.innerHTML = renderSignedIn(auth, me);
    wireAuthLink(auth);
  } catch (err) {
    console.error(err);
    if (err.status === 401 && auth.configured) {
      auth.signedIn = false;
      auth.needsReauth = !!auth.user;
      root.innerHTML = renderSignInPrompt(auth);
      wireAuthLink(auth);
      return;
    }
    root.innerHTML = renderShell({
      body: `<section class="panel"><p class="omc-error">${escapeHtml(err.message || 'Something went wrong.')}</p></section>`,
    });
    wireAuthLink(auth);
  }
}

boot();
