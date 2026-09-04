import type { AuthOf, AuthPreset, HandlerResponse } from '@lambda-event-router/http';
import { createMockSchema, type MockSchema } from '@lambda-event-router/testing';

import { createAPIGatewayRouter, defineRoute } from './APIGatewayRouter.js';
import type { APIGatewayAuth, IamAuth, LambdaAuth } from './auth.js';
import { cognitoAuth, iamAuth, type jwtAuth, lambdaAuth, noAuth } from './presets.js';
import type { ApiRequest } from './types.js';

type Query = Record<string, string | undefined>;
type SeatsContext = { orgId: string; seats: number };

const seatsSchema: MockSchema<SeatsContext> = createMockSchema<SeatsContext>();
const orgAuth: AuthPreset<APIGatewayAuth, LambdaAuth<SeatsContext>> = lambdaAuth(seatsSchema);

function handlesOrg(
  request: ApiRequest<Record<string, string>, Query, AuthOf<typeof orgAuth>>,
): Promise<HandlerResponse> {
  expectTypeOf(request.auth.context).toEqualTypeOf<SeatsContext>();
  return Promise.resolve(request.auth.context.seats);
}

function handlesIam(request: ApiRequest<Record<string, string>, Query, IamAuth>): Promise<HandlerResponse> {
  return Promise.resolve(request.auth.iam.accountId);
}

function handlesAnyAuth(
  _request: ApiRequest<Record<string, string>, Query, APIGatewayAuth, { sku: string }>,
): Promise<HandlerResponse> {
  return Promise.resolve(undefined);
}

function handlesNoAuth(_request: ApiRequest<Record<string, string>, Query, undefined>): Promise<HandlerResponse> {
  return Promise.resolve(undefined);
}

suite('API Gateway auth preset types', () => {
  test('lambdaAuth with a schema types the context as the schema output', () => {
    expectTypeOf<AuthOf<ReturnType<typeof lambdaAuth<SeatsContext>>>>().toEqualTypeOf<LambdaAuth<SeatsContext>>();
  });

  test('lambdaAuth with no schema types the context as JSON values', () => {
    expectTypeOf<AuthOf<ReturnType<typeof lambdaAuth>>>().toEqualTypeOf<LambdaAuth>();
  });

  test('lambdaAuth refuses a schema whose output is not JSON', () => {
    // @ts-expect-error - a Date is not a value an authorizer context can hold
    lambdaAuth(createMockSchema<{ hiredAt: Date }>());
  });

  test('cognitoAuth and jwtAuth keep the standard claims next to the schema output', () => {
    const tenantAuth = cognitoAuth({ claims: createMockSchema<{ 'custom:tenantId': string }>() });
    type TenantClaims = AuthOf<typeof tenantAuth>['claims'];

    expectTypeOf<TenantClaims['custom:tenantId']>().toEqualTypeOf<string>();
    expectTypeOf<TenantClaims['exp']>().toEqualTypeOf<Date | undefined>();
    expectTypeOf<AuthOf<ReturnType<typeof jwtAuth>>['scopes']>().toEqualTypeOf<string[] | undefined>();
  });

  test('iamAuth takes no settings', () => {
    expectTypeOf<AuthOf<ReturnType<typeof iamAuth>>>().toEqualTypeOf<IamAuth>();

    // @ts-expect-error - IAM has no part for you to describe
    iamAuth(seatsSchema);
  });

  test('a router default types an annotated handler, and a route can override it', () => {
    const router = createAPIGatewayRouter({ auth: orgAuth });

    router.get({ filters: { path: '/orders' }, handler: handlesOrg });
    router.get({ filters: { path: '/audit' }, auth: iamAuth(), handler: handlesIam });
    router.get({ filters: { path: '/health' }, auth: noAuth(), handler: handlesNoAuth });

    // @ts-expect-error - the default hands on the Lambda auth, not IAM
    router.get({ filters: { path: '/audit' }, handler: handlesIam });
  });

  test('a router with no default refuses a handler that expects checked auth', () => {
    // @ts-expect-error - nothing checks the auth on this route
    createAPIGatewayRouter().get({ filters: { path: '/orders' }, handler: handlesOrg });
  });

  test('defineRoute takes a preset and types the inferred handler', () => {
    defineRoute({ filters: { method: 'GET', path: '/orders' }, auth: orgAuth }).handle(async ({ auth }) => {
      expectTypeOf(auth.context.seats).toEqualTypeOf<number>();
      return auth.context.orgId;
    });
  });

  test('the router defineRoute types the inferred handler from the router default', () => {
    createAPIGatewayRouter({ auth: orgAuth })
      .defineRoute({ filters: { method: 'GET', path: '/orders' } })
      .handle(async ({ auth }) => {
        expectTypeOf(auth.context.seats).toEqualTypeOf<number>();
        return auth.context.orgId;
      });
  });

  test('APIGatewayAuth covers an unsecured route, so it fills the auth slot on its own', () => {
    expectTypeOf<undefined>().toExtend<APIGatewayAuth>();

    createAPIGatewayRouter().post({
      filters: { path: '/orders' },
      bodySchema: createMockSchema<{ sku: string }>(),
      handler: handlesAnyAuth,
    });
  });

  test('ApiRequest refuses a type in the auth slot that is not API Gateway auth', () => {
    // @ts-expect-error - a body type in the auth slot
    expectTypeOf<ApiRequest<Record<string, string>, Query, { sku: string }>>();
  });
});
