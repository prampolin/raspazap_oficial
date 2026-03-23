import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isAdminEmail } from "@/lib/admin-auth";
import type { Tables } from "@/integrations/supabase/types";

export const dynamic = "force-dynamic";

type ProfileRow = Tables<"profiles">;
type CampaignRow = Tables<"campaigns">;
type ScratchRow = Tables<"scratch_entries">;

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Configure SUPABASE_SERVICE_ROLE_KEY no servidor." },
      { status: 503 },
    );
  }

  try {
    const [
      profilesRes,
      campaignsRes,
      entriesCountRes,
      prizesCountRes,
      campaignsActiveRes,
      entriesForAgg,
      recentEntriesRes,
    ] = await Promise.all([
      admin.from("profiles").select("*"),
      admin.from("campaigns").select("*").order("created_at", { ascending: false }),
      admin.from("scratch_entries").select("*", { count: "exact", head: true }),
      admin.from("prizes").select("*", { count: "exact", head: true }),
      admin.from("campaigns").select("*", { count: "exact", head: true }).eq("is_active", true),
      admin.from("scratch_entries").select("campaign_id"),
      admin
        .from("scratch_entries")
        .select("*")
        .order("scratched_at", { ascending: false })
        .limit(100),
    ]);

    const profiles = (profilesRes.data ?? []) as ProfileRow[];
    const campaigns = (campaignsRes.data ?? []) as CampaignRow[];
    const totalEntries = entriesCountRes.count ?? 0;
    const totalPrizes = prizesCountRes.count ?? 0;
    const activeCampaigns = campaignsActiveRes.count ?? 0;

    const byPlan: Record<string, number> = {};
    for (const p of profiles) {
      const k = p.subscription_plan ?? "free";
      byPlan[k] = (byPlan[k] ?? 0) + 1;
    }

    const entryCountByCampaign: Record<string, number> = {};
    for (const row of entriesForAgg.data ?? []) {
      const id = (row as { campaign_id: string }).campaign_id;
      entryCountByCampaign[id] = (entryCountByCampaign[id] ?? 0) + 1;
    }

    const profileByUserId = Object.fromEntries(profiles.map((p) => [p.user_id, p]));

    const authUsers: Array<{
      id: string;
      email: string | null;
      created_at: string;
      last_sign_in_at: string | null;
    }> = [];

    try {
      let page = 1;
      const perPage = 200;
      for (;;) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) throw error;
        const batch = data?.users ?? [];
        for (const u of batch) {
          authUsers.push({
            id: u.id,
            email: u.email ?? null,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at ?? null,
          });
        }
        if (batch.length < perPage) break;
        page += 1;
      }
    } catch (e) {
      console.error("admin listUsers:", e);
    }

    authUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const usersPayload = authUsers.map((u) => {
      const pr = profileByUserId[u.id] as ProfileRow | undefined;
      return {
        id: u.id,
        email: u.email,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at,
        businessName: pr?.business_name ?? null,
        subscriptionPlan: pr?.subscription_plan ?? "free",
        subscriptionStatus: pr?.subscription_status ?? null,
        stripeCustomerId: pr?.stripe_customer_id ?? null,
      };
    });

    const emailByUserId = Object.fromEntries(
      authUsers.map((u) => [u.id, u.email]),
    );

    const campaignsPayload = campaigns.map((c) => {
      const owner = profileByUserId[c.user_id];
      return {
        id: c.id,
        userId: c.user_id,
        title: c.title,
        slug: c.slug,
        isActive: c.is_active,
        createdAt: c.created_at,
        minPurchase: c.min_purchase,
        validityDays: c.validity_days,
        entryCount: entryCountByCampaign[c.id] ?? 0,
        ownerEmail: emailByUserId[c.user_id] ?? null,
        ownerBusinessName: owner?.business_name ?? null,
        ownerPlan: owner?.subscription_plan ?? "free",
      };
    });

    const recentRaw = (recentEntriesRes.data ?? []) as ScratchRow[];
    const campaignIds = [...new Set(recentRaw.map((e) => e.campaign_id))];
    const prizeIds = [...new Set(recentRaw.map((e) => e.prize_id))];

    const [campTitles, prizeNames] = await Promise.all([
      campaignIds.length
        ? admin.from("campaigns").select("id,title").in("id", campaignIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      prizeIds.length
        ? admin.from("prizes").select("id,name").in("id", prizeIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const titleByCamp = Object.fromEntries(
      (campTitles.data ?? []).map((r) => [(r as { id: string }).id, (r as { title: string }).title]),
    );
    const nameByPrize = Object.fromEntries(
      (prizeNames.data ?? []).map((r) => [(r as { id: string }).id, (r as { name: string }).name]),
    );

    const recentEntries = recentRaw.map((e) => ({
      id: e.id,
      scratchedAt: e.scratched_at,
      customerName: e.customer_name,
      customerWhatsapp: e.customer_whatsapp,
      campaignTitle: titleByCamp[e.campaign_id] ?? "—",
      prizeName: nameByPrize[e.prize_id] ?? "—",
      redeemed: e.redeemed,
      validationCode: e.validation_code,
    }));

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      counts: {
        authUsers: authUsers.length,
        profiles: profiles.length,
        campaigns: campaigns.length,
        campaignsActive: activeCampaigns,
        scratchEntries: totalEntries,
        prizes: totalPrizes,
      },
      planByCount: byPlan,
      users: usersPayload,
      campaigns: campaignsPayload,
      recentEntries,
    });
  } catch (e) {
    console.error("admin overview", e);
    return NextResponse.json({ error: "Falha ao carregar dados" }, { status: 500 });
  }
}
