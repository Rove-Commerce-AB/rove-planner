"use server";

import { cloudSqlPool, withCloudSqlTransaction } from "@/lib/cloudSqlPool";
import { getCurrentAppUser } from "@/lib/appUsers";

const FEATURE_REQUEST_BOARD_TITLE = "Rove Apps";
const STATUS_REQUEST = "Request";

function titleFromContent(content: string): string {
  const firstLine = content.split(/\r?\n/).find((line) => line.trim()) ?? content;
  const trimmed = firstLine.trim();
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 117)}...`;
}

function descriptionFromRequest(args: {
  content: string;
  requestedBy: string | null;
  declineComment?: string | null;
}): string {
  const lines = [
    `Requested by: ${args.requestedBy?.trim() || "unknown"}`,
    "",
    args.content.trim(),
  ];
  const decline = args.declineComment?.trim();
  if (decline) {
    lines.push("", `Decline reason: ${decline}`);
  }
  return lines.join("\n");
}

async function resolveFeatureRequestBoard(): Promise<{
  boardId: string;
  requestStatusId: string;
}> {
  const { rows: boards } = await cloudSqlPool.query<{ id: string }>(
    `SELECT id
     FROM work_boards
     WHERE title = $1 AND archived_at IS NULL
     ORDER BY created_at ASC
     LIMIT 2`,
    [FEATURE_REQUEST_BOARD_TITLE]
  );
  if (boards.length === 0) {
    throw new Error(`Work board “${FEATURE_REQUEST_BOARD_TITLE}” was not found`);
  }
  if (boards.length > 1) {
    throw new Error(
      `Multiple Work boards named “${FEATURE_REQUEST_BOARD_TITLE}” found`
    );
  }
  const boardId = boards[0]!.id;

  const { rows: statuses } = await cloudSqlPool.query<{ id: string }>(
    `SELECT id
     FROM work_board_statuses
     WHERE board_id = $1 AND name = $2
     LIMIT 1`,
    [boardId, STATUS_REQUEST]
  );
  const requestStatusId = statuses[0]?.id;
  if (!requestStatusId) {
    throw new Error(
      `Status “${STATUS_REQUEST}” is missing on board “${FEATURE_REQUEST_BOARD_TITLE}”`
    );
  }

  return { boardId, requestStatusId };
}

/**
 * Creates a Work issue on the “Rove Apps” board (column Request).
 * Any signed-in user may submit; board membership is not required.
 * Reporter = submitter. Owner is left empty.
 */
export async function createFeatureRequest(content: string): Promise<void> {
  const trimmed = content?.trim();
  if (!trimmed) throw new Error("Content is required");

  const user = await getCurrentAppUser();
  if (!user?.id) throw new Error("Unauthorized");

  const { boardId, requestStatusId } = await resolveFeatureRequestBoard();
  const title = titleFromContent(trimmed);
  const description = descriptionFromRequest({
    content: trimmed,
    requestedBy: user.email ?? null,
  });

  await withCloudSqlTransaction("feature-request-create", async (client) => {
    await client.query("SELECT id FROM work_boards WHERE id = $1 FOR UPDATE", [
      boardId,
    ]);
    const { rows: numberRows } = await client.query<{ next: number }>(
      `SELECT COALESCE(MAX(number), 0) + 1 AS next
       FROM work_issues
       WHERE board_id = $1`,
      [boardId]
    );
    const { rows: orderRows } = await client.query<{ next: number }>(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next
       FROM work_issues
       WHERE board_id = $1 AND status = $2`,
      [boardId, requestStatusId]
    );
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO work_issues (
         board_id, number, title, status, sort_order,
         owner_app_user_id, created_by_app_user_id, description
       ) VALUES ($1, $2, $3, $4, $5, NULL, $6, $7)
       RETURNING id`,
      [
        boardId,
        numberRows[0]?.next ?? 1,
        title,
        requestStatusId,
        orderRows[0]?.next ?? 0,
        user.id,
        description,
      ]
    );
    const issueId = rows[0]?.id;
    if (!issueId) throw new Error("Failed to create feature request");
    await client.query(
      `INSERT INTO work_issue_events (issue_id, actor_app_user_id, kind, summary)
       VALUES ($1, $2, 'created', 'created the issue')`,
      [issueId, user.id]
    );
  });
}
