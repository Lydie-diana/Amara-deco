-- Phase 4 : assistant IA. Le client décrit son besoin, l'assistant cherche dans le catalogue
-- public (objets, services, boutiques) et propose ce qui correspond.
-- Tout se règle dans Amara Admin : activation, modèle, quota par personne et clé de l'API,
-- chiffrée dans Supabase Vault (l'écran peut la remplacer, jamais la relire).

create table private.assistant_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  model text not null default 'claude-opus-5-5'
    check (model ~ '^claude-[a-z0-9.-]+$' and char_length(model) <= 64),
  -- Demandes permises par personne sur 24 heures glissantes.
  daily_limit integer not null default 30 check (daily_limit between 1 and 1000),
  api_key_id uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table private.assistant_settings enable row level security;
revoke all on private.assistant_settings from public, anon, authenticated;
insert into private.assistant_settings (id) values (true);

-- Une ligne par demande, pour le quota (aucun contenu de conversation n'est gardé).
create table private.assistant_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index assistant_usage_user_idx on private.assistant_usage (user_id, created_at desc);
alter table private.assistant_usage enable row level security;
revoke all on private.assistant_usage from public, anon, authenticated;

/** Ce que voit l'écran Admin : jamais la clé, seulement si elle est enregistrée. */
create function public.admin_assistant_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s private.assistant_settings;
begin
  if not private.is_admin() then
    raise exception 'réservé aux administrateurs' using errcode = '42501';
  end if;
  select * into s from private.assistant_settings;
  return jsonb_build_object(
    'enabled', s.enabled,
    'model', s.model,
    'dailyLimit', s.daily_limit,
    'hasApiKey', s.api_key_id is not null,
    'updatedAt', s.updated_at);
end $$;

/** Enregistre les réglages. Clé à null : garde celle enregistrée ; chaîne vide : l'efface. */
create function public.admin_set_assistant_settings(
  p_enabled boolean,
  p_model text,
  p_daily_limit integer,
  p_api_key text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s private.assistant_settings;
  v_key uuid;
begin
  if not private.is_admin() then
    raise exception 'réservé aux administrateurs' using errcode = '42501';
  end if;
  if coalesce(trim(p_model), '') !~ '^claude-[a-z0-9.-]+$' then
    raise exception 'invalid_model' using errcode = '22023';
  end if;
  if p_daily_limit is null or p_daily_limit not between 1 and 1000 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;

  select * into s from private.assistant_settings for update;
  v_key := private.store_secret(s.api_key_id, p_api_key, 'assistant_api_key');
  if p_enabled and v_key is null then
    raise exception 'missing_api_key' using errcode = '22023';
  end if;

  update private.assistant_settings set
    enabled = p_enabled,
    model = trim(p_model),
    daily_limit = p_daily_limit,
    api_key_id = v_key,
    updated_at = now(),
    updated_by = auth.uid()
  where id;
end $$;

/** Réglages complets, clé en clair : uniquement pour la fonction « assistant ». */
create function public.assistant_runtime_config() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'enabled', s.enabled and s.api_key_id is not null,
    'model', s.model,
    'apiKey', (select decrypted_secret from vault.decrypted_secrets where id = s.api_key_id))
  from private.assistant_settings s;
$$;

/** Compte une demande si la personne n'a pas atteint son quota ; renvoie false sinon. */
create function public.assistant_take_quota(p_user_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_limit integer;
begin
  -- Deux demandes simultanées de la même personne ne dépassent pas le quota.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select daily_limit into v_limit from private.assistant_settings;
  if (select count(*) from private.assistant_usage
      where user_id = p_user_id and created_at > now() - interval '24 hours') >= v_limit then
    return false;
  end if;
  insert into private.assistant_usage (user_id) values (p_user_id);
  return true;
end $$;

/** Mots d'une demande en requête plein texte : chaque mot, au début d'un mot, l'un OU l'autre. */
create function private.loose_tsquery(p_text text) returns tsquery
language sql immutable set search_path = '' as $$
  select nullif(string_agg(quote_literal(w) || ':*', ' | '), '')::tsquery
  from (
    select distinct w from regexp_split_to_table(lower(coalesce(p_text, '')), '[\s[:punct:]]+') w
    where char_length(w) >= 2
    limit 12
  ) words;
$$;

/**
 * Recherche dans le catalogue public, pour l'assistant (et utilisable par les applis).
 * Ne renvoie que ce qui est publié par une boutique validée, quelle que soit la personne.
 */
create function public.search_catalog(
  p_query text default null,
  p_kind text default null,
  p_category text default null,
  p_city text default null,
  p_max_price integer default null,
  p_limit integer default 8
) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with q as (select private.loose_tsquery(p_query) as tsq),
  lim as (select least(greatest(coalesce(p_limit, 8), 1), 20) as n),
  products as (
    select jsonb_build_object(
      'type', 'product', 'id', p.id, 'title', p.title,
      'description', left(p.description, 240), 'priceXaf', p.price_xaf,
      'category', p.category_id, 'merchant', m.name, 'merchantSlug', m.slug, 'city', m.city
    ) as item, ts_rank(p.search, q.tsq) as rank
    from public.products p
    join public.merchants m on m.id = p.merchant_id
    cross join q
    where coalesce(p_kind, 'product') = 'product'
      and p.is_published and p.stock > 0 and private.merchant_is_public(p.merchant_id)
      and (q.tsq is null or p.search @@ q.tsq)
      and (p_category is null or p.category_id = p_category)
      and (p_city is null or m.city ilike p_city)
      and (p_max_price is null or p.price_xaf <= p_max_price)
    order by rank desc, p.created_at desc
    limit (select n from lim)
  ),
  services as (
    select jsonb_build_object(
      'type', 'service', 'id', s.id, 'title', s.title,
      'description', left(s.description, 240), 'priceXaf', s.price_xaf,
      'category', s.category_id, 'merchant', m.name, 'merchantSlug', m.slug, 'city', m.city
    ) as item, ts_rank(s.search, q.tsq) as rank
    from public.services s
    join public.merchants m on m.id = s.merchant_id
    cross join q
    where coalesce(p_kind, 'service') = 'service'
      and s.is_published and private.merchant_is_public(s.merchant_id)
      and (q.tsq is null or s.search @@ q.tsq)
      and (p_category is null or s.category_id = p_category)
      and (p_city is null or m.city ilike p_city)
      and (p_max_price is null or s.price_xaf is null or s.price_xaf <= p_max_price)
    order by rank desc, s.created_at desc
    limit (select n from lim)
  ),
  merchants as (
    select jsonb_build_object(
      'type', 'merchant', 'id', m.id, 'title', m.name, 'description', left(m.bio, 240),
      'merchantSlug', m.slug, 'city', m.city, 'kind', m.kind
    ) as item, ts_rank(to_tsvector('simple', m.name || ' ' || coalesce(m.bio, '')), q.tsq) as rank
    from public.merchants m
    cross join q
    where coalesce(p_kind, 'merchant') = 'merchant'
      and p_category is null and p_max_price is null
      and private.merchant_is_public(m.id)
      and (q.tsq is null or to_tsvector('simple', m.name || ' ' || coalesce(m.bio, '')) @@ q.tsq)
      and (p_city is null or m.city ilike p_city)
    order by rank desc, m.created_at desc
    limit (select n from lim)
  )
  select coalesce(jsonb_agg(item order by rank desc), '[]'::jsonb)
  from (select * from products union all select * from services union all select * from merchants) found;
$$;

revoke all on function public.admin_assistant_settings() from public, anon;
revoke all on function public.admin_set_assistant_settings(boolean, text, integer, text) from public, anon;
grant execute on function public.admin_assistant_settings() to authenticated;
grant execute on function public.admin_set_assistant_settings(boolean, text, integer, text) to authenticated;
revoke all on function public.assistant_runtime_config() from public, anon, authenticated;
grant execute on function public.assistant_runtime_config() to service_role;
revoke all on function public.assistant_take_quota(uuid) from public, anon, authenticated;
grant execute on function public.assistant_take_quota(uuid) to service_role;
revoke all on function private.loose_tsquery(text) from public;
grant execute on function private.loose_tsquery(text) to anon, authenticated, service_role;
grant execute on function public.search_catalog(text, text, text, text, integer, integer)
  to anon, authenticated, service_role;
