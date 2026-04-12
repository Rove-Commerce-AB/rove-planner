"use server";

import { revalidatePath } from "next/cache";
import { cloudSqlPool } from "@/lib/cloudSqlPool";
import { getCurrentAppUser } from "@/lib/appUsers";
import { assertNotSubcontractorForWrite } from "@/lib/accessGuards";

export type FeatureRequest = {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  submitted_by_email: string | null;
  is_implemented: boolean;
};

export async function getFeatureRequests(): Promise<FeatureRequest[]> {
  const { rows } = await cloudSqlPool.query<FeatureRequest>(
    `SELECT id, content, created_at::text, updated_at::text, submitted_by_email, is_implemented
     FROM feature_requests
     ORDER BY is_implemented ASC, created_at DESC`
  );
  return rows;
}

export async function setFeatureRequestImplemented(
  id: string,
  is_implemented: boolean
): Promise<void> {
  await assertNotSubcontractorForWrite();
  const { rowCount } = await cloudSqlPool.query(
    `UPDATE feature_requests SET is_implemented = $2, updated_at = now() WHERE id = $1`,
    [id, is_implemented]
  );
  if (!rowCount) throw new Error("Update failed");
  revalidatePath("/settings");
}

export async function createFeatureRequest(content: string): Promise<void> {
  const trimmed = content?.trim();
  if (!trimmed) throw new Error("Content is required");

  const user = await getCurrentAppUser();
  await cloudSqlPool.query(
    `INSERT INTO feature_requests (content, submitted_by_email) VALUES ($1, $2)`,
    [trimmed, user?.email ?? null]
  );
  revalidatePath("/settings");
}

export async function updateFeatureRequest(
  id: string,
  content: string
): Promise<void> {
  await assertNotSubcontractorForWrite();
  const trimmed = content?.trim();
  if (!trimmed) throw new Error("Content is required");

  const { rowCount } = await cloudSqlPool.query(
    `UPDATE feature_requests SET content = $2, updated_at = now() WHERE id = $1`,
    [id, trimmed]
  );
  if (!rowCount) throw new Error("Update failed");
  revalidatePath("/settings");
}

export async function deleteFeatureRequest(id: string): Promise<void> {
  await assertNotSubcontractorForWrite();
  await cloudSqlPool.query(`DELETE FROM feature_requests WHERE id = $1`, [id]);
  revalidatePath("/settings");
}
