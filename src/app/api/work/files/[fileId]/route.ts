import { NextResponse } from "next/server";
import { requireVisibleWorkBoard } from "@/lib/workBoards";
import { fetchWorkIssueFileForDownload } from "@/lib/workIssuesQueries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await context.params;
  const file = await fetchWorkIssueFileForDownload(fileId);
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const visible = await requireVisibleWorkBoard(file.board_id);
    if (!visible) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const isImage = file.mime_type.toLowerCase().startsWith("image/");
  const safeName = file.file_name.replace(/"/g, "");

  return new NextResponse(new Uint8Array(file.content), {
    headers: {
      "Content-Type": file.mime_type,
      "Content-Disposition": isImage
        ? `inline; filename="${safeName}"`
        : `attachment; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
