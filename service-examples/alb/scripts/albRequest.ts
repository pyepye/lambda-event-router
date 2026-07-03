import { request as httpRequest } from 'node:http';

import type { RequestInput } from '../src/requests/steps.js';

const SOCKET_TIMEOUT_MS = 15_000;
const DEFAULT_HTTP_PORT = 80;

// node:http leaves the default port out of the Host header, and the load balancer resolves a
// relative `Location` against that header.
export function listenerOrigin(host: string, port: number): string {
  return port === DEFAULT_HTTP_PORT ? `http://${host}` : `http://${host}:${port}`;
}

export interface RequestResult {
  status: number;
  body: string;
  bytes: Buffer;
  headers: Record<string, string | undefined>;
}

export function queryString(query: Record<string, string | string[]> | undefined): string {
  if (!query) return '';
  const pairs: string[] = [];
  for (const [name, value] of Object.entries(query)) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      pairs.push(`${encodeURIComponent(name)}=${encodeURIComponent(entry)}`);
    }
  }
  return pairs.length > 0 ? `?${pairs.join('&')}` : '';
}

// `fetch` folds a repeated header name into one comma joined value, so it cannot send the same
// header twice. node:http writes one line per array entry, which is what a multi-value target
// group needs to see.
export function albRequest(host: string, port: number, input: RequestInput): Promise<RequestResult> {
  const { method, path, headers, body } = input;
  const contentLength = body === undefined ? {} : { 'content-length': String(Buffer.byteLength(body)) };

  return new Promise((resolve, reject) => {
    const outbound = httpRequest(
      {
        host,
        port,
        path: `${path}${queryString(input.query)}`,
        method,
        headers: { ...headers, ...contentLength },
        timeout: SOCKET_TIMEOUT_MS,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const received = Object.entries(response.headers).map(
            ([name, value]) => [name, Array.isArray(value) ? value.join(', ') : value] as const,
          );
          const bytes = Buffer.concat(chunks);
          resolve({
            status: response.statusCode ?? 0,
            body: bytes.toString(),
            bytes,
            headers: Object.fromEntries(received),
          });
        });
      },
    );

    outbound.on('timeout', () => outbound.destroy(new Error(`${method} ${path} timed out`)));
    outbound.on('error', reject);
    if (body !== undefined) outbound.write(body);
    outbound.end();
  });
}
