import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AmaraClient } from './client';
import { useAmaraClient } from './provider';
import {
  toMerchant,
  toProduct,
  toService,
  type CategoryRow,
  type MerchantRow,
  type ProductRow,
  type ServiceRow,
} from './rows';

const MERCHANT_COLUMNS =
  'id, owner_id, slug, name, kind, city, bio, review_status, review_note, created_at';
const PRODUCT_COLUMNS =
  'id, merchant_id, category_id, title, description, price_xaf, stock, is_unique, is_published';
const SERVICE_COLUMNS =
  'id, merchant_id, category_id, title, description, booking_modes, duration_minutes, price_xaf, deposit_xaf, is_published';

function need(client: AmaraClient | null): AmaraClient {
  if (!client) throw new Error('not_configured');
  return client;
}

/** Clés de cache, rangées ici pour invalider précisément après une modification. */
export const catalogKeys = {
  categories: ['categories'] as const,
  merchants: (city?: string) => ['merchants', city ?? 'all'] as const,
  merchant: (slug: string) => ['merchant', slug] as const,
  product: (id: string) => ['product', id] as const,
  search: (q: string) => ['search', q] as const,
  myMerchant: ['my-merchant'] as const,
  pending: ['merchants-pending'] as const,
};

export function useCategories() {
  const client = useAmaraClient();
  return useQuery({
    queryKey: catalogKeys.categories,
    enabled: client != null,
    staleTime: 24 * 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await need(client)
        .from('categories')
        .select('id, kind, name_fr, name_en, position')
        .order('position');
      if (error) throw error;
      return data as CategoryRow[];
    },
  });
}

/** Boutiques validées, les plus récentes d'abord. La base ne renvoie jamais les autres au public. */
export function useMerchants(city?: string) {
  const client = useAmaraClient();
  return useQuery({
    queryKey: catalogKeys.merchants(city),
    enabled: client != null,
    queryFn: async () => {
      let query = need(client)
        .from('merchants')
        .select(MERCHANT_COLUMNS)
        .eq('review_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(50);
      if (city) query = query.eq('city', city);
      const { data, error } = await query;
      if (error) throw error;
      return (data as MerchantRow[]).map(toMerchant);
    },
  });
}

/** Une boutique avec ses objets et services publiés. */
export function useMerchant(slug: string) {
  const client = useAmaraClient();
  return useQuery({
    queryKey: catalogKeys.merchant(slug),
    enabled: client != null && slug.length > 0,
    queryFn: async () => {
      const db = need(client);
      const { data: m, error } = await db
        .from('merchants')
        .select(MERCHANT_COLUMNS)
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      if (!m) return null;
      const merchant = toMerchant(m as MerchantRow);
      const [products, services] = await Promise.all([
        db
          .from('products')
          .select(PRODUCT_COLUMNS)
          .eq('merchant_id', merchant.id)
          .order('created_at', { ascending: false }),
        db
          .from('services')
          .select(SERVICE_COLUMNS)
          .eq('merchant_id', merchant.id)
          .order('created_at', { ascending: false }),
      ]);
      if (products.error) throw products.error;
      if (services.error) throw services.error;
      return {
        merchant,
        products: (products.data as ProductRow[]).map(toProduct),
        services: (services.data as ServiceRow[]).map(toService),
      };
    },
  });
}

/** Un objet et la boutique qui le vend. */
export function useProduct(id: string) {
  const client = useAmaraClient();
  return useQuery({
    queryKey: catalogKeys.product(id),
    enabled: client != null && id.length > 0,
    queryFn: async () => {
      const db = need(client);
      const { data, error } = await db
        .from('products')
        .select(PRODUCT_COLUMNS)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const product = toProduct(data as ProductRow);
      const { data: m, error: mErr } = await db
        .from('merchants')
        .select(MERCHANT_COLUMNS)
        .eq('id', product.merchantId)
        .single();
      if (mErr) throw mErr;
      return { product, merchant: toMerchant(m as MerchantRow) };
    },
  });
}

/** Transforme une saisie libre en requête plein texte : chaque mot doit apparaître (préfixe accepté). */
export function toSearchQuery(input: string): string | null {
  const words = input
    .toLowerCase()
    .normalize('NFC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2)
    .slice(0, 6);
  return words.length ? words.map((w) => `${w}:*`).join(' & ') : null;
}

/** Recherche dans les objets, les services et les noms de boutiques. */
export function useSearch(input: string) {
  const client = useAmaraClient();
  const q = toSearchQuery(input);
  return useQuery({
    queryKey: catalogKeys.search(q ?? ''),
    enabled: client != null && q != null,
    queryFn: async () => {
      const db = need(client);
      const pattern = `%${input.trim().replace(/[%_]/g, '')}%`;
      const [products, services, merchants] = await Promise.all([
        db
          .from('products')
          .select(PRODUCT_COLUMNS)
          .textSearch('search', q!, { config: 'simple' })
          .limit(30),
        db
          .from('services')
          .select(SERVICE_COLUMNS)
          .textSearch('search', q!, { config: 'simple' })
          .limit(30),
        db
          .from('merchants')
          .select(MERCHANT_COLUMNS)
          .eq('review_status', 'approved')
          .ilike('name', pattern)
          .limit(10),
      ]);
      for (const r of [products, services, merchants]) if (r.error) throw r.error;
      return {
        products: (products.data as ProductRow[]).map(toProduct),
        services: (services.data as ServiceRow[]).map(toService),
        merchants: (merchants.data as MerchantRow[]).map(toMerchant),
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Amara Pro : la boutique de la personne connectée
// ---------------------------------------------------------------------------

export function useMyMerchant() {
  const client = useAmaraClient();
  return useQuery({
    queryKey: catalogKeys.myMerchant,
    enabled: client != null,
    queryFn: async () => {
      const db = need(client);
      const { data: auth } = await db.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await db
        .from('merchants')
        .select(MERCHANT_COLUMNS)
        .eq('owner_id', auth.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const merchant = toMerchant(data as MerchantRow);
      const [products, services] = await Promise.all([
        db
          .from('products')
          .select(PRODUCT_COLUMNS)
          .eq('merchant_id', merchant.id)
          .order('created_at', { ascending: false }),
        db
          .from('services')
          .select(SERVICE_COLUMNS)
          .eq('merchant_id', merchant.id)
          .order('created_at', { ascending: false }),
      ]);
      if (products.error) throw products.error;
      if (services.error) throw services.error;
      return {
        merchant,
        products: (products.data as ProductRow[]).map(toProduct),
        services: (services.data as ServiceRow[]).map(toService),
      };
    },
  });
}

export interface NewMerchant {
  name: string;
  slug: string;
  kind: 'artisan' | 'service_provider' | 'both';
  city: string;
  bio?: string;
}

export function useCreateMerchant() {
  const client = useAmaraClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewMerchant) => {
      const db = need(client);
      const { data: auth } = await db.auth.getUser();
      if (!auth.user) throw new Error('not_signed_in');
      const { error } = await db.from('merchants').insert({ ...input, owner_id: auth.user.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogKeys.myMerchant }),
  });
}

export interface NewProduct {
  merchantId: string;
  categoryId: string;
  title: string;
  description?: string;
  priceXaf: number;
  stock: number;
  isUnique: boolean;
}

export function useAddProduct() {
  const client = useAmaraClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: NewProduct) => {
      const { error } = await need(client)
        .from('products')
        .insert({
          merchant_id: p.merchantId,
          category_id: p.categoryId,
          title: p.title,
          description: p.description ?? null,
          price_xaf: p.priceXaf,
          stock: p.stock,
          is_unique: p.isUnique,
        });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogKeys.myMerchant }),
  });
}

export interface NewService {
  merchantId: string;
  categoryId: string;
  title: string;
  description?: string;
  bookingModes: ('slot' | 'quote')[];
  durationMinutes?: number;
  priceXaf?: number;
  depositXaf?: number;
}

export function useAddService() {
  const client = useAmaraClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: NewService) => {
      const { error } = await need(client)
        .from('services')
        .insert({
          merchant_id: s.merchantId,
          category_id: s.categoryId,
          title: s.title,
          description: s.description ?? null,
          booking_modes: s.bookingModes,
          duration_minutes: s.durationMinutes ?? null,
          price_xaf: s.priceXaf ?? null,
          deposit_xaf: s.depositXaf ?? null,
        });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogKeys.myMerchant }),
  });
}

// ---------------------------------------------------------------------------
// Amara Admin : validation des boutiques
// ---------------------------------------------------------------------------

export function usePendingMerchants() {
  const client = useAmaraClient();
  return useQuery({
    queryKey: catalogKeys.pending,
    enabled: client != null,
    queryFn: async () => {
      const { data, error } = await need(client)
        .from('merchants')
        .select(MERCHANT_COLUMNS)
        .eq('review_status', 'pending')
        .order('created_at');
      if (error) throw error;
      return (data as MerchantRow[]).map(toMerchant);
    },
  });
}

export function useReviewMerchant() {
  const client = useAmaraClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      merchantId: string;
      decision: 'approved' | 'rejected';
      note?: string;
    }) => {
      const { error } = await need(client).rpc('review_merchant', {
        p_merchant_id: v.merchantId,
        p_decision: v.decision,
        p_note: v.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: catalogKeys.pending });
      void qc.invalidateQueries({ queryKey: ['merchants'] });
    },
  });
}

/** Indique si la personne connectée est administratrice (la base ne lui montre sinon rien). */
export function useIsAdmin() {
  const client = useAmaraClient();
  return useQuery({
    queryKey: ['is-admin'],
    enabled: client != null,
    queryFn: async () => {
      const { data, error } = await need(client).rpc('is_admin');
      if (error) throw error;
      return data === true;
    },
  });
}
