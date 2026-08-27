"use server";

import { assertCanUseDataAgent } from "@/lib/accessGuards";
import { askDataAgent, type DataAgentAnswer } from "@/lib/dataAgent";

export async function askDataAgentAction(
  question: string
): Promise<DataAgentAnswer> {
  await assertCanUseDataAgent();
  return askDataAgent(question);
}
