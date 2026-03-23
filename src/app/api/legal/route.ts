import { NextResponse } from "next/server";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

/** Leitura pública dos textos legais (landing, cadastro, etc.). */
export async function GET() {
  try {
    const supabase = createPublicSupabaseClient();
    const { data, error } = await supabase
      .from("site_legal")
      .select("terms_of_use, privacy_policy, updated_at")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("legal GET:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      terms_of_use: data?.terms_of_use ?? "",
      privacy_policy: data?.privacy_policy ?? "",
      updated_at: data?.updated_at ?? null,
    });
  } catch (e) {
    console.error("legal GET:", e);
    return NextResponse.json({ error: "Configuração do servidor incompleta." }, { status: 503 });
  }
}
