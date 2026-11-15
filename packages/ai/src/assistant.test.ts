import { describe, expect, it } from 'vitest';
import {
  AssistantInputError,
  readConversation,
  readFilters,
  runAssistant,
  systemPrompt,
  type CatalogItem,
  type SearchFilters,
} from './index.ts';

const mask: CatalogItem = {
  type: 'product',
  id: 'p1',
  title: 'Masque Bamiléké',
  priceXaf: 45000,
  merchant: 'Bois de Mbouda',
  merchantSlug: 'bois-de-mbouda',
  city: 'Douala',
};
const sofa: CatalogItem = { ...mask, id: 'p2', title: 'Canapé en raphia' };

/** Faux client de l'API : rejoue des réponses écrites d'avance et garde chaque demande. */
function fakeClient(responses: Array<{ stop_reason: string; content: unknown[] }>) {
  const requests: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        create: async (params: Record<string, unknown>) => {
          requests.push(structuredClone(params));
          const next = responses.shift();
          if (!next) throw new Error('plus de réponse prévue');
          return next;
        },
      },
    },
  };
  return { requests, client: client as never };
}

const toolUse = (id: string, name: string, input: unknown) => ({
  type: 'tool_use',
  id,
  name,
  input,
});
const text = (t: string) => ({ type: 'text', text: t });

describe('readConversation', () => {
  it('garde un échange texte qui finit par le client', () => {
    expect(
      readConversation([
        { role: 'user', text: ' Un masque ' },
        { role: 'assistant', text: 'Pour quelle pièce ?' },
        { role: 'user', text: 'Le salon' },
      ]),
    ).toEqual([
      { role: 'user', text: 'Un masque' },
      { role: 'assistant', text: 'Pour quelle pièce ?' },
      { role: 'user', text: 'Le salon' },
    ]);
  });

  it.each([
    [[], 'empty_conversation'],
    [[{ role: 'system', text: 'x' }], 'invalid_turn'],
    [[{ role: 'assistant', text: 'x' }], 'invalid_turn'],
    [[{ role: 'user', text: 'x'.repeat(2001) }], 'too_long'],
    [Array.from({ length: 21 }, () => ({ role: 'user', text: 'x' })), 'too_long'],
  ])('refuse une conversation invalide (%#)', (value, code) => {
    expect(() => readConversation(value)).toThrow(AssistantInputError);
    expect(() => readConversation(value)).toThrow(code);
  });
});

describe('readFilters', () => {
  it('nettoie ce que propose le modèle', () => {
    expect(
      readFilters({
        query: '  masque ',
        kind: 'shop',
        category: '',
        city: 'Douala',
        maxPriceXaf: -5,
      }),
    ).toEqual({ query: 'masque', kind: null, category: null, city: 'Douala', maxPriceXaf: null });
  });
});

describe('systemPrompt', () => {
  it('répond dans la langue de l’appli et connaît les catégories', () => {
    const prompt = systemPrompt('en', [{ id: 'sculpture', name: 'Sculpture' }]);
    expect(prompt).toContain('Answer in English');
    expect(prompt).toContain('- sculpture: Sculpture');
  });
});

describe('runAssistant', () => {
  const base = {
    model: 'claude-opus-5-5',
    language: 'fr' as const,
    categories: [{ id: 'sculpture', name: 'Sculpture' }],
    conversation: [{ role: 'user' as const, text: 'Un masque pour mon salon à Douala' }],
  };

  it('cherche, montre son choix puis répond', async () => {
    const { client, requests } = fakeClient([
      {
        stop_reason: 'tool_use',
        content: [
          toolUse('t1', 'search_catalog', {
            query: 'masque mask',
            kind: null,
            category: 'sculpture',
            city: 'Douala',
            maxPriceXaf: null,
          }),
        ],
      },
      { stop_reason: 'tool_use', content: [toolUse('t2', 'show_results', { ids: ['p2', 'zz'] })] },
      { stop_reason: 'end_turn', content: [text('Ce canapé ira très bien.')] },
    ]);
    const searches: SearchFilters[] = [];
    const answer = await runAssistant({
      ...base,
      client,
      search: async (f) => {
        searches.push(f);
        return [mask, sofa];
      },
    });

    expect(answer).toEqual({ reply: 'Ce canapé ira très bien.', items: [sofa] });
    expect(searches).toEqual([
      {
        query: 'masque mask',
        kind: null,
        category: 'sculpture',
        city: 'Douala',
        maxPriceXaf: null,
      },
    ]);
    expect(requests).toHaveLength(3);
    expect(requests[0]).toMatchObject({
      model: 'claude-opus-5-5',
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    // Le résultat de la recherche revient au modèle, lié à son appel.
    expect(requests[1]!.messages).toEqual(
      expect.arrayContaining([
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 't1', content: JSON.stringify([mask, sofa]) },
          ],
        },
      ]),
    );
  });

  it('montre tout ce qu’il a trouvé s’il ne choisit pas', async () => {
    const { client } = fakeClient([
      {
        stop_reason: 'tool_use',
        content: [toolUse('t1', 'search_catalog', { query: 'masque' })],
      },
      { stop_reason: 'end_turn', content: [text('Voici deux pistes.')] },
    ]);
    const answer = await runAssistant({ ...base, client, search: async () => [mask, sofa] });
    expect(answer.items).toEqual([mask, sofa]);
  });

  it('s’arrête après quelques recherches', async () => {
    const search = { stop_reason: 'tool_use', content: [toolUse('t', 'search_catalog', {})] };
    const { client, requests } = fakeClient([
      search,
      search,
      search,
      search,
      { stop_reason: 'end_turn', content: [text('Rien de précis.')] },
    ]);
    const answer = await runAssistant({ ...base, client, search: async () => [] });
    expect(answer.reply).toBe('Rien de précis.');
    expect(requests.at(-1)!.tool_choice).toEqual({ type: 'none' });
  });

  it('répond poliment à un refus', async () => {
    const { client } = fakeClient([{ stop_reason: 'refusal', content: [] }]);
    const answer = await runAssistant({ ...base, client, search: async () => [] });
    expect(answer.items).toEqual([]);
    expect(answer.reply).toMatch(/autrement/);
  });
});
