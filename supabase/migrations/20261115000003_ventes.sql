-- Phase 2 : commandes, réservations, disponibilités, messages et paiements.
-- Les montants et les changements d'état passent uniquement par des fonctions de la base :
-- une application ne peut ni choisir un prix, ni marquer une commande comme payée.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.order_status as enum
  ('awaiting_payment', 'paid', 'accepted', 'preparing', 'delivered', 'cancelled');
create type public.booking_status as enum
  ('requested', 'quoted', 'awaiting_payment', 'confirmed', 'completed', 'declined', 'cancelled');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'cancelled');

-- Référence courte et lisible, partagée avec le prestataire de paiement (ex. « C-7F3A9B21 »).
create function private.new_reference(p_prefix text) returns text
language sql volatile set search_path = '' as $$
  select p_prefix || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
$$;

-- Taux de commission applicable à une boutique (le sien, sinon celui de la plateforme).
create function private.commission_rate(p_merchant_id uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select commission_percent from public.merchants where id = p_merchant_id),
    (select default_commission_percent from public.platform_settings)
  );
$$;

-- ---------------------------------------------------------------------------
-- Commandes
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default private.new_reference('C'),
  buyer_id uuid not null references public.profiles (id),
  merchant_id uuid not null references public.merchants (id),
  status public.order_status not null default 'awaiting_payment',
  subtotal_xaf integer not null check (subtotal_xaf >= 0),
  commission_percent numeric(5, 2) not null,
  commission_xaf integer not null check (commission_xaf >= 0),
  delivery_city text not null check (char_length(delivery_city) between 2 and 60),
  delivery_address text not null check (char_length(delivery_address) between 3 and 300),
  contact_phone text not null check (contact_phone ~ '^\+237[26][0-9]{8}$'),
  note text check (char_length(note) <= 600),
  cancel_reason text check (char_length(cancel_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_merchant_idx on public.orders (merchant_id, created_at desc);

create table public.order_items (
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  -- Copie du titre et du prix au moment de la commande.
  title text not null,
  unit_price_xaf integer not null check (unit_price_xaf >= 0),
  quantity integer not null check (quantity between 1 and 99),
  primary key (order_id, product_id)
);
create index order_items_product_idx on public.order_items (product_id);

create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- Passe une commande chez une boutique. Les prix viennent de la base, le stock est réservé.
create function public.place_order(
  p_merchant_id uuid,
  p_items jsonb,
  p_delivery_city text,
  p_delivery_address text,
  p_contact_phone text,
  p_note text default null
) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_buyer uuid := auth.uid();
  v_order public.orders;
  v_item record;
  v_title text;
  v_price integer;
  v_subtotal integer := 0;
  v_rate numeric;
begin
  if v_buyer is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if not private.merchant_is_public(p_merchant_id) then
    raise exception 'Boutique indisponible' using errcode = 'P0002';
  end if;
  if private.owns_merchant(p_merchant_id) then
    raise exception 'Impossible de commander dans sa propre boutique' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Panier vide' using errcode = '22023';
  end if;

  v_rate := private.commission_rate(p_merchant_id);
  insert into public.orders (buyer_id, merchant_id, subtotal_xaf, commission_percent, commission_xaf,
                             delivery_city, delivery_address, contact_phone, note)
  values (v_buyer, p_merchant_id, 0, v_rate, 0, p_delivery_city, p_delivery_address, p_contact_phone, p_note)
  returning * into v_order;

  for v_item in
    select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'quantity')::integer)::integer as quantity
      from jsonb_array_elements(p_items) e
     group by 1
  loop
    if v_item.quantity is null or v_item.quantity < 1 then
      raise exception 'Quantité invalide' using errcode = '22023';
    end if;
    update public.products
       set stock = stock - v_item.quantity
     where id = v_item.product_id
       and merchant_id = p_merchant_id
       and is_published
       and stock >= v_item.quantity
    returning title, price_xaf into v_title, v_price;
    if not found then
      raise exception 'Objet indisponible ou stock insuffisant' using errcode = 'P0001';
    end if;
    insert into public.order_items (order_id, product_id, title, unit_price_xaf, quantity)
    values (v_order.id, v_item.product_id, v_title, v_price, v_item.quantity);
    v_subtotal := v_subtotal + v_price * v_item.quantity;
  end loop;

  update public.orders
     set subtotal_xaf = v_subtotal,
         commission_xaf = round(v_subtotal * v_rate / 100)::integer
   where id = v_order.id
  returning * into v_order;
  return v_order;
end;
$$;

-- Fait avancer une commande. Le paiement (« paid ») n'est jamais posé ici.
--   client   : annuler tant qu'elle n'est pas payée
--   marchand : paid -> accepted -> preparing -> delivered, ou annuler avant livraison
--   admin    : tout, sauf « paid »
create function public.set_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_reason text default null
) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_is_merchant boolean;
  v_is_admin boolean := private.is_admin();
  v_allowed boolean;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Commande introuvable' using errcode = 'P0002';
  end if;
  v_is_merchant := private.owns_merchant(v_order.merchant_id);

  if p_status = 'paid' then
    v_allowed := false;
  elsif v_order.status in ('delivered', 'cancelled') then
    v_allowed := false;
  elsif v_is_admin then
    v_allowed := true;
  elsif v_is_merchant then
    v_allowed := (v_order.status, p_status) in (
      ('paid'::public.order_status, 'accepted'::public.order_status),
      ('accepted', 'preparing'), ('accepted', 'delivered'), ('preparing', 'delivered')
    ) or p_status = 'cancelled';
  elsif v_order.buyer_id = auth.uid() then
    v_allowed := v_order.status = 'awaiting_payment' and p_status = 'cancelled';
  else
    v_allowed := false;
  end if;

  if not v_allowed then
    raise exception 'Changement de statut non autorisé' using errcode = '42501';
  end if;

  if p_status = 'cancelled' then
    update public.products p
       set stock = p.stock + i.quantity
      from public.order_items i
     where i.order_id = v_order.id and p.id = i.product_id;
  end if;

  update public.orders
     set status = p_status,
         cancel_reason = case when p_status = 'cancelled' then p_reason else cancel_reason end
   where id = v_order.id
  returning * into v_order;
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Disponibilités des boutiques (heure du Cameroun)
-- ---------------------------------------------------------------------------
create table public.merchant_hours (
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  -- 1 = lundi … 7 = dimanche (norme ISO).
  weekday smallint not null check (weekday between 1 and 7),
  opens_at time not null,
  closes_at time not null,
  primary key (merchant_id, weekday, opens_at),
  check (closes_at > opens_at)
);

-- ---------------------------------------------------------------------------
-- Réservations de services
-- ---------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default private.new_reference('R'),
  client_id uuid not null references public.profiles (id),
  merchant_id uuid not null references public.merchants (id),
  service_id uuid not null references public.services (id),
  mode public.booking_mode not null,
  status public.booking_status not null,
  starts_at timestamptz,
  ends_at timestamptz,
  price_xaf integer check (price_xaf >= 0),
  -- Montant à payer en ligne pour confirmer (acompte ou total). 0 = rien à payer.
  amount_due_xaf integer not null default 0 check (amount_due_xaf >= 0),
  commission_percent numeric(5, 2) not null,
  city text not null check (char_length(city) between 2 and 60),
  address text check (char_length(address) <= 300),
  client_message text check (char_length(client_message) <= 1000),
  merchant_note text check (char_length(merchant_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((starts_at is null) = (ends_at is null)),
  check (ends_at is null or ends_at > starts_at),
  check (mode = 'quote' or starts_at is not null)
);
create index bookings_client_idx on public.bookings (client_id, created_at desc);
create index bookings_merchant_idx on public.bookings (merchant_id, starts_at);
create index bookings_service_idx on public.bookings (service_id);

create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

-- Un créneau est libre s'il tient dans les horaires et ne chevauche aucune réservation active.
create function private.slot_is_free(p_merchant_id uuid, p_starts_at timestamptz, p_ends_at timestamptz,
                                     p_ignore_booking uuid default null)
returns boolean
language sql stable security definer set search_path = '' as $$
  select p_starts_at > now()
     and (p_starts_at at time zone 'Africa/Douala')::date = (p_ends_at at time zone 'Africa/Douala')::date
     and exists (
       select 1 from public.merchant_hours h
        where h.merchant_id = p_merchant_id
          and h.weekday = extract(isodow from p_starts_at at time zone 'Africa/Douala')
          and h.opens_at <= (p_starts_at at time zone 'Africa/Douala')::time
          and h.closes_at >= (p_ends_at at time zone 'Africa/Douala')::time
     )
     and not exists (
       select 1 from public.bookings b
        where b.merchant_id = p_merchant_id
          and b.id is distinct from p_ignore_booking
          and b.status in ('quoted', 'awaiting_payment', 'confirmed')
          and b.starts_at < p_ends_at and b.ends_at > p_starts_at
     );
$$;

-- Créneaux libres d'un service pour un jour donné (heure du Cameroun).
create function public.available_slots(p_service_id uuid, p_day date)
returns setof timestamptz
language sql stable security definer set search_path = '' as $$
  select slot
    from public.services s
    join public.merchant_hours h
      on h.merchant_id = s.merchant_id and h.weekday = extract(isodow from p_day)
    cross join lateral generate_series(
      (p_day + h.opens_at) at time zone 'Africa/Douala',
      (p_day + h.closes_at) at time zone 'Africa/Douala' - make_interval(mins => s.duration_minutes),
      make_interval(mins => s.duration_minutes)
    ) as slot
   where s.id = p_service_id
     and s.is_published
     and 'slot' = any (s.booking_modes)
     and private.merchant_is_public(s.merchant_id)
     and private.slot_is_free(s.merchant_id, slot, slot + make_interval(mins => s.duration_minutes))
   order by slot;
$$;

-- Le client réserve un créneau ou demande un devis.
create function public.request_booking(
  p_service_id uuid,
  p_mode public.booking_mode,
  p_city text,
  p_starts_at timestamptz default null,
  p_address text default null,
  p_message text default null
) returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  v_client uuid := auth.uid();
  v_service public.services;
  v_booking public.bookings;
  v_ends_at timestamptz;
  v_due integer;
begin
  if v_client is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  select * into v_service from public.services where id = p_service_id and is_published;
  if not found or not private.merchant_is_public(v_service.merchant_id) then
    raise exception 'Service indisponible' using errcode = 'P0002';
  end if;
  if private.owns_merchant(v_service.merchant_id) then
    raise exception 'Impossible de réserver son propre service' using errcode = '22023';
  end if;
  if not (p_mode = any (v_service.booking_modes)) then
    raise exception 'Mode de réservation non proposé' using errcode = '22023';
  end if;

  if p_mode = 'slot' then
    if p_starts_at is null then
      raise exception 'Créneau requis' using errcode = '22023';
    end if;
    v_ends_at := p_starts_at + make_interval(mins => v_service.duration_minutes);
    -- Une réservation à la fois par boutique pour éviter deux clients sur le même créneau.
    perform pg_advisory_xact_lock(hashtext(v_service.merchant_id::text));
    if not private.slot_is_free(v_service.merchant_id, p_starts_at, v_ends_at) then
      raise exception 'Créneau indisponible' using errcode = 'P0001';
    end if;
    v_due := coalesce(v_service.deposit_xaf, 0);
  end if;

  insert into public.bookings (client_id, merchant_id, service_id, mode, status, starts_at, ends_at,
                               price_xaf, amount_due_xaf, commission_percent, city, address, client_message)
  values (v_client, v_service.merchant_id, v_service.id, p_mode,
          case when p_mode = 'quote' then 'requested'
               when v_due > 0 then 'awaiting_payment'
               else 'confirmed' end::public.booking_status,
          case when p_mode = 'slot' then p_starts_at end, v_ends_at,
          case when p_mode = 'slot' then v_service.price_xaf end,
          coalesce(v_due, 0), private.commission_rate(v_service.merchant_id),
          p_city, p_address, p_message)
  returning * into v_booking;
  return v_booking;
end;
$$;

-- Le marchand répond à une demande de devis : prix, acompte à payer en ligne, date proposée.
create function public.quote_booking(
  p_booking_id uuid,
  p_price_xaf integer,
  p_amount_due_xaf integer,
  p_starts_at timestamptz default null,
  p_duration_minutes integer default null,
  p_note text default null
) returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or not private.owns_merchant(v_booking.merchant_id) then
    raise exception 'Réservation introuvable' using errcode = 'P0002';
  end if;
  if v_booking.mode <> 'quote' or v_booking.status not in ('requested', 'quoted') then
    raise exception 'Devis impossible à ce stade' using errcode = '42501';
  end if;
  if p_price_xaf is null or p_price_xaf < 0 or p_amount_due_xaf < 0 or p_amount_due_xaf > p_price_xaf then
    raise exception 'Montants invalides' using errcode = '22023';
  end if;
  if (p_starts_at is null) <> (p_duration_minutes is null) or p_duration_minutes <= 0 then
    raise exception 'Date et durée vont ensemble' using errcode = '22023';
  end if;

  update public.bookings
     set status = 'quoted',
         price_xaf = p_price_xaf,
         amount_due_xaf = p_amount_due_xaf,
         starts_at = p_starts_at,
         ends_at = p_starts_at + make_interval(mins => p_duration_minutes),
         merchant_note = p_note
   where id = v_booking.id
  returning * into v_booking;
  return v_booking;
end;
$$;

-- Fait avancer une réservation (hors paiement).
--   client   : accepter un devis ; annuler avant la prestation
--   marchand : refuser une demande ; marquer comme faite ; annuler
--   admin    : tout, sauf confirmer une réservation qui attend un paiement
create function public.set_booking_status(
  p_booking_id uuid,
  p_status public.booking_status,
  p_note text default null
) returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  v_booking public.bookings;
  v_is_client boolean;
  v_is_merchant boolean;
  v_target public.booking_status := p_status;
  v_allowed boolean := false;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Réservation introuvable' using errcode = 'P0002';
  end if;
  v_is_client := v_booking.client_id = auth.uid();
  v_is_merchant := private.owns_merchant(v_booking.merchant_id);

  if v_booking.status in ('completed', 'declined', 'cancelled') then
    v_allowed := false;
  elsif p_status = 'confirmed' and v_booking.status = 'quoted' and (v_is_client or private.is_admin()) then
    -- Accepter un devis : paiement d'abord s'il y a un montant dû, et la date doit être libre.
    if v_booking.starts_at is not null then
      perform pg_advisory_xact_lock(hashtext(v_booking.merchant_id::text));
      if exists (
        select 1 from public.bookings b
         where b.merchant_id = v_booking.merchant_id and b.id <> v_booking.id
           and b.status in ('awaiting_payment', 'confirmed')
           and b.starts_at < v_booking.ends_at and b.ends_at > v_booking.starts_at
      ) then
        raise exception 'Créneau indisponible' using errcode = 'P0001';
      end if;
    end if;
    if v_booking.amount_due_xaf > 0 then
      v_target := 'awaiting_payment';
    end if;
    v_allowed := true;
  elsif p_status = 'cancelled' then
    v_allowed := v_is_client or v_is_merchant or private.is_admin();
  elsif p_status = 'declined' then
    v_allowed := (v_is_merchant or private.is_admin()) and v_booking.status in ('requested', 'quoted');
  elsif p_status = 'completed' then
    v_allowed := (v_is_merchant or private.is_admin()) and v_booking.status = 'confirmed';
  end if;

  if not v_allowed then
    raise exception 'Changement de statut non autorisé' using errcode = '42501';
  end if;

  update public.bookings
     set status = v_target,
         merchant_note = case when v_is_merchant and p_note is not null then p_note else merchant_note end
   where id = v_booking.id
  returning * into v_booking;
  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- Messages entre un client et une boutique
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  merchant_id uuid not null references public.merchants (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (client_id, merchant_id)
);
create index conversations_merchant_idx on public.conversations (merchant_id, last_message_at desc);
create index conversations_client_idx on public.conversations (client_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_sender_idx on public.messages (sender_id);

create function private.in_conversation(p_conversation_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversations c
     where c.id = p_conversation_id
       and (c.client_id = (select auth.uid()) or private.owns_merchant(c.merchant_id))
  );
$$;

-- Ouvre (ou retrouve) la conversation du client connecté avec une boutique validée.
create function public.start_conversation(p_merchant_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if not private.merchant_is_public(p_merchant_id) or private.owns_merchant(p_merchant_id) then
    raise exception 'Boutique indisponible' using errcode = 'P0002';
  end if;
  insert into public.conversations (client_id, merchant_id) values (auth.uid(), p_merchant_id)
  on conflict (client_id, merchant_id) do update set client_id = excluded.client_id
  returning id into v_id;
  return v_id;
end;
$$;

create function private.on_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function private.on_message();

-- Marque comme lus les messages reçus dans une conversation.
create function public.mark_conversation_read(p_conversation_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.messages
     set read_at = now()
   where conversation_id = p_conversation_id
     and sender_id <> (select auth.uid())
     and read_at is null
     and private.in_conversation(p_conversation_id);
$$;

-- ---------------------------------------------------------------------------
-- Paiements : écrits uniquement par le serveur (fonction « payments », rôle service)
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id),
  booking_id uuid references public.bookings (id),
  provider text not null,
  provider_payment_id text,
  -- Référence envoyée au prestataire, unique par tentative (ex. « C-7F3A9B21-1 »).
  reference text not null unique,
  amount_xaf integer not null check (amount_xaf > 0),
  status public.payment_status not null default 'pending',
  payer_phone text not null,
  checkout_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((order_id is null) <> (booking_id is null))
);
create index payments_order_idx on public.payments (order_id);
create index payments_booking_idx on public.payments (booking_id);
create unique index payments_provider_idx on public.payments (provider, provider_payment_id);

create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

-- Enregistre l'issue d'un paiement et fait avancer la commande ou la réservation.
-- Réservé au serveur : appelée par la fonction « payments » après vérification chez le prestataire.
create function public.record_payment_result(p_payment_id uuid, p_status public.payment_status)
returns public.payments
language plpgsql security definer set search_path = '' as $$
declare
  v_payment public.payments;
begin
  update public.payments set status = p_status
   where id = p_payment_id and status = 'pending'
  returning * into v_payment;
  if not found then
    select * into v_payment from public.payments where id = p_payment_id;
    return v_payment;
  end if;
  if p_status = 'succeeded' then
    update public.orders set status = 'paid'
     where id = v_payment.order_id and status = 'awaiting_payment';
    update public.bookings set status = 'confirmed'
     where id = v_payment.booking_id and status = 'awaiting_payment';
  end if;
  return v_payment;
end;
$$;

-- ---------------------------------------------------------------------------
-- Règles d'accès
-- ---------------------------------------------------------------------------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.merchant_hours enable row level security;
alter table public.bookings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.payments enable row level security;

create policy orders_select on public.orders for select to authenticated
  using (buyer_id = (select auth.uid()) or private.owns_merchant(merchant_id) or (select private.is_admin()));

create policy order_items_select on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

create policy merchant_hours_select on public.merchant_hours for select to anon, authenticated
  using (private.merchant_is_public(merchant_id) or private.owns_merchant(merchant_id)
         or (select private.is_admin()));
create policy merchant_hours_insert on public.merchant_hours for insert to authenticated
  with check (private.owns_merchant(merchant_id));
create policy merchant_hours_update on public.merchant_hours for update to authenticated
  using (private.owns_merchant(merchant_id)) with check (private.owns_merchant(merchant_id));
create policy merchant_hours_delete on public.merchant_hours for delete to authenticated
  using (private.owns_merchant(merchant_id));

create policy bookings_select on public.bookings for select to authenticated
  using (client_id = (select auth.uid()) or private.owns_merchant(merchant_id) or (select private.is_admin()));

create policy conversations_select on public.conversations for select to authenticated
  using (client_id = (select auth.uid()) or private.owns_merchant(merchant_id) or (select private.is_admin()));

create policy messages_select on public.messages for select to authenticated
  using (private.in_conversation(conversation_id) or (select private.is_admin()));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and read_at is null and private.in_conversation(conversation_id));

create policy payments_select on public.payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id)
         or exists (select 1 from public.bookings b where b.id = booking_id));

-- Droits : lecture via les règles ci-dessus ; écriture uniquement via les fonctions.
grant select on public.orders, public.order_items, public.bookings, public.conversations,
  public.messages, public.payments to authenticated;
grant select on public.merchant_hours to anon, authenticated;
grant insert, update, delete on public.merchant_hours to authenticated;
grant insert on public.messages to authenticated;

revoke all on all functions in schema private from public;
grant execute on function private.in_conversation(uuid), private.commission_rate(uuid)
  to anon, authenticated;
revoke all on function private.on_message() from anon, authenticated;

revoke all on function public.place_order(uuid, jsonb, text, text, text, text) from public, anon;
revoke all on function public.set_order_status(uuid, public.order_status, text) from public, anon;
revoke all on function public.request_booking(uuid, public.booking_mode, text, timestamptz, text, text) from public, anon;
revoke all on function public.quote_booking(uuid, integer, integer, timestamptz, integer, text) from public, anon;
revoke all on function public.set_booking_status(uuid, public.booking_status, text) from public, anon;
revoke all on function public.start_conversation(uuid) from public, anon;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
revoke all on function public.record_payment_result(uuid, public.payment_status) from public, anon, authenticated;
revoke all on function public.available_slots(uuid, date) from public;

grant execute on function public.place_order(uuid, jsonb, text, text, text, text),
  public.set_order_status(uuid, public.order_status, text),
  public.request_booking(uuid, public.booking_mode, text, timestamptz, text, text),
  public.quote_booking(uuid, integer, integer, timestamptz, integer, text),
  public.set_booking_status(uuid, public.booking_status, text),
  public.start_conversation(uuid),
  public.mark_conversation_read(uuid)
  to authenticated;
grant execute on function public.available_slots(uuid, date) to anon, authenticated;
grant execute on function public.record_payment_result(uuid, public.payment_status) to service_role;
-- Le serveur (fonction « payments ») lit les commandes et réservations et écrit les paiements.
grant usage on schema public to service_role;
grant select on public.orders, public.bookings to service_role;
grant select, insert, update on public.payments to service_role;

-- Messages en temps réel (Supabase Realtime respecte les règles d'accès ci-dessus).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
