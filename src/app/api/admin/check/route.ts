import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin-auth";

/** Indica se o usuário logado é admin (sem expor a lista de e-mails). */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ admin: false });
  }
  return NextResponse.json({ admin: isAdminEmail(user.email) });
}
