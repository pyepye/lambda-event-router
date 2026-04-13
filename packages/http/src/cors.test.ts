import { buildCorsHeaders, type CorsConfig, resolveOrigin } from './cors.js';
import type { HttpMethod } from './types.js';

suite('resolveOrigin', () => {
  test('returns wildcard string origin directly', async () => {
    const config: CorsConfig = { origin: '*' };

    const result = await resolveOrigin(config, 'https://example.com', '/');
    expect(result).toBe('*');
  });

  test('returns specific string origin directly', async () => {
    const config: CorsConfig = { origin: 'https://example.com' };

    const result = await resolveOrigin(config, 'https://other.com', '/');
    expect(result).toBe('https://example.com');
  });

  test('returns string origin even when requestOrigin is undefined', async () => {
    const config: CorsConfig = { origin: 'https://example.com' };

    const result = await resolveOrigin(config, undefined, '/');
    expect(result).toBe('https://example.com');
  });

  test('returns matching origin from array', async () => {
    const config: CorsConfig = { origin: ['https://a.com', 'https://b.com'] };

    const result = await resolveOrigin(config, 'https://b.com', '/');
    expect(result).toBe('https://b.com');
  });

  test('returns undefined for non-matching origin in array', async () => {
    const config: CorsConfig = { origin: ['https://a.com', 'https://b.com'] };

    const result = await resolveOrigin(config, 'https://c.com', '/');
    expect(result).toBeUndefined();
  });

  test('returns undefined for array origin when requestOrigin is undefined', async () => {
    const config: CorsConfig = { origin: ['https://a.com'] };

    const result = await resolveOrigin(config, undefined, '/');
    expect(result).toBeUndefined();
  });

  test('calls function origin with origin and path', async () => {
    const originFn = vi.fn().mockReturnValue('https://allowed.com');
    const config: CorsConfig = { origin: originFn };

    const result = await resolveOrigin(config, 'https://allowed.com', '/items');

    expect(result).toBe('https://allowed.com');
    expect(originFn).toHaveBeenCalledWith('https://allowed.com', '/items');
  });

  test('returns undefined from function origin', async () => {
    const config: CorsConfig = { origin: () => undefined };

    const result = await resolveOrigin(config, 'https://denied.com', '/');
    expect(result).toBeUndefined();
  });

  test('returns undefined for function origin when requestOrigin is undefined', async () => {
    const originFn = vi.fn();
    const config: CorsConfig = { origin: originFn };

    const result = await resolveOrigin(config, undefined, '/');
    expect(result).toBeUndefined();
    expect(originFn).not.toHaveBeenCalled();
  });
});

suite('buildCorsHeaders', () => {
  const defaultOptions = {
    requestOrigin: 'https://example.com',
    path: '/',
    requestHeaders: {} as Record<string, string | undefined>,
    methods: ['GET', 'POST'] as HttpMethod[],
  };

  test('returns undefined when origin is not allowed', async () => {
    const config: CorsConfig = { origin: ['https://other.com'] };

    const result = await buildCorsHeaders({
      config,
      ...defaultOptions,
      isPreflight: false,
    });

    expect(result).toBeUndefined();
  });

  suite('actual requests', () => {
    test('sets Access-Control-Allow-Origin for wildcard', async () => {
      const config: CorsConfig = { origin: '*' };

      const result = await buildCorsHeaders({
        config,
        ...defaultOptions,
        isPreflight: false,
      });

      expect(result).toEqual({
        'Access-Control-Allow-Origin': '*',
      });
    });

    test('sets Vary: Origin for non-wildcard origin', async () => {
      const config: CorsConfig = { origin: ['https://example.com'] };

      const result = await buildCorsHeaders({
        config,
        ...defaultOptions,
        isPreflight: false,
      });

      expect(result).toEqual({
        'Access-Control-Allow-Origin': 'https://example.com',
        Vary: 'Origin',
      });
    });

    test('sets Access-Control-Allow-Credentials when credentials is true', async () => {
      const config: CorsConfig = { origin: '*', credentials: true };

      const result = await buildCorsHeaders({
        config,
        ...defaultOptions,
        isPreflight: false,
      });

      expect(result).toEqual(
        expect.objectContaining({
          'Access-Control-Allow-Credentials': 'true',
        }),
      );
    });

    test('sets Access-Control-Expose-Headers when configured', async () => {
      const config: CorsConfig = { origin: '*', exposedHeaders: ['X-Request-Id', 'X-Total-Count'] };

      const result = await buildCorsHeaders({
        config,
        ...defaultOptions,
        isPreflight: false,
      });

      expect(result).toEqual(
        expect.objectContaining({
          'Access-Control-Expose-Headers': 'X-Request-Id, X-Total-Count',
        }),
      );
    });

    test('does not set Access-Control-Expose-Headers for empty exposedHeaders array', async () => {
      const config: CorsConfig = { origin: '*', exposedHeaders: [] };

      const result = await buildCorsHeaders({
        config,
        ...defaultOptions,
        isPreflight: false,
      });

      expect(result).not.toHaveProperty('Access-Control-Expose-Headers');
    });

    test('does not set preflight-only headers on actual requests', async () => {
      const config: CorsConfig = { origin: '*', maxAge: 3600 };

      const result = await buildCorsHeaders({
        config,
        ...defaultOptions,
        isPreflight: false,
      });

      expect(result).not.toHaveProperty('Access-Control-Allow-Methods');
      expect(result).not.toHaveProperty('Access-Control-Allow-Headers');
      expect(result).not.toHaveProperty('Access-Control-Max-Age');
    });
  });

  suite('preflight requests', () => {
    test('sets Access-Control-Allow-Methods from registered methods plus OPTIONS', async () => {
      const config: CorsConfig = { origin: '*' };

      const result = await buildCorsHeaders({
        config,
        ...defaultOptions,
        isPreflight: true,
      });

      expect(result).toEqual(
        expect.objectContaining({
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        }),
      );
    });

    test('uses configured methods instead of auto-detected ones', async () => {
      const config: CorsConfig = { origin: '*', methods: ['GET', 'POST', 'PUT'] };

      const result = await buildCorsHeaders({
        config,
        ...defaultOptions,
        isPreflight: true,
      });

      expect(result).toEqual(
        expect.objectContaining({
          'Access-Control-Allow-Methods': 'GET, POST, PUT',
        }),
      );
    });

    test('reflects Access-Control-Request-Headers from request', async () => {
      const config: CorsConfig = { origin: '*' };

      const result = await buildCorsHeaders({
        config,
        ...defaultOptions,
        isPreflight: true,
        requestHeaders: { 'access-control-request-headers': 'Content-Type, Authorization' },
      });

      expect(result).toEqual(
        expect.objectContaining({
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }),
      );
    });

    test('uses configured allowedHeaders over reflected headers', async () => {
      const config: CorsConfig = { origin: '*', allowedHeaders: ['Content-Type'] };

      const result = await buildCorsHeaders({
        config,
        ...defaultOptions,
        isPreflight: true,
        requestHeaders: { 'access-control-request-headers': 'Content-Type, Authorization' },
      });

      expect(result).toEqual(
        expect.objectContaining({
          'Access-Control-Allow-Headers': 'Content-Type',
        }),
      );
    });

    test('sets Access-Control-Max-Age when configured', async () => {
      const config: CorsConfig = { origin: '*', maxAge: 86400 };

      const result = await buildCorsHeaders({
        config,
        ...defaultOptions,
        isPreflight: true,
      });

      expect(result).toEqual(
        expect.objectContaining({
          'Access-Control-Max-Age': '86400',
        }),
      );
    });

    test('does not set Access-Control-Allow-Headers when no allowedHeaders config and no request headers', async () => {
      const config: CorsConfig = { origin: '*' };

      const result = await buildCorsHeaders({
        config,
        ...defaultOptions,
        isPreflight: true,
        requestHeaders: {},
      });

      expect(result).not.toHaveProperty('Access-Control-Allow-Headers');
    });

    test('does not set Access-Control-Expose-Headers on preflight', async () => {
      const config: CorsConfig = { origin: '*', exposedHeaders: ['X-Request-Id'] };

      const result = await buildCorsHeaders({
        config,
        ...defaultOptions,
        isPreflight: true,
      });

      expect(result).not.toHaveProperty('Access-Control-Expose-Headers');
    });
  });
});
