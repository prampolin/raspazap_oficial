-- Limite opcional de raspadinhas por campanha (armazenado na tabela campaigns)

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS max_scratch_entries integer;

