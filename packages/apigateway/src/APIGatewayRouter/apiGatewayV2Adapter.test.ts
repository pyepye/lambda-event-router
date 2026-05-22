import {
  createApiGatewayV2Event,
  createApiGatewayV2WithIAMAuthorizerEvent,
  createApiGatewayV2WithJWTAuthorizerEvent,
  createApiGatewayV2WithLambdaAuthorizerEvent,
} from '@lambda-event-router/testing';

import { apiGatewayV2Adapter } from './apiGatewayV2Adapter.js';

suite('apiGatewayV2Adapter', () => {
  suite('canHandleEvent', () => {
    test('returns true for a valid V2 event', () => {
      const event = createApiGatewayV2Event();
      expect(apiGatewayV2Adapter.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(apiGatewayV2Adapter.canHandleEvent(null)).toBe(false);
    });

    test('returns false when rawPath is missing', () => {
      expect(apiGatewayV2Adapter.canHandleEvent({ requestContext: { http: { method: 'GET' } } })).toBe(false);
    });

    test('returns false when requestContext.http is missing', () => {
      expect(apiGatewayV2Adapter.canHandleEvent({ rawPath: '/', requestContext: {} })).toBe(false);
    });

    test('returns false when http.method is not a string', () => {
      expect(apiGatewayV2Adapter.canHandleEvent({ rawPath: '/', requestContext: { http: { method: 123 } } })).toBe(
        false,
      );
    });
  });

  suite('normalize', () => {
    test('extracts method, path, headers, query, body from V2 event', () => {
      const event = createApiGatewayV2Event({
        rawPath: '/items',
        headers: { 'content-type': 'application/json' },
        queryStringParameters: { page: '1' },
        body: '{"name":"test"}',
        requestContext: { http: { method: 'POST' } },
      });

      const normalized = apiGatewayV2Adapter.normalize(event);

      expect(normalized.method).toBe('POST');
      expect(normalized.path).toBe('/items');
      expect(normalized.headers).toEqual({ 'content-type': 'application/json' });
      expect(normalized.query).toEqual({ page: '1' });
      expect(normalized.body).toBe('{"name":"test"}');
      expect(normalized.isBase64Encoded).toBe(false);
    });

    test('returns empty query when queryStringParameters is undefined', () => {
      const event = createApiGatewayV2Event();

      const normalized = apiGatewayV2Adapter.normalize(event);

      expect(normalized.query).toEqual({});
    });

    test('keeps V2 comma-joined values as a single multi-value entry (no comma splitting)', () => {
      // API Gateway V2 joins repeated params itself; it is not split back apart
      const event = createApiGatewayV2Event({
        headers: { 'x-tag': 'a,b' },
        queryStringParameters: { tag: 'a,b' },
      });

      const normalized = apiGatewayV2Adapter.normalize(event);

      expect(normalized.query).toEqual({ tag: 'a,b' });
      expect(normalized.multiValueQuery).toEqual({ tag: ['a,b'] });
      expect(normalized.multiValueHeaders['x-tag']).toEqual(['a,b']);
    });

    test('extracts JWT auth from V2 event', () => {
      const event = createApiGatewayV2WithJWTAuthorizerEvent({
        requestContext: {
          authorizer: {
            jwt: {
              claims: { sub: 'user-1', iss: 'https://cognito.example.com' },
              scopes: ['openid', 'email'],
            },
          },
        },
      });

      const normalized = apiGatewayV2Adapter.normalize(event);

      expect(normalized.auth).toEqual({
        claims: { sub: 'user-1', iss: 'https://cognito.example.com' },
        scopes: ['openid', 'email'],
      });
    });

    test('extracts client certificate auth', () => {
      const event = createApiGatewayV2Event({
        requestContext: {
          authentication: {
            clientCert: {
              clientCertPem: 'CERT_PEM',
              subjectDN: 'CN=client',
              issuerDN: 'CN=issuer',
              serialNumber: '1234',
              validity: { notBefore: '2024-01-01', notAfter: '2025-01-01' },
            },
          },
        },
      });

      const normalized = apiGatewayV2Adapter.normalize(event);

      expect(normalized.auth).toEqual({
        clientCert: {
          clientCertPem: 'CERT_PEM',
          subjectDN: 'CN=client',
          issuerDN: 'CN=issuer',
          serialNumber: '1234',
          validity: { notBefore: '2024-01-01', notAfter: '2025-01-01' },
        },
      });
    });

    test('extracts IAM authorizer auth', () => {
      const event = createApiGatewayV2WithIAMAuthorizerEvent({
        requestContext: {
          authorizer: {
            iam: {
              accessKey: 'test-access-key',
              accountId: '999888777666',
              callerId: 'test-caller-id',
              cognitoIdentity: null,
              principalOrgId: 'o-test123',
              userArn: 'arn:aws:iam::999888777666:user/test',
              userId: 'test-user-id',
            },
          },
        },
      });

      const normalized = apiGatewayV2Adapter.normalize(event);

      expect(normalized.auth?.iam).toBeDefined();
      expect(normalized.auth?.iam?.accountId).toBe('999888777666');
    });

    test('returns default authorizer context when authorizer has no jwt or iam key', () => {
      const event = createApiGatewayV2WithLambdaAuthorizerEvent({
        requestContext: {
          authorizer: {
            lambda: { tenantId: 'tenant-1', role: 'viewer' },
          },
        },
      });

      const normalized = apiGatewayV2Adapter.normalize(event);

      expect(normalized.auth).toEqual({
        context: { lambda: { userId: 'user-1', role: 'viewer', tenantId: 'tenant-1' } },
      });
    });

    test('returns undefined auth when no authorizer is present', () => {
      const event = createApiGatewayV2Event();

      const normalized = apiGatewayV2Adapter.normalize(event);

      expect(normalized.auth).toBeUndefined();
    });
  });

  suite('buildResult', () => {
    test('converts finalized response to API Gateway V2 result', () => {
      const event = createApiGatewayV2Event();
      const response = { statusCode: 200, body: '{"ok":true}', headers: { 'x-custom': 'value' } };

      const result = apiGatewayV2Adapter.buildResult(response, event);

      expect(result).toEqual({
        statusCode: 200,
        body: '{"ok":true}',
        headers: { 'x-custom': 'value' },
      });
    });
  });
});
