import type { HttpMethod } from './types.js';

export type CorsOriginFunction = (origin: string, path: string) => string | undefined | Promise<string | undefined>;

export interface CorsConfig {
  origin: string | string[] | CorsOriginFunction;
  methods?: HttpMethod[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

interface BuildCorsHeadersOptions {
  config: CorsConfig;
  requestOrigin: string | undefined;
  path: string;
  isPreflight: boolean;
  requestHeaders: Record<string, string | undefined>;
  methods: HttpMethod[];
}

export async function resolveOrigin(
  config: CorsConfig,
  requestOrigin: string | undefined,
  path: string,
): Promise<string | undefined> {
  const { origin } = config;

  if (typeof origin === 'string') {
    return origin;
  }

  if (Array.isArray(origin)) {
    if (requestOrigin && origin.includes(requestOrigin)) {
      return requestOrigin;
    }
    return undefined;
  }

  if (!requestOrigin) {
    return undefined;
  }

  return await origin(requestOrigin, path);
}

export async function buildCorsHeaders(options: BuildCorsHeadersOptions): Promise<Record<string, string> | undefined> {
  const { config, requestOrigin, path, isPreflight, requestHeaders, methods } = options;

  const allowedOrigin = await resolveOrigin(config, requestOrigin, path);
  if (allowedOrigin === undefined) {
    return undefined;
  }

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allowedOrigin,
  };

  if (allowedOrigin !== '*') {
    headers.Vary = 'Origin';
  }

  if (config.credentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  if (isPreflight) {
    const allowMethods = config.methods ?? [...new Set<HttpMethod>([...methods, 'OPTIONS'])];
    headers['Access-Control-Allow-Methods'] = allowMethods.join(', ');

    const allowHeaders = config.allowedHeaders ?? requestHeaders['access-control-request-headers'];
    if (allowHeaders) {
      const headerValue = Array.isArray(allowHeaders) ? allowHeaders.join(', ') : allowHeaders;
      headers['Access-Control-Allow-Headers'] = headerValue;
    }

    if (config.maxAge !== undefined) {
      headers['Access-Control-Max-Age'] = String(config.maxAge);
    }
  } else if (config.exposedHeaders && config.exposedHeaders.length > 0) {
    headers['Access-Control-Expose-Headers'] = config.exposedHeaders.join(', ');
  }

  return headers;
}
