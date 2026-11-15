import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { need } from './client';
import { useAmaraClient } from './provider';

/** Conversations entre un client et une boutique, mises à jour en temps réel. */

export interface Conversation {
  id: string;
  clientId: string;
  merchantId: string;
  merchantName: string;
  merchantSlug: string;
  clientName: string | null;
  lastMessageAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export const messageKeys = {
  conversations: (merchantId?: string) => ['conversations', merchantId ?? 'mine'] as const,
  thread: (conversationId: string) => ['messages', conversationId] as const,
};

interface ConversationRow {
  id: string;
  client_id: string;
  merchant_id: string;
  last_message_at: string;
  merchants: { name: string; slug: string } | null;
  profiles: { display_name: string | null } | null;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

const toMessage = (r: MessageRow): Message => ({
  id: r.id,
  conversationId: r.conversation_id,
  senderId: r.sender_id,
  body: r.body,
  createdAt: r.created_at,
  readAt: r.read_at,
});

/** Côté client : ses conversations. Côté Pro : celles de sa boutique (merchantId). */
export function useConversations(merchantId?: string) {
  const client = useAmaraClient();
  return useQuery({
    queryKey: messageKeys.conversations(merchantId),
    enabled: client != null,
    queryFn: async () => {
      const db = need(client);
      let query = db
        .from('conversations')
        .select(
          'id, client_id, merchant_id, last_message_at, merchants(name, slug), profiles(display_name)',
        )
        .order('last_message_at', { ascending: false })
        .limit(100);
      if (merchantId) {
        query = query.eq('merchant_id', merchantId);
      } else {
        const { data } = await db.auth.getUser();
        if (!data.user) return [];
        query = query.eq('client_id', data.user.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as ConversationRow[]).map((r): Conversation => ({
        id: r.id,
        clientId: r.client_id,
        merchantId: r.merchant_id,
        merchantName: r.merchants?.name ?? '',
        merchantSlug: r.merchants?.slug ?? '',
        clientName: r.profiles?.display_name ?? null,
        lastMessageAt: r.last_message_at,
      }));
    },
  });
}

/** Les messages d'une conversation ; les nouveaux arrivent sans recharger. */
export function useMessages(conversationId: string) {
  const client = useAmaraClient();
  const qc = useQueryClient();
  const key = messageKeys.thread(conversationId);

  useEffect(() => {
    if (!client || !conversationId) return;
    const channel = client
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const message = toMessage(payload.new as MessageRow);
          qc.setQueryData<Message[]>(key, (old = []) =>
            old.some((m) => m.id === message.id) ? old : [...old, message],
          );
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, conversationId]);

  return useQuery({
    queryKey: key,
    enabled: client != null && conversationId.length > 0,
    queryFn: async () => {
      const { data, error } = await need(client)
        .from('messages')
        .select('id, conversation_id, sender_id, body, created_at, read_at')
        .eq('conversation_id', conversationId)
        .order('created_at')
        .limit(500);
      if (error) throw error;
      return (data as MessageRow[]).map(toMessage);
    },
  });
}

export function useStartConversation() {
  const client = useAmaraClient();
  return useMutation({
    mutationFn: async (merchantId: string) => {
      const { data, error } = await need(client).rpc('start_conversation', {
        p_merchant_id: merchantId,
      });
      if (error) throw error;
      return data as string;
    },
  });
}

export function useSendMessage(conversationId: string) {
  const client = useAmaraClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const db = need(client);
      const { data: auth } = await db.auth.getUser();
      if (!auth.user) throw new Error('not_signed_in');
      const { data, error } = await db
        .from('messages')
        .insert({ conversation_id: conversationId, sender_id: auth.user.id, body: body.trim() })
        .select('id, conversation_id, sender_id, body, created_at, read_at')
        .single();
      if (error) throw error;
      return toMessage(data as MessageRow);
    },
    onSuccess: (message) => {
      qc.setQueryData<Message[]>(messageKeys.thread(conversationId), (old = []) =>
        old.some((m) => m.id === message.id) ? old : [...old, message],
      );
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useMarkConversationRead() {
  const client = useAmaraClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await need(client).rpc('mark_conversation_read', {
        p_conversation_id: conversationId,
      });
      if (error) throw error;
    },
  });
}
