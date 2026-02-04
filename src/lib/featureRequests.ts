"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FeatureRequest = {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export async function getFeatureRequests(): Promise<FeatureRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feature_requests")
    .select("id,content,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as FeatureRequest[];
}

export async function createFeatureRequest(content: string): Promise<void> {
  const trimmed = content?.trim();
  if (!trimmed) throw new Error("Content is required");

  const supabase = await createClient();
  const { error } = await supabase.from("feature_requests").insert({
    content: trimmed,
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
