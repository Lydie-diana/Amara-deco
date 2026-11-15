-- Réglages de paiement : seule une administratrice les modifie, les clés ne ressortent jamais
-- vers l'application, et le prestataire de test reste interdit là où il n'est pas permis.
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-0000000000a1', '+237699100001'),
  ('00000000-0000-0000-0000-0000000000a2', '+237699100002');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000a1');

-- 1. Par défaut, aucun prestataire : les paiements restent fermés.
set role service_role;
do $$ begin
  assert public.payment_runtime_config()->>'provider' = 'none', 'fermé par défaut';
end $$;
reset role;

-- 2. Une personne connectée qui n'est pas administratrice ne lit ni n'écrit rien.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
set role authenticated;
do $$ begin
  begin
    perform public.admin_payment_settings();
    assert false, 'lecture réservée aux administrateurs';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_set_payment_settings('honelia', 'live', 'https://x.test', null, 'k');
    assert false, 'écriture réservée aux administrateurs';
  exception when insufficient_privilege then null; end;
  begin
    perform public.payment_runtime_config();
    assert false, 'clés en clair réservées au serveur';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 3. L'administratrice enregistre Honelia Pay ; l'écran ne lui renvoie jamais la clé.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
do $$
declare s jsonb;
begin
  begin
    perform public.admin_set_payment_settings('honelia', 'sandbox', 'https://api.honelia.test', null);
    assert false, 'clé secrète exigée';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.admin_set_payment_settings('honelia', 'sandbox', 'https://api.honelia.test', ' ', 'sk_1');
    assert false, 'clé publique exigée';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.admin_set_payment_settings('mock', 'sandbox', null, null);
    assert false, 'prestataire de test interdit ici';
  exception when invalid_parameter_value then null; end;

  perform public.admin_set_payment_settings('honelia', 'sandbox', 'https://api.honelia.test', 'pk_1', 'sk_1', 'wh_1');
  s := public.admin_payment_settings();
  assert s->>'provider' = 'honelia' and s->>'baseUrl' = 'https://api.honelia.test', 'réglages relus';
  assert (s->>'hasSecretKey')::boolean and (s->>'hasWebhookSecret')::boolean, 'clés signalées';
  assert not s ? 'secretKey' and s::text not like '%sk_1%', 'clé jamais renvoyée';
  assert not (s->>'mockAllowed')::boolean, 'test interdit';

  -- Sans nouvelle clé, l'ancienne est gardée ; une chaîne vide efface le secret du webhook.
  perform public.admin_set_payment_settings('honelia', 'live', 'https://api.honelia.test', 'pk_1', null, '');
  s := public.admin_payment_settings();
  assert (s->>'hasSecretKey')::boolean and not (s->>'hasWebhookSecret')::boolean, 'clé gardée, webhook effacé';
end $$;
reset role;

-- 4. Le serveur lit les clés en clair, et le coffre ne garde que ce qui sert.
set role service_role;
do $$
declare c jsonb := public.payment_runtime_config();
begin
  assert c->>'provider' = 'honelia' and c->>'mode' = 'live', 'prestataire lu par le serveur';
  assert c->>'secretKey' = 'sk_1' and c->>'webhookSecret' is null, 'clés lues par le serveur';
end $$;
reset role;
do $$ begin
  assert (select count(*) from vault.secrets) = 1, 'secret effacé du coffre';
end $$;

-- 5. Là où le prestataire de test est permis (dev), l'administratrice peut le choisir.
insert into private.server_settings (key, value) values ('allow_mock_payments', 'true');
set role authenticated;
do $$ begin
  perform public.admin_set_payment_settings('mock', 'sandbox', null, null);
  assert public.admin_payment_settings()->>'provider' = 'mock', 'test permis en dev';
end $$;
reset role;
delete from private.server_settings where key = 'allow_mock_payments';
set role service_role;
do $$ begin
  assert public.payment_runtime_config()->>'provider' = 'none', 'test coupé dès qu''il n''est plus permis';
end $$;
reset role;

\echo 'Tests des réglages de paiement : OK.'
