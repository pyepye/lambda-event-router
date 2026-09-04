import type { StandardSchemaV1 } from '@standard-schema/spec';

import { getLogger } from '@lambda-event-router/base';
import { createApiGatewayV1Event, createMockContext } from '@lambda-event-router/testing';

import { createAPIGatewayRouter } from './APIGatewayRouter.js';
import type { APIGatewayAuth, CognitoAuth, IamAuth, JwtAuth, LambdaAuth } from './auth.js';
import { cognitoAuth, iamAuth, jwtAuth, lambdaAuth, noAuth } from './presets.js';
import type { ApiRequest } from './types.js';

type OrdersRequest<TAuth extends APIGatewayAuth> = ApiRequest<
  Record<never, never>,
  Record<string, string | undefined>,
  TAuth,
  undefined
>;

// A schema that reads seats as a number, the way a coercing schema library would
const SeatsSchema: StandardSchemaV1<unknown, { orgId: string; seats: number }> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value: unknown) => {
      const record = typeof value === 'object' && value !== null ? Object.entries(value) : [];
      const fields = new Map(record);
      const orgId = fields.get('orgId');
      const seats = Number(fields.get('seats'));
      if (typeof orgId !== 'string' || Number.isNaN(seats)) {
        return { issues: [{ message: 'orgId and seats are required' }] };
      }
      return { value: { orgId, seats } };
    },
  },
};

const TenantClaimsSchema: StandardSchemaV1<unknown, { 'custom:tenantId': string }> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value: unknown) => {
      const tenantId =
        typeof value === 'object' && value !== null ? new Map(Object.entries(value)).get('custom:tenantId') : undefined;
      if (typeof tenantId !== 'string') return { issues: [{ message: 'custom:tenantId is required' }] };
      return { value: { 'custom:tenantId': tenantId } };
    },
  },
};

const LAMBDA: LambdaAuth = { type: 'lambda', principalId: 'user-1', context: { orgId: 'acme', seats: '3' } };
const COGNITO: CognitoAuth = { type: 'cognito', claims: { sub: 'user-sub', 'custom:tenantId': 'goods-in' } };
const JWT: JwtAuth = {
  type: 'jwt',
  claims: { sub: 'user-sub', 'custom:tenantId': 'goods-in' },
  scopes: ['probe/read'],
};
const IAM: IamAuth = {
  type: 'iam',
  iam: {
    accountId: '123456789012',
    userArn: 'arn:aws:iam::123456789012:user/service',
    callerId: 'AIDAEXAMPLE',
    userId: 'AIDAEXAMPLE',
    accessKey: 'AKIAEXAMPLE',
    principalOrgId: undefined,
    cognitoIdentityId: undefined,
    cognitoIdentityPoolId: undefined,
    cognitoAuthenticated: undefined,
    cognitoAmr: undefined,
  },
};

suite('API Gateway auth presets', () => {
  suite('lambdaAuth', () => {
    test('accepts a Lambda authorizer and hands it on', async () => {
      expect(await lambdaAuth().check(LAMBDA)).toEqual({ success: true, auth: LAMBDA });
    });

    test('refuses any other auth, and no auth', async () => {
      expect(await lambdaAuth().check(JWT)).toEqual({
        success: false,
        reason: 'wrongType',
        message: 'Expected lambda auth, got jwt',
      });
      expect(await lambdaAuth().check(undefined)).toEqual({
        success: false,
        reason: 'missing',
        message: 'Expected lambda auth, got none',
      });
    });

    test('hands on the schema output as the context', async () => {
      expect(await lambdaAuth(SeatsSchema).check(LAMBDA)).toEqual({
        success: true,
        auth: { ...LAMBDA, context: { orgId: 'acme', seats: 3 } },
      });
    });

    test('refuses a context that fails its schema, with the issues', async () => {
      const result = await lambdaAuth(SeatsSchema).check({ ...LAMBDA, context: { seats: '3' } });

      expect(result).toEqual({
        success: false,
        reason: 'invalid',
        message: 'The Lambda authorizer context failed its schema',
        issues: [{ message: 'orgId and seats are required' }],
      });
    });

    test('keeps an API key that arrived alongside the authorizer', async () => {
      const withKey: LambdaAuth = { ...LAMBDA, apiKey: { key: 'key-value', id: 'key-id' } };

      expect(await lambdaAuth(SeatsSchema).check(withKey)).toMatchObject({
        success: true,
        auth: { apiKey: { key: 'key-value', id: 'key-id' } },
      });
    });
  });

  suite('cognitoAuth', () => {
    test('accepts a Cognito authorizer and refuses a JWT one', async () => {
      expect(await cognitoAuth().check(COGNITO)).toEqual({ success: true, auth: COGNITO });
      expect(await cognitoAuth().check(JWT)).toEqual({
        success: false,
        reason: 'wrongType',
        message: 'Expected cognito auth, got jwt',
      });
    });

    test('keeps every claim and lays the schema output over them', async () => {
      const result = await cognitoAuth({ claims: TenantClaimsSchema }).check(COGNITO);

      expect(result).toEqual({ success: true, auth: COGNITO });
    });

    test('refuses claims that fail their schema', async () => {
      const result = await cognitoAuth({ claims: TenantClaimsSchema }).check({ type: 'cognito', claims: { sub: 'x' } });

      expect(result).toMatchObject({
        success: false,
        reason: 'invalid',
        message: 'The Cognito claims failed their schema',
      });
    });
  });

  suite('jwtAuth', () => {
    test('accepts a JWT authorizer, keeps its scopes, and refuses a Cognito one', async () => {
      expect(await jwtAuth({ claims: TenantClaimsSchema }).check(JWT)).toEqual({ success: true, auth: JWT });
      expect(await jwtAuth().check(COGNITO)).toEqual({
        success: false,
        reason: 'wrongType',
        message: 'Expected jwt auth, got cognito',
      });
    });

    test('refuses claims that fail their schema', async () => {
      const result = await jwtAuth({ claims: TenantClaimsSchema }).check({ ...JWT, claims: { sub: 'x' } });

      expect(result).toMatchObject({
        success: false,
        reason: 'invalid',
        message: 'The JWT claims failed their schema',
      });
    });
  });

  suite('iamAuth', () => {
    test('accepts IAM and refuses a Lambda authorizer', async () => {
      expect(await iamAuth().check(IAM)).toEqual({ success: true, auth: IAM });
      expect(await iamAuth().check(LAMBDA)).toEqual({
        success: false,
        reason: 'wrongType',
        message: 'Expected iam auth, got lambda',
      });
    });
  });

  suite('on the router', () => {
    const context = createMockContext();
    const restEvent = createApiGatewayV1Event({
      path: '/orders',
      requestContext: { authorizer: { principalId: 'user-1', integrationLatency: 5, orgId: 'acme', seats: '3' } },
    });

    test('a router default checks every route and hands on the schema output', async () => {
      const router = createAPIGatewayRouter({ auth: lambdaAuth(SeatsSchema) }).get({
        filters: { path: '/orders' },
        handler: async ({ auth }: OrdersRequest<LambdaAuth<{ orgId: string; seats: number }>>) => ({
          orgId: auth.context.orgId,
          seats: auth.context.seats,
        }),
      });

      const result = await router.handleEvent(restEvent, context);

      expect(result).toMatchObject({ statusCode: 200, body: JSON.stringify({ orgId: 'acme', seats: 3 }) });
    });

    test('a request whose auth does not match answers 500', async () => {
      const errorSpy = vi.spyOn(getLogger(), 'error').mockImplementation(() => undefined);
      const router = createAPIGatewayRouter({ auth: iamAuth() }).get({
        filters: { path: '/orders' },
        handler: vi.fn(),
      });

      const result = await router.handleEvent(restEvent, context);

      expect(result).toMatchObject({ statusCode: 500 });
      expect(errorSpy).toHaveBeenCalledWith(
        'Request auth does not match the auth preset',
        expect.objectContaining({ preset: 'iamAuth', message: 'Expected iam auth, got lambda' }),
      );
      errorSpy.mockRestore();
    });

    test('noAuth marks a public route on a router with a default', async () => {
      const warnSpy = vi.spyOn(getLogger(), 'warn').mockImplementation(() => undefined);
      const router = createAPIGatewayRouter({ auth: iamAuth() }).get({
        filters: { path: '/orders' },
        auth: noAuth(),
        handler: async ({ auth }: OrdersRequest<undefined>) => ({ hasAuth: auth !== undefined }),
      });

      const result = await router.handleEvent(restEvent, context);

      expect(result).toMatchObject({ statusCode: 200, body: JSON.stringify({ hasAuth: false }) });
      warnSpy.mockRestore();
    });
  });
});
