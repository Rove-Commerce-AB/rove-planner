export type WorkIssueStatus = string;

export type WorkBoardStatus = {
  id: string;
  name: string;
  sortOrder: number;
  isDone: boolean;
};

export const DEFAULT_WORK_PROJECT_STATUSES: {
  name: string;
  isDone: boolean;
}[] = [
  { name: "Todo", isDone: false },
  { name: "In progress", isDone: false },
  { name: "To be tested", isDone: false },
  { name: "In review", isDone: false },
  { name: "Done", isDone: true },
];
