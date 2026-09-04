import type {
  APIGatewayEventClientCertificate,
  APIGatewayEventDefaultAuthorizerContext,
  APIGatewayEventRequestContextV2,
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
} from 'aws-lambda';

import { createApiGatewayV1Event, createApiGatewayV2Event } from '@lambda-event-router/testing';

import { apiGatewayV1Adapter } from './apiGatewayV1Adapter.js';
import { apiGatewayV2Adapter } from './apiGatewayV2Adapter.js';

// Each authorizer and identity below has the shape API Gateway delivered to a Lambda in a real request

const IAM_USER_IDENTITY: Record<string, unknown> = {
  accessKey: 'AKIAEXAMPLE',
  accountId: '123456789012',
  caller: 'AIDAEXAMPLE',
  user: 'AIDAEXAMPLE',
  userArn: 'arn:aws:iam::123456789012:user/service',
  principalOrgId: null,
  cognitoAuthenticationProvider: null,
  cognitoAuthenticationType: null,
  cognitoIdentityId: null,
  cognitoIdentityPoolId: null,
};

const POOL_ID: string = 'eu-west-2:pool-id';
const PROVIDERS: string[] = [
  'cognito-idp.eu-west-2.amazonaws.com/eu-west-2_pool',
  'cognito-idp.eu-west-2.amazonaws.com/eu-west-2_pool:CognitoSignIn:user-sub',
];

const UNAUTHENTICATED_POOL_IDENTITY: Record<string, unknown> = {
  ...IAM_USER_IDENTITY,
  accessKey: 'ASIAEXAMPLE',
  caller: 'AROAEXAMPLE:CognitoIdentityCredentials',
  user: 'AROAEXAMPLE:CognitoIdentityCredentials',
  userArn: 'arn:aws:sts::123456789012:assumed-role/guest/CognitoIdentityCredentials',
  cognitoAuthenticationType: 'unauthenticated',
  cognitoIdentityId: 'eu-west-2:guest-id',
  cognitoIdentityPoolId: POOL_ID,
};

const AUTHENTICATED_POOL_IDENTITY: Record<string, unknown> = {
  ...UNAUTHENTICATED_POOL_IDENTITY,
  userArn: 'arn:aws:sts::123456789012:assumed-role/signed-in/CognitoIdentityCredentials',
  cognitoAuthenticationType: 'authenticated',
  cognitoAuthenticationProvider: PROVIDERS.join(','),
  cognitoIdentityId: 'eu-west-2:user-id',
};

const CLIENT_CERT: APIGatewayEventClientCertificate = {
  clientCertPem: '-----BEGIN CERTIFICATE-----',
  serialNumber: '01',
  subjectDN: 'CN=client',
  issuerDN: 'CN=issuer',
  validity: { notBefore: 'Jan 1 00:00:00 2026 GMT', notAfter: 'Jan 1 00:00:00 2027 GMT' },
};

interface V1RequestContext {
  authorizer?: APIGatewayEventDefaultAuthorizerContext;
  identity?: Record<string, unknown>;
}

function restEvent(requestContext: V1RequestContext): APIGatewayProxyEvent {
  const event = createApiGatewayV1Event();
  const identity = { ...event.requestContext.identity, ...requestContext.identity };
  const mergedContext = { ...event.requestContext, authorizer: requestContext.authorizer, identity };
  return { ...event, requestContext: mergedContext };
}

function httpPayloadV1Event(requestContext: V1RequestContext): APIGatewayProxyEvent {
  const event: APIGatewayProxyEvent & { version: string } = { ...restEvent(requestContext), version: '1.0' };
  return event;
}

function httpPayloadV2Event(requestContext: {
  authorizer?: Record<string, unknown>;
  authentication?: APIGatewayEventRequestContextV2['authentication'];
}): APIGatewayProxyEventV2 {
  const event = createApiGatewayV2Event();
  const mergedContext = { ...event.requestContext, ...requestContext };
  return { ...event, requestContext: mergedContext };
}

suite('API Gateway auth', () => {
  suite('REST', () => {
    test('a Lambda authorizer gives its principal and context, without the fields API Gateway adds', () => {
      const event = restEvent({
        authorizer: { principalId: 'probe-principal', integrationLatency: 16, text: 'goods-in', numeric: '42' },
      });

      expect(apiGatewayV1Adapter.normalize(event).auth).toEqual({
        type: 'lambda',
        principalId: 'probe-principal',
        context: { text: 'goods-in', numeric: '42' },
      });
    });

    test('a Lambda authorizer context key named claims stays in the context', () => {
      const event = restEvent({
        authorizer: { principalId: 'probe-principal', integrationLatency: 17, claims: 'not-cognito', jwt: 'not-jwt' },
      });

      expect(apiGatewayV1Adapter.normalize(event).auth).toEqual({
        type: 'lambda',
        principalId: 'probe-principal',
        context: { claims: 'not-cognito', jwt: 'not-jwt' },
      });
    });

    test('an API key sits alongside a Lambda authorizer', () => {
      const event = restEvent({
        authorizer: { principalId: 'probe-principal', integrationLatency: 14, text: 'goods-in' },
        identity: { apiKey: 'key-value', apiKeyId: 'key-id' },
      });

      expect(apiGatewayV1Adapter.normalize(event).auth).toEqual({
        type: 'lambda',
        principalId: 'probe-principal',
        context: { text: 'goods-in' },
        apiKey: { key: 'key-value', id: 'key-id' },
      });
    });

    test('an API key with no authorizer gives an apiKey auth', () => {
      const event = restEvent({ identity: { apiKey: 'key-value', apiKeyId: 'key-id' } });

      expect(apiGatewayV1Adapter.normalize(event).auth).toEqual({
        type: 'apiKey',
        apiKey: { key: 'key-value', id: 'key-id' },
      });
    });

    test('a Cognito authorizer gives its claims as real values', () => {
      const event = restEvent({
        authorizer: {
          claims: {
            sub: 'user-sub',
            'cognito:groups': 'pickers,supervisors',
            email_verified: 'true',
            'custom:tenantId': 'goods-in',
            exp: 'Mon Sep 28 22:44:53 UTC 2026',
            token_use: 'id',
          },
        },
      });

      expect(apiGatewayV1Adapter.normalize(event).auth).toEqual({
        type: 'cognito',
        claims: {
          sub: 'user-sub',
          'cognito:groups': ['pickers', 'supervisors'],
          email_verified: true,
          'custom:tenantId': 'goods-in',
          exp: new Date('2026-09-28T22:44:53Z'),
          token_use: 'id',
        },
      });
    });

    test('a Cognito authorizer keeps an API key alongside its claims', () => {
      const event = restEvent({
        authorizer: { claims: { sub: 'user-sub' } },
        identity: { apiKey: 'key-value', apiKeyId: 'key-id' },
      });

      expect(apiGatewayV1Adapter.normalize(event).auth).toEqual({
        type: 'cognito',
        claims: { sub: 'user-sub' },
        apiKey: { key: 'key-value', id: 'key-id' },
      });
    });

    test('IAM from an IAM user gives its identity', () => {
      const event = restEvent({ authorizer: null, identity: IAM_USER_IDENTITY });

      expect(apiGatewayV1Adapter.normalize(event).auth).toEqual({
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
      });
    });

    test('IAM from an unauthenticated identity pool marks the caller as not authenticated', () => {
      const event = restEvent({ authorizer: null, identity: UNAUTHENTICATED_POOL_IDENTITY });

      expect(apiGatewayV1Adapter.normalize(event).auth).toMatchObject({
        type: 'iam',
        iam: {
          cognitoIdentityId: 'eu-west-2:guest-id',
          cognitoIdentityPoolId: POOL_ID,
          cognitoAuthenticated: false,
          cognitoAmr: ['unauthenticated'],
        },
      });
    });

    test('IAM from an authenticated identity pool gives the providers in cognitoAmr', () => {
      const event = restEvent({ authorizer: null, identity: AUTHENTICATED_POOL_IDENTITY });

      expect(apiGatewayV1Adapter.normalize(event).auth).toMatchObject({
        type: 'iam',
        iam: { cognitoAuthenticated: true, cognitoAmr: ['authenticated', ...PROVIDERS] },
      });
    });

    test('IAM leaves the caller IP address off auth', () => {
      const event = restEvent({ authorizer: null, identity: { ...AUTHENTICATED_POOL_IDENTITY, sourceIp: '10.0.0.1' } });

      expect(JSON.stringify(apiGatewayV1Adapter.normalize(event).auth)).not.toContain('10.0.0.1');
    });

    test('an API key sits alongside IAM', () => {
      const event = restEvent({
        authorizer: null,
        identity: { ...IAM_USER_IDENTITY, apiKey: 'key-value', apiKeyId: 'key-id' },
      });

      expect(apiGatewayV1Adapter.normalize(event).auth).toMatchObject({
        type: 'iam',
        apiKey: { key: 'key-value', id: 'key-id' },
      });
    });

    test('a client certificate sits alongside an authorizer', () => {
      const event = restEvent({
        authorizer: { principalId: 'probe-principal', integrationLatency: 3 },
        identity: { clientCert: CLIENT_CERT },
      });

      expect(apiGatewayV1Adapter.normalize(event).auth).toEqual({
        type: 'lambda',
        principalId: 'probe-principal',
        context: {},
        clientCert: CLIENT_CERT,
      });
    });

    test('a request with no auth gives undefined', () => {
      expect(apiGatewayV1Adapter.normalize(restEvent({ authorizer: null })).auth).toBeUndefined();
    });
  });

  suite('HTTP API, integration payload 1.0', () => {
    test('a Lambda authorizer gives its context, without the claims and scopes API Gateway adds', () => {
      const event = httpPayloadV1Event({
        authorizer: { claims: null, scopes: null, text: 'goods-in', numeric: '42' },
      });

      expect(apiGatewayV1Adapter.normalize(event).auth).toEqual({
        type: 'lambda',
        principalId: undefined,
        context: { text: 'goods-in', numeric: '42' },
      });
    });

    test('a Lambda authorizer context key named principalId stays in the context', () => {
      const event = httpPayloadV1Event({
        authorizer: { claims: null, scopes: null, principalId: 'context-principal', integrationLatency: '99' },
      });

      expect(apiGatewayV1Adapter.normalize(event).auth).toEqual({
        type: 'lambda',
        principalId: undefined,
        context: { principalId: 'context-principal', integrationLatency: '99' },
      });
    });

    test('a JWT authorizer gives its claims and scopes', () => {
      const event = httpPayloadV1Event({
        authorizer: {
          claims: { sub: 'user-sub', exp: '1790635493', 'cognito:groups': '[pickers supervisors]' },
          scopes: ['aws.cognito.signin.user.admin'],
        },
      });

      expect(apiGatewayV1Adapter.normalize(event).auth).toEqual({
        type: 'jwt',
        claims: {
          sub: 'user-sub',
          exp: new Date('2026-09-28T22:44:53Z'),
          'cognito:groups': ['pickers', 'supervisors'],
        },
        scopes: ['aws.cognito.signin.user.admin'],
      });
    });

    test('a JWT authorizer on a route with no scopes gives undefined scopes', () => {
      const event = httpPayloadV1Event({ authorizer: { claims: { sub: 'user-sub' }, scopes: null } });

      expect(apiGatewayV1Adapter.normalize(event).auth).toEqual({
        type: 'jwt',
        claims: { sub: 'user-sub' },
        scopes: undefined,
      });
    });

    test('IAM from an identity pool gives cognitoAmr as delivered', () => {
      const event = httpPayloadV1Event({
        authorizer: null,
        identity: { ...AUTHENTICATED_POOL_IDENTITY, cognitoAmr: ['authenticated', ...PROVIDERS] },
      });

      expect(apiGatewayV1Adapter.normalize(event).auth).toMatchObject({
        type: 'iam',
        iam: { cognitoAuthenticated: true, cognitoAmr: ['authenticated', ...PROVIDERS] },
      });
    });

    test('a request with no auth gives undefined', () => {
      expect(apiGatewayV1Adapter.normalize(httpPayloadV1Event({ authorizer: null })).auth).toBeUndefined();
    });
  });

  suite('HTTP API, integration payload 2.0', () => {
    test('a Lambda authorizer gives the context from under the lambda key', () => {
      const event = httpPayloadV2Event({
        authorizer: { lambda: { text: 'goods-in', integer: 3, nested: { level: 3 } } },
      });

      expect(apiGatewayV2Adapter.normalize(event).auth).toEqual({
        type: 'lambda',
        principalId: undefined,
        context: { text: 'goods-in', integer: 3, nested: { level: 3 } },
      });
    });

    test('a Lambda authorizer with no context gives an empty context', () => {
      const event = httpPayloadV2Event({ authorizer: { lambda: null } });

      expect(apiGatewayV2Adapter.normalize(event).auth).toEqual({
        type: 'lambda',
        principalId: undefined,
        context: {},
      });
    });

    test('a JWT authorizer gives its claims and scopes', () => {
      const event = httpPayloadV2Event({
        authorizer: {
          jwt: { claims: { sub: 'custom-user', amr: '[pwd mfa]', email_verified: 'true' }, scopes: ['probe/read'] },
        },
      });

      expect(apiGatewayV2Adapter.normalize(event).auth).toEqual({
        type: 'jwt',
        claims: { sub: 'custom-user', amr: ['pwd', 'mfa'], email_verified: true },
        scopes: ['probe/read'],
      });
    });

    test('a JWT authorizer on a route with no scopes gives undefined scopes', () => {
      const event = httpPayloadV2Event({ authorizer: { jwt: { claims: { sub: 'user-sub' }, scopes: null } } });

      expect(apiGatewayV2Adapter.normalize(event).auth).toEqual({
        type: 'jwt',
        claims: { sub: 'user-sub' },
        scopes: undefined,
      });
    });

    test('IAM from an IAM user gives the same shape as REST', () => {
      const event = httpPayloadV2Event({
        authorizer: {
          iam: {
            accessKey: 'AKIAEXAMPLE',
            accountId: '123456789012',
            callerId: 'AIDAEXAMPLE',
            cognitoIdentity: null,
            principalOrgId: null,
            userArn: 'arn:aws:iam::123456789012:user/service',
            userId: 'AIDAEXAMPLE',
          },
        },
      });

      expect(apiGatewayV2Adapter.normalize(event).auth).toEqual(
        apiGatewayV1Adapter.normalize(restEvent({ authorizer: null, identity: IAM_USER_IDENTITY })).auth,
      );
    });

    test('IAM from an identity pool gives the pool fields', () => {
      const event = httpPayloadV2Event({
        authorizer: {
          iam: {
            accessKey: 'ASIAEXAMPLE',
            accountId: '123456789012',
            callerId: 'AROAEXAMPLE:CognitoIdentityCredentials',
            cognitoIdentity: {
              amr: ['unauthenticated'],
              identityId: 'eu-west-2:guest-id',
              identityPoolId: POOL_ID,
            },
            principalOrgId: null,
            userArn: 'arn:aws:sts::123456789012:assumed-role/guest/CognitoIdentityCredentials',
            userId: 'AROAEXAMPLE:CognitoIdentityCredentials',
          },
        },
      });

      expect(apiGatewayV2Adapter.normalize(event).auth).toMatchObject({
        type: 'iam',
        iam: {
          cognitoIdentityId: 'eu-west-2:guest-id',
          cognitoIdentityPoolId: POOL_ID,
          cognitoAuthenticated: false,
          cognitoAmr: ['unauthenticated'],
        },
      });
    });

    test('a client certificate sits alongside an authorizer', () => {
      const event = httpPayloadV2Event({
        authentication: { clientCert: CLIENT_CERT },
        authorizer: { jwt: { claims: { sub: 'user-sub' }, scopes: null } },
      });

      expect(apiGatewayV2Adapter.normalize(event).auth).toEqual({
        type: 'jwt',
        claims: { sub: 'user-sub' },
        scopes: undefined,
        clientCert: CLIENT_CERT,
      });
    });

    test('a client certificate with no authorizer gives a clientCert auth', () => {
      const event = httpPayloadV2Event({ authentication: { clientCert: CLIENT_CERT } });

      expect(apiGatewayV2Adapter.normalize(event).auth).toEqual({ type: 'clientCert', clientCert: CLIENT_CERT });
    });

    test('a request with no auth gives undefined', () => {
      expect(apiGatewayV2Adapter.normalize(httpPayloadV2Event({})).auth).toBeUndefined();
    });
  });
});
