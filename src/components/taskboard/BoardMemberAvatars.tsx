export type BoardMemberAvatarMember = {
  app_user_id: string;
  email: string;
  name: string | null;
};

function memberDisplayLabel(m: BoardMemberAvatarMember): string {
  const n = m.name?.trim();
  if (n) return n;
  return m.email?.trim() || "Unknown";
}

function memberInitials(m: BoardMemberAvatarMember): string {
  const n = m.name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0]![0];
      const b = parts[1]![0];
      if (a && b) return (a + b).toUpperCase();
    }
    const letters = [...n].filter((ch) => /\p{L}/u.test(ch));
    if (letters.length >= 2) return (letters[0]! + letters[1]!).toUpperCase();
    if (letters.length === 1) return letters[0]!.toUpperCase();
    return n.slice(0, 2).toUpperCase() || "?";
  }
  const local = (m.email.split("@")[0] ?? "").replace(/[^a-zA-Z0-9]/g, "");
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  if (local.length === 1) return local.toUpperCase();
  return "?";
}

const MEMBER_AVATAR_CLASS =
  "bg-bg-muted text-text-primary border-[0.5px] border-border-subtle/70";

type Props = {
  members: BoardMemberAvatarMember[];
  /** Where the avatar stack sits inside its row (default `end` for list cards). */
  align?: "start" | "end";
  className?: string;
};

export function BoardMemberAvatars({
  members,
  align = "end",
  className = "",
}: Props) {
  if (members.length === 0) return null;
  const justify = align === "start" ? "justify-start" : "justify-end";
  return (
    <div
      className={`flex shrink-0 items-center -space-x-1.5 ${justify} ${className}`.trim()}
      role="list"
      aria-label="Board members"
    >
      {members.map((m, i) => {
        const label = memberDisplayLabel(m);
        return (
          <span
            key={m.app_user_id}
            role="listitem"
            title={label}
            aria-label={label}
            className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-1 ring-bg-default ${MEMBER_AVATAR_CLASS}`}
            style={{ zIndex: members.length - i }}
          >
            {memberInitials(m)}
          </span>
        );
      })}
    </div>
  );
}
