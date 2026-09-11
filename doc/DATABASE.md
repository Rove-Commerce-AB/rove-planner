# Database schema

This document mirrors the **PostgreSQL** schema in use (DDL excerpt), e.g. on **Google Cloud SQL**. Use it when generating queries, types, or UI logic.  
Terminology: we use **customer** (never client).

> Additional indexes, unique constraints, and policies may exist in the live database and are not repeated here unless noted.

---

## app_users

Authenticated application users. Google sign-in resolves the account by email;
all internal relationships use the account UUID.

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK, default `gen_random_uuid()` |
| email | text | NOT NULL, UNIQUE |
| role | text | NOT NULL, default `member`; check: `admin`, `member`, `subcontractor`, `customer` |
| name | text | nullable |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |

Application code may map legacy DB values (e.g. `underkonsult`) to `subcontractor`.

---

## apps

Catalogue of assignable Rove apps.

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK, default `gen_random_uuid()` |
| key | text | NOT NULL, UNIQUE; `planner`, `time_report`, `insights`, `work` |
| name | text | NOT NULL |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |

`work` is added by [`scripts/20260911_rove_work_app.sql`](../scripts/20260911_rove_work_app.sql) and is not auto-granted.

---

## app_user_apps

Many-to-many app access assigned to login accounts.

| Column | Type | Notes |
|--------|------|--------|
| app_user_id | uuid | PK part, FK → `app_users.id`, ON DELETE CASCADE |
| app_id | uuid | PK part, FK → `apps.id`, ON DELETE CASCADE |
| created_at | timestamptz | NOT NULL, default now() |

Application actions require every **Rove** account (`admin`, `member`, `subcontractor`) to retain at least one app. `customer` accounts must have none of the Rove apps.

---

## customers

Customer / company.

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| name | text | NOT NULL |
| contact_name | text | nullable; denormalized from the contact user when `contact_app_user_id` is set |
| contact_email | text | nullable; denormalized from the contact user when `contact_app_user_id` is set |
| color | text | default `#3b82f6` |
| logo_url | text | nullable |
| is_internal | boolean | NOT NULL, default false; max one row should be true |
| is_active | boolean | NOT NULL, default true |
| account_manager_id | uuid | nullable, FK → `consultants.id` |
| contact_app_user_id | uuid | nullable, FK → `app_users.id`, ON DELETE SET NULL; must be a `customer` user assigned to this customer |
| url | text | nullable (e.g. website for favicon / links) |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |

---

## roles

Roles for consultants, allocation overrides, and rate tables.

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| name | text | NOT NULL, UNIQUE |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |

---

## calendars

Working-hours context and holiday calendar identifier (holidays in `calendar_holidays`).

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| name | text | NOT NULL |
| country_code | text | NOT NULL; length 2–3 |
| hours_per_week | numeric | NOT NULL, default 40, ≥ 0 |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |

---

## teams

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| name | text | NOT NULL, UNIQUE |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |

---

## calendar_holidays

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| calendar_id | uuid | NOT NULL, FK → `calendars.id` |
| holiday_date | date | NOT NULL |
| name | text | NOT NULL |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |

---

## consultants

Allocatable person; default role, calendar, optional team.

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| app_user_id | uuid | nullable, UNIQUE when present; FK → `app_users.id`, ON DELETE SET NULL |
| name | text | NOT NULL |
| email | text | nullable |
| role_id | uuid | NOT NULL, FK → `roles.id` |
| calendar_id | uuid | NOT NULL, FK → `calendars.id` |
| team_id | uuid | nullable, FK → `teams.id` |
| is_external | boolean | NOT NULL, default false |
| work_percentage | smallint | NOT NULL, default 100; check 5–100 |
| overhead_percentage | smallint | nullable, default 0 |
| start_date | date | nullable |
| end_date | date | nullable |
| birth_date | date | nullable |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |

---

## projects

Belongs to one customer. Optional Jira / DevOps integration fields, PM, budgets.

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| customer_id | uuid | NOT NULL, FK → `customers.id` |
| name | text | NOT NULL |
| start_date | date | nullable |
| end_date | date | nullable |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |
| is_active | boolean | NOT NULL, default true |
| type | `project_type` (enum) | NOT NULL, default `customer` |
| probability | integer | NOT NULL, default 100; check 1–100 |
| jira_project_key | text | nullable; joins `jira_issues.project_key` |
| devops_project | text | nullable; joins `devops_work_items.project` |
| budget_hours | numeric | nullable |
| budget_money | numeric | nullable |
| project_manager_id | uuid | nullable, FK → `consultants.id` |

---

## jira_issues

Synced Jira issues.

| Column | Type | Notes |
|--------|------|--------|
| jira_key | text | PK |
| summary | text | nullable |
| parent_key | text | nullable |
| parent_summary | text | nullable |
| parent_type | text | nullable |
| status | text | nullable |
| created_at | timestamptz | nullable |
| updated_at | timestamptz | nullable |
| due_date | date | nullable |
| issue_type | text | nullable |
| original_estimate_hours | numeric | nullable |
| source_instance | text | nullable |
| last_synced_at | timestamptz | nullable, default now() |
| project_key | text | nullable |
| project_name | text | nullable |
| url | text | nullable |

---

## devops_work_items

Synced Azure DevOps work items.

| Column | Type | Notes |
|--------|------|--------|
| work_item_id | bigint | PK |
| title | text | nullable |
| project | text | nullable |
| state | text | nullable |
| last_synced_at | timestamptz | nullable, default now() |

---

## customer_rates

Customer-level hourly rates per role.

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| customer_id | uuid | NOT NULL, FK → `customers.id` |
| role_id | uuid | NOT NULL, FK → `roles.id` |
| rate_per_hour | numeric | NOT NULL, ≥ 0 |
| currency | text | NOT NULL, default `SEK` |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |

---

## project_rates

Project-level rates per role (override customer rates when present).

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| project_id | uuid | NOT NULL, FK → `projects.id` |
| role_id | uuid | NOT NULL, FK → `roles.id` |
| rate_per_hour | numeric | NOT NULL |
| currency | text | NOT NULL, default `SEK` |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |

---

## customer_consultants

Which consultants may work on which customers. Source of truth for planning,
time reporting, and which customers a consultant sees in Rove apps.

| Column | Type | Notes |
|--------|------|--------|
| customer_id | uuid | PK part, FK → `customers.id` |
| consultant_id | uuid | PK part, FK → `consultants.id` |
| created_at | timestamptz | NOT NULL |

---

## customer_app_users

Which **customer users** belong to which customers. These accounts can log in
and be chosen as the customer contact. They are never allocatable and never
receive Rove apps (Planner, Time report, Insights, Work).

| Column | Type | Notes |
|--------|------|--------|
| customer_id | uuid | PK part, FK → `customers.id`, ON DELETE CASCADE |
| app_user_id | uuid | PK part, FK → `app_users.id`, ON DELETE CASCADE |
| created_at | timestamptz | NOT NULL, default now() |

A person is either a consultant or a customer user, never both. Rows cannot
reference the internal (Rove) customer. Enforced with triggers
(`enforce_customer_user_rules`). Unlinking a user who is the contact clears
`customers.contact_app_user_id`. The app also rejects marking a customer
internal while it still has customer users.

DDL: [`scripts/20260911_customer_users.sql`](../scripts/20260911_customer_users.sql).

---

## allocations

Consultant allocation per project (and optional role) per ISO week.

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| consultant_id | uuid | nullable, FK → `consultants.id` |
| project_id | uuid | NOT NULL, FK → `projects.id` |
| role_id | uuid | nullable, FK → `roles.id` |
| year | smallint | NOT NULL; check 2000–2100 |
| week | smallint | NOT NULL; check 1–53 |
| hours | numeric | NOT NULL, ≥ 0 |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |

Uniqueness and extra constraints: confirm in live DB / migrations (not in the excerpt).

---

## allocation_history

Audit log for allocation changes.

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK, default `gen_random_uuid()` |
| allocation_id | uuid | nullable |
| action | text | NOT NULL; check: `create`, `update`, `delete`, `bulk` |
| changed_by_email | text | NOT NULL |
| changed_at | timestamptz | NOT NULL, default now() |
| details | jsonb | nullable |

---

## time_report_entries

One row per **calendar day** per logical grid row (consultant + customer + project + role + Jira/DevOps key + `display_order`). The app groups rows by week for the time report UI.

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| consultant_id | uuid | NOT NULL, FK → `consultants.id` |
| customer_id | uuid | NOT NULL, FK → `customers.id` |
| project_id | uuid | NOT NULL, FK → `projects.id` |
| role_id | uuid | NOT NULL, FK → `roles.id` |
| jira_devops_key | text | nullable |
| entry_date | date | NOT NULL |
| hours | numeric | NOT NULL, default 0 |
| internal_comment | text | nullable (per-day comment) |
| rate_snapshot | numeric | nullable |
| display_order | smallint | NOT NULL, default 0; separates multiple UI lines with same project/role/jira |
| description | text | nullable; row-level task text |
| pm_edited_hours | numeric | nullable |
| pm_edited_comment | text | nullable |
| pm_edited_at | timestamptz | nullable |
| pm_edited_by | uuid | nullable, FK → `consultants.id` |
| invoiced_at | timestamptz | nullable |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |

Unique / index definitions: see migrations (e.g. uniqueness including `display_order`).

---

## feature_requests

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| content | text | NOT NULL |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |
| submitted_by_email | text | nullable |
| is_implemented | boolean | NOT NULL, default false |
| declined_at | timestamptz | nullable; set when request is declined |
| decline_comment | text | nullable; admin comment shown to reporter |

---

## user_notifications

In-app notifications for authenticated users (`app_users`). Rows are created from application code (e.g. new allocations, feature request implemented).

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK, default `gen_random_uuid()` |
| app_user_id | uuid | NOT NULL, FK → `app_users.id`, ON DELETE CASCADE |
| kind | text | NOT NULL, e.g. `allocation_booked`, `feature_request_implemented`, `feature_request_declined` |
| payload | jsonb | NOT NULL, default `{}`; shape depends on `kind` |
| read_at | timestamptz | nullable; null = unread |
| created_at | timestamptz | NOT NULL, default now() |

Indexes: `(app_user_id, created_at DESC)`; partial `(app_user_id) WHERE read_at IS NULL`.

DDL script: [`sql/20260418_user_notifications.sql`](sql/20260418_user_notifications.sql). If the app DB user (from `CLOUD_SQL_URL`) is not the table owner, run the commented `GRANT` at the end of that script as a superuser so the app can `SELECT`/`INSERT`/`UPDATE` this table.

---

## Relationship summary (short)

- **customers** → **projects** → **allocations** / **time_report_entries**  
- **app_users** ↔ **apps** via **app_user_apps**; Rove accounts must have one or more apps; `customer` accounts have none  
- **app_users** → zero or one **consultants** profile via `consultants.app_user_id` (not allowed when `role = customer`)  
- **consultants** ↔ **customers** via **customer_consultants**; **allocations** link consultant + project + week (+ optional role)  
- **customer** role **app_users** ↔ **customers** via **customer_app_users**; `customers.contact_app_user_id` picks one of those users  
- **customer_rates** / **project_rates** + **roles** drive pricing; **time_report_entries** can store **rate_snapshot** at save  
- **jira_issues** / **devops_work_items** integrate with **projects** for issue pickers  

Authorization and row-level rules are enforced in **application code**
(Auth.js + `app_users` + `app_user_apps` + checks in `src/lib/`), not in this
DDL excerpt. See [`PEOPLE_MIGRATION.md`](PEOPLE_MIGRATION.md) for rollout and
backfill details.
