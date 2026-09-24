/**
 * One-shot: migrate feature_requests → Work issues on “Rove Apps”.
 * Usage: node --env-file=.env.prod.local scripts/migrate_feature_requests_to_work.mjs
 *
 * Status mapping: open → Request, implemented → Done, declined → Declined.
 * Reporter = app_users match on submitted_by_email (else null).
 * Owner always null. Preserves created_at / updated_at. Idempotent if board already has issues.
 */
import fs from "fs";
import pg from "pg";
import { parse } from "pg-connection-string";

const BOARD_TITLE = "Rove Apps";

function titleFromContent(content) {
  const firstLine = content.split(/\r?\n/).find((line) => line.trim()) ?? content;
  const trimmed = firstLine.trim();
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 117)}...`;
}

function descriptionFromRequest({ content, requestedBy, declineComment }) {
  const lines = [
    `Requested by: ${requestedBy?.trim() || "unknown"}`,
    "",
    content.trim(),
  ];
  const decline = declineComment?.trim();
  if (decline) {
    lines.push("", `Decline reason: ${decline}`);
  }
  return lines.join("\n");
}

const connectionString = process.env.CLOUD_SQL_URL;
if (!connectionString) {
  console.error("CLOUD_SQL_URL missing");
  process.exit(1);
}

const normalized = connectionString.replace(/^postgresql:/i, "postgres:");
const url = new URL(normalized);
const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
url.searchParams.delete("sslmode");
const parsed = parse(url.toString());
const { ssl: _s, ...connection } = parsed;
void _s;

const client = new pg.Client({
  ...connection,
  ssl: sslMode === "disable" ? false : { rejectUnauthorized: false },
});

await client.connect();

const nullableSql = fs.readFileSync(
  "scripts/20260924_work_issue_nullable_reporter.sql",
  "utf8"
);
await client.query(nullableSql);
console.log("nullable reporter: OK");

const { rows: boards } = await client.query(
  `SELECT id, created_by_app_user_id
   FROM work_boards
   WHERE title = $1 AND archived_at IS NULL
   ORDER BY created_at ASC`,
  [BOARD_TITLE]
);
if (boards.length !== 1) {
  console.error(`Expected 1 board named ${BOARD_TITLE}, found ${boards.length}`);
  process.exit(1);
}
const board = boards[0];

const { rows: statuses } = await client.query(
  `SELECT id, name FROM work_board_statuses WHERE board_id = $1`,
  [board.id]
);
const byName = Object.fromEntries(statuses.map((s) => [s.name, s.id]));
for (const name of ["Request", "Done", "Declined"]) {
  if (!byName[name]) {
    console.error(`Missing status ${name}`);
    process.exit(1);
  }
}

const { rows: existing } = await client.query(
  `SELECT count(*)::int AS n FROM work_issues WHERE board_id = $1`,
  [board.id]
);
if (existing[0].n > 0) {
  console.log(
    `Board already has ${existing[0].n} issues — aborting to avoid duplicates.`
  );
  await client.end();
  process.exit(0);
}

const { rows: requests } = await client.query(
  `SELECT id, content, submitted_by_email, is_implemented, declined_at,
          decline_comment, created_at, updated_at
   FROM feature_requests
   ORDER BY created_at ASC`
);
console.log(`Migrating ${requests.length} feature requests...`);

const emails = [
  ...new Set(
    requests
      .map((r) => r.submitted_by_email?.trim().toLowerCase())
      .filter(Boolean)
  ),
];
const { rows: users } =
  emails.length === 0
    ? { rows: [] }
    : await client.query(
        `SELECT id, lower(email) AS email FROM app_users WHERE lower(email) = ANY($1::text[])`,
        [emails]
      );
const userByEmail = new Map(users.map((u) => [u.email, u.id]));

await client.query("BEGIN");
try {
  await client.query("SELECT id FROM work_boards WHERE id = $1 FOR UPDATE", [
    board.id,
  ]);

  let number = 0;
  const sortByStatus = new Map();

  for (const fr of requests) {
    number += 1;
    let statusId = byName.Request;
    if (fr.declined_at) statusId = byName.Declined;
    else if (fr.is_implemented) statusId = byName.Done;

    const sortOrder = sortByStatus.get(statusId) ?? 0;
    sortByStatus.set(statusId, sortOrder + 1);

    const email = fr.submitted_by_email?.trim() ?? null;
    const reporterId = email
      ? userByEmail.get(email.toLowerCase()) ?? null
      : null;
    const title = titleFromContent(fr.content);
    const description = descriptionFromRequest({
      content: fr.content,
      requestedBy: email,
      declineComment: fr.decline_comment,
    });
    const eventActor = reporterId ?? board.created_by_app_user_id;

    const { rows: inserted } = await client.query(
      `INSERT INTO work_issues (
         board_id, number, title, status, sort_order,
         owner_app_user_id, created_by_app_user_id, description,
         created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, $9)
       RETURNING id`,
      [
        board.id,
        number,
        title,
        statusId,
        sortOrder,
        reporterId,
        description,
        fr.created_at,
        fr.updated_at ?? fr.created_at,
      ]
    );
    const issueId = inserted[0].id;
    if (eventActor) {
      await client.query(
        `INSERT INTO work_issue_events (issue_id, actor_app_user_id, kind, summary, created_at)
         VALUES ($1, $2, 'created', 'migrated from feature request', $3)`,
        [issueId, eventActor, fr.created_at]
      );
    }
  }

  await client.query("COMMIT");
  console.log(`Done. Created ${number} issues on ${BOARD_TITLE}.`);
} catch (e) {
  await client.query("ROLLBACK");
  console.error(e);
  process.exit(1);
}

await client.end();
