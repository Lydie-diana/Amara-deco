import type { BookingMode, Merchant, Product, ReviewStatus, Service } from '@amara/core';

/**
 * Forme des lignes telles que la base les renvoie (snake_case), et conversion vers les
 * modèles d'Amara (camelCase). Une fois le projet Supabase relié, ces types pourront être
 * générés automatiquement à partir du schéma.
 */
export interface MerchantRow {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  kind: Merchant['kind'];
  city: string;
  bio: string | null;
  review_status: ReviewStatus;
  review_note: string | null;
  created_at: string;
}

export interface ProductRow {
  id: string;
  merchant_id: string;
  category_id: string;
  title: string;
  description: string | null;
  price_xaf: number;
  stock: number;
  is_unique: boolean;
  is_published: boolean;
}

export interface ServiceRow {
  id: string;
  merchant_id: string;
  category_id: string;
  title: string;
  description: string | null;
  booking_modes: BookingMode[];
  duration_minutes: number | null;
  price_xaf: number | null;
  deposit_xaf: number | null;
  is_published: boolean;
}

export interface CategoryRow {
  id: string;
  kind: 'product' | 'service';
  name_fr: string;
  name_en: string;
  position: number;
}

export type MerchantWithReview = Merchant & {
  ownerId: string;
  reviewNote?: string;
  createdAt: string;
};
export type CatalogProduct = Product & { isPublished: boolean };
export type CatalogService = Service & { categoryId: string; isPublished: boolean };

const opt = <T>(v: T | null): T | undefined => (v === null ? undefined : v);

export function toMerchant(r: MerchantRow): MerchantWithReview {
  return {
    id: r.id,
    ownerId: r.owner_id,
    slug: r.slug,
    name: r.name,
    kind: r.kind,
    city: r.city,
    bio: opt(r.bio),
    reviewStatus: r.review_status,
    reviewNote: opt(r.review_note),
    createdAt: r.created_at,
  };
}

export function toProduct(r: ProductRow): CatalogProduct {
  return {
    id: r.id,
    merchantId: r.merchant_id,
    title: r.title,
    description: opt(r.description),
    category: r.category_id,
    priceXaf: r.price_xaf,
    stock: r.stock,
    isUnique: r.is_unique,
    isPublished: r.is_published,
  };
}

export function toService(r: ServiceRow): CatalogService {
  return {
    id: r.id,
    merchantId: r.merchant_id,
    categoryId: r.category_id,
    title: r.title,
    description: opt(r.description),
    bookingModes: r.booking_modes,
    durationMinutes: opt(r.duration_minutes),
    priceXaf: opt(r.price_xaf),
    depositXaf: opt(r.deposit_xaf),
    isPublished: r.is_published,
  };
}
