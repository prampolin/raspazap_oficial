import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isAdminEmail } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const MAX_LEN = 200_000;

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

  const { data, error } = await admin.from("site_legal").select("terms_of_use, privacy_policy, updated_at").eq("id", 1).maybeSingle();

  if (error) {
    console.error("admin legal GET:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    terms_of_use: data?.terms_of_use ?? "",
    privacy_policy: data?.privacy_policy ?? "",
    updated_at: data?.updated_at ?? null,
  });
}

export async function PUT(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const raw = body as { terms_of_use?: unknown; privacy_policy?: unknown };
  let terms_of_use: string | undefined;
  let privacy_policy: string | undefined;

  if (raw.terms_of_use !== undefined) {
    if (typeof raw.terms_of_use !== "string") {
      return NextResponse.json({ error: "terms_of_use deve ser texto." }, { status: 400 });
    }
    if (raw.terms_of_use.length > MAX_LEN) {
      return NextResponse.json({ error: "Termos de uso excedem o tamanho máximo." }, { status: 400 });
    }
    terms_of_use = raw.terms_of_use;
  }
  if (raw.privacy_policy !== undefined) {
    if (typeof raw.privacy_policy !== "string") {
      return NextResponse.json({ error: "privacy_policy deve ser texto." }, { status: 400 });
    }
    if (raw.privacy_policy.length > MAX_LEN) {
      return NextResponse.json({ error: "Política de privacidade excede o tamanho máximo." }, { status: 400 });
    }
    privacy_policy = raw.privacy_policy;
  }

  if (terms_of_use === undefined && privacy_policy === undefined) {
    return NextResponse.json({ error: "Envie terms_of_use e/ou privacy_policy." }, { status: 400 });
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

  const patch: { terms_of_use?: string; privacy_policy?: string } = {};
  if (terms_of_use !== undefined) patch.terms_of_use = terms_of_use;
  if (privacy_policy !== undefined) patch.privacy_policy = privacy_policy;

  const { data, error } = await admin.from("site_legal").update(patch).eq("id", 1).select("terms_of_use, privacy_policy, updated_at").maybeSingle();

  if (error) {
    console.error("admin legal PUT:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    terms_of_use: data?.terms_of_use ?? "",
    privacy_policy: data?.privacy_policy ?? "",
    updated_at: data?.updated_at ?? null,
  });
}
