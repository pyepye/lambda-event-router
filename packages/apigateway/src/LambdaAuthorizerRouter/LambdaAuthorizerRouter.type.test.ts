import type { APIGatewayRequestAuthorizerEventV2 } from 'aws-lambda';

import { createApiGatewayLambdaAuthorizerRequestHttpApiV1Event } from '@lambda-event-router/testing';

import type { HttpApiRequestAuthorizerEventV1, LambdaAuthorizerEvent } from './types.js';

suite('LambdaAuthorizerEvent', () => {
  test('covers the event an HTTP API sends on payload format 1.0', () => {
    expectTypeOf<HttpApiRequestAuthorizerEventV1>().toExtend<LambdaAuthorizerEvent>();
  });

  test('the testing builder produces that shape', () => {
    expectTypeOf(createApiGatewayLambdaAuthorizerRequestHttpApiV1Event()).toExtend<HttpApiRequestAuthorizerEventV1>();
  });

  test('methodArn with version narrows to the payload 1.0 shape', () => {
    const resourceArnOf = (event: LambdaAuthorizerEvent): string => {
      if ('methodArn' in event && 'version' in event) return event.methodArn;
      return 'other shape';
    };

    expect(resourceArnOf(createApiGatewayLambdaAuthorizerRequestHttpApiV1Event())).toContain('execute-api');
  });

  // aws-lambda types APIGatewayRequestAuthorizerEventV2.version as string, so a version check alone
  // leaves both payload formats in the union. The ARN field is what separates them.
  test('version alone leaves both payload formats in the union', () => {
    type ByVersion = Extract<LambdaAuthorizerEvent, { version: string }>;

    expectTypeOf<ByVersion>().toExtend<HttpApiRequestAuthorizerEventV1 | APIGatewayRequestAuthorizerEventV2>();
  });

  test('the payload 1.0 shape carries the fields AWS sends and no others', () => {
    expectTypeOf<keyof HttpApiRequestAuthorizerEventV1>().toEqualTypeOf<
      | 'version'
      | 'type'
      | 'methodArn'
      | 'identitySource'
      | 'authorizationToken'
      | 'resource'
      | 'path'
      | 'httpMethod'
      | 'headers'
      | 'queryStringParameters'
      | 'pathParameters'
      | 'stageVariables'
      | 'requestContext'
    >();
  });
});
