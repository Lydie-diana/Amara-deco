import type { ReviewStatus } from '@amara/core';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { need, type AmaraClient } from './client';
import { useAmaraClient } from './provider';

/**
 * Ateliers : photos et vidéos des artisans (publications) et statuts de 24 h.
 * Les fichiers sont privés : la base dit qui peut les voir, et l'application reçoit
 * des liens signés valables une heure.
 */

export type PostKind = 'post' | 'status';
export type MediaType = 'image' | 'video';

export interface PostMedia {
  id: string;
  path: string;
  type: MediaType;
  url: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
}

export interface AtelierPost {
  id: string;
  merchantId: string;
  merchant: { name: string; slug: string; city: string } | null;
  kind: PostKind;
  caption: string | null;
  reviewStatus: ReviewStatus;
  reviewNote: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  media: PostMedia[];
}

interface PostRow {
  id: string;
  merchant_id: string;
  kind: PostKind;
  caption: string | null;
  review_status: ReviewStatus;
  review_note: string | null;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  merchants: { name: string; slug: string; city: string } | null;
  post_media: {
    id: string;
    position: number;
    path: string;
    type: MediaType;
    width: number | null;
    height: number | null;
    duration_ms: number | null;
  }[];
}

const POST_COLUMNS =
  'id, merchant_id, kind, caption, review_status, review_note, published_at, expires_at, created_at, ' +
  'merchants(name, slug, city), post_media(id, position, path, type, width, height, duration_ms)';
const BUCKET = 'ateliers';
const URL_LIFETIME_S = 60 * 60;
const PAGE_SIZE = 12;

export const atelierKeys = {
  all: ['ateliers'] as const,
  feed: ['ateliers', 'feed'] as const,
  statuses: ['ateliers', 'statuses'] as const,
  merchant: (merchantId: string) => ['ateliers', 'merchant', merchantId] as const,
  mine: (merchantId: string) => ['ateliers', 'mine', merchantId] as const,
  pending: ['ateliers', 'pending'] as const,
};

/** Convertit les lignes et signe tous les fichiers en un seul appel. */
async function withUrls(db: AmaraClient, rows: PostRow[]): Promise<AtelierPost[]> {
  const paths = rows.flatMap((r) => r.post_media.map((m) => m.path));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data, error } = await db.storage.from(BUCKET).createSignedUrls(paths, URL_LIFETIME_S);
    if (error) throw error;
    for (const s of data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  return rows.map((r) => ({
    id: r.id,
    merchantId: r.merchant_id,
    merchant: r.merchants,
    kind: r.kind,
    caption: r.caption,
    reviewStatus: r.review_status,
    reviewNote: r.review_note,
    publishedAt: r.published_at,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    media: [...r.post_media]
      .sort((a, b) => a.position - b.position)
      .map((m) => ({
        id: m.id,
        path: m.path,
        type: m.type,
        url: urls.get(m.path) ?? null,
        width: m.width,
        height: m.height,
        durationMs: m.duration_ms,
      })),
  }));
}

/** Liens signés valables une heure : on recharge avant qu'ils n'expirent. */
const FRESH_MS = 30 * 60_000;

/** Fil des Ateliers : publications validées, les plus récentes d'abord, par pages. */
export function useAtelierFeed() {
  const client = useAmaraClient();
  return useInfiniteQuery({
    queryKey: atelierKeys.feed,
    enabled: client != null,
    staleTime: FRESH_MS,
    initialPageParam: 0,
    getNextPageParam: (last: AtelierPost[], pages) =>
      last.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
    queryFn: async ({ pageParam }) => {
      const db = need(client);
      const { data, error } = await db
        .from('posts')
        .select(POST_COLUMNS)
        .eq('kind', 'post')
        .eq('review_status', 'approved')
        .order('published_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);
      if (error) throw error;
      return withUrls(db, data as unknown as PostRow[]);
    },
  });
}

export interface StatusGroup {
  merchantId: string;
  merchant: AtelierPost['merchant'];
  statuses: AtelierPost[];
}

/** Statuts en cours (moins de 24 h), regroupés par boutique, la plus récente d'abord. */
export function groupStatuses(statuses: AtelierPost[]): StatusGroup[] {
  const groups = new Map<string, StatusGroup>();
  for (const s of statuses) {
    const group = groups.get(s.merchantId) ?? {
      merchantId: s.merchantId,
      merchant: s.merchant,
      statuses: [],
    };
    group.statuses.push(s);
    groups.set(s.merchantId, group);
  }
  for (const g of groups.values()) {
    g.statuses.sort((a, b) => (a.publishedAt ?? '').localeCompare(b.publishedAt ?? ''));
  }
  return [...groups.values()];
}

export function useStatuses() {
  const client = useAmaraClient();
  return useQuery({
    queryKey: atelierKeys.statuses,
    enabled: client != null,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const db = need(client);
      const { data, error } = await db
        .from('posts')
        .select(POST_COLUMNS)
        .eq('kind', 'status')
        .eq('review_status', 'approved')
        .gt('expires_at', new Date().toISOString())
        .order('published_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return groupStatuses(await withUrls(db, data as unknown as PostRow[]));
    },
  });
}

/** Publications validées d'une boutique (page boutique). */
export function useMerchantPosts(merchantId: string | undefined) {
  const client = useAmaraClient();
  return useQuery({
    queryKey: atelierKeys.merchant(merchantId ?? ''),
    enabled: client != null && !!merchantId,
    staleTime: FRESH_MS,
    queryFn: async () => {
      const db = need(client);
      const { data, error } = await db
        .from('posts')
        .select(POST_COLUMNS)
        .eq('merchant_id', merchantId!)
        .eq('kind', 'post')
        .eq('review_status', 'approved')
        .order('published_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return withUrls(db, data as unknown as PostRow[]);
    },
  });
}

/** Amara Pro : toutes les publications de ma boutique, avec leur état de validation. */
export function useMyPosts(merchantId: string | undefined) {
  const client = useAmaraClient();
  return useQuery({
    queryKey: atelierKeys.mine(merchantId ?? ''),
    enabled: client != null && !!merchantId,
    staleTime: FRESH_MS,
    queryFn: async () => {
      const db = need(client);
      const { data, error } = await db
        .from('posts')
        .select(POST_COLUMNS)
        .eq('merchant_id', merchantId!)
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return withUrls(db, data as unknown as PostRow[]);
    },
  });
}

/** Amara Admin : contenus en attente de validation, les plus anciens d'abord. */
export function usePendingPosts() {
  const client = useAmaraClient();
  return useQuery({
    queryKey: atelierKeys.pending,
    enabled: client != null,
    staleTime: FRESH_MS,
    queryFn: async () => {
      const db = need(client);
      const { data, error } = await db
        .from('posts')
        .select(POST_COLUMNS)
        .eq('review_status', 'pending')
        .order('created_at')
        .limit(50);
      if (error) throw error;
      return withUrls(db, data as unknown as PostRow[]);
    },
  });
}

/** Fichier choisi dans la galerie ou pris avec l'appareil photo. */
export interface PickedMedia {
  uri: string;
  type: MediaType;
  mimeType: string;
  width?: number;
  height?: number;
  durationMs?: number;
  sizeBytes?: number;
}

export interface NewPost {
  merchantId: string;
  kind: PostKind;
  caption?: string;
  media: PickedMedia[];
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

export const MAX_MEDIA_PER_POST = 10;
export const MAX_VIDEO_MS = 180_000;
/** Limite du stockage « ateliers » (50 Mo). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/**
 * Crée la publication (en attente), envoie les fichiers dans le dossier de la boutique,
 * puis les rattache. En cas d'échec, tout ce qui a été créé est retiré.
 */
export function useCreatePost() {
  const client = useAmaraClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewPost) => {
      if (input.media.length === 0 || input.media.length > MAX_MEDIA_PER_POST) {
        throw new Error('invalid_media_count');
      }
      for (const m of input.media) {
        if (!EXTENSIONS[m.mimeType]) throw new Error('unsupported_media');
        if (m.type === 'video' && (m.durationMs ?? 0) > MAX_VIDEO_MS) {
          throw new Error('video_too_long');
        }
        if ((m.sizeBytes ?? 0) > MAX_FILE_BYTES) throw new Error('too_large');
      }
      const db = need(client);
      const { data: post, error } = await db
        .from('posts')
        .insert({
          merchant_id: input.merchantId,
          kind: input.kind,
          caption: input.caption?.trim() || null,
        })
        .select('id')
        .single();
      if (error) throw error;
      const postId = (post as { id: string }).id;
      const uploaded: string[] = [];
      try {
        const rows = [];
        for (const [position, m] of input.media.entries()) {
          const path = `${input.merchantId}/${postId}-${position}.${EXTENSIONS[m.mimeType]}`;
          const body = await (await fetch(m.uri)).arrayBuffer();
          const { error: upErr } = await db.storage
            .from(BUCKET)
            .upload(path, body, { contentType: m.mimeType });
          if (upErr) throw upErr;
          uploaded.push(path);
          rows.push({
            post_id: postId,
            position,
            path,
            type: m.type,
            width: m.width ? Math.round(m.width) : null,
            height: m.height ? Math.round(m.height) : null,
            duration_ms: m.durationMs ? Math.round(m.durationMs) : null,
          });
        }
        const { error: mediaErr } = await db.from('post_media').insert(rows);
        if (mediaErr) throw mediaErr;
      } catch (e) {
        if (uploaded.length) await db.storage.from(BUCKET).remove(uploaded);
        await db.from('posts').delete().eq('id', postId);
        throw e;
      }
      return postId;
    },
    onSuccess: (_id, input) => invalidate(qc, input.merchantId),
  });
}

/** Supprime une publication et ses fichiers (la boutique, ou l'admin). */
export function useDeletePost() {
  const client = useAmaraClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (post: AtelierPost) => {
      const db = need(client);
      const { error } = await db.from('posts').delete().eq('id', post.id);
      if (error) throw error;
      // Seule la boutique peut supprimer ses fichiers. Après une suppression par l'admin,
      // ils ne sont plus rattachés à aucune publication et la base ne les sert plus.
      const paths = post.media.map((m) => m.path);
      if (paths.length) await db.storage.from(BUCKET).remove(paths);
    },
    onSuccess: (_v, post) => invalidate(qc, post.merchantId),
  });
}

export function useReviewPost() {
  const client = useAmaraClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { postId: string; decision: 'approved' | 'rejected'; note?: string }) => {
      const { error } = await need(client).rpc('review_post', {
        p_post_id: v.postId,
        p_decision: v.decision,
        p_note: v.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: atelierKeys.all }),
  });
}

function invalidate(qc: QueryClient, merchantId: string) {
  void qc.invalidateQueries({ queryKey: atelierKeys.mine(merchantId) });
  void qc.invalidateQueries({ queryKey: atelierKeys.pending });
}
