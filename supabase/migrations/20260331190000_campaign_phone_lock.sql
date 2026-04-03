-- Trava opcional por número de celular na campanha

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS phone_lock_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_lock_number text;

