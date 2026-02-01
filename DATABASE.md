# Database Schema – ResursPlanner

This document is the source of truth for the database schema.
When generating SQL, queries, types, or UI logic, follow this strictly.
Terminology: we use **customer** (never client).

---

## customers
Represents a customer/company.

Columns:
- id (uuid, pk)
- name (text)
- contact_name (text, nullable)
- contact_email (text, nullable)
- color (text, default '#3b82f6')  # hex color for allocation and card
- logo_url (text, nullable)        # URL to customer logo
- created_at (timestamptz)
- updated_at (timestamptz)

---

## roles
Roles used for consultants and (optionally) allocation overrides. Also used for customer-specific rates.

Columns:
- id (uuid, pk)
- name (text, unique)
- created_at (timestamptz)
- updated_at (timestamptz)

---

## calendars
Defines working hours per week and a set of holidays per country/region.

Columns:
- id (uuid, pk)
- name (text)           e.g. "Sverige"
- country_code (text)   e.g. "SE", "NO"
- hours_per_week (numeric)
- created_at (timestamptz)
- updated_at (timestamptz)

---

## teams
Team for grouping consultants (e.g. Team Sthlm, Team Helsingborg, Team Polen).

Columns:
- id (uuid, pk)
- name (text, unique)
- created_at (timestamptz)
- updated_at (timestamptz)

---

## calendar_holidays
Holidays belonging to a calendar.

Columns:
- id (uuid, pk)
- calendar_id (uuid, fk → calendars.id)
- holiday_date (date)
- name (text)
- created_at (timestamptz)
- updated_at (timestamptz)

Constraint:
- unique(calendar_id, holiday_date)

---

## consultants
A person that can be allocated to projects. Has a default role, calendar and team.

Columns:
- id (uuid, pk)
- name (text)
- email (text, nullable)
- role_id (uuid, fk → roles.id)
- calendar_id (uuid, fk → calendars.id)
- team_id (uuid, nullable, fk → teams.id)
- is_external (boolean, default false)  # true = external consultant
- work_percentage (smallint, default 100)  # 100 = full-time; 80 = 80% (available hours = calendar × work_percentage/100)
- created_at (timestamptz)
- updated_at (timestamptz)

---

## projects
A project always belongs to a customer.

Columns:
- id (uuid, pk)
- customer_id (uuid, fk → customers.id)
- name (text)
- is_active (boolean, default true)  # false = inactive/archived
- start_date (date, nullable)
- end_date (date, nullable)
- created_at (timestamptz)
- updated_at (timestamptz)

---

## customer_rates
Customer-specific hourly rates per role (used for pricing).

Columns:
- id (uuid, pk)
- customer_id (uuid, fk → customers.id)
- role_id (uuid, fk → roles.id)
- rate_per_hour (numeric)
- currency (text, default 'SEK')
- created_at (timestamptz)
- updated_at (timestamptz)

Constraint:
- unique(customer_id, role_id)

---

## allocations
One row per consultant + project + week.
Used by both views:
- "Per consultant"
- "Per customer"

Columns:
- id (uuid, pk)
- consultant_id (uuid, fk → consultants.id)
- project_id (uuid, fk → projects.id)
- role_id (uuid, nullable, fk → roles.id)  # override role for this allocation (optional)
- year (smallint)
- week (smallint)
- hours (numeric)
- created_at (timestamptz)
- updated_at (timestamptz)

Uniqueness rules:
- If role_id is NOT NULL: unique(consultant_id, project_id, year, week, role_id)
- If role_id is NULL: only one row per (consultant_id, project_id, year, week)

Notes:
- Consultants have a default role, but allocations may override it via role_id.
- Projects always belong to a customer.
- All rollups (per customer, per consultant, dashboards) are derived from allocations + joins.

---
