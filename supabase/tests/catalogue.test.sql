-- Tests des règles d'accès de la phase 1. Chaque bloc échoue bruyamment si une règle est fausse.
\set ON_ERROR_STOP on
\set QUIET on

-- Trois personnes : une artisane, un client, une administratrice.
insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-00000000000a', '+237699000001'),
  ('00000000-0000-0000-0000-00000000000b', '+237699000002'),
  ('00000000-0000-0000-0000-00000000000c', '+237699000003');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000c');

create function pg_temp.act_as(who text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',
    case who when 'artisane' then '00000000-0000-0000-0000-00000000000a'
             when 'client' then '00000000-0000-0000-0000-00000000000b'
             when 'admin' then '00000000-0000-0000-0000-00000000000c'
             else '' end, false);
end $$;

-- 1. Le profil est créé à l'inscription.
do $$ begin
  assert (select count(*) from public.profiles) = 3, 'un profil par inscrit';
  assert (select phone from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = '+237699000001', 'téléphone recopié';
end $$;

-- 2. L'artisane crée sa boutique : elle reste en attente, même si elle tente de se valider elle-même.
select pg_temp.act_as('artisane') \gset
set role authenticated;
insert into public.merchants (owner_id, slug, name, kind, city, review_status, commission_percent)
values ('00000000-0000-0000-0000-00000000000a', 'atelier-nkam', 'Atelier Nkam', 'artisan', 'Douala', 'approved', 0);
insert into public.products (merchant_id, category_id, title, price_xaf, is_unique)
select id, 'sculpture', 'Masque en bois d''ébène', 85000, true from public.merchants where slug = 'atelier-nkam';
insert into public.services (merchant_id, category_id, title, booking_modes, duration_minutes, price_xaf, deposit_xaf)
select id, 'fabrication-sur-mesure', 'Sculpture sur commande', '{slot,quote}', 60, 150000, 30000 from public.merchants where slug = 'atelier-nkam';
do $$ begin
  assert (select review_status from public.merchants where slug = 'atelier-nkam') = 'pending', 'boutique créée en attente';
  assert (select commission_percent from public.merchants where slug = 'atelier-nkam') is null, 'commission non modifiable';
  assert (select count(*) from public.products) = 1, 'l''artisane voit son objet';
end $$;

-- 3. Elle ne peut pas changer son statut de validation.
do $$ begin
  begin
    update public.merchants set review_status = 'approved' where slug = 'atelier-nkam';
    assert false, 'auto-validation refusée';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 4. Elle ne peut pas appeler la validation réservée aux administrateurs.
do $$ begin
  begin
    perform public.review_merchant((select id from public.merchants where slug = 'atelier-nkam'), 'approved');
    assert false, 'validation réservée à l''admin';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 5. Tant que la boutique est en attente, ni le public ni un client ne la voient.
set role anon;
select pg_temp.act_as('nobody') \gset
do $$ begin
  assert (select count(*) from public.merchants) = 0, 'boutique en attente invisible au public';
  assert (select count(*) from public.products) = 0, 'objets invisibles au public';
end $$;
reset role;
select pg_temp.act_as('client') \gset
set role authenticated;
do $$ begin
  assert (select count(*) from public.merchants) = 0, 'boutique en attente invisible au client';
end $$;

-- 6. Un client ne peut pas ajouter d'objet dans la boutique d'un autre, même en connaissant son identifiant.
reset role;
select set_config('test.merchant_id', id::text, false) as merchant_id from public.merchants where slug = 'atelier-nkam' \gset
set role authenticated;
do $$ begin
  begin
    insert into public.products (merchant_id, category_id, title, price_xaf)
    values (current_setting('test.merchant_id')::uuid, 'sculpture', 'Intrus', 1);
    assert false, 'ajout dans la boutique d''un autre refusé';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 7. L'administratrice voit la boutique en attente et la valide.
select pg_temp.act_as('admin') \gset
set role authenticated;
do $$ begin
  assert (select count(*) from public.merchants where review_status = 'pending') = 1, 'l''admin voit les boutiques en attente';
  perform public.review_merchant((select id from public.merchants where slug = 'atelier-nkam'), 'approved', 'Bienvenue');
  assert (select reviewed_by from public.merchants where slug = 'atelier-nkam') = '00000000-0000-0000-0000-00000000000c', 'décision tracée';
  assert (select default_commission_percent from public.platform_settings) = 10, 'l''admin lit la commission';
end $$;
reset role;

-- 8. Une fois validée, la boutique et son catalogue sont publics.
set role anon;
select pg_temp.act_as('nobody') \gset
do $$ begin
  assert (select count(*) from public.merchants) = 1, 'boutique validée visible';
  assert (select count(*) from public.products) = 1, 'objet visible';
  assert (select count(*) from public.services) = 1, 'service visible';
  assert (select count(*) from public.products where search @@ plainto_tsquery('simple', 'masque')) = 1, 'recherche plein texte';
end $$;
reset role;

-- 9. Un objet dépublié disparaît pour le public mais pas pour l'artisane.
select pg_temp.act_as('artisane') \gset
set role authenticated;
update public.products set is_published = false;
reset role;
set role anon;
select pg_temp.act_as('nobody') \gset
do $$ begin
  assert (select count(*) from public.products) = 0, 'objet dépublié invisible';
end $$;
reset role;

-- 10. Les réglages de commission sont invisibles aux non-administrateurs.
select pg_temp.act_as('client') \gset
set role authenticated;
do $$ begin
  assert (select count(*) from public.platform_settings) = 0, 'commission privée';
end $$;
reset role;

-- 11. Un service sur créneau exige une durée ; un acompte ne dépasse pas le prix.
do $$ begin
  begin
    insert into public.services (merchant_id, category_id, title, booking_modes, price_xaf)
    select id, 'decoration-interieure', 'Sans durée', '{slot}', 1000 from public.merchants limit 1;
    assert false, 'durée exigée pour un créneau';
  exception when check_violation then null;
  end;
  begin
    insert into public.services (merchant_id, category_id, title, booking_modes, price_xaf, deposit_xaf)
    select id, 'decoration-interieure', 'Acompte trop haut', '{quote}', 1000, 2000 from public.merchants limit 1;
    assert false, 'acompte plafonné';
  exception when check_violation then null;
  end;
end $$;

-- Fonctions internes : hors de portée de l'API.
do $$ begin
  assert not has_function_privilege('anon', 'public.is_admin()', 'execute'), 'is_admin fermé aux anonymes';
  assert has_function_privilege('authenticated', 'public.is_admin()', 'execute'), 'is_admin ouvert aux connectés';
  assert not has_function_privilege('authenticated', 'public.guard_merchant_review()', 'execute'), 'déclencheur non appelable';
  assert not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'), 'déclencheur non appelable';
  assert not has_function_privilege('authenticated', 'public.touch_updated_at()', 'execute'), 'déclencheur non appelable';
  assert not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'public' and p.proname in ('owns_merchant', 'merchant_is_public')),
    'aides des règles d''accès sorties du schéma public';
end $$;

\echo 'Tous les tests de la base passent.'
