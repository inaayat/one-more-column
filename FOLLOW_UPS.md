# Follow-ups

What the UX pass deliberately left open, roughly in the order it's worth doing.
Each item says what's wrong now, why it matters, and where to start.

---

## 1. Saving is still manual

**Now:** the Planner and Team pages collect edits in memory and commit them when
you press *Save changes*. There's a dirty flag, a disabled-until-dirty button,
and a `beforeunload` warning, but nothing writes on its own. Any action that
reloads from the server (adding a gate, deleting a row, switching version)
calls `flushPendingEdits()` first so nothing is lost — which means an unrelated
click can trigger a silent save you didn't ask for.

**Why it matters:** it's the last remaining way to lose work, and the implicit
saves are surprising.

**Where to start:** debounced per-field PATCH on blur, with the row showing a
saved/failed state. `savePlannerGrid()` in `engine/app.js` already builds the
exact payload — it needs to be narrowed from "all rows" to "this row".

---

## 2. `render()` still replaces the entire DOM

**Now:** every state change re-renders the whole page via `innerHTML`. Two
workarounds exist because of it — `captureGridEdits()` reads unsaved input
values back into state before each render, and `captureFocus()`/`restoreFocus()`
put the caret back afterwards.

**Why it matters:** those two helpers are load-bearing. Any new interactive
field must remember to participate in both, or it will quietly lose its value
and steal focus. That's a trap for the next person.

**Where to start:** either keep whole-page renders but move inputs to
`defaultValue`-free controlled patterns, or introduce targeted updates for the
two tables. A ~2KB diffing helper would remove both workarounds outright.

---

## 3. Concurrent edits clobber each other

**Now:** two browsers on the same plan both PATCH the full row set. Last write
wins, silently.

**Why it matters:** the app is multi-user by construction — it's behind shared
Neon Auth, and capacity planning is a team activity.

**Where to start:** `plan_items` and `dependencies` already carry `updated_at`.
Send it back on PATCH and have the handler reject stale writes with a 409, then
show "someone else changed this row" instead of overwriting.

---

## 4. Day-level tracking is offered nowhere but half-implemented everywhere

**Now:** `lib/handlers/capacity.js` coerces any granularity that isn't `month`
to `week`. The wizard and Settings toggle now only offer Week and Month, and
Settings shows a note if it finds a plan already stored as `day`.

**Why it matters:** the schema, the policy object and `engines/period_normalizer.js`
all still talk about days, so it reads as supported to anyone opening the code.

**Where to start:** either implement day columns in `capacity-build.js` and put
the option back, or remove `day` from `schemas/planning_policy.schema.json` and
the engines so the code stops implying it works.

---

## 5. Capacity view settings don't persist

**Now:** the due-vs-spread mode and the week/month toggle live in the DOM. They
reset every reload, and *spread* mode has to be re-picked each visit.

**Where to start:** move both into the plan's policy alongside
`tracking_granularity`, so the plan remembers how its owner reads it.

---

## 6. Creating a plan with a team is N+1 round trips

**Now:** `createPlanFromWizard()` loops `await resourcesApi.create(...)` once per
person. Ten people is ten sequential round trips to a serverless Postgres.

**Where to start:** a bulk POST on `/api/omc-resources` taking an array.
`patchResources` already handles arrays — creation should match.

---

## 7. "Versions" is still the most confusing thing on the Planner

**Now:** the draft/live toggle, the version dropdown, *New draft*, *Make this
the live plan* and *Delete version* are all on screen from the first visit, even
when only one version exists. The copy explains them, but they're still five
controls for a concept most users won't need on day one.

**Where to start:** collapse to a single "Working on: Baseline" control that
only expands into the full set once a second version exists.

---

## 8. Alerts can't be acted on from the Alerts page

**Now:** each alert explains itself and suggests a fix, but you have to navigate
to the Planner and find the row by hand. There's no dismiss or snooze either, so
a known-and-accepted overload nags forever.

**Where to start:** `engines/alerts.js` already puts `plan_item_id` and
`resource_id` on most alerts — link straight to the row, and add a dismissed-until
field keyed to the alert type and target.

---

## 9. The Planner has no sort, filter, or bulk edit

**Now:** rows render in whatever order the API returns. On a real plan of 80
items, finding the one you want means scrolling.

**Where to start:** sort by due date by default, then add column sort and a
text filter. Type is already a field and would make a good filter chip row.

---

## 10. Modals don't trap focus

**Now:** `confirmDialog` and `promptDialog` handle Escape, restore focus to the
opener, and focus the right control on open — but Tab can still walk out of the
dialog into the page behind it.

**Where to start:** a focus-trap loop in `engine/shell.js`, plus `inert` on the
app root while a dialog is open.

---

## 11. There's no page-level test coverage of behaviour

**Now:** `engine/views.test.js` covers rendering, escaping, routing and gating —
all pure functions. Nothing tests the event wiring, which is where the two bugs
this pass fixed actually lived.

**Where to start:** Playwright is already available in the sibling
`replacing-nerd-jobs` repo. A handful of flows would pay for themselves: create
a plan, add a row, edit and save, delete a row with edits pending.

---

## 12. Smaller things

- **`ensureDefaultWorkspace()` names it "Default workspace"** on first list, and
  nothing lets you rename it. The wizard hides this, but the name shows in the
  sidebar. Add rename on the Plans page.
- **Dates are hardcoded `en-US`** in `prettyDate()` and the changelog. Use the
  browser locale.
- **The blocked-row indicator is a 3px red border** on the title input, which is
  easy to miss. The "Can start" badge does the real work; consider dropping the
  border.
- **Capacity band colours should be verified for contrast** — they're paired
  with numbers and text labels so they don't rely on colour alone, but the
  amber-on-cream combination is worth measuring.
- **No skip link** to jump past the sidebar nav.
- **Toasts vanish after ~3s** with no history. A failed save that the user
  glanced away from leaves no trace.
