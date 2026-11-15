import { useAskAssistant, type AssistantItem, type AssistantTurn } from '@amara/api';
import { formatXaf } from '@amara/core';
import { useTranslation } from '@amara/i18n';
import { Arch, Button, colors, fonts, radius, space, Text, TextField } from '@amara/ui';
import { Link, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { archTint } from '../catalog/labels';
import { cardStyle } from '../catalog/MerchantCard';

interface ChatMessage extends AssistantTurn {
  items?: AssistantItem[];
}

/** La conversation envoyée au serveur reste courte : les derniers échanges suffisent. */
const MAX_SENT_TURNS = 12;
const KNOWN_ERRORS = ['quota_reached', 'assistant_disabled', 'assistant_busy', 'unauthorized'];

/** Conversation avec l'assistant IA : le client décrit son besoin, l'assistant propose. */
export function AssistantChat() {
  const { t, i18n } = useTranslation('assistant');
  const ask = useAskAssistant();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');

  const send = (text: string) => {
    const clean = text.trim();
    if (!clean || ask.isPending) return;
    const next = [...messages, { role: 'user' as const, text: clean }];
    setMessages(next);
    setDraft('');
    // Le serveur attend un échange qui commence et finit par le client.
    const recent = next.slice(-MAX_SENT_TURNS);
    const firstUser = recent.findIndex((m) => m.role === 'user');
    ask.mutate(
      {
        conversation: recent.slice(firstUser).map(({ role, text: body }) => ({ role, text: body })),
        language: i18n.language === 'en' ? 'en' : 'fr',
      },
      {
        onSuccess: (answer) =>
          setMessages((current) => [
            ...current,
            { role: 'assistant', text: answer.reply, items: answer.items },
          ]),
      },
    );
  };

  const errorCode = ask.error?.message ?? '';
  const suggestions = t('suggestions', { returnObjects: true }) as string[];

  return (
    <View style={{ gap: space.lg }}>
      {messages.length === 0 ? (
        <View style={{ gap: space.sm }}>
          <Text tone="muted">{t('intro')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {suggestions.map((s) => (
              <Pressable
                key={s}
                accessibilityRole="button"
                onPress={() => send(s)}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: space.md,
                    paddingVertical: space.sm,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.sandLine,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text variant="caption">{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {messages.map((m, i) => (
        <Bubble key={i} message={m} />
      ))}

      {ask.isPending ? (
        <Text tone="muted" accessibilityLiveRegion="polite">
          {t('thinking')}
        </Text>
      ) : null}
      {ask.isError ? (
        <Text style={{ color: colors.clay }} accessibilityLiveRegion="polite">
          {t(`errors.${KNOWN_ERRORS.includes(errorCode) ? errorCode : 'generic'}`)}
        </Text>
      ) : null}

      <View style={{ gap: space.sm }}>
        <TextField
          label={t('inputLabel')}
          placeholder={t('inputPlaceholder')}
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={2000}
          onSubmitEditing={() => send(draft)}
        />
        <Button
          label={t('send')}
          loading={ask.isPending}
          disabled={!draft.trim()}
          onPress={() => send(draft)}
        />
      </View>
    </View>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role === 'user';
  return (
    <View style={{ gap: space.md, alignItems: mine ? 'flex-end' : 'stretch' }}>
      <View
        style={{
          maxWidth: mine ? '85%' : '100%',
          padding: space.md,
          borderRadius: radius.md,
          backgroundColor: mine ? colors.olive : colors.sand,
        }}
      >
        <Text style={mine ? { color: colors.linen } : undefined}>{message.text}</Text>
      </View>
      {message.items?.map((item) => (
        <ResultCard key={`${item.type}-${item.id}`} item={item} />
      ))}
    </View>
  );
}

function hrefFor(item: AssistantItem): Href {
  switch (item.type) {
    case 'product':
      return { pathname: '/objet/[id]', params: { id: item.id } };
    case 'service':
      return { pathname: '/reservation/[service]', params: { service: item.id } };
    default:
      return { pathname: '/boutique/[slug]', params: { slug: item.merchantSlug } };
  }
}

/** Une proposition de l'assistant : objet, service ou boutique, qui ouvre sa page. */
function ResultCard({ item }: { item: AssistantItem }) {
  const { t } = useTranslation('assistant');
  const place = item.type === 'merchant' ? item.city : `${item.merchant ?? ''} · ${item.city}`;
  return (
    <Link href={hrefFor(item)} asChild>
      <Pressable
        accessibilityRole="link"
        style={({ pressed }) => [
          cardStyle,
          { flexDirection: 'row', gap: space.md, alignItems: 'center' },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Arch width={56} height={70} color={archTint(item.id)} footRadius={8} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="eyebrow" tone="brand" style={{ fontSize: 11 }}>
            {t(`types.${item.type}`)}
          </Text>
          <Text variant="title" style={{ fontSize: 17, lineHeight: 21 }} numberOfLines={2}>
            {item.title}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {place}
          </Text>
          {item.priceXaf != null ? (
            <Text style={{ fontFamily: fonts.bodyBold, color: colors.ebony }}>
              {formatXaf(item.priceXaf)}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}
