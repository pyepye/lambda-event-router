import { createVPCLatticeV1Event } from '@lambda-event-router/testing';

import { vpcLatticeV1Adapter } from './vpcLatticeV1Adapter.js';

suite('vpcLatticeV1Adapter', () => {
  suite('canHandleEvent', () => {
    test('returns true for a valid V1 event', () => {
      const event = createVPCLatticeV1Event();
      expect(vpcLatticeV1Adapter.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(vpcLatticeV1Adapter.canHandleEvent(null)).toBe(false);
    });

    test('returns false when raw_path is missing', () => {
      expect(vpcLatticeV1Adapter.canHandleEvent({ method: 'GET' })).toBe(false);
    });

    test('returns false when method is missing', () => {
      expect(vpcLatticeV1Adapter.canHandleEvent({ raw_path: '/' })).toBe(false);
    });

    test('returns false when version is 2.0', () => {
      expect(vpcLatticeV1Adapter.canHandleEvent({ method: 'GET', raw_path: '/', version: '2.0' })).toBe(false);
    });

    test('returns false when requestContext is present', () => {
      expect(vpcLatticeV1Adapter.canHandleEvent({ method: 'GET', raw_path: '/', requestContext: {} })).toBe(false);
    });
  });

  suite('normalize', () => {
    test('extracts method, path, body from V1 event', () => {
      const event = createVPCLatticeV1Event({
        method: 'POST',
        raw_path: '/items',
        body: '{"name":"test"}',
      });

      const normalized = vpcLatticeV1Adapter.normalize(event);

      expect(normalized.method).toBe('POST');
      expect(normalized.path).toBe('/items');
      expect(normalized.body).toBe('{"name":"test"}');
    });

    test('flattens headers to lowercase', () => {
      const event = createVPCLatticeV1Event({
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
      });

      const normalized = vpcLatticeV1Adapter.normalize(event);

      expect(normalized.headers['content-type']).toBe('application/json');
      expect(normalized.headers.authorization).toBe('Bearer token');
    });

    test('returns empty headers when headers is undefined', () => {
      const event = createVPCLatticeV1Event({ headers: undefined });

      const normalized = vpcLatticeV1Adapter.normalize(event);

      expect(normalized.headers).toEqual({});
    });

    test('returns empty query when query_string_parameters is undefined', () => {
      const event = createVPCLatticeV1Event();

      const normalized = vpcLatticeV1Adapter.normalize(event);

      expect(normalized.query).toEqual({});
    });

    test('passes through query string parameters', () => {
      const event = createVPCLatticeV1Event({
        query_string_parameters: { page: '1', limit: '10' },
      });

      const normalized = vpcLatticeV1Adapter.normalize(event);

      expect(normalized.query).toEqual({ page: '1', limit: '10' });
    });

    test('exposes single-value query and headers as one-element multi-value entries', () => {
      const event = createVPCLatticeV1Event({
        headers: { 'X-Trace': 'abc' },
        query_string_parameters: { page: '1' },
      });

      const normalized = vpcLatticeV1Adapter.normalize(event);

      expect(normalized.multiValueQuery).toEqual({ page: ['1'] });
      expect(normalized.multiValueHeaders['x-trace']).toEqual(['abc']);
    });

    test('returns undefined body when event body is undefined', () => {
      const event = createVPCLatticeV1Event();

      const normalized = vpcLatticeV1Adapter.normalize(event);

      expect(normalized.body).toBeUndefined();
    });

    test('passes through is_base64_encoded as isBase64Encoded', () => {
      const event = createVPCLatticeV1Event({ is_base64_encoded: true });
      const normalized = vpcLatticeV1Adapter.normalize(event);
      expect(normalized.isBase64Encoded).toBe(true);
    });

    test('strips the query string VPC Lattice leaves on the path', () => {
      const event = createVPCLatticeV1Event({ raw_path: '/stock/brk-9?page=2&depot=leeds' });

      const normalized = vpcLatticeV1Adapter.normalize(event);

      expect(normalized.path).toBe('/stock/brk-9');
    });

    test('keeps the path when there is no query string on it', () => {
      const event = createVPCLatticeV1Event({ raw_path: '/stock/brk-9' });

      const normalized = vpcLatticeV1Adapter.normalize(event);

      expect(normalized.path).toBe('/stock/brk-9');
    });

    test('reads the identity and network headers into auth.iam alongside the principal', () => {
      const event = createVPCLatticeV1Event({
        headers: {
          'x-amzn-lattice-identity':
            'Principal=arn:aws:sts::123456789012:assumed-role/Ordering/session; PrincipalOrgID=; PrincipalOrgPaths=; SessionName=session; Type=AWS_IAM',
          'x-amzn-lattice-network': 'SourceVpcArn=arn:aws:ec2:eu-west-2:123456789012:vpc/vpc-0abc',
        },
      });

      const normalized = vpcLatticeV1Adapter.normalize(event);

      expect(normalized.auth).toEqual({
        principalId: 'arn:aws:sts::123456789012:assumed-role/Ordering/session',
        iam: {
          sourceVpcArn: 'arn:aws:ec2:eu-west-2:123456789012:vpc/vpc-0abc',
          type: 'AWS_IAM',
          principal: 'arn:aws:sts::123456789012:assumed-role/Ordering/session',
          sessionName: 'session',
        },
      });
    });

    test('auth is undefined when only the network header is present', () => {
      const event = createVPCLatticeV1Event({
        headers: { 'x-amzn-lattice-network': 'SourceVpcArn=arn:aws:ec2:eu-west-2:123456789012:vpc/vpc-0abc' },
      });

      const normalized = vpcLatticeV1Adapter.normalize(event);

      expect(normalized.auth).toBeUndefined();
    });

    test('auth is undefined when there is no identity header', () => {
      const event = createVPCLatticeV1Event();

      const normalized = vpcLatticeV1Adapter.normalize(event);

      expect(normalized.auth).toBeUndefined();
    });

    test('auth is undefined when the identity header names no principal', () => {
      const event = createVPCLatticeV1Event({
        headers: { 'x-amzn-lattice-identity': 'Principal=; PrincipalOrgID=; Type=NONE' },
      });

      const normalized = vpcLatticeV1Adapter.normalize(event);

      expect(normalized.auth).toBeUndefined();
    });
  });

  suite('buildResult', () => {
    test('converts finalized response to VPC Lattice result', () => {
      const event = createVPCLatticeV1Event();
      const response = {
        statusCode: 200,
        body: '{"ok":true}',
        headers: { 'x-custom': 'value' },
        isBase64Encoded: false,
      };

      const result = vpcLatticeV1Adapter.buildResult(response, event);

      expect(result).toEqual({
        statusCode: 200,
        body: '{"ok":true}',
        headers: { 'x-custom': 'value' },
        isBase64Encoded: false,
      });
    });

    test('passes a base64 body through with its flag', () => {
      const event = createVPCLatticeV1Event();
      const body = Buffer.from([0x00, 0x01]).toString('base64');

      const result = vpcLatticeV1Adapter.buildResult({ statusCode: 200, body, isBase64Encoded: true }, event);

      expect(result.body).toBe(body);
      expect(result.isBase64Encoded).toBe(true);
    });
  });
});
