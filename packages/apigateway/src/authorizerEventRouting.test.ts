import type { Context } from 'aws-lambda';

import type { Mock } from 'vitest';

import { createLambdaRouter } from '@lambda-event-router/base';
import { Ok } from '@lambda-event-router/http';
import {
  createApiGatewayLambdaAuthorizerRequestV1Event,
  createApiGatewayLambdaAuthorizerRequestV2Event,
  createApiGatewayV1Event,
  createApiGatewayV2Event,
  createMockContext,
} from '@lambda-event-router/testing';

import { type APIGatewayRouter, createAPIGatewayRouter } from './APIGatewayRouter/index.js';
import { Allow, createLambdaAuthorizerRouter, type LambdaAuthorizerRouter } from './LambdaAuthorizerRouter/index.js';

const context: Context = createMockContext();

suite('API Gateway authorizer and proxy events', () => {
  let apiRouter: APIGatewayRouter;
  let authorizerRouter: LambdaAuthorizerRouter;
  let httpHandler: Mock;
  let authorizerHandler: Mock;

  beforeEach(() => {
    httpHandler = vi.fn(async () => Ok({ ok: true }));
    authorizerHandler = vi.fn(async () => Allow('user-1', 'arn:aws:execute-api:*'));

    apiRouter = createAPIGatewayRouter();
    apiRouter.get({ filters: { path: '/' }, handler: httpHandler });

    authorizerRouter = createLambdaAuthorizerRouter();
    authorizerRouter.request({ handler: authorizerHandler });
  });

  test('sends a V1 REQUEST authorizer event to the authorizer router, with APIGatewayRouter first', async () => {
    const handler = createLambdaRouter({ routers: [apiRouter, authorizerRouter] }).handler();

    const result = await handler(createApiGatewayLambdaAuthorizerRequestV1Event(), context, vi.fn());

    expect(authorizerHandler).toHaveBeenCalledOnce();
    expect(httpHandler).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ principalId: 'user-1' }));
  });

  test('sends a V2 REQUEST authorizer event to the authorizer router, with APIGatewayRouter first', async () => {
    const handler = createLambdaRouter({ routers: [apiRouter, authorizerRouter] }).handler();

    const result = await handler(createApiGatewayLambdaAuthorizerRequestV2Event(), context, vi.fn());

    expect(authorizerHandler).toHaveBeenCalledOnce();
    expect(httpHandler).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ principalId: 'user-1' }));
  });

  test('sends a V1 proxy event to the HTTP router, with the authorizer router first', async () => {
    const handler = createLambdaRouter({ routers: [authorizerRouter, apiRouter] }).handler();

    const result = await handler(createApiGatewayV1Event({ path: '/', httpMethod: 'GET' }), context, vi.fn());

    expect(httpHandler).toHaveBeenCalledOnce();
    expect(authorizerHandler).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
  });

  test('sends a V2 proxy event to the HTTP router, with the authorizer router first', async () => {
    const handler = createLambdaRouter({ routers: [authorizerRouter, apiRouter] }).handler();
    const event = createApiGatewayV2Event({ rawPath: '/', requestContext: { http: { method: 'GET' } } });

    const result = await handler(event, context, vi.fn());

    expect(httpHandler).toHaveBeenCalledOnce();
    expect(authorizerHandler).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
  });
});
