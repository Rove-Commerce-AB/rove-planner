import { cloudSqlPool } from "@/lib/cloudSqlPool";
import { workIssueHref } from "@/lib/routes";
import { workIssueKey } from "@/lib/workIssueKey";

export type WorkIssueTimeOption = {
  value: string;
  label: string;
  customerId?: string;
  boardId?: string;
  url?: string;
};

function optionFromRow(row: {
  id: string;
  number: number;
  title: string;
  prefix: string;
  customer_id?: string;
  board_id?: string;
}): WorkIssueTimeOption {
  const key = workIssueKey(row.prefix, row.number);
  const title = row.title.trim();
  return {
    value: row.id,
    label: title ? `${key} ${title}` : key,
    customerId: row.customer_id,
    boardId: row.board_id,
    url:
      row.customer_id && row.board_id
        ? workIssueHref(row.customer_id, row.board_id, row.id)
        : undefined,
  };
}

export async function fetchWorkIssueTimeOptionsForCustomer(
  customerId: string,
  appUserId: string
): Promise<WorkIssueTimeOption[]> {
  if (!customerId || !appUserId) return [];
  const { rows } = await cloudSqlPool.query<{
    id: string;
    number: number;
    title: string;
    prefix: string;
    customer_id: string;
    board_id: string;
  }>(
    `SELECT i.id, i.number, i.title, b.prefix, b.customer_id, b.id AS board_id
     FROM work_issues i
     JOIN work_boards b ON b.id = i.board_id
     JOIN work_board_members m ON m.board_id = b.id
     WHERE b.customer_id = $1
       AND b.archived_at IS NULL
       AND m.app_user_id = $2
     ORDER BY b.prefix, i.number`,
    [customerId, appUserId]
  );
  return rows.map(optionFromRow);
}

export async function fetchWorkIssueTimeOptionsByIds(
  issueIds: string[]
): Promise<WorkIssueTimeOption[]> {
  const ids = [...new Set(issueIds.filter(Boolean))];
  if (ids.length === 0) return [];
  const { rows } = await cloudSqlPool.query<{
    id: string;
    number: number;
    title: string;
    prefix: string;
    customer_id: string;
    board_id: string;
  }>(
    `SELECT i.id, i.number, i.title, b.prefix, b.customer_id, b.id AS board_id
     FROM work_issues i
     JOIN work_boards b ON b.id = i.board_id
     WHERE i.id = ANY($1::uuid[])
     ORDER BY b.prefix, i.number`,
    [ids]
  );
  return rows.map(optionFromRow);
}

export async function workIssueIdsForCustomer(
  issueIds: string[],
  customerId: string
): Promise<Set<string>> {
  const ids = [...new Set(issueIds.filter(Boolean))];
  if (ids.length === 0 || !customerId) return new Set();
  const { rows } = await cloudSqlPool.query<{ id: string }>(
    `SELECT i.id
     FROM work_issues i
     JOIN work_boards b ON b.id = i.board_id
     WHERE i.id = ANY($1::uuid[])
       AND b.customer_id = $2`,
    [ids, customerId]
  );
  return new Set(rows.map((row) => row.id));
}
