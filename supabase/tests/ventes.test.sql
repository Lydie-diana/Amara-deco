-- Tests de la phase 2 : commandes, réservations, messages, paiements.
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

-- Une ébéniste (boutique validée), une cliente, une curieuse sans lien.
insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-0000000000e1', '+237699100001'),
  ('00000000-0000-0000-0000-0000000000e2', '+237699100002'),
  ('00000000-0000-0000-0000-0000000000e3', '+237699100003');

create function pg_temp.act_as(who text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',
    case who when 'ebeniste' then '00000000-0000-0000-0000-0000000000e1'
             when 'cliente' then '00000000-0000-0000-0000-0000000000e2'
             when 'curieuse' then '00000000-0000-0000-0000-0000000000e3'
             else '' end, false);
end $$;

-- Mise en place directe (déclencheurs de validation suspendus le temps de l'insertion).
set session_replication_role = replica;
insert into public.merchants (id, owner_id, slug, name, kind, city, review_status, commission_percent)
values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1',
        'ebenisterie-mbarga', 'Ébénisterie Mbarga', 'both', 'Yaoundé', 'approved', 12);
set session_replication_role = origin;
insert into public.products (id, merchant_id, category_id, title, price_xaf, stock) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', 'mobilier', 'Tabouret', 25000, 3),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f1', 'mobilier', 'Table basse', 120000, 1);
insert into public.services (id, merchant_id, category_id, title, booking_modes, duration_minutes, price_xaf, deposit_xaf) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1', 'decoration-interieure',
   'Conseil déco', '{slot,quote}', 60, 20000, 5000),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f1', 'fabrication-sur-mesure',
   'Visite gratuite', '{slot}', 30, 0, null);
-- Ouvert tous les jours de 9 h à 12 h.
insert into public.merchant_hours (merchant_id, weekday, opens_at, closes_at)
select '00000000-0000-0000-0000-0000000000f1', d, '09:00', '12:00' from generate_series(1, 7) d;

-- 1. Commande : les prix viennent de la base, le stock est réservé, la commission calculée.
select pg_temp.act_as('cliente') \gset
set role authenticated;
do $$
declare o public.orders;
begin
  o := public.place_order('00000000-0000-0000-0000-0000000000f1',
    '[{"product_id":"00000000-0000-0000-0000-0000000000a1","quantity":2},
      {"product_id":"00000000-0000-0000-0000-0000000000a2","quantity":1,"price_xaf":1}]',
    'Yaoundé', 'Bastos, rue 1.234', '+237699100002');
  assert o.status = 'awaiting_payment', 'commande en attente de paiement';
  assert o.subtotal_xaf = 170000, 'total calculé par la base : ' || o.subtotal_xaf;
  assert o.commission_xaf = 20400, 'commission de 12 % : ' || o.commission_xaf;
  assert (select count(*) from public.order_items where order_id = o.id) = 2, 'la cliente voit ses lignes';
  begin
    perform public.place_order('00000000-0000-0000-0000-0000000000f1',
      '[{"product_id":"00000000-0000-0000-0000-0000000000a2","quantity":1}]', 'Yaoundé', 'Bastos', '+237699100002');
    assert false, 'objet unique déjà réservé';
  exception when raise_exception then null;
  end;
  begin
    perform public.set_order_status(o.id, 'paid');
    assert false, 'une cliente ne peut pas se déclarer payée';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.orders set status = 'paid' where id = o.id;
    assert false, 'pas d''écriture directe';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  assert (select stock from public.products where id = '00000000-0000-0000-0000-0000000000a1') = 1, 'stock réservé';
end $$;

-- 2. Une autre personne ne voit pas la commande ; la boutique la voit.
select pg_temp.act_as('curieuse') \gset
set role authenticated;
do $$ begin
  assert (select count(*) from public.orders) = 0, 'commande invisible pour les autres';
  assert (select count(*) from public.order_items) = 0, 'lignes invisibles pour les autres';
end $$;
reset role;
select pg_temp.act_as('ebeniste') \gset
set role authenticated;
do $$ begin
  assert (select count(*) from public.orders) = 1, 'la boutique voit la commande';
  begin
    perform public.set_order_status((select id from public.orders), 'accepted');
    assert false, 'pas d''acceptation avant paiement';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 3. Paiement : seul le serveur l'enregistre, puis la boutique fait avancer la commande.
set role service_role;
insert into public.payments (order_id, provider, provider_payment_id, reference, amount_xaf, payer_phone)
select id, 'mock', 'mock_1', reference || '-1', subtotal_xaf, contact_phone from public.orders;
select public.record_payment_result((select id from public.payments), 'succeeded');
select public.record_payment_result((select id from public.payments), 'failed');
reset role;
do $$ begin
  assert (select status from public.orders) = 'paid', 'commande payée';
  assert (select status from public.payments) = 'succeeded', 'un paiement réglé ne change plus';
end $$;
select pg_temp.act_as('cliente') \gset
set role authenticated;
do $$ begin
  assert (select count(*) from public.payments) = 1, 'la cliente voit son paiement';
  begin
    perform public.record_payment_result((select id from public.payments), 'succeeded');
    assert false, 'enregistrement réservé au serveur';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_order_status((select id from public.orders), 'cancelled');
    assert false, 'plus d''annulation côté cliente après paiement';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select pg_temp.act_as('ebeniste') \gset
set role authenticated;
do $$ begin
  perform public.set_order_status((select id from public.orders), 'accepted');
  perform public.set_order_status((select id from public.orders), 'delivered');
  assert (select status from public.orders) = 'delivered', 'commande livrée';
end $$;
reset role;

-- 4. Annulation : le stock revient.
select pg_temp.act_as('cliente') \gset
set role authenticated;
do $$
declare o public.orders;
begin
  o := public.place_order('00000000-0000-0000-0000-0000000000f1',
    '[{"product_id":"00000000-0000-0000-0000-0000000000a1","quantity":1}]', 'Yaoundé', 'Bastos', '+237699100002');
  perform public.set_order_status(o.id, 'cancelled', 'Erreur');
end $$;
reset role;
do $$ begin
  assert (select stock from public.products where id = '00000000-0000-0000-0000-0000000000a1') = 1, 'stock rendu';
end $$;

-- 5. Créneaux : horaires respectés, pas de double réservation, acompte à payer.
select pg_temp.act_as('cliente') \gset
set role authenticated;
do $$
declare
  v_day date := (now() at time zone 'Africa/Douala')::date + 2;
  v_slot timestamptz := (v_day + time '10:00') at time zone 'Africa/Douala';
  b public.bookings;
begin
  assert (select count(*) from public.available_slots('00000000-0000-0000-0000-0000000000b1', v_day)) = 3,
    'trois créneaux d''une heure entre 9 h et 12 h';
  b := public.request_booking('00000000-0000-0000-0000-0000000000b1', 'slot', 'Yaoundé', v_slot);
  assert b.status = 'awaiting_payment' and b.amount_due_xaf = 5000, 'acompte à payer';
  assert (select count(*) from public.available_slots('00000000-0000-0000-0000-0000000000b1', v_day)) = 2,
    'créneau retiré';
  begin
    perform public.request_booking('00000000-0000-0000-0000-0000000000b2', 'slot', 'Yaoundé',
      v_slot + interval '30 minutes');
    assert false, 'chevauchement refusé';
  exception when raise_exception then null;
  end;
  begin
    perform public.request_booking('00000000-0000-0000-0000-0000000000b2', 'slot', 'Yaoundé',
      (v_day + time '14:00') at time zone 'Africa/Douala');
    assert false, 'hors horaires refusé';
  exception when raise_exception then null;
  end;
  b := public.request_booking('00000000-0000-0000-0000-0000000000b2', 'slot', 'Yaoundé',
    (v_day + time '11:00') at time zone 'Africa/Douala');
  assert b.status = 'confirmed', 'sans acompte, confirmé tout de suite';
  begin
    perform public.request_booking('00000000-0000-0000-0000-0000000000b2', 'quote', 'Yaoundé');
    assert false, 'mode non proposé';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;

-- 6. Devis : demande, proposition de la boutique, acceptation puis paiement.
select pg_temp.act_as('cliente') \gset
set role authenticated;
select (public.request_booking('00000000-0000-0000-0000-0000000000b1', 'quote', 'Douala',
        null, 'Akwa', 'Salon de 30 m²')).id as devis \gset
select set_config('test.devis', :'devis', false) \gset
reset role;
select pg_temp.act_as('curieuse') \gset
set role authenticated;
do $$ begin
  assert (select count(*) from public.bookings) = 0, 'réservations invisibles pour les autres';
end $$;
reset role;
select pg_temp.act_as('ebeniste') \gset
set role authenticated;
select public.quote_booking(:'devis', 300000, 100000, null, null, 'Visite incluse');
reset role;
select pg_temp.act_as('cliente') \gset
set role authenticated;
do $$ begin
  assert (select status from public.bookings where id = current_setting('test.devis')::uuid) = 'quoted', 'devis reçu';
end $$;
reset role;
select pg_temp.act_as('cliente') \gset
set role authenticated;
do $$
declare b public.bookings;
begin
  b := public.set_booking_status(current_setting('test.devis')::uuid, 'confirmed');
  assert b.status = 'awaiting_payment' and b.amount_due_xaf = 100000, 'devis accepté, acompte à payer';
end $$;
reset role;

-- 7. Messages : seuls la cliente et la boutique lisent et écrivent.
select pg_temp.act_as('cliente') \gset
set role authenticated;
select public.start_conversation('00000000-0000-0000-0000-0000000000f1') as conv \gset
select set_config('test.conv', :'conv', false) \gset
insert into public.messages (conversation_id, sender_id, body)
values (:'conv', '00000000-0000-0000-0000-0000000000e2', 'Bonjour, livrez-vous à Douala ?');
reset role;
select pg_temp.act_as('curieuse') \gset
set role authenticated;
do $$ begin
  assert (select count(*) from public.messages) = 0, 'messages privés';
end $$;
do $$ begin
  insert into public.messages (conversation_id, sender_id, body)
  values (current_setting('test.conv')::uuid, '00000000-0000-0000-0000-0000000000e3', 'Intrusion');
  assert false, 'pas d''écriture dans la conversation des autres';
exception when insufficient_privilege then null;
end $$;
reset role;
select pg_temp.act_as('ebeniste') \gset
set role authenticated;
select public.mark_conversation_read(:'conv');
do $$ begin
  assert (select count(*) from public.messages) = 1, 'la boutique lit le message (et l''intrusion a échoué)';
  assert (select read_at from public.messages) is not null, 'message marqué lu';
end $$;
reset role;

\echo 'Tests des ventes : OK.'
