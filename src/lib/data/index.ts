import "server-only";

import { dataMode } from "@/lib/env.server";
import { MockDataSource } from "@/lib/data/mock";
import { SupabaseDataSource } from "@/lib/data/supabase";
import type { DataSource } from "@/lib/data/source";

/**
 * Picks the data source for this deployment.
 *
 * Supabase when `NEXT_PUBLIC_SUPABASE_URL`,
 * `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
 * all set; the in-memory mock otherwise. Requiring all three avoids a
 * half-configured state where public pages read real data but admin writes
 * silently fail.
 */
let cached: DataSource | undefined;

export function getDataSource(): DataSource {
  cached ??= dataMode === "supabase" ? new SupabaseDataSource() : new MockDataSource();
  return cached;
}

export type { DataSource, TeamOption, BroadcastPatch } from "@/lib/data/source";
