export type DataSource = 'memory' | 'api';
export type AppConfig = { dataSource: DataSource; apiBaseUrl: string };

export function parseConfig(env: Record<string, unknown>): AppConfig {
  const raw = env.VITE_DATA_SOURCE;
  const value = raw === undefined || raw === '' ? 'memory' : raw;
  if (value !== 'memory' && value !== 'api') {
    throw new Error(`Invalid VITE_DATA_SOURCE "${String(value)}": expected "memory" or "api"`);
  }
  const base = env.VITE_API_BASE_URL;
  const apiBaseUrl = typeof base === 'string' && base !== '' ? base : '/api';
  return { dataSource: value, apiBaseUrl };
}

export const config: AppConfig = parseConfig(import.meta.env);
