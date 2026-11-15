-- Phase 1 : profils, boutiques, catalogue (objets et services) et validation des marchands.
-- Principe : la base applique elle-même les règles d'accès (RLS). Une application ne peut
-- jamais voir ou modifier plus que ce que son rôle autorise, même si son code a un bug.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.review_status as enum ('pending', 'approved', 'rejected');
create type public.merchant_kind as enum ('artisan', 'service_provider', 'both');
create type public.booking_mode as enum ('slot', 'quote');
create type public.category_kind as enum ('product', 'service');

-- ---------------------------------------------------------------------------
-- Profils et administrateurs
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 80),
  phone text,
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  created_at timestamptz not null default now()
);

-- Un profil est créé automatiquement à l'inscription.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, phone) values (new.id, new.phone);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Les administrateurs d'Amara. Ajoutés à la main par l'équipe (pas depuis une application).
create table public.admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Réglages de la plateforme (commission paramétrable)
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  id boolean primary key default true check (id),
  default_commission_percent numeric(5, 2) not null default 10
    check (default_commission_percent between 0 and 100),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings default values;

-- ---------------------------------------------------------------------------
-- Catégories
-- ---------------------------------------------------------------------------
create table public.categories (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind public.category_kind not null,
  name_fr text not null,
  name_en text not null,
  position smallint not null default 0
);

insert into public.categories (id, kind, name_fr, name_en, position) values
  ('sculpture', 'product', 'Sculpture', 'Sculpture', 1),
  ('mobilier', 'product', 'Mobilier', 'Furniture', 2),
  ('textile', 'product', 'Textile', 'Textiles', 3),
  ('luminaires', 'product', 'Luminaires', 'Lighting', 4),
  ('ceramique', 'product', 'Céramique', 'Ceramics', 5),
  ('decoration-interieure', 'service', 'Décoration intérieure', 'Interior design', 6),
  ('fabrication-sur-mesure', 'service', 'Fabrication sur mesure', 'Custom making', 7),
  ('peinture-decorative', 'service', 'Peinture décorative', 'Decorative painting', 8);

-- ---------------------------------------------------------------------------
-- Boutiques
-- ---------------------------------------------------------------------------
create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  name text not null check (char_length(name) between 2 and 80),
  kind public.merchant_kind not null,
  city text not null check (char_length(city) between 2 and 60),
  bio text check (char_length(bio) <= 600),
  review_status public.review_status not null default 'pending',
  review_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  -- Taux propre à ce marchand ; null = taux par défaut de la plateforme.
  commission_percent numeric(5, 2) check (commission_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index merchants_review_status_idx on public.merchants (review_status, created_at);
create index merchants_city_idx on public.merchants (city);

-- Seul un administrateur peut changer le statut de validation ou la commission d'une boutique.
-- Une boutique refusée qui modifie sa fiche repasse en attente.
create function public.guard_merchant_review() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() then
    new.updated_at := now();
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.review_status := 'pending';
    new.review_note := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.commission_percent := null;
    return new;
  end if;
  if new.review_status is distinct from old.review_status
     or new.review_note is distinct from old.review_note
     or new.reviewed_at is distinct from old.reviewed_at
     or new.reviewed_by is distinct from old.reviewed_by
     or new.commission_percent is distinct from old.commission_percent
     or new.owner_id is distinct from old.owner_id then
    raise exception 'Seul un administrateur peut modifier ces champs' using errcode = '42501';
  end if;
  if old.review_status = 'rejected' then
    new.review_status := 'pending';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger merchants_guard
  before insert or update on public.merchants
  for each row execute function public.guard_merchant_review();

-- Décision de l'administrateur sur une boutique.
create function public.review_merchant(
  p_merchant_id uuid,
  p_decision public.review_status,
  p_note text default null
) returns public.merchants
language plpgsql security definer set search_path = '' as $$
declare
  result public.merchants;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  if p_decision = 'pending' then
    raise exception 'La décision doit être approved ou rejected' using errcode = '22023';
  end if;
  update public.merchants
     set review_status = p_decision,
         review_note = p_note,
         reviewed_at = now(),
         reviewed_by = auth.uid()
   where id = p_merchant_id
  returning * into result;
  if result.id is null then
    raise exception 'Boutique introuvable' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

create function public.owns_merchant(p_merchant_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.merchants where id = p_merchant_id and owner_id = auth.uid());
$$;

create function public.merchant_is_public(p_merchant_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.merchants where id = p_merchant_id and review_status = 'approved');
$$;

-- ---------------------------------------------------------------------------
-- Objets (à commander)
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  category_id text not null references public.categories (id),
  title text not null check (char_length(title) between 2 and 120),
  description text check (char_length(description) <= 2000),
  price_xaf integer not null check (price_xaf >= 0),
  stock integer not null default 1 check (stock >= 0),
  is_unique boolean not null default false,
  is_published boolean not null default true,
  search tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_merchant_idx on public.products (merchant_id);
create index products_category_idx on public.products (category_id);
create index products_search_idx on public.products using gin (search);

-- ---------------------------------------------------------------------------
-- Services (à réserver sur créneau, sur devis, ou les deux)
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  category_id text not null references public.categories (id),
  title text not null check (char_length(title) between 2 and 120),
  description text check (char_length(description) <= 2000),
  booking_modes public.booking_mode[] not null check (cardinality(booking_modes) >= 1),
  duration_minutes integer check (duration_minutes > 0),
  price_xaf integer check (price_xaf >= 0),
  deposit_xaf integer check (deposit_xaf >= 0),
  is_published boolean not null default true,
  search tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un créneau a une durée ; l'acompte ne dépasse jamais le prix.
  check (not ('slot' = any (booking_modes)) or duration_minutes is not null),
  check (deposit_xaf is null or price_xaf is null or deposit_xaf <= price_xaf)
);

create index services_merchant_idx on public.services (merchant_id);
create index services_category_idx on public.services (category_id);
create index services_search_idx on public.services using gin (search);

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger services_touch before update on public.services
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Règles d'accès
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.admins enable row level security;
alter table public.platform_settings enable row level security;
alter table public.categories enable row level security;
alter table public.merchants enable row level security;
alter table public.products enable row level security;
alter table public.services enable row level security;

-- Profils : chacun voit et modifie le sien ; l'admin voit tout.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Administrateurs : visibles par les administrateurs uniquement ; aucune écriture depuis une application.
create policy admins_select on public.admins for select to authenticated
  using (public.is_admin());

-- Réglages : lus et modifiés par l'admin uniquement.
create policy settings_select on public.platform_settings for select to authenticated
  using (public.is_admin());
create policy settings_update on public.platform_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Catégories : publiques en lecture, modifiées par l'admin.
create policy categories_select on public.categories for select to anon, authenticated
  using (true);
create policy categories_write on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Boutiques : le public ne voit que les boutiques validées.
create policy merchants_select on public.merchants for select to anon, authenticated
  using (review_status = 'approved' or owner_id = auth.uid() or public.is_admin());
create policy merchants_insert on public.merchants for insert to authenticated
  with check (owner_id = auth.uid());
create policy merchants_update on public.merchants for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy merchants_delete on public.merchants for delete to authenticated
  using (public.is_admin());

-- Objets et services : visibles s'ils sont publiés par une boutique validée.
create policy products_select on public.products for select to anon, authenticated
  using ((is_published and public.merchant_is_public(merchant_id))
         or public.owns_merchant(merchant_id) or public.is_admin());
create policy products_write on public.products for all to authenticated
  using (public.owns_merchant(merchant_id) or public.is_admin())
  with check (public.owns_merchant(merchant_id) or public.is_admin());

create policy services_select on public.services for select to anon, authenticated
  using ((is_published and public.merchant_is_public(merchant_id))
         or public.owns_merchant(merchant_id) or public.is_admin());
create policy services_write on public.services for all to authenticated
  using (public.owns_merchant(merchant_id) or public.is_admin())
  with check (public.owns_merchant(merchant_id) or public.is_admin());

-- Droits de base des rôles Supabase (les règles ci-dessus filtrent ensuite les lignes).
grant usage on schema public to anon, authenticated;
grant select on public.categories, public.merchants, public.products, public.services to anon;
grant select, insert, update, delete on public.merchants, public.products, public.services to authenticated;
grant select, update on public.profiles, public.platform_settings to authenticated;
grant select on public.admins, public.categories to authenticated;
grant insert, update, delete on public.categories to authenticated;
revoke all on function public.review_merchant(uuid, public.review_status, text) from public, anon;
grant execute on function public.review_merchant(uuid, public.review_status, text) to authenticated;
