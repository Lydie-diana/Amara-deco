-- Les réglages serveur ne sont lisibles que par le rôle serveur.
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

insert into private.server_settings (key, value) values ('payment_provider', 'mock');
do $$ begin
  assert not has_function_privilege('anon', 'public.server_setting(text)', 'execute'), 'fermé aux anonymes';
  assert not has_function_privilege('authenticated', 'public.server_setting(text)', 'execute'), 'fermé aux connectés';
  assert has_function_privilege('service_role', 'public.server_setting(text)', 'execute'), 'ouvert au serveur';
  assert not has_table_privilege('authenticated', 'private.server_settings', 'select'), 'table invisible';
end $$;
set role service_role;
do $$ begin
  assert public.server_setting('payment_provider') = 'mock', 'lecture par le serveur';
end $$;
reset role;

\echo 'Tests des réglages serveur : OK.'
