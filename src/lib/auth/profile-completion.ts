import type { Tables } from "@/integrations/supabase/types";

export function profileNeedsCompletion(
  profile: Pick<Tables<"profiles">, "business_name"> | null | undefined,
): boolean {
  const v = profile?.business_name?.trim();
  return !v;
}
