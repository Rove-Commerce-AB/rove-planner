"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/appUsers";

export type FeatureRequest = {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  submitted_by_email: string | null;
  is_implemented: boolean;
};

export async function getFeatureRequests(): Promise<FeatureRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feature_requests")
    .select("id,content,created_at,updated_at,submitted_by_email,is_implemented")
    .order("is_implemented", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as FeatureRequest[];
}

export async function setFeatureRequestImplemented(
  id: string,
  is_implemented: boolean
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("feature_requests")
    .update({ is_implemented, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function createFeatureRequest(content: string): Promise<void> {
  const trimmed = content?.trim();
  if (!trimmed) throw new Error("Content is required");

  const user = await getCurrentAppUser();
  const supabase = await createClient();
  const { error } = await supabase.from("feature_requests").insert({
    content: trimmed,
    submitted_by_email: user?.email ?? null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function updateFeatureRequest(
  id: string,
  content: string
): Promise<void> {
  const trimmed = content?.trim();
  if (!trimmed) throw new Error("Content is required");

  const supabase = await createClient();
  const { error } = await supabase
    .from("feature_requests")
    .update({ content: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function deleteFeatureRequest(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("feature_requests").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}
