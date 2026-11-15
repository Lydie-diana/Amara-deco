-- Tests de la phase 3 : publications, statuts, validation et accès aux fichiers.
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

-- Tout se passe dans une transaction annulée à la fin : les autres tests partent d'une base propre.
begin;

-- Une potière (boutique validée), une autre artisane (boutique en attente), une visiteuse, une admin.
insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-000000000301', '+237699300001'),
  ('00000000-0000-0000-0000-000000000302', '+237699300002'),
  ('00000000-0000-0000-0000-000000000303', '+237699300003'),
  ('00000000-0000-0000-0000-000000000304', '+237699300004');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000304');

create function pg_temp.act_as(who text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',
    case who when 'potiere' then '00000000-0000-0000-0000-000000000301'
             when 'novice' then '00000000-0000-0000-0000-000000000302'
             when 'visiteuse' then '00000000-0000-0000-0000-000000000303'
             when 'admin' then '00000000-0000-0000-0000-000000000304'
             else '' end, false);
end $$;

set session_replication_role = replica;
insert into public.merchants (id, owner_id, slug, name, kind, city, review_status) values
  ('00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000301',
   'poterie-ngo', 'Poterie Ngo', 'artisan', 'Douala', 'approved'),
  ('00000000-0000-0000-0000-000000000312', '00000000-0000-0000-0000-000000000302',
   'atelier-neuf', 'Atelier neuf', 'artisan', 'Bafoussam', 'pending');
set session_replication_role = origin;
insert into storage.buckets (id, name) values ('ateliers', 'ateliers') on conflict do nothing;

-- 1. La potière publie une vidéo et un statut : en attente, invisibles au public.
select pg_temp.act_as('potiere') \gset
set role authenticated;
do $$ begin
  insert into public.posts (id, merchant_id, kind, caption) values
    ('00000000-0000-0000-0000-000000000321', '00000000-0000-0000-0000-000000000311', 'post', 'Tournage d''une jarre'),
    ('00000000-0000-0000-0000-000000000322', '00000000-0000-0000-0000-000000000311', 'status', 'Four allumé');
  insert into storage.objects (bucket_id, name) values
    ('ateliers', '00000000-0000-0000-0000-000000000311/jarre.mp4'),
    ('ateliers', '00000000-0000-0000-0000-000000000311/four.jpg');
  insert into public.post_media (post_id, path, type, width, height, duration_ms) values
    ('00000000-0000-0000-0000-000000000321', '00000000-0000-0000-0000-000000000311/jarre.mp4', 'video', 1080, 1920, 42000),
    ('00000000-0000-0000-0000-000000000322', '00000000-0000-0000-0000-000000000311/four.jpg', 'image', 1080, 1920, null);
  assert (select count(*) from public.posts) = 2, 'la potière voit ses publications';
  assert (select count(*) from storage.objects where bucket_id = 'ateliers') = 2, 'et ses fichiers';

  -- Elle ne peut ni se valider elle-même, ni déposer dans le dossier d'une autre boutique.
  begin
    insert into public.posts (merchant_id, review_status) values ('00000000-0000-0000-0000-000000000311', 'approved');
    assert false, 'auto-validation interdite';
  exception when insufficient_privilege then null; end;
  begin
    perform public.review_post('00000000-0000-0000-0000-000000000321', 'approved');
    assert false, 'validation réservée à l''admin';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects (bucket_id, name) values ('ateliers', '00000000-0000-0000-0000-000000000312/x.jpg');
    assert false, 'dossier d''une autre boutique';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.post_media (post_id, path, type)
    values ('00000000-0000-0000-0000-000000000321', '00000000-0000-0000-0000-000000000312/x.jpg', 'image');
    assert false, 'média hors du dossier de la boutique';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 2. Une boutique pas encore validée ne publie pas.
select pg_temp.act_as('novice') \gset
set role authenticated;
do $$ begin
  begin
    insert into public.posts (merchant_id, caption) values ('00000000-0000-0000-0000-000000000312', 'Bonjour');
    assert false, 'boutique en attente : pas de publication';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 3. Visiteuse anonyme ou connectée : rien avant la validation, ni publication ni fichier.
select pg_temp.act_as('visiteuse') \gset
set role authenticated;
do $$ begin
  assert (select count(*) from public.posts) = 0, 'rien avant validation';
  assert (select count(*) from public.post_media) = 0, 'aucun média avant validation';
  assert (select count(*) from storage.objects where bucket_id = 'ateliers') = 0, 'aucun fichier avant validation';
end $$;
reset role;

-- 4. L'admin voit la file d'attente et valide.
select pg_temp.act_as('admin') \gset
set role authenticated;
do $$ begin
  assert (select count(*) from public.posts where review_status = 'pending') = 2, 'file de validation';
  perform public.review_post('00000000-0000-0000-0000-000000000321', 'approved');
  perform public.review_post('00000000-0000-0000-0000-000000000322', 'approved');
  assert (select expires_at - published_at from public.posts
          where id = '00000000-0000-0000-0000-000000000322') = interval '24 hours', 'statut : 24 h';
  assert (select expires_at from public.posts
          where id = '00000000-0000-0000-0000-000000000321') is null, 'publication durable';
end $$;
reset role;

-- 5. Après validation, tout le monde voit, y compris les visiteurs non connectés.
select pg_temp.act_as('') \gset
set role anon;
do $$ begin
  assert (select count(*) from public.posts) = 2, 'publications visibles';
  assert (select count(*) from storage.objects where bucket_id = 'ateliers') = 2, 'fichiers visibles';
end $$;
reset role;

-- 6. Une fois validée, la publication n'accepte plus de nouveau média.
select pg_temp.act_as('potiere') \gset
set role authenticated;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('ateliers', '00000000-0000-0000-0000-000000000311/ajout.jpg');
  begin
    insert into public.post_media (post_id, position, path, type)
    values ('00000000-0000-0000-0000-000000000321', 1, '00000000-0000-0000-0000-000000000311/ajout.jpg', 'image');
    assert false, 'média ajouté après validation';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 7. Un statut expiré disparaît ; un refus retire la publication du public.
update public.posts set published_at = now() - interval '25 hours', expires_at = now() - interval '1 hour'
where id = '00000000-0000-0000-0000-000000000322';
select pg_temp.act_as('admin') \gset
set role authenticated;
select public.review_post('00000000-0000-0000-0000-000000000321', 'rejected', 'Image floue');
reset role;
select pg_temp.act_as('visiteuse') \gset
set role authenticated;
do $$ begin
  assert (select count(*) from public.posts) = 0, 'statut expiré et publication refusée invisibles';
  assert (select count(*) from storage.objects where bucket_id = 'ateliers') = 0, 'leurs fichiers aussi';
end $$;
reset role;
select pg_temp.act_as('potiere') \gset
set role authenticated;
do $$ begin
  assert (select review_note from public.posts where id = '00000000-0000-0000-0000-000000000321') = 'Image floue',
    'la potière lit le motif du refus';
  delete from public.posts where id = '00000000-0000-0000-0000-000000000321';
  delete from storage.objects where name = '00000000-0000-0000-0000-000000000311/jarre.mp4';
  assert (select count(*) from public.posts) = 1, 'elle supprime sa publication';
end $$;
reset role;

rollback;
\echo 'Tests des Ateliers : OK.'
