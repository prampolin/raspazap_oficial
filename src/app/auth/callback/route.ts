import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { safeAuthRedirectPath } from "@/lib/auth/safe-redirect";
import { profileNeedsCompletion } from "@/lib/auth/profile-completion";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeAuthRedirectPath(searchParams.get("next"), "/dashboard");

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("business_name")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profileNeedsCompletion(profile)) {
          const complete = new URL("/completar-cadastro", origin);
          complete.searchParams.set("next", next);
          return NextResponse.redirect(complete);
        }
      }
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  const login = new URL("/login", origin);
  login.searchParams.set("oauth_error", "1");
  return NextResponse.redirect(login);
}
