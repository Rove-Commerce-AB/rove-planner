# Phase 0 — Refactor inventory (megafiles, UI vs lib, criteria)

**Purpose:** Reduce regression risk and make later refactors measurable. Aligns with [PROJECT_RULES.md](./PROJECT_RULES.md) (no business logic in UI, all database access via `lib/` + server actions, one file = clear responsibility).

**Note:** Line counts and some paths in this doc are a **snapshot**; the live stack uses **PostgreSQL (Cloud SQL) + `pg`**. Re-run a line-count sweep when planning major splits.

**Scope:** Documentation only; no functional changes.

**Snapshot date:** 2025-03-24 (line counts from repo; rounded to nearest line).

---

## 1. File size and responsibility criteria

Use these as **team defaults**; exceptions need a short justification (e.g. generated code, a single tightly coupled wizard).

| Criterion | Target |
|-----------|--------|
| **Typical module size** | Prefer **≤ ~300 lines** per `.ts` / `.tsx` file. Above that: plan a split or document why it must stay monolithic. |
| **Component responsibility** | One primary concern per file (e.g. table OR week nav OR one modal). “God components” that fetch, compute, and render large trees should be sliced vertically. |
| **Business / domain logic** | Belongs in **`src/lib/`** (or server actions calling into `lib/` only). **No occupancy/allocation math, week rules, or validation-only transforms in JSX-heavy files** — see [PROJECT_RULES.md](./PROJECT_RULES.md) §3.1, §3.3. |
| **Non-trivial pure behavior** | If it is worth testing and has no React dependency, prefer a **pure function in `lib/`** (e.g. date/week helpers, aggregation, validation). |
| **Custom React hooks** | **Convention:** add reusable client hooks under **`src/hooks/`** (folder does not exist yet). Today `useEscToClose` lives in `src/lib/useEscToClose.ts`; migrating it is optional housekeeping when you introduce `src/hooks/`. |

---

## 2. Megafiles and near-megafiles (≥ ~200 lines)

Sorted by size. Line counts are non-blank / WC-style totals from PowerShell `Measure-Object -Line` on source files.

| Lines (approx.) | Path | Domain |
|----------------:|------|--------|
| 2656 | `src/components/AllocationPageClient.tsx` | Allocation / planning |
| 1203 | `src/app/(app)/time-report/TimeReportPageClient.tsx` | Time report (consultant) |
| 1115 | `src/components/ProjectDetailClient.tsx` | Project CRUD + embed allocation |
| 887 | `src/components/SettingsPageClient.tsx` | Settings (roles, teams, calendars, users, feature requests) |
| 741 | `src/components/AllocationCustomerProjectTabs.tsx` | Allocation tabs (customer/project tables) |
| 728 | `src/app/(app)/time-report/project-manager/ProjectManagerTimeReportClient.tsx` | PM time report |
| 712 | `src/components/CustomerDetailClient.tsx` | Customer detail |
| 710 | `src/components/ConsultantDetailClient.tsx` | Consultant detail |
| 469 | `src/components/AddAllocationModal.tsx` | Allocation modal |
| 455 | `src/lib/projects.ts` | Data layer (acceptable size; not a UI violation) |
| 453 | `src/lib/allocations.ts` | Data layer |
| 430 | `src/lib/allocationPage.ts` | Allocation page data assembly |
| 389 | `src/app/(app)/time-report/actions.ts` | Server actions (time report) |
| 374 | `src/lib/consultants.ts` | Data layer |
| 362 | `src/components/OccupancyChartPanel.tsx` | Dashboard / charts |
| 362 | `src/components/CustomerRatesTab.tsx` | Customer rates UI |
| 344 | `src/components/EditConsultantModal.tsx` | Consultants |
| 336 | `src/components/EditAllocationRangeModal.tsx` | Allocation |
| 319 | `src/app/(app)/allocation/actions.ts` | Server actions (allocation / history) |
| 316 | `src/components/ProjectsPageClient.tsx` | Projects list |
| 292 | `src/components/CalendarAccordionItem.tsx` | Settings / calendars |
| 292 | `src/components/ui/Combobox.tsx` | Shared UI primitive |
| 277 | `src/components/EditCustomerModal.tsx` | Customers |
| 271 | `src/components/EditProjectModal.tsx` | Projects |
| 255 | `src/app/(app)/time-report/project-manager/actions.ts` | Server actions (PM time report) |
| 248 | `src/lib/customers.ts` | Data layer |
| 247 | `src/components/ProjectRatesTab.tsx` | Project rates UI |
| 242 | `src/components/EditAllocationModal.tsx` | Allocation |
| 237 | `src/components/Sidebar.tsx` | App chrome |
| 206 | `src/lib/occupancyReport.ts` | Data / reporting |
| 206 | `src/lib/dateUtils.ts` | Shared date/week helpers |
| 204 | `src/app/(app)/page.tsx` | Home / dashboard entry |

**Note:** Large **`lib/*.ts`** files are expected to hold data access and domain assembly; the main concern is **client components + actions** gaining unmaintainable mixes of UI and logic.

---

## 3. Public surface per priority megafile

### `AllocationPageClient.tsx`

- **Props:** `data`, `error`, `year`, `weekFrom`, `weekTo`, `currentYear`, `currentWeek`; optional `embedMode`, `onWeekRangeChange`, `embedWeekNavLoading`.
- **Types exported from module:** `ProbabilityDisplay`, `ProjectVisibility` (also used conceptually across allocation UI).
- **Server actions (`@/app/(app)/allocation/actions`):** `revalidateAllocationPage`, `getAllocationHistory`, `logAllocationHistoryCreate`, `logAllocationHistoryUpdate`, `deleteAllocationWithHistory`, `deleteAllocationsWithHistory`, `getBookingAllocationsForRow`.
- **`lib` imports:** `dateUtils`, `allocationPage` (`AllocationPageData`, `TO_PLAN_CONSULTANT_ID`), `constants`, `allocations` (`createAllocation`, `updateAllocation`).
- **`src/types`:** `AllocationHistoryEntry`.
- **Child / dynamic imports:** `AddAllocationModal`, `EditAllocationModal`, `EditAllocationRangeModal`, `AllocationCustomerProjectTabs`, `AllocationHistoryTable`.

### `AllocationCustomerProjectTabs.tsx`

- **Props:** Large “controller” surface: tab mode, `data`, week range, `monthSpans`, `isCurrentWeek`, `renderWeekHeaderCells`, navigation callbacks/URLs, expanded sets, editing cell state, save handlers, and many more (see `AllocationCustomerProjectTabsProps` in file).
- **`lib`:** `AllocationPageData` type only (no direct database access in this file).
- **Note:** Tightly coupled to parent state in `AllocationPageClient`; prime candidate for hooks + presentational split.

### `TimeReportPageClient.tsx`

- **Props:** `consultant`, `customers`, `initialYear`, `initialWeek`, `calendarId`, `initialHolidayDates`.
- **Local types:** `Entry`, `CustomerGroup`, `CustomerOption` (not in `src/types` today — duplication risk if reused elsewhere).
- **Server actions (`./actions`):** `getActiveProjectsForCustomer`, `getJiraDevOpsOptionsForProject`, `getTaskOptionsForCustomerAndProject`, `getHolidayDatesForWeek`, `getTimeReportEntries`, `saveTimeReportEntries`, `copyEntryToWeek` (+ exported `ProjectOption`, `JiraDevOpsOption`, `TaskOption` from actions).
- **`lib` in page:** None directly in client (by design, comment mentions avoiding `dateUtils` in client for bundle reasons — **ISO week logic is duplicated locally**).

### `ProjectManagerTimeReportClient.tsx`

- **Props (inline):** `isAdmin`, `consultantId`, `customers`, `projects`, `initialYear`, `initialMonth`.
- **Server actions (`./actions`):** `pmSetInvoicingStatus`, `pmSetInvoicingStatusBulk`, `pmUpdateTimeEntry`, `getProjectManagerTimeEntries`, type `ProjectManagerEntry`.
- **`lib`:** `getMonthLabel` from `dateUtils`.

### `ProjectDetailClient.tsx`

- **Props:** `project` (`ProjectWithDetails`), `allocationData`, `allocationError`, allocation week range, `currentYear`, `currentWeek`, optional `allocationRates`.
- **Server actions:** `getProjectAllocationData` from `@/app/(app)/allocation/actions`; `moveEntireBookingAction` from `@/app/(app)/projects/[id]/actions`.
- **`lib`:** `projects`, `customers`, `consultants`, `inlineEdit`.
- **`src/types`:** `ProjectWithDetails`, `ProjectType`.
- **`lib` types:** `AllocationPageData`.
- **Dynamic:** `AllocationPageClient` (embed).

### `CustomerDetailClient.tsx`

- **Props:** `customer` (`CustomerWithDetails`), `initialConsultants`, `allConsultants`.
- **Server actions:** `updateCustomerAction`, `deleteCustomerAction` from `@/app/(app)/customers/actions`.
- **`lib`:** `customerConsultants`, `constants`, `inlineEdit`.
- **`src/types`:** `CustomerWithDetails`.

### `ConsultantDetailClient.tsx`

- **Props:** `consultant` (`ConsultantForEdit`), optional `isAdmin`.
- **`lib`:** `consultants`, `roles`, `calendars`, `teams`, `inlineEdit` (client calls `getRoles` / `getCalendars` / `getTeams` from browser — data layer used as client API).

### `SettingsPageClient.tsx`

- **Props:** `roles`, `teams`, `calendars`, `appUsers`, `currentAppUser`, `featureRequests`, `error` (shapes from `getRoles`, `getTeams`, `getCalendarsWithHolidayCount`, `AppUser`, `FeatureRequest`).
- **`lib`:** `roles`, `teams`, `calendars`, `appUsers`, `featureRequests`, `inlineEdit`.
- **Modals:** `AddAppUserModal`, `AddRoleModal`, `AddTeamModal`, `AddCalendarModal`, `CalendarAccordionItem`.

---

## 4. Business logic in UI vs `lib` (by domain)

### Allocation

| Location | What |
|----------|------|
| **`lib`** | `allocationPage.ts` assembles `AllocationPageData`; `allocations.ts` CRUD; `dateUtils` week/month helpers. |
| **UI (`AllocationPageClient`)** | **Display math:** `getProjectProbabilityMap`, `getDisplayHours`, `showProbabilitySymbol` — weighted hours and visibility; should move to testable `lib` helpers (e.g. `lib/allocationDisplay.ts`) per PROJECT_RULES. |
| **UI** | Large table state, editing cells, expand/collapse — acceptable as orchestration if trimmed; consider **`useAllocationTableState`**-style hook in `src/hooks/`. |
| **Server actions** | History logging, revalidation, booking row fetches — keep thin; domain rules shared with `lib` where possible. |

### Time report

| Location | What |
|----------|------|
| **`lib` / actions** | `time-report/actions.ts` uses `createClient` (server), delegates to `lib/projects`, integrations, rates, holidays, `dateUtils`. |
| **UI (`TimeReportPageClient`)** | **Duplicated ISO week calendar logic** (`getISOWeekDateRangeLocal`, `getYearWeekForDateLocal`, `isoWeeksInYearLocal`, `addWeeksToYearWeekLocal`, `getWeeksInMonthLocal`) — should unify with `lib/dateUtils` (or a thin `lib/isoWeekClient.ts` re-export) if bundle constraints allow. |
| **UI** | `groupTotalHours`, `dayTotals`, task cache keys — small aggregates; candidates for `lib/timeReport.ts` if reused or tested. |

### Settings

| Location | What |
|----------|------|
| **`lib`** | CRUD for roles, teams, calendars, app users, feature requests. |
| **UI** | Mostly forms and inline edit; **orchestration** is heavy (many `useState` branches). Split by section into subcomponents + optional hooks; little numeric domain logic. |

### Detail pages (customer / consultant / project)

| Location | What |
|----------|------|
| **`lib`** | Entity updates via `lib/*` or route `actions`. |
| **UI** | Inline edit wiring, planning panel layout constants in `ProjectDetailClient` — layout/constants OK; any **derived planning width/week math** should stay in named helpers if it grows. |

---

## 5. `src/types` usage (shared DTOs)

Megafiles depend on centralized types mainly for **entities**: `ProjectWithDetails`, `CustomerWithDetails`, `AllocationHistoryEntry`, etc. (see `src/types/index.ts`).

**Gaps:** Time report client-local types (`Entry`, `CustomerGroup`, `CustomerOption`) and some action-exported option types live next to UI/actions — **Phase 3** should consolidate if the same shapes appear in multiple routes.

---

## 6. Database access (current stack)

- **Single path:** Server-only access via `pg` (`src/lib/cloudSqlPool.ts`) and query modules under `src/lib/*Queries.ts` / wrappers.
- **Auth:** Auth.js (Google); `app_users` and role checks in `lib/` gate mutations and sensitive reads.
- **No browser DB client:** Client components use server actions or serialized props only.

---

## 7. Suggested issue / TODO groups (for tracking)

Group work items roughly as follows (no need to create all at once):

1. **Allocation display logic** — Extract probability/visibility hour helpers from `AllocationPageClient` to `lib` + tests.
2. **Allocation UI split** — `components/allocation/*`: week header/nav, consultant table, customer/project tabs, modals; optional `useAllocation*` hooks.
3. **Time report** — Deduplicate ISO week helpers with `dateUtils`; split `TimeReportPageClient` and share pieces with PM client if overlap appears.
4. **Project / customer / consultant details** — Extract “read vs edit” sections; shared inline-edit patterns already in `lib/inlineEdit.ts` + UI.
5. **Settings** — One file per section (users, roles, teams, calendars, feature requests) + thin container.
6. **Types** — Move repeated time-report DTOs to `src/types` when shared.
7. **Data layer hygiene** — Keep query logic in `lib/`; avoid duplicating connection patterns outside `cloudSqlPool`.

---

## 8. Verification

- Re-run line-count sweep:  
  `Get-ChildItem -Recurse -Include *.tsx,*.ts` (exclude `node_modules`) and filter `Lines -ge 200` after major refactors.
- When splitting files, preserve **props and action imports** listed in §3 for grep-friendly regression checks.
