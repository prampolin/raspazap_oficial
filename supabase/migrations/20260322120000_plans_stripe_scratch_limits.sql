-- Planos (Grátis, Básico, PRO) + Stripe + limite mensal de raspadinhas (fus America/Sao_Paulo)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_plan text NOT NULL DEFAULT 'free'
    CONSTRAINT profiles_subscription_plan_check CHECK (
      subscription_plan = ANY (ARRAY['free'::text, 'basic'::text, 'pro'::text])
    ),
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text
    CONSTRAINT profiles_subscription_status_check CHECK (
      subscription_status IS NULL
      OR subscription_status = ANY (
        ARRAY['active'::text, 'canceled'::text, 'past_due'::text, 'trialing'::text, 'incomplete'::text, 'unpaid'::text, 'paused'::text]
      )
    ),
  ADD COLUMN IF NOT EXISTS current_period_end timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_stripe_customer_id_key
  ON public.profiles (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_stripe_subscription_id_key
  ON public.profiles (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns (user_id);

-- Uso mensal (mesmo critério do trigger) — só o próprio usuário autenticado
CREATE OR REPLACE FUNCTION public.get_my_monthly_scratch_usage()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      (date_trunc('month', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo') AS ms,
      (date_trunc('month', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo')
        + interval '1 month' AS me
  )
  SELECT count(*)::integer
  FROM public.scratch_entries se
  INNER JOIN public.campaigns c ON c.id = se.campaign_id
  CROSS JOIN bounds b
  WHERE c.user_id = auth.uid()
    AND se.scratched_at >= b.ms
    AND se.scratched_at < b.me;
$$;

REVOKE ALL ON FUNCTION public.get_my_monthly_scratch_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_monthly_scratch_usage() TO authenticated;

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
BEGIN
  SELECT c.user_id INTO owner_id
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_scratch_monthly_limit ON public.scratch_entries;
CREATE TRIGGER trg_enforce_scratch_monthly_limit
  BEFORE INSERT ON public.scratch_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_scratch_monthly_limit();
