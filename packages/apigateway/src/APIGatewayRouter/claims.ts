export type ClaimValue = string | number | boolean | null | Date | ClaimValue[] | { [key: string]: ClaimValue };

export interface StandardClaims {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  scope?: string;
  exp?: Date;
  iat?: Date;
  nbf?: Date;
  auth_time?: Date;
  updated_at?: Date;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
  phone_number_verified?: boolean;
  amr?: string[];
  address?: Record<string, string>;
  'cognito:groups'?: string[];
  'cognito:roles'?: string[];
  'cognito:username'?: string;
  'cognito:preferred_role'?: string;
}

export type Claims = StandardClaims & Record<string, ClaimValue | undefined>;

// API Gateway writes every claim value with Go's default print format, so null arrives as '<nil>'
const GO_NIL = '<nil>';
const GO_MAP_PREFIX = 'map[';
const MILLISECONDS_PER_SECOND = 1000;

const TIME_CLAIMS: ReadonlySet<string> = new Set(['exp', 'iat', 'nbf', 'auth_time', 'updated_at']);
const BOOLEAN_CLAIMS: ReadonlySet<string> = new Set(['email_verified', 'phone_number_verified']);
const LIST_CLAIMS: ReadonlySet<string> = new Set(['cognito:groups', 'cognito:roles', 'amr']);
const STRING_CLAIMS: ReadonlySet<string> = new Set([
  'sub',
  'iss',
  'scope',
  'email',
  'phone_number',
  'cognito:username',
  'cognito:preferred_role',
]);
// The OpenID Connect address fields, which let a value with spaces be read back
const ADDRESS_FIELDS: ReadonlySet<string> = new Set([
  'formatted',
  'street_address',
  'locality',
  'region',
  'postal_code',
  'country',
]);

// All digits, which is epoch seconds
const EPOCH_SECONDS = /^\d+$/;
// A REST Cognito date such as 'Mon Sep 28 22:44:53 UTC 2026': weekday, month, day, time, zone, year
const REST_DATE = /^[A-Z][a-z]{2} ([A-Z][a-z]{2}) (\d{1,2}) (\d{2}):(\d{2}):(\d{2}) UTC (\d{4})$/;
const MONTH_INDEXES: ReadonlyMap<string, number> = new Map(
  ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, index) => [
    month,
    index,
  ]),
);
// A map entry key, which runs up to the first ':' and holds no space or bracket
const GO_MAP_KEY = /^[^\s:[\]]+$/;

function parseClaimDate(value: string): Date | undefined {
  if (EPOCH_SECONDS.test(value)) {
    return new Date(Number(value) * MILLISECONDS_PER_SECOND);
  }

  const match = REST_DATE.exec(value);
  if (!match) return undefined;

  const [, monthName = '', day, hour, minute, second, year] = match;
  const monthIndex = MONTH_INDEXES.get(monthName);
  if (monthIndex === undefined) return undefined;

  return new Date(Date.UTC(Number(year), monthIndex, Number(day), Number(hour), Number(minute), Number(second)));
}

// Splits on the spaces that sit outside any brackets, so a nested value stays whole
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const character of text) {
    if (character === '[') depth += 1;
    if (character === ']') depth -= 1;

    if (character === ' ' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  parts.push(current);

  return parts;
}

function isGoArray(value: string): boolean {
  return value.startsWith('[') && value.endsWith(']');
}

function isGoMap(value: string): boolean {
  return value.startsWith(GO_MAP_PREFIX) && value.endsWith(']');
}

// A token without a key belongs to the value before it, which is how a value with spaces is read back
function parseGoMap(inner: string, isKey: (key: string) => boolean): Record<string, ClaimValue> | undefined {
  if (inner === '') return {};

  const entries: [string, string][] = [];
  for (const token of splitTopLevel(inner)) {
    const separatorIndex = token.indexOf(':');
    const key = token.slice(0, separatorIndex);
    const startsEntry = separatorIndex > 0 && isKey(key);

    if (startsEntry) {
      entries.push([key, token.slice(separatorIndex + 1)]);
      continue;
    }

    const lastEntry = entries.at(-1);
    if (!lastEntry) return undefined;
    lastEntry[1] = `${lastEntry[1]} ${token}`;
  }

  return Object.fromEntries(entries.map(([key, value]) => [key, parseGoValue(value)]));
}

function parseGoArray(inner: string): ClaimValue[] {
  if (inner === '') return [];
  return splitTopLevel(inner).map(parseGoValue);
}

function parseGoValue(value: string): ClaimValue {
  if (value === GO_NIL) return null;
  if (isGoMap(value)) {
    return parseGoMap(value.slice(GO_MAP_PREFIX.length, -1), (key) => GO_MAP_KEY.test(key)) ?? value;
  }
  if (isGoArray(value)) return parseGoArray(value.slice(1, -1));
  return value;
}

function parseClaimBoolean(value: string): boolean | string {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

function parseStringList(value: string): string[] {
  if (isGoArray(value)) return value.slice(1, -1).split(' ').filter(Boolean);
  return value.split(',');
}

function parseStandardClaim(name: string, value: string): ClaimValue {
  if (TIME_CLAIMS.has(name)) return parseClaimDate(value) ?? value;
  if (BOOLEAN_CLAIMS.has(name)) return parseClaimBoolean(value);
  if (LIST_CLAIMS.has(name)) return parseStringList(value);
  if (name === 'aud') return isGoArray(value) ? parseStringList(value) : value;
  if (name === 'address' && isGoMap(value)) {
    return parseGoMap(value.slice(GO_MAP_PREFIX.length, -1), (key) => ADDRESS_FIELDS.has(key)) ?? value;
  }
  if (STRING_CLAIMS.has(name)) return value;
  return parseGoValue(value);
}

function parseClaim(name: string, value: unknown): ClaimValue | undefined {
  if (typeof value === 'string') return parseStandardClaim(name, value);
  if (typeof value === 'number' && TIME_CLAIMS.has(name)) return new Date(value * MILLISECONDS_PER_SECOND);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return undefined;
}

export function parseClaims(rawClaims: Record<string, unknown>): Claims {
  const claims: Claims = {};
  for (const [name, value] of Object.entries(rawClaims)) {
    const claim = parseClaim(name, value);
    if (claim !== undefined) claims[name] = claim;
  }
  return claims;
}
