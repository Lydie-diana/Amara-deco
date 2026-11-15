-- Réglages lus uniquement par le serveur (fonctions Supabase), jamais par les applications.
-- Ce ne sont pas des secrets : les clés et mots de passe restent dans les secrets des fonctions.
-- Exemple : le prestataire de paiement (« mock » en dev, « honelia » en prod).
create table private.server_settings (
  key text primary key check (key ~ '^[a-z_]+$'),
  value text not null,
  updated_at timestamptz not null default now()
);
alter table private.server_settings enable row level security;
revoke all on private.server_settings from public, anon, authenticated;

create function public.server_setting(p_key text) returns text
language sql stable security definer set search_path = '' as $$
  select value from private.server_settings where key = p_key;
$$;
revoke all on function public.server_setting(text) from public, anon, authenticated;
grant execute on function public.server_setting(text) to service_role;
