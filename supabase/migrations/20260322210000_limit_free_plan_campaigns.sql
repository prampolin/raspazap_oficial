-- Plano grátis: no máximo 1 campanha por conta (planos pagos: sem limite nesta regra)

CREATE OR REPLACE FUNCTION public.enforce_free_plan_campaign_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_plan text;
  existing_count integer;
BEGIN
  SELECT p.subscription_plan INTO user_plan
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;

  IF user_plan IS NULL THEN
    user_plan := 'free';
  END IF;

  IF user_plan = 'free' THEN
    SELECT count(*)::integer INTO existing_count
    FROM public.campaigns c
    WHERE c.user_id = NEW.user_id;

    IF existing_count >= 1 THEN
      RAISE EXCEPTION 'FREE_PLAN_CAMPAIGN_LIMIT: O plano grátis permite apenas 1 campanha. Faça upgrade para criar mais.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_free_plan_campaign_limit ON public.campaigns;
CREATE TRIGGER trg_enforce_free_plan_campaign_limit
  BEFORE INSERT ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_free_plan_campaign_limit();
