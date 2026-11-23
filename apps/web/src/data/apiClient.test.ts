import { ApiClient } from './apiClient';
import { ClientError } from './client';

type Call = { url: string; init?: RequestInit };

function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fn = ((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(respond());
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('ApiClient', () => {
  it('serialises list queries with repeated params', async () => {
    const { fn, calls } = fakeFetch(() => json({ items: [], total: 0, page: 2, pageSize: 25 }));
    const client = new ApiClient('/api', fn);
    await client.list({
      status: ['applied', 'offer'],
      page: 2,
      pageSize: 25,
      sort: 'dateApplied:desc',
    });
    expect(calls[0]?.url).toBe(
      '/api/applications?status=applied&status=offer&page=2&pageSize=25&sort=dateApplied%3Adesc',
    );
    expect(calls[0]?.init?.method).toBe('GET');
  });

  it('maps an error body to ClientError with its code', async () => {
    const { fn } = fakeFetch(() => json({ code: 'ENTRY_BEFORE_APPLIED', message: 'too early' }, 409));
    const client = new ApiClient('/api', fn);
    await expect(client.addStatus('a', { status: 'offer', date: '2026-01-01' })).rejects.toMatchObject({
      name: 'ClientError',
      status: 409,
      code: 'ENTRY_BEFORE_APPLIED',
      message: 'too early',
    });
  });

  it('keeps validation issues from the error body', async () => {
    const issues = [{ path: ['company'] }];
    const { fn } = fakeFetch(() => json({ code: 'VALIDATION', message: 'bad', issues }, 400));
    await expect(new ApiClient('/api', fn).get('a')).rejects.toMatchObject({
      status: 400,
      issues,
    });
  });

  it('uses HTTP_<status> for non-JSON error bodies', async () => {
    const { fn } = fakeFetch(() => new Response('<html>bad gateway</html>', { status: 502 }));
    await expect(new ApiClient('/api', fn).health()).rejects.toMatchObject({
      status: 502,
      code: 'HTTP_502',
    });
  });

  it('maps a rejected fetch to status 0 NETWORK', async () => {
    const client = new ApiClient('/api', () => Promise.reject(new TypeError('Failed to fetch')));
    const err = await client.get('a').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ClientError);
    expect(err).toMatchObject({ status: 0, code: 'NETWORK' });
  });

  it('requests report ranges', async () => {
    const { fn, calls } = fakeFetch(() => json({}));
    await new ApiClient('/api', fn).report({
      from: '2026-01-01',
      to: '2026-02-01',
    });
    expect(calls[0]?.url).toBe('/api/reports?from=2026-01-01&to=2026-02-01');
  });

  it('sends JSON bodies and expects 204 on remove', async () => {
    const { fn, calls } = fakeFetch(() => new Response(null, { status: 204 }));
    const client = new ApiClient('/api/', fn);
    await expect(client.remove('abc')).resolves.toBeUndefined();
    expect(calls[0]).toMatchObject({
      url: '/api/applications/abc',
      init: { method: 'DELETE' },
    });

    const post = fakeFetch(() => json({ id: 'x' }, 201));
    await new ApiClient('/api', post.fn).create({
      company: 'Acme',
      role: 'Eng',
      source: 'other',
      dateApplied: '2026-01-01',
      contacts: [],
    });
    expect(post.calls[0]?.init?.method).toBe('POST');
    expect(JSON.parse(post.calls[0]?.init?.body as string)).toMatchObject({
      company: 'Acme',
    });
  });

  it('uses the documented routes', async () => {
    const { fn, calls } = fakeFetch(() => json({}));
    const client = new ApiClient('/api', fn);
    await client.dashboard('2026-11-23');
    await client.statistics();
    await client.health();
    await client.updateStatus('a', 'e', { note: 'n' });
    await client.removeStatus('a', 'e');
    expect(calls.map((c) => `${c.init?.method} ${c.url}`)).toEqual([
      'GET /api/dashboard?today=2026-11-23',
      'GET /api/stats',
      'GET /api/health',
      'PATCH /api/applications/a/status/e',
      'DELETE /api/applications/a/status/e',
    ]);
  });
});
