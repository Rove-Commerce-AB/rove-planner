const TONES = [
  "bg-[var(--color-avatar-1-bg)] text-[var(--color-avatar-1-fg)]",
  "bg-[var(--color-avatar-2-bg)] text-[var(--color-avatar-2-fg)]",
  "bg-[var(--color-avatar-3-bg)] text-[var(--color-avatar-3-fg)]",
  "bg-[var(--color-avatar-4-bg)] text-[var(--color-avatar-4-fg)]",
  "bg-[var(--color-avatar-5-bg)] text-[var(--color-avatar-5-fg)]",
  "bg-[var(--color-avatar-6-bg)] text-[var(--color-avatar-6-fg)]",
] as const;

const SIZES = {
  sm: "h-8 w-8 text-[11px] font-semibold",
  md: "h-10 w-10 text-[13px] font-semibold",
  lg: "h-14 w-14 text-xl font-semibold",
} as const;

type Props = {
  name: string;
  initials: string;
  size?: keyof typeof SIZES;
  className?: string;
};

function toneForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return TONES[hash % TONES.length] ?? TONES[0];
}

export function InitialsAvatar({
  name,
  initials,
  size = "sm",
  className = "",
}: Props) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${SIZES[size]} ${toneForName(name)} ${className}`.trim()}
    >
      {initials}
    </span>
  );
}
