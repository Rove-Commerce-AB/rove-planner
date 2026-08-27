"use server";

import { assertCanUseDataAgent } from "@/lib/accessGuards";
import {
  askDataAgent,
  type DataAgentAnswer,
  type DataAgentHistoryTurn,
} from "@/lib/dataAgent";

export async function askDataAgentAction(
  question: string,
  history: DataAgentHistoryTurn[] = []
): Promise<DataAgentAnswer> {
  await assertCanUseDataAgent();
  return askDataAgent(question, history);
}
