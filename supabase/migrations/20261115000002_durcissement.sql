-- Phase 1, durcissement après les avis de sécurité et de performance de Supabase.
-- 1. Les fonctions internes ne sont plus appelables par l'API (/rpc).
-- 2. Les règles d'accès évaluent auth.uid() une seule fois par requête.
-- 3. Une seule règle permissive par action, et un index manquant.

-- Schéma privé : non exposé par l'API, mais utilisable dans les règles d'accès.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

create function private.owns_merchant(p_merchant_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.merchants where id = p_merchant_id and owner_id = (select auth.uid())
  );
$$;

create function private.merchant_is_public(p_merchant_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.merchants where id = p_merchant_id and review_status = 'approved'
  );
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to anon, authenticated;

-- Règles d'accès réécrites sur les fonctions privées.
drop policy profiles_select on public.profiles;
drop policy profiles_update on public.profiles;
drop policy admins_select on public.admins;
drop policy settings_select on public.platform_settings;
drop policy settings_update on public.platform_settings;
drop policy categories_select on public.categories;
drop policy categories_write on public.categories;
drop policy merchants_select on public.merchants;
drop policy merchants_insert on public.merchants;
drop policy merchants_update on public.merchants;
drop policy merchants_delete on public.merchants;
drop policy products_select on public.products;
drop policy products_write on public.products;
drop policy services_select on public.services;
drop policy services_write on public.services;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy admins_select on public.admins for select to authenticated
  using ((select private.is_admin()));

create policy settings_select on public.platform_settings for select to authenticated
  using ((select private.is_admin()));
create policy settings_update on public.platform_settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy categories_select on public.categories for select to anon, authenticated
  using (true);
create policy categories_insert on public.categories for insert to authenticated
  with check ((select private.is_admin()));
create policy categories_update on public.categories for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy categories_delete on public.categories for delete to authenticated
  using ((select private.is_admin()));

create policy merchants_select on public.merchants for select to anon, authenticated
  using (review_status = 'approved' or owner_id = (select auth.uid()) or (select private.is_admin()));
create policy merchants_insert on public.merchants for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy merchants_update on public.merchants for update to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_admin()))
  with check (owner_id = (select auth.uid()) or (select private.is_admin()));
create policy merchants_delete on public.merchants for delete to authenticated
  using ((select private.is_admin()));

create policy products_select on public.products for select to anon, authenticated
  using ((is_published and private.merchant_is_public(merchant_id))
         or private.owns_merchant(merchant_id) or (select private.is_admin()));
create policy products_insert on public.products for insert to authenticated
  with check (private.owns_merchant(merchant_id) or (select private.is_admin()));
create policy products_update on public.products for update to authenticated
  using (private.owns_merchant(merchant_id) or (select private.is_admin()))
  with check (private.owns_merchant(merchant_id) or (select private.is_admin()));
create policy products_delete on public.products for delete to authenticated
  using (private.owns_merchant(merchant_id) or (select private.is_admin()));

create policy services_select on public.services for select to anon, authenticated
  using ((is_published and private.merchant_is_public(merchant_id))
         or private.owns_merchant(merchant_id) or (select private.is_admin()));
create policy services_insert on public.services for insert to authenticated
  with check (private.owns_merchant(merchant_id) or (select private.is_admin()));
create policy services_update on public.services for update to authenticated
  using (private.owns_merchant(merchant_id) or (select private.is_admin()))
  with check (private.owns_merchant(merchant_id) or (select private.is_admin()));
create policy services_delete on public.services for delete to authenticated
  using (private.owns_merchant(merchant_id) or (select private.is_admin()));

-- Anciennes fonctions publiques : supprimées, sauf is_admin, que l'app Admin appelle.
drop function public.owns_merchant(uuid);
drop function public.merchant_is_public(uuid);

create or replace function public.is_admin() returns boolean
language sql stable security invoker set search_path = '' as $$
  select private.is_admin();
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Fonctions de déclencheurs : jamais appelables directement.
alter function public.touch_updated_at() set search_path = '';
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.guard_merchant_review() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Index de la clé étrangère vers l'administrateur qui a validé.
create index merchants_reviewed_by_idx on public.merchants (reviewed_by);
