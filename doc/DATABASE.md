# Database schema

This document mirrors the **PostgreSQL** schema in use (DDL excerpt), e.g. on **Google Cloud SQL**. Use it when generating queries, types, or UI logic.  
Terminology: we use **customer** (never client).

> Additional indexes, unique constraints, and policies may exist in the live database and are not repeated here unless noted.

---

## app_users

Authenticated application users (linked to auth by email).

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK, default `gen_random_uuid()` |
| email | text | NOT NULL, UNIQUE |
| role | text | NOT NULL, default `member`; check: `admin`, `member`, `subcontractor` |
| name | text | nullable |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |

Application code may map legacy DB values (e.g. `underkonsult`) to `subcontractor`.

---

## customers

Customer / company.

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| name | text | NOT NULL |
| contact_name | text | nullable |
| contact_email | text | nullable |
| color | text | default `#3b82f6` |
| logo_url | text | nullable |
| is_active | boolean | NOT NULL, default true |
| account_manager_id | uuid | nullable, FK → `consultants.id` |
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

Which consultants may work on which customers (used e.g. for allocation / time-report access).

| Column | Type | Notes |
|--------|------|--------|
| customer_id | uuid | PK part, FK → `customers.id` |
| consultant_id | uuid | PK part, FK → `consultants.id` |
| created_at | timestamptz | NOT NULL |

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

---

## Relationship summary (short)

- **customers** → **projects** → **allocations** / **time_report_entries**  
- **consultants** ↔ **customers** via **customer_consultants**; **allocations** link consultant + project + week (+ optional role)  
- **customer_rates** / **project_rates** + **roles** drive pricing; **time_report_entries** can store **rate_snapshot** at save  
- **jira_issues** / **devops_work_items** integrate with **projects** for issue pickers  

Authorization and row-level rules are enforced in **application code** (Auth.js + `app_users` + checks in `src/lib/`), not in this DDL excerpt.
