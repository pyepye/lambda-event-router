import { filterStringMatcher, isObject } from './data.js';

// A Date or a Map has no own entries, so isObject alone would read it as a record constraining nothing
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) return false;

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function countWildcards(matcher: string): number {
  return matcher.split('*').length - 1;
}

function stringSubsumes(broad: string, narrow: string): boolean {
  if (broad === narrow) return true;

  if (!narrow.includes('*')) return filterStringMatcher(narrow, broad);

  // Everything a single-wildcard pattern matches carries its literal, so a shorter literal at the same end covers it
  if (countWildcards(broad) !== 1 || countWildcards(narrow) !== 1) return false;

  if (broad.endsWith('*') && narrow.endsWith('*')) return narrow.slice(0, -1).startsWith(broad.slice(0, -1));
  if (broad.startsWith('*') && narrow.startsWith('*')) return narrow.slice(1).endsWith(broad.slice(1));

  return false;
}

function valueSubsumes(broad: unknown, narrow: unknown): boolean {
  // A custom is opaque, so it is only provable against itself
  if (typeof broad === 'function') return broad === narrow;

  // '*' matches every string, so it covers any other matcher including a RegExp
  if (broad === '*' && (typeof narrow === 'string' || narrow instanceof RegExp)) return true;

  if (broad instanceof RegExp || narrow instanceof RegExp) {
    return (
      broad instanceof RegExp &&
      narrow instanceof RegExp &&
      broad.source === narrow.source &&
      broad.flags === narrow.flags
    );
  }

  if (Array.isArray(broad) || Array.isArray(narrow)) {
    const broadMembers = Array.isArray(broad) ? broad : [broad];
    const narrowMembers = Array.isArray(narrow) ? narrow : [narrow];

    return narrowMembers.every((member) => broadMembers.some((candidate) => valueSubsumes(candidate, member)));
  }

  if (isPlainObject(broad)) {
    if (!isPlainObject(narrow)) return false;

    return Object.entries(broad).every(
      ([key, value]) => Object.hasOwn(narrow, key) && valueSubsumes(value, narrow[key]),
    );
  }

  if (typeof broad === 'string') {
    return typeof narrow === 'string' && stringSubsumes(broad, narrow);
  }

  if (typeof broad === 'number' || typeof broad === 'boolean') {
    return broad === narrow;
  }

  return false;
}

// True when every event matching narrow also matches broad, so narrow has to be tried first. Answers
// false for anything the filters do not prove
export function filtersSubsume(broad: object, narrow: object): boolean {
  return Object.entries(broad).every(([key, value]) => {
    if (value === undefined) return true;
    if (!Object.hasOwn(narrow, key)) return false;

    return valueSubsumes(value, (narrow as Record<string, unknown>)[key]);
  });
}

// Callers reuse the result, so a changed route list has to order again
export function orderRoutesBySpecificity<TRoute extends { filters: object }>(routes: TRoute[]): TRoute[] {
  const ordered: TRoute[] = [];

  for (const route of routes) {
    const firstBroader = ordered.findIndex(
      (placed) => filtersSubsume(placed.filters, route.filters) && !filtersSubsume(route.filters, placed.filters),
    );

    if (firstBroader === -1) {
      ordered.push(route);
    } else {
      ordered.splice(firstBroader, 0, route);
    }
  }

  return ordered;
}
