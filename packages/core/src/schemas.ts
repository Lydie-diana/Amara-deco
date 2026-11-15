import { z } from 'zod';

/** Langues prises en charge dès la V1. */
export const LocaleSchema = z.enum(['fr', 'en']);
export type Locale = z.infer<typeof LocaleSchema>;

/** Rôles des comptes : un même compte peut être client et marchand. */
export const RoleSchema = z.enum(['client', 'merchant', 'admin']);
export type Role = z.infer<typeof RoleSchema>;

/** Montant en francs CFA : entier positif ou nul. */
export const AmountXafSchema = z.number().int().nonnegative();

/** Cycle de validation partagé par les boutiques et les publications du fil. */
export const ReviewStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const MerchantKindSchema = z.enum(['artisan', 'service_provider', 'both']);

export const MerchantSchema = z.object({
  id: z.string().uuid(),
  slug: z
    .string()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(2).max(80),
  kind: MerchantKindSchema,
  city: z.string().min(2).max(60),
  bio: z.string().max(600).optional(),
  reviewStatus: ReviewStatusSchema,
});
export type Merchant = z.infer<typeof MerchantSchema>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  merchantId: z.string().uuid(),
  title: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  category: z.string().min(2).max(40),
  priceXaf: AmountXafSchema,
  stock: z.number().int().nonnegative(),
  isUnique: z.boolean(),
});
export type Product = z.infer<typeof ProductSchema>;

/** Un service se réserve sur créneau, sur devis, ou les deux, au choix du marchand. */
export const BookingModeSchema = z.enum(['slot', 'quote']);
export type BookingMode = z.infer<typeof BookingModeSchema>;

export const ServiceSchema = z.object({
  id: z.string().uuid(),
  merchantId: z.string().uuid(),
  title: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  bookingModes: z.array(BookingModeSchema).min(1),
  durationMinutes: z.number().int().positive().optional(),
  priceXaf: AmountXafSchema.optional(),
  depositXaf: AmountXafSchema.optional(),
});
export type Service = z.infer<typeof ServiceSchema>;

export const OrderStatusSchema = z.enum([
  'awaiting_payment',
  'paid',
  'accepted',
  'preparing',
  'delivered',
  'cancelled',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

/** Publication du fil « Ateliers » : rien n'est visible avant validation par l'admin. */
export const FeedPostSchema = z.object({
  id: z.string().uuid(),
  merchantId: z.string().uuid(),
  kind: z.enum(['video', 'image', 'status']),
  caption: z.string().max(500).optional(),
  reviewStatus: ReviewStatusSchema,
  /** Les statuts expirent ; les vidéos et images restent. */
  expiresAt: z.string().datetime().optional(),
});
export type FeedPost = z.infer<typeof FeedPostSchema>;

/** Un contenu n'est montré au public que s'il est validé. */
export function isPubliclyVisible(item: { reviewStatus: ReviewStatus }): boolean {
  return item.reviewStatus === 'approved';
}
