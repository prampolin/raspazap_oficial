-- Testes: prêmio / código FORA do prazo de validade
-- A app considera válido até: scratched_at + validity_days (campo em campaigns).
-- Rode no Supabase → SQL Editor (modo que respeita RLS ou use service role se necessário).

-- 1) Listar participações que já estão EXPIRADAS (lógica alinhada ao Dashboard)
SELECT
  se.id,
  se.validation_code,
  se.customer_name,
  se.scratched_at,
  c.validity_days,
  (se.scratched_at + c.validity_days * interval '1 day') AS valido_ate,
  NOW() AS agora,
  (NOW() > se.scratched_at + c.validity_days * interval '1 day') AS expirado
FROM public.scratch_entries se
JOIN public.campaigns c ON c.id = se.campaign_id
ORDER BY se.scratched_at DESC;

-- 2) FORÇAR um código a ficar fora do prazo (troque o código)
-- Ex.: campanha com validity_days = 7 → raspagem há 30 dias já expirou.
UPDATE public.scratch_entries
SET scratched_at = NOW() - INTERVAL '30 days'
WHERE validation_code = 'COLOQUE_SEU_CODIGO_AQUI';

-- 3) (Opcional) Conferir só aquele código depois do UPDATE
SELECT
  se.validation_code,
  se.scratched_at,
  c.validity_days,
  (se.scratched_at + c.validity_days * interval '1 day') AS valido_ate,
  (NOW() > se.scratched_at + c.validity_days * interval '1 day') AS expirado
FROM public.scratch_entries se
JOIN public.campaigns c ON c.id = se.campaign_id
WHERE se.validation_code = 'COLOQUE_SEU_CODIGO_AQUI';
