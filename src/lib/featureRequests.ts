"use server";

import { revalidatePath } from "next/cache";
import { cloudSqlPool } from "@/lib/cloudSqlPool";
import { getCurrentAppUser } from "@/lib/appUsers";
import { assertNotSubcontractorForWrite } from "@/lib/accessGuards";

type LinearConfig = {
  apiKey: string;
  teamId: string;
  projectId: string;
};

function getLinearConfig(): LinearConfig | null {
  const apiKey = process.env.LINEAR_API_KEY?.trim();
  const teamId = process.env.LINEAR_TEAM_ID?.trim();
  const projectId = process.env.LINEAR_PROJECT_ID?.trim();

  if (!apiKey || !teamId || !projectId) {
    console.warn(
      "[featureRequests] Linear disabled: missing LINEAR_API_KEY, LINEAR_TEAM_ID or LINEAR_PROJECT_ID"
    );
    return null;
  }

  return { apiKey, teamId, projectId };
}

async function createLinearIssueForFeatureRequest(args: {
  content: string;
  submittedByEmail: string | null;
}) {
  const config = getLinearConfig();
  if (!config) return;

  const title = args.content.length > 120 ? `${args.content.slice(0, 117)}...` : args.content;
  const descriptionLines = [
    "Created from Rove Planner feature request.",
    "",
    `Requested by: ${args.submittedByEmail ?? "unknown"}`,
    "",
    "Request content:",
    args.content,
  ];

  const mutation = `
    mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          url
        }
      }
    }
  `;

  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: config.apiKey,
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        input: {
          title,
          description: descriptionLines.join("\n"),
          teamId: config.teamId,
          projectId: config.projectId,
        },
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Linear API HTTP ${response.status}`);
  }

  const result = (await response.json()) as {
    errors?: Array<{ message?: string }>;
    data?: {
      issueCreate?: {
        success?: boolean;
      };
    };
  };

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message ?? "Unknown error").join("; "));
  }

  if (!result.data?.issueCreate?.success) {
    throw new Error("Linear issueCreate returned success=false");
  }
}

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
  const submittedByEmail = user?.email ?? null;
  await cloudSqlPool.query(
    `INSERT INTO feature_requests (content, submitted_by_email) VALUES ($1, $2)`,
    [trimmed, submittedByEmail]
  );

  try {
    await createLinearIssueForFeatureRequest({
      content: trimmed,
      submittedByEmail,
    });
  } catch (error) {
    console.error("[featureRequests] Failed to create Linear issue", error);
  }

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
