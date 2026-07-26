import * as builders from './index.js';

export type EventBuilderEntry = [name: string, build: () => unknown];

// Every builder that makes something Lambda could be handed, for tests asserting which router claims
// what. Handler-event builders are left out: they return an event with a context beside it.
export function allEventBuilders(): EventBuilderEntry[] {
  return Object.entries(builders)
    .filter(
      ([name, value]) =>
        typeof value === 'function' &&
        name.startsWith('create') &&
        name.endsWith('Event') &&
        !name.endsWith('HandlerEvent'),
    )
    .map(([name, value]): EventBuilderEntry => [name, value as () => unknown])
    .sort(([left], [right]) => left.localeCompare(right));
}
