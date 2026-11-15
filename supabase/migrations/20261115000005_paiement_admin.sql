-- Réglages du prestataire de paiement, modifiables par la super admin depuis Amara Admin.
-- Les clés secrètes sont chiffrées dans Supabase Vault : l'écran peut les remplacer, jamais les relire.
-- Seule la fonction « payments » (rôle serveur) lit les clés en clair.

create table private.payment_settings (
  id boolean primary key default true check (id),
  provider text not null default 'none' check (provider in ('none', 'mock', 'honelia')),
  mode text not null default 'sandbox' check (mode in ('sandbox', 'live')),
  base_url text check (base_url ~ '^https://[^\s]+$'),
  public_key text,
  secret_key_id uuid,
  webhook_secret_id uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table private.payment_settings enable row level security;
revoke all on private.payment_settings from public, anon, authenticated;

-- Reprend le réglage de la phase 2 (« mock » sur la base de dev) puis le retire de l'ancien emplacement.
-- Le prestataire de test n'est permis que là où il était déjà utilisé : jamais en prod.
insert into private.server_settings (key, value)
select 'allow_mock_payments', 'true'
from private.server_settings where key = 'payment_provider' and value = 'mock';
insert into private.payment_settings (provider)
select coalesce(
  (select value from private.server_settings
   where key = 'payment_provider' and value in ('mock', 'honelia')),
  'none');
delete from private.server_settings where key = 'payment_provider';

create function private.mock_payments_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.server_settings
                 where key = 'allow_mock_payments' and value = 'true');
$$;

/** Ce que voit l'écran Admin : jamais les clés secrètes, seulement si elles sont enregistrées. */
create function public.admin_payment_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s private.payment_settings;
begin
  if not private.is_admin() then
    raise exception 'réservé aux administrateurs' using errcode = '42501';
  end if;
  select * into s from private.payment_settings;
  return jsonb_build_object(
    'provider', coalesce(s.provider, 'none'),
    'mode', coalesce(s.mode, 'sandbox'),
    'baseUrl', s.base_url,
    'publicKey', s.public_key,
    'hasSecretKey', s.secret_key_id is not null,
    'hasWebhookSecret', s.webhook_secret_id is not null,
    'mockAllowed', private.mock_payments_allowed(),
    'updatedAt', s.updated_at);
end $$;

/**
 * Enregistre les réglages. Une clé laissée à null garde la valeur déjà enregistrée ;
 * une chaîne vide l'efface.
 */
create function public.admin_set_payment_settings(
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

  if p_provider = 'honelia' and (nullif(trim(p_base_url), '') is null or v_secret is null) then
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

/** Crée, remplace ou efface un secret du coffre ; renvoie son identifiant (null si effacé). */
create function private.store_secret(p_id uuid, p_value text, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if p_value is null then
    return p_id;
  end if;
  if trim(p_value) = '' then
    if p_id is not null then
      delete from vault.secrets where id = p_id;
    end if;
    return null;
  end if;
  if p_id is not null then
    perform vault.update_secret(p_id, trim(p_value));
    return p_id;
  end if;
  return vault.create_secret(trim(p_value), p_name || '_' || gen_random_uuid()::text);
end $$;

/** Réglages complets, clés en clair : uniquement pour la fonction « payments ». */
create function public.payment_runtime_config() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'provider', case when s.provider = 'mock' and not private.mock_payments_allowed()
                     then 'none' else s.provider end,
    'mode', s.mode,
    'baseUrl', s.base_url,
    'publicKey', s.public_key,
    'secretKey', (select decrypted_secret from vault.decrypted_secrets where id = s.secret_key_id),
    'webhookSecret', (select decrypted_secret from vault.decrypted_secrets where id = s.webhook_secret_id))
  from private.payment_settings s;
$$;

revoke all on function private.mock_payments_allowed() from public, anon, authenticated;
revoke all on function private.store_secret(uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_payment_settings() from public, anon;
revoke all on function public.admin_set_payment_settings(text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_payment_settings() to authenticated;
grant execute on function public.admin_set_payment_settings(text, text, text, text, text, text) to authenticated;
revoke all on function public.payment_runtime_config() from public, anon, authenticated;
grant execute on function public.payment_runtime_config() to service_role;
