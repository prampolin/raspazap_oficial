-- Lista de números autorizados por campanha

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS phone_lock_whitelist text[];

