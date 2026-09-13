export type WorkIssueStatus = string;

export type WorkBoardStatus = {
  id: string;
  name: string;
  sortOrder: number;
  isDone: boolean;
};

export const DEFAULT_WORK_BOARD_STATUSES: {
  name: string;
  isDone: boolean;
}[] = [
  { name: "Todo", isDone: false },
  { name: "In progress", isDone: false },
  { name: "To be tested", isDone: false },
  { name: "In review", isDone: false },
  { name: "Done", isDone: true },
];

export const WORK_STATUS_DOTS = [
  "border-2 border-text-tertiary bg-bg-default",
  "bg-brand-signal",
  "bg-[var(--color-avatar-4-bg)]",
  "bg-brand-blue",
  "bg-[var(--color-avatar-2-bg)]",
] as const;

export function workStatusDotClass(index: number): string {
  return WORK_STATUS_DOTS[index % WORK_STATUS_DOTS.length] ?? WORK_STATUS_DOTS[0];
}
