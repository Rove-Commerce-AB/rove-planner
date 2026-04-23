## Rove Planner (this repo)

- **Platform:** Next.js app hosted on Google Cloud Run.
- **Database:** PostgreSQL on Google Cloud SQL. Set `CLOUD_SQL_URL` in `.env.local` (see `src/lib/cloudSqlPool.ts`). Schema notes: [`doc/DATABASE.md`](doc/DATABASE.md).
- **Auth:** Auth.js with Google; app users in PostgreSQL (`app_users`). Architecture: [`doc/PROJECT_RULES.md`](doc/PROJECT_RULES.md).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database Connection Modes

- **Cloud Run (production):** use Cloud SQL unix socket
  - `postgresql://USER:PASSWORD@/postgres?host=/cloudsql/PROJECT:REGION:INSTANCE`
- **Local dev against Cloud SQL public IP:** use TCP URL
  - `postgresql://USER:PASSWORD@HOST/postgres?sslmode=require`
- Production enforces unix socket by default. If you need to bypass temporarily, set:
  - `CLOUD_SQL_ENFORCE_UNIX_SOCKET=false`

### Optional Cloud SQL pool tuning env vars

- `CLOUD_SQL_POOL_MAX` (default in production: `5`)
- `CLOUD_SQL_IDLE_TIMEOUT_MS` (default in production: `20000`)
- `CLOUD_SQL_CONNECTION_TIMEOUT_MS` (default in production: `5000`)
- `CLOUD_SQL_KEEP_ALIVE` (default: `true`)
- `CLOUD_SQL_KEEP_ALIVE_INITIAL_DELAY_MS` (default: `10000`)

You can start editing the page by modifying `src/app/(app)/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
