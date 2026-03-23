-- =============================================================================
-- LIMPEZA DO BANCO — RaspaZap (Supabase / Postgres)
-- Execute no: Supabase Dashboard → SQL Editor → New query
-- Aviso: operação irreversível. Faça backup se precisar dos dados.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- OPÇÃO A — Zerar TUDO (usuários + campanhas + leads)
-- Remove todas as contas de autenticação. Quem tinha login precisa se cadastrar de novo.
-- Com ON DELETE CASCADE, perfis, campanhas, prêmios e raspadinhas somem junto.
-- -----------------------------------------------------------------------------
DELETE FROM auth.users;

-- Se o comando acima falhar por permissão, use o painel:
-- Authentication → Users → selecionar todos → Delete users


-- -----------------------------------------------------------------------------
-- OPÇÃO B — Só dados das campanhas (MANTÉM contas / login)
-- Use se quiser esvaziar campanhas mas manter os usuários em auth.
-- Depois disso cada usuário continua existindo; a tabela profiles pode ficar vazia
-- ou inconsistente — o ideal é recriar perfis ou usar só a Opção A.
-- -----------------------------------------------------------------------------
/*
BEGIN;
TRUNCATE TABLE public.scratch_entries RESTART IDENTITY;
TRUNCATE TABLE public.prizes RESTART IDENTITY;
TRUNCATE TABLE public.campaigns RESTART IDENTITY;
TRUNCATE TABLE public.profiles RESTART IDENTITY;
COMMIT;
*/
