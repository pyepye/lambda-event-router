import { request as httpRequest } from 'node:http';

import { Sha256 } from '@aws-crypto/sha256-js';
import { HttpRequest } from '@smithy/protocol-http';
import { SignatureV4 } from '@smithy/signature-v4';

import { SIGNING_SERVICE, V1_LISTENER_PORT } from '../utils/constants.js';
import { config } from './config.js';

const SOCKET_TIMEOUT_MS = 10_000;

// VPC Lattice answers 403 "Signed payloads are not supported" for a real payload hash. The signer
// uses this header's value as the hash when it is already set, so the canonical request carries
// the literal instead.
const UNSIGNED_PAYLOAD_HEADER = { 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD' };

const signer = new SignatureV4({
  service: SIGNING_SERVICE,
  region: config.region,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    sessionToken: config.sessionToken,
  },
  sha256: Sha256,
});

export interface RequestInput {
  method: string;
  path: string;
  port: number;
  query?: Record<string, string | string[]>;
  headers?: Record<string, string | string[]>;
  body?: string;
  // An unsigned request reaches the worker with no caller identity on it.
  anonymous?: boolean;
}

export interface RequestResult {
  status: number;
  body: string;
  headers: Record<string, string | undefined>;
}

function queryString(query: Record<string, string | string[]> | undefined): string {
  if (!query) return '';
  const pairs: string[] = [];
  for (const [name, value] of Object.entries(query)) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      pairs.push(`${encodeURIComponent(name)}=${encodeURIComponent(entry)}`);
    }
  }
  return pairs.length > 0 ? `?${pairs.join('&')}` : '';
}

// A repeated header cannot go in the signature: SigV4 holds one string per name, and combining
// the values by hand has to match what the service reconstructs. Repeats are sent unsigned
// instead, which SigV4 allows because the signature only covers the names it lists.
function splitHeaders(headers: Record<string, string | string[]> | undefined): {
  signed: Record<string, string>;
  repeated: Record<string, string[]>;
} {
  const signed: Record<string, string> = {};
  const repeated: Record<string, string[]> = {};

  for (const [name, value] of Object.entries(headers ?? {})) {
    if (Array.isArray(value)) {
      repeated[name] = value;
    } else {
      signed[name] = value;
    }
  }

  return { signed, repeated };
}

async function outboundHeaders(
  input: RequestInput,
  host: string,
  signed: Record<string, string>,
): Promise<Record<string, string>> {
  if (input.anonymous) return { ...signed, host };

  const request = new HttpRequest({
    method: input.method,
    protocol: 'http:',
    hostname: config.latticeDomain,
    port: input.port,
    path: input.path,
    query: input.query,
    headers: { ...signed, ...UNSIGNED_PAYLOAD_HEADER, host },
    body: input.body,
  });

  const { headers } = await signer.sign(request);
  return headers;
}

export async function latticeRequest(input: RequestInput): Promise<RequestResult> {
  const { method, path, port, query, body } = input;
  const host = port === V1_LISTENER_PORT ? config.latticeDomain : `${config.latticeDomain}:${port}`;
  const { signed, repeated } = splitHeaders(input.headers);

  const requestHeaders = await outboundHeaders(input, host, signed);
  const contentLength = body === undefined ? {} : { 'content-length': String(Buffer.byteLength(body)) };

  return new Promise((resolve, reject) => {
    const outbound = httpRequest(
      {
        host: config.latticeDomain,
        port,
        path: `${path}${queryString(query)}`,
        method,
        headers: { ...requestHeaders, ...repeated, ...contentLength },
        timeout: SOCKET_TIMEOUT_MS,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const received = Object.entries(response.headers).map(
            ([name, value]) => [name, Array.isArray(value) ? value.join(', ') : value] as const,
          );
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString(),
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
