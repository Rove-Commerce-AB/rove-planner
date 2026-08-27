import "server-only";

import { GoogleAuth } from "google-auth-library";
import {
  buildChatMessages,
  parseDataAgentStream,
  type DataAgentAnswer,
  type DataAgentHistoryTurn,
  type DataAgentTable,
} from "@/lib/dataAgentParse";

export type { DataAgentAnswer, DataAgentHistoryTurn, DataAgentTable };

const CLOUD_PLATFORM_SCOPE =
  "https://www.googleapis.com/auth/cloud-platform";
const SQL_LOGIN_SCOPE = "https://www.googleapis.com/auth/sqlservice.login";

let googleAuth: GoogleAuth | null = null;

function getGoogleAuth(): GoogleAuth {
  if (!googleAuth) {
    googleAuth = new GoogleAuth({
      scopes: [CLOUD_PLATFORM_SCOPE, SQL_LOGIN_SCOPE],
    });
  }
  return googleAuth;
}

function getDataAgentConfig(): {
  projectId: string;
  location: string;
  agentId: string;
} {
  const projectId = process.env.GCP_PROJECT_ID?.trim() ?? "";
  const agentId = process.env.DATA_AGENT_ID?.trim() ?? "";
  const location = process.env.GCP_LOCATION?.trim() || "us";
  const missing: string[] = [];
  if (!projectId) missing.push("GCP_PROJECT_ID");
  if (!agentId) missing.push("DATA_AGENT_ID");
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
  return { projectId, location, agentId };
}

async function getAccessToken(): Promise<string> {
  const client = await getGoogleAuth().getClient();
  const result = await client.getAccessToken();
  const token = typeof result === "string" ? result : result?.token;
  if (!token) {
    throw new Error("Missing access token for Conversational Analytics API");
  }
  return token;
}

export async function askDataAgent(
  question: string,
  history: DataAgentHistoryTurn[] = []
): Promise<DataAgentAnswer> {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("Question is empty");
  }

  const { projectId, location, agentId } = getDataAgentConfig();
  const accessToken = await getAccessToken();
  const parent = `projects/${projectId}/locations/${location}`;
  const url = `https://geminidataanalytics.googleapis.com/v1/${parent}:chat`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "x-server-timeout": "300",
    },
    body: JSON.stringify({
      parent,
      messages: buildChatMessages(trimmed, history),
      credentials: {
        oauth: {
          token: { accessToken },
        },
      },
      dataAgentContext: {
        dataAgent: `${parent}/dataAgents/${agentId}`,
      },
    }),
    signal: AbortSignal.timeout(300_000),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `Conversational Analytics API error ${response.status}: ${body}`
    );
  }

  return parseDataAgentStream(body);
}
