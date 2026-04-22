import type { PreSignUpTriggerEvent } from 'aws-lambda';

import { testCognitoTriggerTypes } from './common.type.test.js';
import type {
  PreSignUpHandler,
  PreSignUpRequest,
  PreSignUpResponse,
  PreSignUpRouteDefinition,
  PreSignUpTriggerSource,
} from './index.js';

type CustomAttributes = { email: string } & Record<string, string>;

suite('PreSignUpTriggerSource', () => {
  test('resolves to expected literals', () => {
    expectTypeOf<PreSignUpTriggerSource>().toEqualTypeOf<
      'PreSignUp_SignUp' | 'PreSignUp_AdminCreateUser' | 'PreSignUp_ExternalProvider'
    >();
  });
});

suite('PreSignUpResponse', () => {
  test('matches event response type', () => {
    expectTypeOf<PreSignUpResponse>().toEqualTypeOf<PreSignUpTriggerEvent['response']>();
  });
});

testCognitoTriggerTypes<
  PreSignUpTriggerSource,
  PreSignUpTriggerEvent,
  PreSignUpRequest,
  PreSignUpRequest<CustomAttributes>,
  PreSignUpHandler,
  PreSignUpHandler<CustomAttributes>,
  PreSignUpRouteDefinition
>('PreSignUp');
