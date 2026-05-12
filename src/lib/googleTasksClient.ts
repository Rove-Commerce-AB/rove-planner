import "server-only";

type GoogleTaskList = {
  id: string;
  title: string;
};

export type GoogleTask = {
  id: string;
  title: string;
  notes?: string;
  status?: "needsAction" | "completed";
  due?: string;
  updated?: string;
  deleted?: boolean;
};

type GoogleTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

type GoogleTaskListResponse = {
  items?: GoogleTaskList[];
};

type GoogleTaskListTasksResponse = {
  items?: GoogleTask[];
};

function parseJsonResponse<T>(raw: string): T {
  if (!raw) {
    return {} as T;
  }
  return JSON.parse(raw) as T;
}

export async function refreshGoogleAccessToken(params: {
  refreshToken: string;
}): Promise<{ accessToken: string; tokenType: string | null; expiresAt: Date | null }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth client is not configured.");
  }

  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", params.refreshToken);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Google token refresh failed (${response.status}).`);
  }
  const json = parseJsonResponse<GoogleTokenResponse>(raw);
  if (!json.access_token) {
    throw new Error("Google token refresh returned no access token.");
  }
  const expiresAt =
    typeof json.expires_in === "number" && Number.isFinite(json.expires_in)
      ? new Date(Date.now() + json.expires_in * 1000)
      : null;
  return {
    accessToken: json.access_token,
    tokenType: json.token_type ?? null,
    expiresAt,
  };
}

async function googleTasksRequest<T>(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`https://tasks.googleapis.com/tasks/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Google Tasks request failed (${response.status}).`);
  }
  return parseJsonResponse<T>(raw);
}

export async function findGoogleTaskListByTitle(
  accessToken: string,
  title: string
): Promise<GoogleTaskList | null> {
  const data = await googleTasksRequest<GoogleTaskListResponse>(
    accessToken,
    "/users/@me/lists?maxResults=100"
  );
  const target = title.trim().toLowerCase();
  if (!target) return null;
  const match = (data.items ?? []).find(
    (x) => x.title.trim().toLowerCase() === target
  );
  return match ?? null;
}

export async function createGoogleTaskList(
  accessToken: string,
  title: string
): Promise<GoogleTaskList> {
  return googleTasksRequest<GoogleTaskList>(accessToken, "/users/@me/lists", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function listGoogleTasks(
  accessToken: string,
  taskListId: string
): Promise<GoogleTask[]> {
  const data = await googleTasksRequest<GoogleTaskListTasksResponse>(
    accessToken,
    `/lists/${encodeURIComponent(taskListId)}/tasks?showCompleted=true&showHidden=true&showDeleted=true&maxResults=100`
  );
  return data.items ?? [];
}

export async function insertGoogleTask(
  accessToken: string,
  taskListId: string,
  task: {
    title: string;
    notes?: string | null;
    due?: string | null;
    status?: "needsAction" | "completed";
  }
): Promise<GoogleTask> {
  return googleTasksRequest<GoogleTask>(
    accessToken,
    `/lists/${encodeURIComponent(taskListId)}/tasks`,
    {
      method: "POST",
      body: JSON.stringify({
        title: task.title,
        ...(task.notes != null && String(task.notes).trim() !== ""
          ? { notes: String(task.notes) }
          : {}),
        ...(task.due ? { due: task.due } : {}),
        ...(task.status ? { status: task.status } : {}),
      }),
    }
  );
}

export async function patchGoogleTask(
  accessToken: string,
  taskListId: string,
  taskId: string,
  patch: {
    title?: string;
    notes?: string | null;
    due?: string | null;
    status?: "needsAction" | "completed";
  }
): Promise<GoogleTask> {
  return googleTasksRequest<GoogleTask>(
    accessToken,
    `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    }
  );
}
