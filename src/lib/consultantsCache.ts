import "server-only";

import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const CACHE_REVALIDATE = 60;

/** Shared consultant list for allocation page and consultants roster (stable cache key). */
export async function getCachedConsultantsRaw() {
  const supabase = await createClient();
  return unstable_cache(
    async () => {
      const { data } = await supabase
        .from("consultants")
        .select(
          "id,name,email,role_id,calendar_id,team_id,is_external,work_percentage,overhead_percentage,start_date,end_date"
        )
        .order("name");
      return data ?? [];
    },
    ["allocation-consultants"],
    { revalidate: CACHE_REVALIDATE, tags: ["allocation-consultants"] }
  )();
}
