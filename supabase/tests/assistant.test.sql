-- Tests de la phase 4 : réglages de l'assistant, quota et recherche dans le catalogue public.
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

begin;

insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-000000000401', '+237699400001'),
  ('00000000-0000-0000-0000-000000000402', '+237699400002'),
  ('00000000-0000-0000-0000-000000000403', '+237699400003');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000401');

-- Une boutique validée à Douala, une en attente à Yaoundé (invisible au public).
set session_replication_role = replica;
insert into public.merchants (id, owner_id, slug, name, kind, city, bio, review_status) values
  ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000402',
   'bois-de-mbouda', 'Bois de Mbouda', 'artisan', 'Douala', 'Sculpteur de masques en ébène', 'approved'),
  ('00000000-0000-0000-0000-000000000412', '00000000-0000-0000-0000-000000000403',
   'atelier-cache', 'Atelier caché', 'artisan', 'Yaoundé', 'Masques et canapés', 'pending');
insert into public.products (merchant_id, category_id, title, description, price_xaf, stock, is_published) values
  ('00000000-0000-0000-0000-000000000411', 'sculpture', 'Masque Bamiléké', 'Masque sculpté en ébène', 45000, 1, true),
  ('00000000-0000-0000-0000-000000000411', 'sculpture', 'Grand masque', 'Masque de cérémonie', 250000, 1, true),
  ('00000000-0000-0000-0000-000000000411', 'mobilier', 'Tabouret brouillon', 'Masque gravé', 10000, 1, false),
  ('00000000-0000-0000-0000-000000000411', 'mobilier', 'Banc vendu', 'Masque gravé sur le dossier', 10000, 0, true),
  ('00000000-0000-0000-0000-000000000412', 'sculpture', 'Masque caché', 'Masque', 1000, 1, true);
insert into public.services (merchant_id, category_id, title, description, booking_modes, price_xaf, is_published) values
  ('00000000-0000-0000-0000-000000000411', 'fabrication-sur-mesure', 'Masque sur mesure',
   'Sculpture d''un masque à votre idée', '{quote}', null, true);
set session_replication_role = origin;

-- 1. Par défaut l'assistant est éteint, et seule l'administratrice voit ou change ses réglages.
set role service_role;
do $$ begin
  assert not (public.assistant_runtime_config()->>'enabled')::boolean, 'éteint par défaut';
end $$;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000402', false);
set role authenticated;
do $$ begin
  begin
    perform public.admin_assistant_settings();
    assert false, 'lecture réservée aux administrateurs';
  exception when insufficient_privilege then null; end;
  begin
    perform public.assistant_runtime_config();
    assert false, 'clé en clair réservée au serveur';
  exception when insufficient_privilege then null; end;
  begin
    perform public.assistant_take_quota('00000000-0000-0000-0000-000000000402');
    assert false, 'quota tenu par le serveur seulement';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 2. L'administratrice ne peut pas l'allumer sans clé ; avec une clé, celle-ci ne ressort jamais.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000401', false);
set role authenticated;
do $$
declare s jsonb;
begin
  begin
    perform public.admin_set_assistant_settings(true, 'claude-opus-5-5', 30);
    assert false, 'clé exigée';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.admin_set_assistant_settings(false, 'gpt; drop', 30);
    assert false, 'modèle invalide';
  exception when invalid_parameter_value then null; end;
  perform public.admin_set_assistant_settings(true, 'claude-opus-5-5', 2, 'sk-ant-test');
  s := public.admin_assistant_settings();
  assert (s->>'enabled')::boolean and (s->>'hasApiKey')::boolean and (s->>'dailyLimit')::int = 2, 'réglages relus';
  assert s::text not like '%sk-ant-test%', 'clé jamais renvoyée';
end $$;
reset role;

set role service_role;
do $$
declare c jsonb := public.assistant_runtime_config();
begin
  assert (c->>'enabled')::boolean and c->>'apiKey' = 'sk-ant-test' and c->>'model' = 'claude-opus-5-5',
    'le serveur lit la clé';
  -- 3. Quota : deux demandes sur 24 h, puis refus.
  assert public.assistant_take_quota('00000000-0000-0000-0000-000000000402'), '1re demande';
  assert public.assistant_take_quota('00000000-0000-0000-0000-000000000402'), '2e demande';
  assert not public.assistant_take_quota('00000000-0000-0000-0000-000000000402'), 'quota atteint';
  assert public.assistant_take_quota('00000000-0000-0000-0000-000000000403'), 'quota par personne';
end $$;
reset role;

-- 4. Recherche : seulement ce qui est publié, en stock, d'une boutique validée.
select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$
declare r jsonb;
begin
  r := public.search_catalog('masque ébène');
  assert jsonb_array_length(r) = 4, format('objets, service et boutique trouvés : %s', r);
  assert not r::text like '%caché%' and not r::text like '%brouillon%' and not r::text like '%vendu%',
    'rien d''invisible';
  assert r->0->>'title' = 'Masque Bamiléké', 'le plus pertinent d''abord';

  r := public.search_catalog('masque', 'product', null, null, 100000);
  assert jsonb_array_length(r) = 1 and r->0->>'priceXaf' = '45000', 'filtre de type et de prix';
  r := public.search_catalog('masque', null, null, 'douala');
  assert jsonb_array_length(r) = 4, 'ville sans tenir compte des majuscules';
  r := public.search_catalog('masque', null, null, 'Garoua');
  assert jsonb_array_length(r) = 0, 'autre ville';
  r := public.search_catalog(null, 'service', 'fabrication-sur-mesure');
  assert jsonb_array_length(r) = 1 and r->0->>'type' = 'service', 'catégorie sans mots';
  r := public.search_catalog('''); select 1; --');
  assert jsonb_array_length(r) = 0, 'texte bizarre sans erreur';
end $$;
reset role;

rollback;

\echo 'Tests de l''assistant : OK.'
