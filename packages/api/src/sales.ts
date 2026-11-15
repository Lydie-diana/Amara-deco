import type { BookingMode } from '@amara/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { need, type AmaraClient } from './client';
import { useAmaraClient } from './provider';

/**
 * Commandes, réservations et paiements.
 * Toute écriture passe par une fonction de la base (place_order, request_booking…) ou par
 * la fonction serveur « payments » : l'application ne fixe jamais un prix ni un statut payé.
 */

export type OrderStatus =
  'awaiting_payment' | 'paid' | 'accepted' | 'preparing' | 'delivered' | 'cancelled';

export type BookingStatus =
  | 'requested'
  | 'quoted'
  | 'awaiting_payment'
  | 'confirmed'
  | 'completed'
  | 'declined'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled';

export interface OrderItem {
  productId: string;
  title: string;
  unitPriceXaf: number;
  quantity: number;
}

export interface Order {
  id: string;
  reference: string;
  buyerId: string;
  merchantId: string;
  merchantName: string;
  status: OrderStatus;
  subtotalXaf: number;
  commissionXaf: number;
  deliveryCity: string;
  deliveryAddress: string;
  contactPhone: string;
  note: string | null;
  createdAt: string;
  items: OrderItem[];
}

export interface Booking {
  id: string;
  reference: string;
  clientId: string;
  merchantId: string;
  merchantName: string;
  serviceId: string;
  serviceTitle: string;
  mode: BookingMode;
  status: BookingStatus;
  startsAt: string | null;
  endsAt: string | null;
  priceXaf: number | null;
  amountDueXaf: number;
  city: string;
  address: string | null;
  clientMessage: string | null;
  merchantNote: string | null;
  createdAt: string;
}

export interface MerchantHours {
  weekday: number;
  opensAt: string;
  closesAt: string;
}

export const salesKeys = {
  order: (id: string) => ['order', id] as const,
  booking: (id: string) => ['booking', id] as const,
  slots: (serviceId: string, day: string) => ['slots', serviceId, day] as const,
  hours: (merchantId: string) => ['merchant-hours', merchantId] as const,
};

/** Quelles commandes ou réservations lister : les miennes (client), celles de ma boutique, ou toutes (admin). */
export type SalesScope = { buyer: true } | { merchantId: string } | { all: true };

const scopeKey = (s: SalesScope) =>
  'buyer' in s ? 'buyer' : 'merchantId' in s ? `merchant:${s.merchantId}` : 'all';

// ---------------------------------------------------------------------------
// Commandes
// ---------------------------------------------------------------------------

const ORDER_COLUMNS =
  'id, reference, buyer_id, merchant_id, status, subtotal_xaf, commission_xaf, delivery_city, delivery_address, contact_phone, note, created_at, merchants(name), order_items(product_id, title, unit_price_xaf, quantity)';

interface OrderRow {
  id: string;
  reference: string;
  buyer_id: string;
  merchant_id: string;
  status: OrderStatus;
  subtotal_xaf: number;
  commission_xaf: number;
  delivery_city: string;
  delivery_address: string;
  contact_phone: string;
  note: string | null;
  created_at: string;
  merchants: { name: string } | null;
  order_items: { product_id: string; title: string; unit_price_xaf: number; quantity: number }[];
}

export function toOrder(r: OrderRow): Order {
  return {
    id: r.id,
    reference: r.reference,
    buyerId: r.buyer_id,
    merchantId: r.merchant_id,
    merchantName: r.merchants?.name ?? '',
    status: r.status,
    subtotalXaf: r.subtotal_xaf,
    commissionXaf: r.commission_xaf,
    deliveryCity: r.delivery_city,
    deliveryAddress: r.delivery_address,
    contactPhone: r.contact_phone,
    note: r.note,
    createdAt: r.created_at,
    items: r.order_items.map((i) => ({
      productId: i.product_id,
      title: i.title,
      unitPriceXaf: i.unit_price_xaf,
      quantity: i.quantity,
    })),
  };
}

async function currentUserId(db: AmaraClient): Promise<string> {
  const { data } = await db.auth.getUser();
  if (!data.user) throw new Error('not_signed_in');
  return data.user.id;
}

export function useOrders(scope: SalesScope) {
  const client = useAmaraClient();
  return useQuery({
    queryKey: ['orders', scopeKey(scope)],
    enabled: client != null,
    queryFn: async () => {
      const db = need(client);
      let query = db
        .from('orders')
        .select(ORDER_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(100);
      if ('buyer' in scope) query = query.eq('buyer_id', await currentUserId(db));
      if ('merchantId' in scope) query = query.eq('merchant_id', scope.merchantId);
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as OrderRow[]).map(toOrder);
    },
  });
}

export function useOrder(id: string) {
  const client = useAmaraClient();
  return useQuery({
    queryKey: salesKeys.order(id),
    enabled: client != null && id.length > 0,
    queryFn: async () => {
      const { data, error } = await need(client)
        .from('orders')
        .select(ORDER_COLUMNS)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? toOrder(data as unknown as OrderRow) : null;
    },
  });
}

export interface NewOrder {
  merchantId: string;
  items: { productId: string; quantity: number }[];
  deliveryCity: string;
  deliveryAddress: string;
  contactPhone: string;
  note?: string;
}

export function usePlaceOrder() {
  const client = useAmaraClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewOrder) => {
      const { data, error } = await need(client).rpc('place_order', {
        p_merchant_id: input.merchantId,
        p_items: input.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
        p_delivery_city: input.deliveryCity,
        p_delivery_address: input.deliveryAddress,
        p_contact_phone: input.contactPhone,
        p_note: input.note ?? null,
      });
      if (error) throw error;
      return data as { id: string; reference: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useSetOrderStatus() {
  const client = useAmaraClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { orderId: string; status: OrderStatus; reason?: string }) => {
      const { error } = await need(client).rpc('set_order_status', {
        p_order_id: input.orderId,
        p_status: input.status,
        p_reason: input.reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, input) => {
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: salesKeys.order(input.orderId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Réservations
// ---------------------------------------------------------------------------

const BOOKING_COLUMNS =
  'id, reference, client_id, merchant_id, service_id, mode, status, starts_at, ends_at, price_xaf, amount_due_xaf, city, address, client_message, merchant_note, created_at, merchants(name), services(title)';

interface BookingRow {
  id: string;
  reference: string;
  client_id: string;
  merchant_id: string;
  service_id: string;
  mode: BookingMode;
  status: BookingStatus;
  starts_at: string | null;
  ends_at: string | null;
  price_xaf: number | null;
  amount_due_xaf: number;
  city: string;
  address: string | null;
  client_message: string | null;
  merchant_note: string | null;
  created_at: string;
  merchants: { name: string } | null;
  services: { title: string } | null;
}

export function toBooking(r: BookingRow): Booking {
  return {
    id: r.id,
    reference: r.reference,
    clientId: r.client_id,
    merchantId: r.merchant_id,
    merchantName: r.merchants?.name ?? '',
    serviceId: r.service_id,
    serviceTitle: r.services?.title ?? '',
    mode: r.mode,
    status: r.status,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    priceXaf: r.price_xaf,
    amountDueXaf: r.amount_due_xaf,
    city: r.city,
    address: r.address,
    clientMessage: r.client_message,
    merchantNote: r.merchant_note,
    createdAt: r.created_at,
  };
}

export function useBookings(scope: SalesScope) {
  const client = useAmaraClient();
  return useQuery({
    queryKey: ['bookings', scopeKey(scope)],
    enabled: client != null,
    queryFn: async () => {
      const db = need(client);
      let query = db
        .from('bookings')
        .select(BOOKING_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(100);
      if ('buyer' in scope) query = query.eq('client_id', await currentUserId(db));
      if ('merchantId' in scope) query = query.eq('merchant_id', scope.merchantId);
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as BookingRow[]).map(toBooking);
    },
  });
}

export function useBooking(id: string) {
  const client = useAmaraClient();
  return useQuery({
    queryKey: salesKeys.booking(id),
    enabled: client != null && id.length > 0,
    queryFn: async () => {
      const { data, error } = await need(client)
        .from('bookings')
        .select(BOOKING_COLUMNS)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? toBooking(data as unknown as BookingRow) : null;
    },
  });
}

/** Créneaux libres d'un service pour un jour (AAAA-MM-JJ, heure du Cameroun). */
export function useAvailableSlots(serviceId: string, day: string) {
  const client = useAmaraClient();
  return useQuery({
    queryKey: salesKeys.slots(serviceId, day),
    enabled: client != null && serviceId.length > 0 && day.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await need(client).rpc('available_slots', {
        p_service_id: serviceId,
        p_day: day,
      });
      if (error) throw error;
      return data as string[];
    },
  });
}

export interface NewBooking {
  serviceId: string;
  mode: BookingMode;
  city: string;
  startsAt?: string;
  address?: string;
  message?: string;
}

export function useRequestBooking() {
  const client = useAmaraClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewBooking) => {
      const { data, error } = await need(client).rpc('request_booking', {
        p_service_id: input.serviceId,
        p_mode: input.mode,
        p_city: input.city,
        p_starts_at: input.startsAt ?? null,
        p_address: input.address ?? null,
        p_message: input.message ?? null,
      });
      if (error) throw error;
      return data as { id: string; status: BookingStatus };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bookings'] });
      void qc.invalidateQueries({ queryKey: ['slots'] });
    },
  });
}

export interface Quote {
  bookingId: string;
  priceXaf: number;
  amountDueXaf: number;
  startsAt?: string;
  durationMinutes?: number;
  note?: string;
}

export function useQuoteBooking() {
  const client = useAmaraClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (q: Quote) => {
      const { error } = await need(client).rpc('quote_booking', {
        p_booking_id: q.bookingId,
        p_price_xaf: q.priceXaf,
        p_amount_due_xaf: q.amountDueXaf,
        p_starts_at: q.startsAt ?? null,
        p_duration_minutes: q.durationMinutes ?? null,
        p_note: q.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, q) => {
      void qc.invalidateQueries({ queryKey: ['bookings'] });
      void qc.invalidateQueries({ queryKey: salesKeys.booking(q.bookingId) });
    },
  });
}

export function useSetBookingStatus() {
  const client = useAmaraClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { bookingId: string; status: BookingStatus; note?: string }) => {
      const { error } = await need(client).rpc('set_booking_status', {
        p_booking_id: input.bookingId,
        p_status: input.status,
        p_note: input.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, input) => {
      void qc.invalidateQueries({ queryKey: ['bookings'] });
      void qc.invalidateQueries({ queryKey: salesKeys.booking(input.bookingId) });
      void qc.invalidateQueries({ queryKey: ['slots'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Horaires d'ouverture (Amara Pro)
// ---------------------------------------------------------------------------

export function useMerchantHours(merchantId: string) {
  const client = useAmaraClient();
  return useQuery({
    queryKey: salesKeys.hours(merchantId),
    enabled: client != null && merchantId.length > 0,
    queryFn: async () => {
      const { data, error } = await need(client)
        .from('merchant_hours')
        .select('weekday, opens_at, closes_at')
        .eq('merchant_id', merchantId)
        .order('weekday')
        .order('opens_at');
      if (error) throw error;
      return (data as { weekday: number; opens_at: string; closes_at: string }[]).map((h) => ({
        weekday: h.weekday,
        opensAt: h.opens_at.slice(0, 5),
        closesAt: h.closes_at.slice(0, 5),
      }));
    },
  });
}

/** Remplace toutes les plages d'ouverture de la boutique. */
export function useSaveMerchantHours() {
  const client = useAmaraClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { merchantId: string; hours: MerchantHours[] }) => {
      const db = need(client);
      const removed = await db.from('merchant_hours').delete().eq('merchant_id', input.merchantId);
      if (removed.error) throw removed.error;
      if (input.hours.length === 0) return;
      const { error } = await db.from('merchant_hours').insert(
        input.hours.map((h) => ({
          merchant_id: input.merchantId,
          weekday: h.weekday,
          opens_at: h.opensAt,
          closes_at: h.closesAt,
        })),
      );
      if (error) throw error;
    },
    onSuccess: (_d, input) => qc.invalidateQueries({ queryKey: salesKeys.hours(input.merchantId) }),
  });
}

// ---------------------------------------------------------------------------
// Paiement (fonction serveur « payments »)
// ---------------------------------------------------------------------------

export interface PaymentResult {
  paymentId: string;
  status: PaymentStatus;
  checkoutUrl?: string;
}

async function invokePayments(db: AmaraClient, body: Record<string, unknown>) {
  const { data, error } = await db.functions.invoke<PaymentResult>('payments', { body });
  if (error) {
    // Le code d'erreur métier (not_payable, invalid_phone…) est dans le corps de la réponse.
    const context = (error as { context?: Response }).context;
    const detail = context
      ? ((await context.json().catch(() => null)) as { error?: string } | null)
      : null;
    throw new Error(detail?.error ?? 'payment_failed');
  }
  return data as PaymentResult;
}

export function useStartPayment() {
  const client = useAmaraClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: 'order' | 'booking'; id: string; payerPhone: string }) =>
      invokePayments(need(client), { action: 'start', ...input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['order'] });
      void qc.invalidateQueries({ queryKey: ['bookings'] });
      void qc.invalidateQueries({ queryKey: ['booking'] });
    },
  });
}

export function useRefreshPayment() {
  const client = useAmaraClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) =>
      invokePayments(need(client), { action: 'refresh', paymentId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['order'] });
      void qc.invalidateQueries({ queryKey: ['booking'] });
    },
  });
}
