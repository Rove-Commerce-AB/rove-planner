const WORK_FILE_IMAGE_RE =
  /!\[([^\]]*)\]\(\/api\/work\/files\/([0-9a-f-]{36})\)/gi;

export function splitWorkInlineImages(text: string): {
  text: string;
  fileIds: string[];
} {
  const fileIds: string[] = [];
  const cleaned = text
    .replace(WORK_FILE_IMAGE_RE, (_match, _alt: string, fileId: string) => {
      if (!fileIds.includes(fileId)) fileIds.push(fileId);
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
  return { text: cleaned, fileIds };
}

export function joinWorkInlineImages(text: string, fileIds: string[]): string {
  const unique = [...new Set(fileIds.filter(Boolean))];
  const body = text.trimEnd();
  if (unique.length === 0) return body;
  const markdown = unique
    .map((id) => `![image](/api/work/files/${id})`)
    .join("\n");
  return body ? `${body}\n\n${markdown}` : markdown;
}

export function workFileImageHref(fileId: string) {
  return `/api/work/files/${fileId}`;
}
