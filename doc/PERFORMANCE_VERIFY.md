# Performance verification (post DB plan)

Use this after deploying pool/layout/allocation/time-report changes.

## Automated checks

```bash
npm run test:run
```

Includes allocation week clamp tests and time-report batch-load parity (delegates to the same per-week loader).

## Manual regression

Work through [`REGRESSION_CHECKLIST.md`](REGRESSION_CHECKLIST.md) and [`PERFORMANCE_REGRESSION_BASELINE.md`](PERFORMANCE_REGRESSION_BASELINE.md), with extra focus on:

- **Time report:** month load, autosave, reload, revision conflict, navigate away with unsaved data
- **Allocation:** same cells for same URL; long week ranges (e.g. full year view) load as before
- **Layout:** notifications badge, PM nav (acceptable short TTL staleness)

## Load / connections (staging or prod-like)

1. Set Cloud Run to recommended values in [`README.md`](../README.md) (concurrency 2–3, pool max 5, max instances 3–5).
2. Enable **Query insights** on Cloud SQL if not already enabled.
3. With 3–5 people (or scripted browsers) using allocation + time-report for ~30 minutes:
   - No `timeout exceeded when trying to connect` in logs
   - GCP **PostgreSQL Connections** stays under ~15 during normal use
4. Optional: `curl -s -o /dev/null -w "%{http_code}" https://<service>/api/health` — expect `200` when healthy.

## “Done” criteria

| Area | Criterion |
|------|-----------|
| Stability | No connection acquire timeouts under moderate parallel use |
| Connections | GCP graph &lt; ~15 at steady state with new settings |
| Time report | Same data after month load/save/reload; batch load matches prior per-week loads |
| Allocation | Same grid for same URL, including wide week ranges |
| Reports | Occupancy charts match pre-change numbers for same week range (admin) |
