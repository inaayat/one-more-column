# one-more-column

because Final_FINAL_Plan wasn’t enough.

Flexible capacity planner — specs and build plan for moving beyond multi-sheet workbook planning.

**Deploy:** Standalone Vercel project with files under `/one-more-column/` and `<base href="/one-more-column/" />`. Production is served at [https://inaayat.xyz/one-more-column/](https://inaayat.xyz/one-more-column/) via rewrites in the main inaayat.xyz (`replacing-nerd-jobs`) `vercel.json`. **Auth:** same `NEON_AUTH_BASE_URL` and `DATABASE_URL` as inaayat.xyz; login via [https://inaayat.xyz/account.html?next=/one-more-column/](https://inaayat.xyz/account.html?next=/one-more-column/) (same Neon users as AMC A-Lister).

**v1 data model:** No pulls from external systems (including Jira). Enter data directly in the app, or optionally upload **XLSX/CSV** when desired. Export to spreadsheet is supported; live sync and publish come later.

## Documents

| Doc | Purpose |
|---|---|
| [ideation/](./ideation/) | Phase 0 specs, architecture, Excel example, design template |
| [BUILD_PLAN.md](./BUILD_PLAN.md) | Phased delivery (platform + capacity + hosted/auth on inaayat.xyz) |
| [ideation/CAPACITY_PLANNER_SPECIFICATION.md](./ideation/CAPACITY_PLANNER_SPECIFICATION.md) | Domain background + flexible platform vision (reference) |
| [ideation/HOSTED_APP_ARCHITECTURE.md](./ideation/HOSTED_APP_ARCHITECTURE.md) | Neon Auth + path proxy + Postgres cutover |
| [ideation/config.excel.example.json](./ideation/config.excel.example.json) | External embed/edit URL example |
| [templates/blank-styling-template.html](./templates/blank-styling-template.html) | Live design reference — tokens and components |
| [FOLLOW_UPS.md](./FOLLOW_UPS.md) | Known gaps and the next changes worth making |

## Sequencing (short)

| Status | Phase | What |
|---|---|---|
| Done | **H0** | Skeleton + Neon Auth on inaayat.xyz |
| Done | **H1** | Postgres SoR: resources, policies, plan items, capacity API |
| Done | **H1.5** | Workspaces (isolated resource pools + cycles) |
| Done | **H2** | Plan Builder UI, scenarios, CSV import |
| Done | **C2** | Dependencies + readiness tracker (core) |
| Done | **C1** | Capacity hardening: bands, assumptions, PTO, effort model |
| Done | **H3 / C4** | CSV export, in-app alerts, import drift |
| Done | **UX1** | Guided plan creation, sidebar shell, reachable guide and alerts |
| Later | **P1** | Additional planning profiles |

See [BUILD_PLAN.md](./BUILD_PLAN.md) for full detail and [FOLLOW_UPS.md](./FOLLOW_UPS.md) for what UX1 deliberately left open.

## Interface

The app is a hash-routed single page. `engine/app.js` owns state and events;
everything else is a pure function of state.

| File | Role |
|---|---|
| `engine/app.js` | State, data loading, event wiring, `render()` |
| `engine/views.js` | One function per page body |
| `engine/wizard.js` | Guided plan creation |
| `engine/shell.js` | Sidebar chrome, toasts, modals, focus preservation |
| `engine/setup.js` | Routes, onboarding progress, nav |
| `engine/app.css` | The only stylesheet |

Routes: `planner`, `capacity`, `alerts`, `team`, `plans`, `rules`, `guide`.
Older hashes (`home`, `settings`, `preferences`, `dependencies`) still resolve —
see `LEGACY_ROUTES` in `engine/setup.js`.

**Visual language:** shared with the rest of inaayat.xyz — cream page, Fraunces
display type, DM Mono labels, teal sidebar matching the project's tile on the
landing grid. See [`templates/blank-styling-template.html`](./templates/blank-styling-template.html).

## Local development

```bash
git clone https://github.com/inaayat/one-more-column.git
cd one-more-column
git checkout main

npm install
cp .env.example .env
# Edit .env — use the same NEON_AUTH_BASE_URL and DATABASE_URL as inaayat.xyz

npm run dev
```

Open **http://localhost:3000/one-more-column/**

Sign in via [inaayat.xyz/account.html](https://inaayat.xyz/account.html?next=http://localhost:3000/one-more-column/) (add `localhost:3000` to Neon Auth trusted domains if the session does not carry over).

| Command | Purpose |
|---|---|
| `npm run dev` | Static UI + `/api/omc-*` + local `/api/auth-config` |
| `npm test` | Engine unit tests |

**Note:** Production is served through inaayat.xyz rewrites; locally the child project exposes its own `auth-config` so you can develop without running the main site.
