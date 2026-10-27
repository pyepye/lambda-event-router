import type { Context } from 'aws-lambda';

import type { Mock } from 'vitest';

import { createLatcher } from '@latcher/base';
import { Ok } from '@latcher/http';
import {
  createApiGatewayLambdaAuthorizerRequestV1Event,
  createApiGatewayLambdaAuthorizerRequestV2Event,
  createApiGatewayV1Event,
  createApiGatewayV2Event,
  createMockContext,
} from '@latcher/testing';

import { type APIGatewayMatcher, createAPIGatewayMatcher } from './APIGatewayMatcher/index.js';
import { Allow, createLambdaAuthorizerMatcher, type LambdaAuthorizerMatcher } from './LambdaAuthorizerMatcher/index.js';

const context: Context = createMockContext();

suite('API Gateway authorizer and proxy events', () => {
  let apiMatcher: APIGatewayMatcher;
  let authorizerMatcher: LambdaAuthorizerMatcher;
  let httpHandler: Mock;
  let authorizerHandler: Mock;

  beforeEach(() => {
    httpHandler = vi.fn(async () => Ok({ ok: true }));
    authorizerHandler = vi.fn(async () => Allow('user-1', 'arn:aws:execute-api:*'));

    apiMatcher = createAPIGatewayMatcher();
    apiMatcher.get({ filters: { path: '/' }, handler: httpHandler });

    authorizerMatcher = createLambdaAuthorizerMatcher();
    authorizerMatcher.request({ handler: authorizerHandler });
  });

  test('sends a V1 REQUEST authorizer event to the authorizer matcher, with APIGatewayMatcher first', async () => {
    const handler = createLatcher({ matchers: [apiMatcher, authorizerMatcher] }).handler();

    const result = await handler(createApiGatewayLambdaAuthorizerRequestV1Event(), context, vi.fn());

    expect(authorizerHandler).toHaveBeenCalledOnce();
    expect(httpHandler).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ principalId: 'user-1' }));
  });

  test('sends a V2 REQUEST authorizer event to the authorizer matcher, with APIGatewayMatcher first', async () => {
    const handler = createLatcher({ matchers: [apiMatcher, authorizerMatcher] }).handler();

    const result = await handler(createApiGatewayLambdaAuthorizerRequestV2Event(), context, vi.fn());

    expect(authorizerHandler).toHaveBeenCalledOnce();
    expect(httpHandler).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ principalId: 'user-1' }));
  });

  test('sends a V1 proxy event to the HTTP matcher, with the authorizer matcher first', async () => {
    const handler = createLatcher({ matchers: [authorizerMatcher, apiMatcher] }).handler();

    const result = await handler(createApiGatewayV1Event({ path: '/', httpMethod: 'GET' }), context, vi.fn());

    expect(httpHandler).toHaveBeenCalledOnce();
    expect(authorizerHandler).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
  });

  test('sends a V2 proxy event to the HTTP matcher, with the authorizer matcher first', async () => {
    const handler = createLatcher({ matchers: [authorizerMatcher, apiMatcher] }).handler();
    const event = createApiGatewayV2Event({ rawPath: '/', requestContext: { http: { method: 'GET' } } });

    const result = await handler(event, context, vi.fn());

    expect(httpHandler).toHaveBeenCalledOnce();
    expect(authorizerHandler).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
  });
});
