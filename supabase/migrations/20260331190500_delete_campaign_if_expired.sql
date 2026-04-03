-- Exclusão de campanha apenas após expirar o prazo das raspadinhas

create or replace function public.delete_campaign_if_expired(
  p_campaign_id uuid,
  p_user_id uuid
) returns void
language plpgsql
security definer
as $$
declare
  v_campaign campaigns%rowtype;
  v_total_entries integer;
  v_redeemed_entries integer;
begin
  select *
  into v_campaign
  from public.campaigns
  where id = p_campaign_id
    and user_id = p_user_id;

  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND';
  end if;

  select count(*)
  into v_total_entries
  from public.scratch_entries
  where campaign_id = p_campaign_id;

  select count(*)
  into v_redeemed_entries
  from public.scratch_entries
  where campaign_id = p_campaign_id
    and redeemed = true;

  -- Regra:
  -- - Se não há raspadinhas: pode excluir a qualquer momento
  -- - Se todas as raspadinhas foram resgatadas: pode excluir a qualquer momento
  -- - Caso contrário, só permite excluir depois que o prazo da campanha expirou
  if v_total_entries > 0
     and v_redeemed_entries < v_total_entries
     and v_campaign.created_at + (v_campaign.validity_days || ' days')::interval > now() then
    raise exception 'CAMPAIGN_NOT_EXPIRED';
  end if;

  delete from public.scratch_entries where campaign_id = p_campaign_id;
  delete from public.prizes where campaign_id = p_campaign_id;
  delete from public.campaigns where id = p_campaign_id;
end;
$$;

