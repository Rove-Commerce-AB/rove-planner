# Manual regression checklist (by domain)

Use this after refactors or releases that touch the listed areas. Check items that match your change set; record environment (browser, role) and notes in the PR when something fails.

## Auth and session

- [ ] Unauthenticated user cannot access app routes (redirect or error as designed).
- [ ] Google (or configured) sign-in completes and lands on the expected home/dashboard.
- [ ] Sign out clears session; protected routes behave correctly when revisiting.
- [ ] Refresh while logged in keeps the session (no unexpected “logged out” state).

## Allocation

- [ ] Week navigation (prev/next, jump) shows the expected ISO week range and column labels.
- [ ] Grid loads consultants/projects/roles; empty states are sensible.
- [ ] Editing a cell (hours/percentage) saves and reflects after refresh; optimistic UI matches server when slow.
- [ ] Adding or removing an allocation row behaves correctly; validation messages (if any) are correct.
- [ ] Side panel / drill-down (if used) stays in sync with the selected week or cell.
- [ ] Revenue or embed displays (if shown) match expectations for known test data.

## Time report

- [ ] Week navigation matches allocation/time-report date rules (Mon–Sun ISO week).
- [ ] Entering or editing hours per day/project saves and totals look correct.
- [ ] Copy/previous week or similar shortcuts (if present) do not corrupt other weeks.
- [ ] Project manager time report view (if applicable): filters, save, and PM-only rows behave as before.

## Dashboard

- [ ] Main KPIs and charts load without errors for a user with typical data.
- [ ] Read-only behavior: no unintended edits from dashboard widgets.
- [ ] Date or period filters (if any) update figures consistently.

## Detail pages (project, customer, consultant)

- [ ] Read view shows correct linked data (client, rates, allocations snippet, etc.).
- [ ] Inline edit: Enter saves where intended; Escape cancels; blur saves only when value changed (trim behavior).
- [ ] Create/update destructive or archive actions (if any) require confirmation and update the list/detail.

## Settings

- [ ] Users and roles: listing, invite/assign, and permission changes apply after reload.
- [ ] Calendars and holidays: edits appear on allocation/time-report working-day logic where applicable.
- [ ] Other sections (teams, rates, integrations): smoke that primary CRUD paths still work.

## Cross-cutting

- [ ] No unexpected Supabase or RLS errors in the browser console for happy paths.
- [ ] Swedish URL aliases (if used) still redirect to the correct English route.
- [ ] Automated tests: `npm run test:run` passes locally / in CI.
