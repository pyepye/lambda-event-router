import type { Context, PreSignUpTriggerEvent } from 'aws-lambda';
import type {
  CognitoFilters,
  PreSignUpHandler,
  PreSignUpRequest,
  PreSignUpResponse,
  PreSignUpRouteDefinition,
  PreSignUpTriggerSource,
  UserAttributes,
} from './index.js';

suite('PreSignUpTriggerSource', () => {
  test('resolves to expected literals', () => {
    expectTypeOf<PreSignUpTriggerSource>().toEqualTypeOf<
      'PreSignUp_SignUp' | 'PreSignUp_AdminCreateUser' | 'PreSignUp_ExternalProvider'
    >();
  });
});

suite('PreSignUpRequest', () => {
  test('has triggerSource field', () => {
    expectTypeOf<PreSignUpRequest['triggerSource']>().toEqualTypeOf<PreSignUpTriggerSource>();
  });

  test('has userAttributes field', () => {
    expectTypeOf<PreSignUpRequest['userAttributes']>().toEqualTypeOf<UserAttributes>();
  });

  test('has event field', () => {
    expectTypeOf<PreSignUpRequest['event']>().toEqualTypeOf<PreSignUpTriggerEvent>();
  });

  test('has context field', () => {
    expectTypeOf<PreSignUpRequest['context']>().toEqualTypeOf<Context>();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<PreSignUpRequest<CustomAttributes>['userAttributes']>().toEqualTypeOf<CustomAttributes>();
  });
});

suite('PreSignUpResponse', () => {
  test('matches event response type', () => {
    expectTypeOf<PreSignUpResponse>().toEqualTypeOf<PreSignUpTriggerEvent['response']>();
  });
});

suite('PreSignUpHandler', () => {
  test('accepts PreSignUpRequest and returns Promise<PreSignUpTriggerEvent>', () => {
    expectTypeOf<PreSignUpHandler>().toEqualTypeOf<(request: PreSignUpRequest) => Promise<PreSignUpTriggerEvent>>();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<PreSignUpHandler<CustomAttributes>>().toEqualTypeOf<
      (request: PreSignUpRequest<CustomAttributes>) => Promise<PreSignUpTriggerEvent>
    >();
  });
});

suite('PreSignUpRouteDefinition', () => {
  test('has optional filters field', () => {
    expectTypeOf<PreSignUpRouteDefinition>().toHaveProperty('filters');
  });

  test('has optional userAttributesSchema field', () => {
    expectTypeOf<PreSignUpRouteDefinition>().toHaveProperty('userAttributesSchema');
  });

  test('has handler field matching PreSignUpHandler', () => {
    expectTypeOf<PreSignUpRouteDefinition['handler']>().toEqualTypeOf<PreSignUpHandler>();
  });

  test('filters use PreSignUpTriggerSource', () => {
    expectTypeOf<NonNullable<PreSignUpRouteDefinition['filters']>>().toEqualTypeOf<
      CognitoFilters<PreSignUpTriggerSource>
    >();
  });
});
