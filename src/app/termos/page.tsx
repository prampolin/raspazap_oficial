import LegalDocumentPage from "@/views/LegalDocumentPage";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

export default async function TermosPage() {
  const supabase = createPublicSupabaseClient();
  const { data } = await supabase.from("site_legal").select("terms_of_use").eq("id", 1).maybeSingle();
  const body =
    data?.terms_of_use?.trim() ||
    "Os termos de uso ainda não foram publicados. Tente novamente em instantes.";

  return <LegalDocumentPage title="Termos de uso" body={body} />;
}
