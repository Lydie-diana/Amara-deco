-- Honelia Pay : l'API marchand exige la clé publique (X-API-Key) en plus de la clé secrète.
-- La super admin ne peut donc plus choisir Honelia sans l'avoir saisie.
create or replace function public.admin_set_payment_settings(
  p_provider text,
  p_mode text,
  p_base_url text,
  p_public_key text,
  p_secret_key text default null,
  p_webhook_secret text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s private.payment_settings;
  v_secret uuid;
  v_webhook uuid;
begin
  if not private.is_admin() then
    raise exception 'réservé aux administrateurs' using errcode = '42501';
  end if;
  if p_provider = 'mock' and not private.mock_payments_allowed() then
    raise exception 'mock_not_allowed' using errcode = '22023';
  end if;

  insert into private.payment_settings (id) values (true) on conflict (id) do nothing;
  select * into s from private.payment_settings for update;

  v_secret := private.store_secret(s.secret_key_id, p_secret_key, 'payment_secret_key');
  v_webhook := private.store_secret(s.webhook_secret_id, p_webhook_secret, 'payment_webhook_secret');

  if p_provider = 'honelia' and (nullif(trim(p_base_url), '') is null
                                 or nullif(trim(p_public_key), '') is null
                                 or v_secret is null) then
    raise exception 'missing_credentials' using errcode = '22023';
  end if;

  update private.payment_settings set
    provider = p_provider,
    mode = p_mode,
    base_url = nullif(trim(p_base_url), ''),
    public_key = nullif(trim(p_public_key), ''),
    secret_key_id = v_secret,
    webhook_secret_id = v_webhook,
    updated_at = now(),
    updated_by = auth.uid();
end $$;
