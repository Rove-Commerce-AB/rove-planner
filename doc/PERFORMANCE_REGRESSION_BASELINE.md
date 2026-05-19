# Performance work — regression baseline

Use this checklist **before and after** DB/performance changes. Record environment, role, and date.

Reference: [REGRESSION_CHECKLIST.md](./REGRESSION_CHECKLIST.md) for full app coverage.

## Time report (critical — no data loss)

- [ ] Load **month** view: rows, hours, projects, Jira/DevOps keys match expectations
- [ ] Edit cell → **autosave** → reload page: same values
- [ ] Switch month quickly: no stale month data; loading/error message if timeout
- [ ] **Revision conflict**: second tab/user edit → “changed elsewhere” dialog; reload preserves data
- [ ] Navigate away with unsaved changes: confirm dialog; flush save works
- [ ] **Week** view: single week load unchanged
- [ ] PM time report (if applicable): filters and save unchanged

## Allocation

- [ ] Default URL load: expected week columns (default ~12 weeks)
- [ ] Week prev/next: correct ISO range
- [ ] Cell edit saves; refresh shows same values
- [ ] Wide URL (`from`/`to` spanning many weeks): full range loads, same cells as before
- [ ] No second full-page loading spinner on first visit (after viewport fix)

## Layout / shell

- [ ] Sidebar: notification badge updates within ~1 min of new notification
- [ ] PM menu item visibility correct for PM / non-PM / admin
- [ ] All routes still require auth

## Stability (staging/prod)

- [ ] No `timeout exceeded when trying to connect` in logs under normal team usage (30 min)
- [ ] `GET /api/health` returns 200 when DB is up

## Automated

- [ ] `npm run test:run` passes (includes time-report batch parity when added)
