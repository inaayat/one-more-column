# one-more-column

because Final_FINAL_Plan wasn’t enough.

Flexible Capacity Planner / SOX planning platform specs and build plan for moving beyond the 30-sheet All Up workbook.

## Documents

| Doc | Purpose |
|---|---|
| [BUILD_PLAN.md](./BUILD_PLAN.md) | Complex phased delivery plan (Track A SOX → Track H hosted → Track B flexible) |
| [CAPACITY_PLANNER_SPECIFICATION.md](./CAPACITY_PLANNER_SPECIFICATION.md) | Part A SOX Capacity Planner + Part B flexible platform |
| [HOSTED_APP_ARCHITECTURE.md](./HOSTED_APP_ARCHITECTURE.md) | Postgres + SSO + API cutover for Part B |
| [config.excel.example.json](./config.excel.example.json) | Non-Jira SharePoint embed/edit example |
| [templates/blank-styling-template.html](./templates/blank-styling-template.html) | Mulish design tokens + UI chrome |

## Sequencing (short)

1. **Track A** — Harden capacity → dependency/readiness → SOX Plan Builder → publish to Jira  
2. **Track H** — Optional hosted SoR (H0–H3) when shared edits/auth outgrow Pages  
3. **Track B** — Multi-profile flexible platform only after SOX Plan Builder is trusted  

See [BUILD_PLAN.md](./BUILD_PLAN.md) for full detail and key functionality gates.
