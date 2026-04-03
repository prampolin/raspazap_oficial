-- Também aplica o limite de raspadinhas por campanha (max_scratch_entries)

CREATE OR REPLACE FUNCTION public.enforce_scratch_monthly_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid;
  user_plan text;
  limit_count integer;
  used_count integer;
  month_start timestamptz;
  month_end timestamptz;
  campaign_limit integer;
  campaign_used integer;
BEGIN
  SELECT c.user_id, c.max_scratch_entries
  INTO owner_id, campaign_limit
  FROM public.campaigns c
  WHERE c.id = NEW.campaign_id
    AND c.is_active = true;

  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Campanha inválida ou inativa.';
  END IF;

  SELECT p.subscription_plan INTO user_plan
  FROM public.profiles p
  WHERE p.user_id = owner_id;

  IF user_plan IS NULL THEN
    user_plan := 'free';
  END IF;

  limit_count := CASE user_plan
    WHEN 'free' THEN 50
    WHEN 'basic' THEN 1500
    WHEN 'pro' THEN 5000
    ELSE 50
  END;

  month_start :=
    (date_trunc('month', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo');
  month_end := month_start + interval '1 month';

  SELECT count(*)::integer INTO used_count
  FROM public.scratch_entries se
  INNER JOIN public.campaigns c ON c.id = se.campaign_id
  WHERE c.user_id = owner_id
    AND se.scratched_at >= month_start
    AND se.scratched_at < month_end;

  IF used_count >= limit_count THEN
    RAISE EXCEPTION 'Limite mensal de raspadinhas atingido para este negócio.';
  END IF;

  -- Aplica também o limite por campanha, se configurado
  IF campaign_limit IS NOT NULL THEN
    SELECT count(*)::integer INTO campaign_used
    FROM public.scratch_entries se
    WHERE se.campaign_id = NEW.campaign_id;

    IF campaign_used >= campaign_limit THEN
      RAISE EXCEPTION 'Limite de raspadinhas desta campanha atingido.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

