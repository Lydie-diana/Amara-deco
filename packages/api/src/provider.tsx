import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';

import type { AmaraClient } from './client';

const ClientContext = createContext<AmaraClient | null>(null);

export interface AmaraDataProviderProps {
  client: AmaraClient | null;
  children: ReactNode;
}

/** Fournit le client Supabase et le cache de données à toute l'application. */
export function AmaraDataProvider({ client, children }: AmaraDataProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // Réseau mobile instable : on garde les données plus longtemps et on réessaie.
          queries: { staleTime: 60_000, gcTime: 24 * 60 * 60_000, retry: 2 },
        },
      }),
  );
  return (
    <ClientContext.Provider value={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ClientContext.Provider>
  );
}

/** Le client Supabase, ou null si l'application n'est pas configurée. */
export function useAmaraClient(): AmaraClient | null {
  return useContext(ClientContext);
}
