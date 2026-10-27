import {
  createApiGatewayLambdaAuthorizerRequestHttpApiV1Event,
  createApiGatewayLambdaAuthorizerRequestV1Event,
  createApiGatewayLambdaAuthorizerRequestV2Event,
  createApiGatewayLambdaAuthorizerTokenEvent,
  createMockContext,
} from '@latcher/testing';

import { createLambdaAuthorizerMatcher } from './LambdaAuthorizerMatcher.js';
import { Allow, Authorized } from './response.js';

// An HTTP API delivers every number that is not a whole number as 0, at any depth, so the matcher
// refuses to send one
suite('LambdaAuthorizerMatcher context numbers', () => {
  const context = createMockContext();

  test('throws on a fraction in a simple response context on an HTTP API', async () => {
    const matcher = createLambdaAuthorizerMatcher().request({ handler: async () => Authorized({ ratio: 1.5 }) });

    await expect(matcher.handleEvent(createApiGatewayLambdaAuthorizerRequestV2Event(), context)).rejects.toThrow(
      'An HTTP API delivers every number that is not a whole number as 0. The authorizer context holds 1.5 at ratio, so send it as a string',
    );
  });

  test('throws on a fraction nested in an object or an array', async () => {
    const nested = createLambdaAuthorizerMatcher().request({
      handler: async () => Authorized({ limits: { ratio: 0.5 } }),
    });
    const listed = createLambdaAuthorizerMatcher().request({ handler: async () => Authorized({ rates: [1, 2.5] }) });
    const event = createApiGatewayLambdaAuthorizerRequestV2Event();

    await expect(nested.handleEvent(event, context)).rejects.toThrow('holds 0.5 at limits.ratio');
    await expect(listed.handleEvent(event, context)).rejects.toThrow('holds 2.5 at rates.1');
  });

  test('throws on a fraction in a policy context on an HTTP API with authorizer payload 1.0', async () => {
    const event = createApiGatewayLambdaAuthorizerRequestHttpApiV1Event();
    const matcher = createLambdaAuthorizerMatcher().request({
      handler: async () => Allow('user-1', event.methodArn, { ratio: -0.5 }),
    });

    await expect(matcher.handleEvent(event, context)).rejects.toThrow('holds -0.5 at ratio');
  });

  test('throws on a fraction in a policy the handler throws', async () => {
    const event = createApiGatewayLambdaAuthorizerRequestHttpApiV1Event();
    const matcher = createLambdaAuthorizerMatcher().request({
      handler: async () => {
        throw Allow('user-1', event.methodArn, { ratio: 1.5 });
      },
    });

    await expect(matcher.handleEvent(event, context)).rejects.toThrow('holds 1.5 at ratio');
  });

  test('passes whole numbers, strings and booleans on an HTTP API', async () => {
    const matcher = createLambdaAuthorizerMatcher().request({
      handler: async () => Authorized({ seats: 3, big: 9007199254740991, ratio: '1.5', admin: true }),
    });

    const result = await matcher.handleEvent(createApiGatewayLambdaAuthorizerRequestV2Event(), context);

    expect(result).toEqual({
      isAuthorized: true,
      context: { seats: 3, big: 9007199254740991, ratio: '1.5', admin: true },
    });
  });

  test('passes a fraction on a REST API, which delivers it as a string', async () => {
    const requestEvent = createApiGatewayLambdaAuthorizerRequestV1Event();
    const tokenEvent = createApiGatewayLambdaAuthorizerTokenEvent();
    const matcher = createLambdaAuthorizerMatcher()
      .request({ handler: async () => Allow('user-1', requestEvent.methodArn, { ratio: 1.5 }) })
      .token({ handler: async () => Allow('user-1', tokenEvent.methodArn, { ratio: 1.5 }) });

    await expect(matcher.handleEvent(requestEvent, context)).resolves.toMatchObject({ context: { ratio: 1.5 } });
    await expect(matcher.handleEvent(tokenEvent, context)).resolves.toMatchObject({ context: { ratio: 1.5 } });
  });
});
