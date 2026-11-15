-- Phase 3 : Ateliers. Les artisans publient des photos et des vidéos (publications durables)
-- et des statuts (visibles 24 h). Rien n'est public avant la validation de la super admin.
-- Les fichiers sont dans le stockage « ateliers », privé : ils ne sont servis qu'à ceux
-- qui ont le droit de voir la publication (liens signés à durée limitée).

create type public.post_kind as enum ('post', 'status');
create type public.media_type as enum ('image', 'video');

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  kind public.post_kind not null default 'post',
  caption text check (char_length(caption) <= 2200),
  review_status public.review_status not null default 'pending',
  review_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  -- Date de mise en ligne (validation) ; un statut disparaît 24 h après.
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index posts_feed_idx on public.posts (kind, published_at desc)
  where review_status = 'approved';
create index posts_merchant_idx on public.posts (merchant_id, created_at desc);
create index posts_pending_idx on public.posts (created_at) where review_status = 'pending';
create index posts_reviewed_by_idx on public.posts (reviewed_by);

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  position smallint not null default 0 check (position between 0 and 9),
  -- Chemin dans le stockage « ateliers » : <boutique>/<fichier>.
  path text not null unique,
  type public.media_type not null,
  width integer check (width > 0),
  height integer check (height > 0),
  duration_ms integer check (duration_ms > 0 and duration_ms <= 180000),
  unique (post_id, position)
);

-- Publication visible par la personne connectée (ou un visiteur).
create function private.can_see_post(p_post_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post_id
      and (
        (p.review_status = 'approved'
          and (p.expires_at is null or p.expires_at > now())
          and private.merchant_is_public(p.merchant_id))
        or private.owns_merchant(p.merchant_id)
        or private.is_admin()
      )
  );
$$;

-- Médias modifiables seulement tant que la publication attend la validation.
create function private.can_edit_post(p_post_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post_id and p.review_status = 'pending' and private.owns_merchant(p.merchant_id)
  );
$$;

-- Fichier du stockage visible : il appartient à une publication visible.
create function private.can_see_media(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.post_media m where m.path = p_path and private.can_see_post(m.post_id)
  );
$$;

revoke all on function private.can_see_post(uuid) from public;
revoke all on function private.can_edit_post(uuid) from public;
revoke all on function private.can_see_media(text) from public;
grant execute on function private.can_see_post(uuid) to anon, authenticated;
grant execute on function private.can_edit_post(uuid) to authenticated;
grant execute on function private.can_see_media(text) to anon, authenticated;

alter table public.posts enable row level security;
alter table public.post_media enable row level security;

create policy posts_select on public.posts for select to anon, authenticated
  using ((select private.can_see_post(id)));
-- Une boutique validée publie ; la publication part toujours en attente de validation.
create policy posts_insert on public.posts for insert to authenticated
  with check (
    (select private.owns_merchant(merchant_id))
    and (select private.merchant_is_public(merchant_id))
    and review_status = 'pending'
    and review_note is null and reviewed_at is null and reviewed_by is null
    and published_at is null and expires_at is null
  );
create policy posts_delete on public.posts for delete to authenticated
  using ((select private.owns_merchant(merchant_id)) or (select private.is_admin()));

create policy post_media_select on public.post_media for select to anon, authenticated
  using ((select private.can_see_post(post_id)));
create policy post_media_insert on public.post_media for insert to authenticated
  with check (
    (select private.can_edit_post(post_id))
    and path like (select merchant_id::text from public.posts where id = post_id) || '/%'
  );

revoke all on public.posts, public.post_media from anon, authenticated;
grant select on public.posts, public.post_media to anon, authenticated;
grant insert (id, merchant_id, kind, caption) on public.posts to authenticated;
grant delete on public.posts to authenticated;
grant insert (post_id, position, path, type, width, height, duration_ms)
  on public.post_media to authenticated;

/** Validation par la super admin. Un statut reste en ligne 24 h à partir de sa validation. */
create function public.review_post(
  p_post_id uuid,
  p_decision public.review_status,
  p_note text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  if p_decision = 'pending' then
    raise exception 'La décision doit être approved ou rejected' using errcode = '22023';
  end if;
  update public.posts set
    review_status = p_decision,
    review_note = nullif(trim(p_note), ''),
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    published_at = case when p_decision = 'approved' then now() end,
    expires_at = case when p_decision = 'approved' and kind = 'status'
                      then now() + interval '24 hours' end
  where id = p_post_id;
  if not found then
    raise exception 'Publication introuvable' using errcode = 'P0002';
  end if;
end $$;
revoke all on function public.review_post(uuid, public.review_status, text) from public, anon;
grant execute on function public.review_post(uuid, public.review_status, text) to authenticated;

-- Stockage : dossier par boutique, 50 Mo par fichier, photos et vidéos seulement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ateliers', 'ateliers', false, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'])
on conflict (id) do nothing;

-- Lecture : fichier d'une publication visible, ou fichier de sa propre boutique.
create policy ateliers_read on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'ateliers'
    and (
      (select private.can_see_media(name))
      or (select private.owns_merchant(((storage.foldername(name))[1])::uuid))
    )
  );
create policy ateliers_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ateliers'
    and (select private.owns_merchant(((storage.foldername(name))[1])::uuid))
  );
create policy ateliers_remove on storage.objects for delete to authenticated
  using (
    bucket_id = 'ateliers'
    and (select private.owns_merchant(((storage.foldername(name))[1])::uuid))
  );
