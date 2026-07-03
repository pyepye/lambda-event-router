import type { StandardSchemaV1 } from '@standard-schema/spec';

// Content types whose bodies are text. Everything else is treated as bytes, because only the sender
// knows what its own media type holds.
const TEXTUAL_TYPES: ReadonlySet<string> = new Set([
  'application/javascript',
  'application/ecmascript',
  'application/x-www-form-urlencoded',
  'application/graphql',
]);

function isTextualContentType(contentType: string): boolean {
  const parameters = contentType.indexOf(';');
  const mediaType = (parameters === -1 ? contentType : contentType.slice(0, parameters)).trim().toLowerCase();

  if (mediaType.startsWith('text/')) return true;
  if (mediaType.includes('json') || mediaType.includes('xml') || mediaType.includes('yaml')) return true;

  return TEXTUAL_TYPES.has(mediaType);
}

// Bytes that survive a utf-8 round trip are text. Anything else holds a byte utf-8 cannot carry,
// which a string would replace with U+FFFD and lose.
function isUtf8(bytes: Buffer): boolean {
  return Buffer.compare(Buffer.from(bytes.toString('utf-8'), 'utf-8'), bytes) === 0;
}

/**
 * Decodes a request body to the shape a handler can use. The content type decides the shape: a
 * textual one gives a string and anything else gives a `Buffer`, so a route's body type does not
 * change with the way a service chose to send it. The base64 flag only decides how the bytes are
 * read. A body with no content type is read as text unless base64 hid bytes utf-8 cannot carry.
 */
export function decodeBody(body: string, isBase64Encoded: boolean, contentType: string | undefined): string | Buffer {
  if (!isBase64Encoded) {
    if (contentType === undefined || isTextualContentType(contentType)) return body;
    return Buffer.from(body, 'utf-8');
  }

  const bytes = Buffer.from(body, 'base64');

  if (contentType === undefined) return isUtf8(bytes) ? bytes.toString('utf-8') : bytes;

  return isTextualContentType(contentType) ? bytes.toString('utf-8') : bytes;
}

function describeBody(value: unknown): string {
  if (value === null) return 'no body';
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'object') return 'an object';
  return `a ${typeof value}`;
}

/**
 * A `bodySchema` for a route that takes bytes. It types `request.body` as a `Buffer` and answers
 * 422 when the caller sends a content type the router read as text.
 */
export const BinaryBody: StandardSchemaV1<unknown, Buffer> = {
  '~standard': {
    version: 1,
    vendor: 'lambda-event-router',
    validate: (value: unknown) =>
      Buffer.isBuffer(value)
        ? { value }
        : { issues: [{ message: `Expected a binary body, got ${describeBody(value)}` }] },
  },
};
