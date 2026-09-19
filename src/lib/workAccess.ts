import type { AppUserRole } from "@/lib/peopleTypes";

export type WorkActor = {
  id: string;
  role: AppUserRole;
};

export type WorkBoardVisibilityInput = {
  customerIsInternal: boolean;
  memberAppUserIds: readonly string[];
};

/** Admin sees every customer. Others only see assigned customers. */
export function canSeeWorkCustomer(
  actor: WorkActor,
  assignedCustomerIds: readonly string[],
  customerId: string
): boolean {
  if (actor.role === "admin") return true;
  return assignedCustomerIds.includes(customerId);
}

/**
 * Board access is the member list for everyone, including admins.
 */
export function canSeeWorkBoard(
  actor: WorkActor,
  board: WorkBoardVisibilityInput
): boolean {
  return board.memberAppUserIds.includes(actor.id);
}

export function filterVisibleWorkBoards<T extends WorkBoardVisibilityInput>(
  actor: WorkActor,
  boards: readonly T[]
): T[] {
  return boards.filter((board) => canSeeWorkBoard(actor, board));
}
