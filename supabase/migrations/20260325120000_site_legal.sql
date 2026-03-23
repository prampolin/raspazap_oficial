-- Textos legais da landing (termos e privacidade), editáveis só via service role / API admin.

CREATE TABLE public.site_legal (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  terms_of_use text NOT NULL DEFAULT '',
  privacy_policy text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_legal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site legal"
  ON public.site_legal
  FOR SELECT
  USING (true);

INSERT INTO public.site_legal (id, terms_of_use, privacy_policy)
VALUES (
  1,
  'Edite os termos de uso no painel administrativo (aba Conteúdo do site).',
  'Edite a política de privacidade no painel administrativo (aba Conteúdo do site).'
);

CREATE OR REPLACE FUNCTION public.set_site_legal_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_site_legal_updated_at
  BEFORE UPDATE ON public.site_legal
  FOR EACH ROW
  EXECUTE FUNCTION public.set_site_legal_updated_at();
