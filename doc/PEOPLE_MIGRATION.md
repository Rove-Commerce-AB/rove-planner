# People and app access rollout

This change keeps authentication and planning data separate:

- `app_users` is the login account and system role.
- `consultants` is the optional, allocatable consultant profile.
- `consultants.app_user_id` explicitly links at most one profile to one account.
- `apps` is the app catalogue.
- `app_user_apps` contains the apps assigned to each login account.

Removing an `app_users` row sets `consultants.app_user_id` to `NULL`. It does
not delete the consultant, allocations, customer links, or time reports.

## Files

- Read-only preflight: `scripts/20260911_people_app_access_preflight.sql`
- Transactional migration: `scripts/20260911_people_app_access.sql`
- SQL runner: `scripts/run-sql-file.mjs`

Both SQL files are safe to run with the repository's installed Node
dependencies. The migration is idempotent.

## Dev result, 2026-09-11

The migration was executed against the database configured by the local
`.env.local`:

- 22 app users
- 29 consultants
- 21 unique email matches linked
- 8 consultant-only people
- 0 ambiguous normalized emails
- 0 users without an assigned app

The migration was not run against production.

## Production procedure

1. Deploy application code and migration files together, but do not route
   traffic to the new revision yet.
2. Take or confirm a current Cloud SQL backup.
3. Configure a local env file whose `CLOUD_SQL_URL` points to production.
   Confirm the target shown by the preflight before continuing.
4. Run the read-only preflight:

   ```powershell
   node --env-file=.env.production.local scripts/run-sql-file.mjs scripts/20260911_people_app_access_preflight.sql
   ```

5. Review duplicate-email rows. They are not blockers for the migration:
   ambiguous people are deliberately left unlinked. Record them for manual
   resolution in Settings → People after deployment.
6. Run the migration:

   ```powershell
   node --env-file=.env.production.local scripts/run-sql-file.mjs scripts/20260911_people_app_access.sql
   ```

7. Verify that:
   - the first result set (users with zero apps) is empty;
   - the second result set contains only known email conflicts;
   - linked and consultant-only counts are plausible.
8. Start the new application revision and smoke-test with:
   - an admin;
   - a normal member;
   - an external consultant (underkonsult) with a login.
9. In Settings → People, manually resolve any ambiguous or intentionally
   unmatched consultant profiles.

## Backfill rules

Existing effective access is preserved:

- `admin` and `member`: Planner, Time report, Insights
- former `subcontractor` accounts: Time report (then migrated to `member`;
  see below)

New Rove account creation (`admin`, `member`) requires at
least one app. The application also prevents removing a Rove user's final app
grant. Underkonsult time-report scope is `consultants.is_external`, not a
login role.

`customer` is a separate login role for people at a customer company. Those
accounts must not receive Rove apps (Planner, Time report, Insights, Work),
must not have a consultant profile, and are linked to one or more customers
through `customer_app_users`. They cannot be linked to the internal Rove
customer. See [`DATABASE.md`](DATABASE.md) and
[`scripts/20260911_customer_users.sql`](../scripts/20260911_customer_users.sql).

## Rove Work catalogue row

`scripts/20260911_rove_work_app.sql` adds `work` / `Work` to `apps`. It does
not grant the app to existing users. Admins assign it in Settings → People.
New `admin` / `member` accounts still default to Planner, Time report, and
Insights only.

## Rollback

Prefer rolling the application revision back while leaving the additive schema
in place. The old code ignores the new tables and nullable column.

Do not drop `consultants.app_user_id` after users have been edited in People
without first exporting those links. Dropping the additive objects, if ever
needed after a full rollback, must be a separate reviewed migration.

## Drop `subcontractor` login role (2026-09-13)

File: `scripts/20260913_drop_subcontractor_role.sql`

- Marks consultants linked to a `subcontractor` (or legacy `underkonsult`)
  account as `is_external`.
- Sets those accounts to `member`. Existing Time report grants are kept.
- Tightens `app_users_role_check` to `admin`, `member`, `customer`.

Apps and Settings follow `app_user_apps` plus Admin/Member. Time report
hides the internal customer and limits projects to allocations when the
signed-in consultant is external.

A subcontractor login is always created from an existing consultant profile
(People → Create account). There is no login-only underkonsult.

```powershell
node --env-file=.env.local scripts/run-sql-file.mjs scripts/20260913_drop_subcontractor_role.sql
```

Run the same file against production with the prod env file when deploying
this revision. Do not run production SQL until asked.
