import { NextResponse } from "next/server";
import { updateLitiumVersionsBySubscriptionId } from "@/lib/customers";
import {
  litiumVersionApiKeyConfigured,
  parseLitiumVersionPayload,
  requestHasLitiumVersionApiKey,
} from "@/lib/litiumVersion";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!litiumVersionApiKeyConfigured()) {
    return NextResponse.json(
      { error: "Litium version endpoint is not configured." },
      { status: 503 }
    );
  }
  if (!requestHasLitiumVersionApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = parseLitiumVersionPayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await updateLitiumVersionsBySubscriptionId(parsed.items);
  return NextResponse.json({
    updated: result.updated,
    notFound: result.notFound,
    invalid: parsed.invalid,
  });
}
