import { createMockSchema } from '@lambda-event-router/testing';

import { defineRoute } from './HTTPRouter.js';
import { NoContent } from './Response.js';
import type { ApiRequest, HandlerResponse } from './types.js';

interface Item {
  name: string;
}

type ItemsRequest<TBody> = ApiRequest<Record<never, never>, Record<string, string | undefined>, TBody>;

function handlesUndefinedBody(_request: ItemsRequest<undefined>): Promise<HandlerResponse> {
  return Promise.resolve(NoContent());
}

function handlesStringBody(_request: ItemsRequest<string>): Promise<HandlerResponse> {
  return Promise.resolve(NoContent());
}

function handlesUnknownBody(_request: ItemsRequest<unknown>): Promise<HandlerResponse> {
  return Promise.resolve(NoContent());
}

function handlesItemBody(_request: ItemsRequest<Item>): Promise<HandlerResponse> {
  return Promise.resolve(NoContent());
}

suite('defineRoute body types', () => {
  const bodySchema = createMockSchema<Item>();

  test('a method without a body and no bodySchema types body as undefined', () => {
    defineRoute({ filters: { method: 'GET', path: '/items' } }).handle(handlesUndefinedBody);

    // @ts-expect-error - a GET route without a bodySchema has no body
    defineRoute({ filters: { method: 'GET', path: '/items' } }).handle(handlesStringBody);
  });

  test('a method with a body and no bodySchema types body as unknown', () => {
    defineRoute({ filters: { method: 'POST', path: '/items' } }).handle(handlesUnknownBody);

    // @ts-expect-error - a POST route hands the handler whatever body arrives
    defineRoute({ filters: { method: 'POST', path: '/items' } }).handle(handlesUndefinedBody);
  });

  test('a bodySchema types body as the schema output on any method', () => {
    defineRoute({ filters: { method: 'GET', path: '/items' }, bodySchema }).handle(handlesItemBody);
    defineRoute({ filters: { method: 'POST', path: '/items' }, bodySchema }).handle(handlesItemBody);

    // @ts-expect-error - the bodySchema output reaches the handler
    defineRoute({ filters: { method: 'GET', path: '/items' }, bodySchema }).handle(handlesUndefinedBody);
  });
});

suite('defineRoute path filter', () => {
  test('accepts a path whose params all have a name', () => {
    defineRoute({ filters: { method: 'GET', path: '/files/:name.json' } }).handle(handlesUndefinedBody);
  });

  test('rejects a param name that starts with a digit', () => {
    // @ts-expect-error - '1abc' is not a param name
    defineRoute({ filters: { method: 'GET', path: '/items/:1abc' } });
  });
});
