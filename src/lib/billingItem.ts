const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BillingItemRef =
  | { kind: "role"; roleId: string }
  | { kind: "customer_rate"; id: string }
  | { kind: "project_rate"; id: string };

export type AllocationBillingIdentity = {
  role_id: string | null;
  customer_rate_id: string | null;
  project_rate_id: string | null;
};

export function encodeBillingItemKey(ref: BillingItemRef): string {
  if (ref.kind === "role") return ref.roleId;
  if (ref.kind === "customer_rate") return `cr:${ref.id}`;
  return `pr:${ref.id}`;
}

export function parseBillingItemKey(value: string | null | undefined): BillingItemRef | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (v.startsWith("cr:")) {
    const id = v.slice(3);
    return UUID_RE.test(id) ? { kind: "customer_rate", id } : null;
  }
  if (v.startsWith("pr:")) {
    const id = v.slice(3);
    return UUID_RE.test(id) ? { kind: "project_rate", id } : null;
  }
  return UUID_RE.test(v) ? { kind: "role", roleId: v } : null;
}

export function allocationIdentityKey(a: AllocationBillingIdentity): string {
  if (a.project_rate_id) {
    return encodeBillingItemKey({ kind: "project_rate", id: a.project_rate_id });
  }
  if (a.customer_rate_id) {
    return encodeBillingItemKey({ kind: "customer_rate", id: a.customer_rate_id });
  }
  return a.role_id ?? "";
}

export function resolveAllocationIdentity(input: {
  role_id?: string | null;
  customer_rate_id?: string | null;
  project_rate_id?: string | null;
}): AllocationBillingIdentity {
  if (input.customer_rate_id || input.project_rate_id) {
    const parsed = parseBillingItemKey(input.role_id);
    return {
      role_id: parsed?.kind === "role" ? parsed.roleId : null,
      customer_rate_id: input.customer_rate_id ?? null,
      project_rate_id: input.project_rate_id ?? null,
    };
  }
  const parsed = parseBillingItemKey(input.role_id);
  if (!parsed) {
    return { role_id: null, customer_rate_id: null, project_rate_id: null };
  }
  if (parsed.kind === "role") {
    return { role_id: parsed.roleId, customer_rate_id: null, project_rate_id: null };
  }
  if (parsed.kind === "customer_rate") {
    return { role_id: null, customer_rate_id: parsed.id, project_rate_id: null };
  }
  return { role_id: null, customer_rate_id: null, project_rate_id: parsed.id };
}

export function normalizeCustomTaskName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}
