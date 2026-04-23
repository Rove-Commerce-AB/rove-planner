import "server-only";

import { unstable_cache } from "next/cache";
import { cloudSqlPool } from "@/lib/cloudSqlPool";

const CACHE_REVALIDATE = 2 * 60;

/** Shared consultant list for allocation page and consultants roster (stable cache key). */
export async function getCachedConsultantsRaw() {
  return unstable_cache(
    async () => {
      const { rows } = await cloudSqlPool.query(
        `SELECT id, name, email, role_id, calendar_id, team_id, is_external,
                work_percentage, overhead_percentage, start_date::text, end_date::text
         FROM consultants ORDER BY name`
      );
      return rows;
    },
    ["allocation-consultants"],
    { revalidate: CACHE_REVALIDATE, tags: ["allocation-consultants"] }
  )();
}
