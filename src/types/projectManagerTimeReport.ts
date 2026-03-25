export type ProjectManagerEntry = {
  id: string;
  entryDate: string;
  consultantId: string;
  consultantName: string;
  customerId: string;
  customerName: string;
  projectId: string;
  task: string;
  jiraDevOpsKey: string | null;
  jiraKey: string | null;
  jiraTitle: string | null;
  hours: number;
  comment: string | null;
  pmEditedHours: number | null;
  pmEditedComment: string | null;
  invoicedAt: string | null;
};
