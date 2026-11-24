import { createContext, useContext, type ReactNode } from 'react';
import { todayIso } from '@applications-db/shared';
import type { AppConfig } from '../config';
import { ApiClient } from './apiClient';
import type { ApplicationsClient } from './client';
import { MemoryClient } from './memoryClient';
import { generateSeed } from './seed';

const ClientContext = createContext<ApplicationsClient | null>(null);

export function ClientProvider({ client, children }: { client: ApplicationsClient; children: ReactNode }) {
  return <ClientContext.Provider value={client}>{children}</ClientContext.Provider>;
}

export function useClient(): ApplicationsClient {
  const client = useContext(ClientContext);
  if (!client) throw new Error('useClient must be used inside a ClientProvider');
  return client;
}

export function createClient(config: AppConfig): ApplicationsClient {
  return config.dataSource === 'api' ? new ApiClient(config.apiBaseUrl) : new MemoryClient(generateSeed(todayIso()));
}
