import LegalDocumentPage from "@/views/LegalDocumentPage";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

export default async function PrivacidadePage() {
  const supabase = createPublicSupabaseClient();
  const { data } = await supabase.from("site_legal").select("privacy_policy").eq("id", 1).maybeSingle();
  const body =
    data?.privacy_policy?.trim() ||
    "A política de privacidade ainda não foi publicada. Tente novamente em instantes.";

  return <LegalDocumentPage title="Política de privacidade" body={body} />;
}
