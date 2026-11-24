import { describe, expect, it } from 'vitest';
import { parseConfig } from './config';

describe('parseConfig', () => {
  it('defaults to memory and /api', () => {
    expect(parseConfig({})).toEqual({ dataSource: 'memory', apiBaseUrl: '/api' });
  });
  it('accepts api', () => {
    expect(parseConfig({ VITE_DATA_SOURCE: 'api' }).dataSource).toBe('api');
  });
  it('reads the api base url', () => {
    expect(parseConfig({ VITE_API_BASE_URL: 'http://x/y' }).apiBaseUrl).toBe('http://x/y');
  });
  it('rejects unknown data sources', () => {
    expect(() => parseConfig({ VITE_DATA_SOURCE: 'mongo' })).toThrow('Invalid VITE_DATA_SOURCE "mongo"');
  });
});
