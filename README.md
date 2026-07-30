# one-more-column

because Final_FINAL_Plan wasn’t enough.

Flexible Capacity Planner / SOX planning platform — specs and build plan for moving beyond the 30-sheet All Up workbook.

**Deploy:** Standalone Vercel project with files under `/one-more-column/` and `<base href="/one-more-column/" />`. Production is served at [https://inaayat.xyz/one-more-column/](https://inaayat.xyz/one-more-column/) via rewrites in the main inaayat.xyz (`replacing-nerd-jobs`) `vercel.json`. **Auth:** same `NEON_AUTH_BASE_URL` and `DATABASE_URL` as inaayat.xyz; login via [https://inaayat.xyz/account.html?next=/one-more-column/](https://inaayat.xyz/account.html?next=/one-more-column/) (same Neon users as AMC A-Lister).

## Documents

| Doc | Purpose |
|---|---|
| [ideation/](./ideation/) | Phase 0 specs, architecture, Excel example, design template |
| [BUILD_PLAN.md](./BUILD_PLAN.md) | Complex phased delivery (Track A SOX → Track H hosted/auth → Track B flexible) |
| [ideation/CAPACITY_PLANNER_SPECIFICATION.md](./ideation/CAPACITY_PLANNER_SPECIFICATION.md) | Part A SOX Capacity Planner + Part B flexible platform |
| [ideation/HOSTED_APP_ARCHITECTURE.md](./ideation/HOSTED_APP_ARCHITECTURE.md) | Neon Auth + path proxy + Postgres cutover |
| [ideation/config.excel.example.json](./ideation/config.excel.example.json) | Non-Jira SharePoint embed/edit example |
| [ideation/templates/blank-styling-template.html](./ideation/templates/blank-styling-template.html) | Mulish design tokens + UI chrome |

## Sequencing (short)

1. **Track A** — Harden capacity → dependency/readiness → SOX Plan Builder → publish to Jira  
2. **Track H** — `inaayat.xyz/one-more-column/` + AMC-style Neon Auth (H0–H3)  
3. **Track B** — Multi-profile flexible platform only after SOX Plan Builder is trusted  

See [BUILD_PLAN.md](./BUILD_PLAN.md) §4 for rewrite vs submodule tradeoffs and the auth checklist.
