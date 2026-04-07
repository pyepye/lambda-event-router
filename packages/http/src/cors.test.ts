import { buildCorsHeaders, type CorsConfig, resolveOrigin } from './cors.js';
import type { HttpMethod } from './types.js';

suite('resolveOrigin', () => {
  test('returns wildcard string origin directly', () => {
    const config: CorsConfig = { origin: '*' };

    expect(resolveOrigin(config, 'https://example.com', '/')).toBe('*');
  });

  test('returns specific string origin directly', () => {
    const config: CorsConfig = { origin: 'https://example.com' };

    expect(resolveOrigin(config, 'https://other.com', '/')).toBe('https://example.com');
  });

  test('returns string origin even when requestOrigin is undefined', () => {
    const config: CorsConfig = { origin: 'https://example.com' };

    expect(resolveOrigin(config, undefined, '/')).toBe('https://example.com');
  });

  test('returns matching origin from array', () => {
    const config: CorsConfig = { origin: ['https://a.com', 'https://b.com'] };

    expect(resolveOrigin(config, 'https://b.com', '/')).toBe('https://b.com');
  });

  test('returns undefined for non-matching origin in array', () => {
    const config: CorsConfig = { origin: ['https://a.com', 'https://b.com'] };

    expect(resolveOrigin(config, 'https://c.com', '/')).toBeUndefined();
  });

  test('returns undefined for array origin when requestOrigin is undefined', () => {
    const config: CorsConfig = { origin: ['https://a.com'] };

    expect(resolveOrigin(config, undefined, '/')).toBeUndefined();
  });

  test('calls function origin with origin and path', () => {
    const originFn = vi.fn().mockReturnValue('https://allowed.com');
    const config: CorsConfig = { origin: originFn };

    const result = resolveOrigin(config, 'https://allowed.com', '/items');

    expect(result).toBe('https://allowed.com');
    expect(originFn).toHaveBeenCalledWith('https://allowed.com', '/items');
  });

  test('returns undefined from function origin', () => {
    const config: CorsConfig = { origin: () => undefined };

    expect(resolveOrigin(config, 'https://denied.com', '/')).toBeUndefined();
  });

  test('returns undefined for function origin when requestOrigin is undefined', () => {
    const originFn = vi.fn();
    const config: CorsConfig = { origin: originFn };

    expect(resolveOrigin(config, undefined, '/')).toBeUndefined();
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

  test('returns undefined when origin is not allowed', () => {
    const config: CorsConfig = { origin: ['https://other.com'] };

    const result = buildCorsHeaders({
      config,
      ...defaultOptions,
      isPreflight: false,
    });

    expect(result).toBeUndefined();
  });

  suite('actual requests', () => {
    test('sets Access-Control-Allow-Origin for wildcard', () => {
      const config: CorsConfig = { origin: '*' };

      const result = buildCorsHeaders({
        config,
        ...defaultOptions,
        isPreflight: false,
      });

      expect(result).toEqual({
        'Access-Control-Allow-Origin': '*',
      });
    });

    test('sets Vary: Origin for non-wildcard origin', () => {
      const config: CorsConfig = { origin: ['https://example.com'] };

      const result = buildCorsHeaders({
        config,
        ...defaultOptions,
        isPreflight: false,
      });

      expect(result).toEqual({
        'Access-Control-Allow-Origin': 'https://example.com',
        Vary: 'Origin',
      });
    });

    test('sets Access-Control-Allow-Credentials when credentials is true', () => {
      const config: CorsConfig = { origin: '*', credentials: true };

      const result = buildCorsHeaders({
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

    test('sets Access-Control-Expose-Headers when configured', () => {
      const config: CorsConfig = { origin: '*', exposedHeaders: ['X-Request-Id', 'X-Total-Count'] };

      const result = buildCorsHeaders({
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

    test('does not set Access-Control-Expose-Headers for empty exposedHeaders array', () => {
      const config: CorsConfig = { origin: '*', exposedHeaders: [] };

      const result = buildCorsHeaders({
        config,
        ...defaultOptions,
        isPreflight: false,
      });

      expect(result).not.toHaveProperty('Access-Control-Expose-Headers');
    });

    test('does not set preflight-only headers on actual requests', () => {
      const config: CorsConfig = { origin: '*', maxAge: 3600 };

      const result = buildCorsHeaders({
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
    test('sets Access-Control-Allow-Methods from registered methods plus OPTIONS', () => {
      const config: CorsConfig = { origin: '*' };

      const result = buildCorsHeaders({
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

    test('uses configured methods instead of auto-detected ones', () => {
      const config: CorsConfig = { origin: '*', methods: ['GET', 'POST', 'PUT'] };

      const result = buildCorsHeaders({
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

    test('reflects Access-Control-Request-Headers from request', () => {
      const config: CorsConfig = { origin: '*' };

      const result = buildCorsHeaders({
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

    test('uses configured allowedHeaders over reflected headers', () => {
      const config: CorsConfig = { origin: '*', allowedHeaders: ['Content-Type'] };

      const result = buildCorsHeaders({
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

    test('sets Access-Control-Max-Age when configured', () => {
      const config: CorsConfig = { origin: '*', maxAge: 86400 };

      const result = buildCorsHeaders({
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

    test('does not set Access-Control-Allow-Headers when no allowedHeaders config and no request headers', () => {
      const config: CorsConfig = { origin: '*' };

      const result = buildCorsHeaders({
        config,
        ...defaultOptions,
        isPreflight: true,
        requestHeaders: {},
      });

      expect(result).not.toHaveProperty('Access-Control-Allow-Headers');
    });

    test('does not set Access-Control-Expose-Headers on preflight', () => {
      const config: CorsConfig = { origin: '*', exposedHeaders: ['X-Request-Id'] };

      const result = buildCorsHeaders({
        config,
        ...defaultOptions,
        isPreflight: true,
      });

      expect(result).not.toHaveProperty('Access-Control-Expose-Headers');
    });
  });
});
