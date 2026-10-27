import { getLogger } from '@latcher/base';
import { createMockContext, createVPCLatticeV2Event } from '@latcher/testing';

import type { VPCLatticeAuth, VPCLatticeIamAuth } from './auth.js';
import { iamAuth, noAuth } from './presets.js';
import { createVPCLatticeMatcher } from './VPCLatticeMatcher.js';

const CALLER: VPCLatticeIamAuth = {
  type: 'iam',
  principalId: 'arn:aws:sts::123456789012:assumed-role/Ordering/session',
  iam: { principal: 'arn:aws:sts::123456789012:assumed-role/Ordering/session', type: 'AWS_IAM' },
};

suite('VPC Lattice auth presets', () => {
  test('VPCLatticeAuth covers an unsigned caller', () => {
    expectTypeOf<undefined>().toExtend<VPCLatticeAuth>();
  });

  test('iamAuth accepts a signed caller and hands it on', async () => {
    expect(await iamAuth().check(CALLER)).toEqual({ success: true, auth: CALLER });
  });

  test('iamAuth refuses a request Lattice could not name, as missing auth', async () => {
    expect(await iamAuth().check(undefined)).toEqual({
      success: false,
      reason: 'missing',
      message: 'Expected iam auth, got none',
    });
  });

  test('a matcher default of iamAuth answers 401 for an unsigned caller', async () => {
    const warnSpy = vi.spyOn(getLogger(), 'warn').mockImplementation(() => undefined);
    const matcher = createVPCLatticeMatcher({ auth: iamAuth() }).get({ filters: { path: '/' }, handler: vi.fn() });

    const result = await matcher.handleEvent(createVPCLatticeV2Event(), createMockContext());

    expect(result).toMatchObject({ statusCode: 401 });
    warnSpy.mockRestore();
  });

  test('noAuth marks a public route on a matcher with a default', async () => {
    const matcher = createVPCLatticeMatcher({ auth: iamAuth() }).get({
      filters: { path: '/' },
      auth: noAuth(),
      handler: vi.fn().mockResolvedValue({ ok: true }),
    });

    const result = await matcher.handleEvent(createVPCLatticeV2Event(), createMockContext());

    expect(result).toMatchObject({ statusCode: 200 });
  });
});
