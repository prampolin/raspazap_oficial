/** Limites mensais de raspadinhas (alinhar com migration `enforce_scratch_monthly_limit`). */
export const PLAN_LIMITS = {
  free: 50,
  basic: 1500,
  pro: 5000,
} as const;

export type PlanId = keyof typeof PLAN_LIMITS;

/** Máximo de campanhas por plano (`null` = ilimitado). Alinhar com `enforce_free_plan_campaign_limit`. */
export const PLAN_CAMPAIGN_LIMITS: Record<PlanId, number | null> = {
  free: 1,
  basic: null,
  pro: null,
};

export function maxCampaignsForPlan(subscriptionPlan: string | null | undefined): number | null {
  const p = (subscriptionPlan ?? "free") as PlanId;
  return p in PLAN_CAMPAIGN_LIMITS ? PLAN_CAMPAIGN_LIMITS[p] : PLAN_CAMPAIGN_LIMITS.free;
}

export const PLAN_LABELS: Record<PlanId, string> = {
  free: "Grátis",
  basic: "Básico",
  pro: "PRO",
};

export function planLimit(subscriptionPlan: string | null | undefined): number {
  const p = (subscriptionPlan ?? "free") as PlanId;
  return p in PLAN_LIMITS ? PLAN_LIMITS[p] : PLAN_LIMITS.free;
}
