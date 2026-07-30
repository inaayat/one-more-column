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
| [ideation/templates/blank-styling-template.html](./ideation/templates/blank-styling-template.html) | Mulish design tokens + UI chrome |

## Sequencing (short)

1. **H0** — `inaayat.xyz/one-more-column/` skeleton + AMC-style Neon Auth  
2. **C1–C3** — Capacity → dependencies → Plan Builder (**direct entry + optional file upload**)  
3. **C4** — Export + in-app alerts (no external pull)  
4. **P2** — External pull/publish (Jira, etc.) only after v1 is trusted  
5. **P1** — Additional planning profiles  

See [BUILD_PLAN.md](./BUILD_PLAN.md) §0A for the v1 input model and rewrite vs submodule tradeoffs.

## Local development

```bash
git clone https://github.com/inaayat/one-more-column.git
cd one-more-column
git checkout cursor/h15-workspaces-f084   # or main after H1.5 merge

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
