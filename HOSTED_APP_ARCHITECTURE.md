# Flexible Planning Platform — Hosted Application Architecture

**Status:** Draft (opinionated)  
**Belongs to:** [Part B](./CAPACITY_PLANNER_SPECIFICATION.md#part-b--flexible-planning-platform-aspirational) of [`CAPACITY_PLANNER_SPECIFICATION.md`](./CAPACITY_PLANNER_SPECIFICATION.md)  
**Not:** Part A near-term SOX Capacity Planner delivery (that remains GitHub Pages–oriented unless/until an explicit rehost decision)  
**Styling reference:** [`templates/blank-styling-template.html`](./templates/blank-styling-template.html)  

This is the **technical deep dive for Part B**: what a flexible planning platform would look like if hosted as a normal web application with a persistent database, authentication, and server-side APIs — instead of a static GitHub Pages site regenerated from CI.

Use **Part A** of the main spec for SOX Capacity Planner behavior and next steps (dependency tracker / SOX Plan Builder). Use **this document** when evaluating or designing the live-site architecture.

---

## 1. Why re-host (Part B)

The current GitHub Pages pipeline is excellent for a read-only SOX capacity dashboard (Part A). It breaks down when you need a flexible, multi-user planning platform:

| Need | Pages + static HTML | Hosted app |
|---|---|---|
| Shared team assignments (not localStorage) | No | Yes |
| Editable Plan Builder / assumptions | Awkward (PRs or Excel) | First-class |
| Auth / role-based edit vs view | No (public to repo readers) | Required |
| Write scenarios, baselines, Non-Jira tasks | Files / SharePoint iframe | DB |
| Publish plan → Jira with audit trail | Manual | API job + ACL |
| Multi-user concurrent planning | Conflicts via Excel | Optimistic locking / scenarios |
| Webhooks / on-demand sync | Hourly cron only | Event + scheduled |

**Recommendation:** Keep the Pages build as a **read-only mirror** during transition if useful, but treat the hosted app as the planning system of record.

---

## 2. Target architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (SPA or SSR)                                        │
│  Mulish design system · section/view nav · capacity grid     │
│  Auth session (cookie / OIDC)                                │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS / JSON API
┌───────────────────────────▼─────────────────────────────────┐
│  Application API                                             │
│  AuthZ · Plan CRUD · Capacity compute · Sync orchestration   │
└───────┬─────────────────────┬───────────────────┬───────────┘
        │                     │                   │
        ▼                     ▼                   ▼
┌───────────────┐   ┌─────────────────┐   ┌──────────────────┐
│ PostgreSQL    │   │ Job workers     │   │ External adapters│
│ (SoR)         │   │ sync, publish,  │   │ Jira, RCM, PTO,  │
│               │   │ alerts, export  │   │ calendar, email  │
└───────────────┘   └─────────────────┘   └──────────────────┘
```

### 2.1 Recommended stack (opinionated)

Pick boring, maintainable defaults that fit internal hosting:

| Layer | Choice | Why |
|---|---|---|
| API | Python (FastAPI) **or** Node (Nest/Express) | Team already has Python in-repo; FastAPI keeps sync/calc logic portable |
| DB | **PostgreSQL** | Multi-user, JSONB for attribute bags, proper authz joins |
| Auth | **OIDC / Okta (or corporate SSO)** + app roles | No custom password store |
| Frontend | React/Vite SPA **or** server-rendered + HTMX | SPA if Plan Builder is highly interactive; keep CSS tokens from blank template |
| Jobs | Queue (Redis + worker) or hosted cron | Replace GHA hourly sync |
| Files | Object storage for Excel exports | Replace `dist/` commit |
| Hosting | Internal PaaS / container (ECS, Cloud Run, etc.) | Not GitHub Pages |

**Do not** keep SQLite as the production SoR. SQLite is fine for local dev mirrors of Jira snapshots only.

### 2.2 What replaces the Pages pipeline

| Today (Pages) | Hosted |
|---|---|
| `sync.py` in GHA → `capacity.db` | Worker job → `jira_issues` tables |
| `generate.py` embeds all data in HTML/JS | API returns capacity matrices; UI renders |
| `patch_html.py` + `gh-pages` | Container deploy / CDN for static assets only |
| `localStorage` team prefs | `user_preferences` + shared `resource.team` |
| `config.deactive_users.json` in git | Admin UI → `resources.active` |
| SharePoint Non-Jira iframe | `plan_items` with `source=manual` |
| “Refresh on GitHub” button | Authenticated **Sync now** → enqueues job |
| Public Pages URL | Private URL + SSO |

---

## 3. Authentication & authorization

### 3.1 Authn

- Corporate SSO via OIDC (Okta / Azure AD — whatever the organization already uses).
- Session cookie (HTTP-only, Secure, SameSite) or short-lived access token + refresh.
- No anonymous access to planning data (SOX staffing is sensitive enough to lock down).

### 3.2 Roles (start simple)

| Role | Capabilities |
|---|---|
| **Viewer** | Read capacity, plan, alerts, navigator; export |
| **Planner** | Edit PlanItems, assumptions, Non-Jira tasks, scenarios; run what-if; request publish |
| **Publisher** | Approve & publish scenario → Jira; manage baselines |
| **Admin** | Policies, resources, deactive flags, provider credentials, field registry |

Map groups from IdP → roles. Default new users to Viewer.

### 3.3 Authz rules of thumb

- Reads: any authenticated role with app access.
- Writes to PlanItems / Policies: Planner+.
- Jira publish: Publisher+ (and always audited).
- Credential management (Jira token): Admin only; tokens in secrets manager, never in git.
- Row-level (optional later): filter by Control Group / team for IT vs BP — not required for MVP.

---

## 4. Data model (database)

Align with the domain model in the main spec. Concrete tables:

### 4.1 Core

```
users                -- from SSO (sub, email, display_name)
roles / user_roles

planning_cycles      -- FY26 BP SOX, etc.
planning_policies    -- versioned JSON + typed columns for common knobs
assumptions          -- cycle_id, text, status, owner_user_id

resources            -- people: name, jira_account_id, team, active
resource_profiles    -- effective_from, weekly_hours OR daily_hours
resource_time_off    -- date range, hours, reason (PTO, holiday, wellness)

field_definitions    -- registry for extensible attributes
work_objects         -- controls / generic work masters (from RCM)
plan_items           -- spine rows (unique_key, phase, attributes JSONB, …)
plan_item_assignments
plan_item_dates
dependencies         -- from_id, to_id, type, status, meta JSONB
forecast_factors

scenarios            -- cycle_id, name, status (draft|active|published|archived)
scenario_overrides   -- sparse overrides on plan_items
baselines            -- frozen snapshot blob or normalized copy

hour_allocations     -- derived cache: person_id, week, hours, role, plan_item_id
```

### 4.2 Integration

```
providers            -- jira, rcm, manual, …
provider_credentials -- secret refs, not raw tokens
sync_runs            -- started_at, status, counts, error
jira_issues          -- key PK, raw JSONB, normalized columns, synced_at
jira_issue_links
jira_comments        -- optional normalized
jira_changelog       -- optional
publish_runs         -- scenario_id, actor, diff summary, status
audit_events         -- who/what/when for edits & publishes
```

### 4.3 Extensibility

- Put SOX-specific columns that change yearly into `plan_items.attributes` JSONB.
- Register each key in `field_definitions` (type, static|dynamic, source, validation).
- Capacity engine reads known keys + registered compute rules — **no migration for every new Excel column**.

---

## 5. API surface (illustrative)

```
POST   /auth/callback | session handled by SSO middleware

GET    /api/cycles
POST   /api/cycles
GET    /api/cycles/:id/policy
PUT    /api/cycles/:id/policy

GET    /api/cycles/:id/plan-items?scenario=
PATCH  /api/plan-items/:id
POST   /api/plan-items
POST   /api/cycles/:id/dependencies

GET    /api/capacity?cycle=&scenario=&mode=due|spread&team=
GET    /api/resources
PATCH  /api/resources/:id

GET    /api/alerts
GET    /api/jira/issues
POST   /api/jira/jql-preview

POST   /api/sync/jira          -- enqueue (Admin/Planner)
GET    /api/sync/runs/:id
POST   /api/scenarios/:id/publish
GET    /api/exports/capacity.xlsx

GET    /api/me
PATCH  /api/me/preferences
```

All mutating routes require CSRF protection (cookie session) or equivalent.

---

## 6. Application modules (replace monolith `generate.py`)

| Module | Responsibility |
|---|---|
| `providers.jira` | Discover fields, fetch issues, normalize (port of `sync.py` / `jira_api.py`) |
| `engine.ready_to_test` | Excel ready-gate rules |
| `engine.dates` | Review +7/+21, phase thresholds |
| `engine.effort` | Review % / floor policies |
| `engine.availability` | Profiles − time off |
| `engine.capacity` | Due-week + spread allocation (port from `generate.py`) |
| `engine.alerts` | Configurable rules (not GitHub-issue stubs) |
| `services.publish` | Diff scenario vs Jira; writeback |
| `services.export` | Excel workbook generation |
| `api.*` | HTTP adapters |

**Opinion:** Port calculation functions first as pure Python (unit-tested). UI is a consumer, not the owner of math — unlike today where math is baked into HTML generation.

---

## 7. Frontend structure

Reuse the blank styling template tokens. Suggested routes:

| Route | Maps to today’s UI / future |
|---|---|
| `/capacity` | Overall / BP / IT / By Person |
| `/plan` | Plan Builder (All Up spine) |
| `/dependencies` | Readiness & dependency board |
| `/alerts` | Alerts |
| `/navigator` | Jira Navigator |
| `/cycle/settings` | Policies, assumptions, resources, calendars |
| `/admin` | Providers, field registry, users/roles |

**Preferences:** Store in DB (`user_preferences`), not only `localStorage`. Optional local cache for UI chrome is fine.

**Realtime (optional later):** SSE/WebSocket for sync job progress; not required for MVP.

---

## 8. Sync & publish flows

### 8.1 Jira → DB (inbound)

```
Scheduler / "Sync now"
  → acquire lease
  → discover field map
  → fetch configured parent initiative hierarchy
  → upsert jira_issues + links
  → optionally refresh comments
  → recompute hour_allocations for execution scenario
  → record sync_run
```

Cadence: hourly weekdays still fine; add webhook later for faster freshness.

### 8.2 Plan → Jira (outbound publish)

```
Publisher selects scenario
  → compute diff vs current Jira fields
  → show WP Changes–style review UI
  → confirm
  → write allowed fields
  → write audit_events + publish_run
  → refresh inbound sync
```

Conflict policy (recommend): **Jira wins on status/comments**; **scenario wins on planning fields** only when publishing. Mid-cycle edits in Jira after publish should surface as drift alerts.

---

## 9. Security & compliance notes

- Jira API tokens in secrets manager; rotate still every ~30 days unless switched to OAuth.
- Audit every publish and policy change (SOX planning evidence hygiene).
- Encrypt data in transit; restrict DB to private network.
- Export downloads authenticated; short-lived signed URLs if using object storage.
- Do not embed secrets in frontend bundles.
- Least-privilege Jira bot user for writeback.

---

## 10. Migration path from Pages → hosted

### Phase H0 — Parallel read (2–4 weeks)

- Stand up app skeleton: SSO, Postgres, empty UI shell with blank template.
- Ingest Jira into Postgres (port `sync.py`).
- Recreate **Capacity** read-only views via API (parity with Pages).
- Keep Pages live; compare numbers.

### Phase H1 — Shared config in DB

- Move deactive users, team membership, weekly/daily capacity into DB admin UI.
- Non-Jira tasks as manual `plan_items` included in capacity.
- Assumptions + policy knobs editable by Planners.

### Phase H2 — Plan Builder

- Import All Up Plan into `plan_items`.
- Ready-to-test / review-due engines.
- Scenario draft vs Jira execution capacity toggle.

### Phase H3 — Publish & retire Pages authority

- Jira publish with diff UI.
- Pages becomes optional public read-only mirror **or** is decommissioned.
- Excel All Up becomes export/import compatibility, not SoR.

### Cutover criteria

- Capacity totals match Pages within rounding tolerance for 2 sync cycles.
- At least one planning cycle phase planned primarily in Plan Builder.
- Publish dry-run reviewed by BP lead.
- SSO roles assigned for Viewer/Planner/Publisher/Admin.

---

## 11. What stays the same vs what changes

### Keep

- Domain layers L0 / L1 / L2 from the main spec  
- Design tokens / Mulish / split-grid UX  
- Jira as execution system of record  
- Calculation semantics (35% review, spread rules) until policies override them  
- Excel export as a download, not the database  

### Change

| Pages world | Hosted world |
|---|---|
| Static HTML generation | API + client render |
| Git as config SoR | DB + admin UI |
| localStorage teams | Shared resources |
| GHA = runtime | GHA = CI only (test/build/deploy) |
| Open Pages URL | Authenticated app |
| “Add alert” → GitHub issue | Alert rules stored & evaluated in-app |
| Hourly full HTML regen | Incremental data sync + on-demand compute/cache |

---

## 12. Local development (hosted)

```bash
# illustrative
docker compose up   # postgres, redis, api, worker
cp .env.example .env
# SSO: use mock auth provider in DEV
make sync-jira      # pulls into local postgres
make web            # frontend on :5173 → API :8000
```

Dev mock auth: `DEV_USER=planner@example.com` bypass when `ENV=development` — never in prod.

---

## 13. Decision log (recommended defaults)

1. **Postgres over SQLite** for production.  
2. **SSO required** before Plan Builder ships with real data.  
3. **Scenarios** before free-edit-on-live-plan (safer for SOX).  
4. **Publish is explicit** — no silent Jira writeback on every blur.  
5. **Pages can remain a mirror** for one cycle after H0, then sunset.  
6. **Same CSS tokens** as blank template / current dashboard — one visual product.

---

## 14. Open questions specific to hosting

1. Where will the app be hosted (internal PaaS, VM, Cloud Run, etc.)?  
2. Which IdP / group claims map to Viewer/Planner/Publisher/Admin?  
3. Is a public read-only Pages mirror still desired after SSO app exists?  
4. Data retention for `jira_issues` raw JSON and audit logs?  
5. Who owns on-call for sync failures (Enablement vs BP)?  

---

*When implementation starts, treat this document as the deployment/runtime architecture and the main specification as the product/domain bible. Keep both in sync when decisions land.*
