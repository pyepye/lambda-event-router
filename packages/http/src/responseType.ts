import type { ResponseKind, ResponseTypeOption } from './types.js';

export interface ResolvedResponseType {
  kind: ResponseKind;
  contentType: string;
}

export const DEFAULT_CONTENT_TYPES: Record<ResponseKind, string> = {
  json: 'application/json',
  html: 'text/html; charset=utf-8',
  text: 'text/plain; charset=utf-8',
  binary: 'application/octet-stream',
};

export const JSON_RESPONSE_TYPE: ResolvedResponseType = { kind: 'json', contentType: DEFAULT_CONTENT_TYPES.json };

export function resolveResponseType(
  option: ResponseTypeOption | undefined,
  fallback: ResolvedResponseType,
): ResolvedResponseType {
  if (option === undefined) return fallback;
  if (typeof option === 'string') return { kind: option, contentType: DEFAULT_CONTENT_TYPES[option] };
  return { kind: option.type, contentType: option.contentType };
}

// Matches the JsonContentType type: application/json or any +json type, with or without parameters
export function isJsonContentType(contentType: string): boolean {
  const parameters = contentType.indexOf(';');
  const mediaType = (parameters === -1 ? contentType : contentType.slice(0, parameters)).trim().toLowerCase();
  return mediaType === 'application/json' || (mediaType.includes('/') && mediaType.endsWith('+json'));
}
