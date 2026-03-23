-- Marca scratch_entries como resgatadas no caixa com segurança (evita depender só do UPDATE via PostgREST/RLS).
-- SECURITY DEFINER: o update roda com privilégios do dono da função; ainda assim só altera linhas da campanha do auth.uid().

CREATE OR REPLACE FUNCTION public.mark_scratch_entry_redeemed(p_validation_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_id uuid;
  v_redeemed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  v_norm := regexp_replace(upper(trim(p_validation_code)), '\s', '', 'g');

  IF v_norm = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT se.id, se.redeemed INTO v_id, v_redeemed
  FROM public.scratch_entries se
  INNER JOIN public.campaigns c ON c.id = se.campaign_id AND c.user_id = auth.uid()
  WHERE regexp_replace(upper(trim(se.validation_code)), '\s', '', 'g') = v_norm;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_redeemed THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_redeemed');
  END IF;

  UPDATE public.scratch_entries se
  SET redeemed = true
  WHERE se.id = v_id AND se.redeemed = false;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  RETURN jsonb_build_object('ok', false, 'reason', 'concurrent');
END;
$$;

REVOKE ALL ON FUNCTION public.mark_scratch_entry_redeemed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_scratch_entry_redeemed(text) TO authenticated;

-- Ajuda o PostgREST a enxergar a função nova (útil ao rodar este SQL no editor do painel).
NOTIFY pgrst, 'reload schema';
