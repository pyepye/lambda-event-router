import type { Context, PostConfirmationTriggerEvent } from 'aws-lambda';
import type {
  CognitoFilters,
  PostConfirmationHandler,
  PostConfirmationRequest,
  PostConfirmationResponse,
  PostConfirmationRouteDefinition,
  PostConfirmationTriggerSource,
  UserAttributes,
} from './index.js';

suite('PostConfirmationTriggerSource', () => {
  test('resolves to expected literals', () => {
    expectTypeOf<PostConfirmationTriggerSource>().toEqualTypeOf<
      'PostConfirmation_ConfirmSignUp' | 'PostConfirmation_ConfirmForgotPassword'
    >();
  });
});

suite('PostConfirmationRequest', () => {
  test('has triggerSource field', () => {
    expectTypeOf<PostConfirmationRequest['triggerSource']>().toEqualTypeOf<PostConfirmationTriggerSource>();
  });

  test('has userAttributes field', () => {
    expectTypeOf<PostConfirmationRequest['userAttributes']>().toEqualTypeOf<UserAttributes>();
  });

  test('has event field', () => {
    expectTypeOf<PostConfirmationRequest['event']>().toEqualTypeOf<PostConfirmationTriggerEvent>();
  });

  test('has context field', () => {
    expectTypeOf<PostConfirmationRequest['context']>().toEqualTypeOf<Context>();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<PostConfirmationRequest<CustomAttributes>['userAttributes']>().toEqualTypeOf<CustomAttributes>();
  });
});

suite('PostConfirmationResponse', () => {
  test('is undefined', () => {
    expectTypeOf<PostConfirmationResponse>().toEqualTypeOf<undefined>();
  });
});

suite('PostConfirmationHandler', () => {
  test('accepts PostConfirmationRequest and returns Promise<PostConfirmationTriggerEvent>', () => {
    expectTypeOf<PostConfirmationHandler>().toEqualTypeOf<
      (request: PostConfirmationRequest) => Promise<PostConfirmationTriggerEvent>
    >();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<PostConfirmationHandler<CustomAttributes>>().toEqualTypeOf<
      (request: PostConfirmationRequest<CustomAttributes>) => Promise<PostConfirmationTriggerEvent>
    >();
  });
});

suite('PostConfirmationRouteDefinition', () => {
  test('has optional filters field', () => {
    expectTypeOf<PostConfirmationRouteDefinition>().toHaveProperty('filters');
  });

  test('has optional userAttributesSchema field', () => {
    expectTypeOf<PostConfirmationRouteDefinition>().toHaveProperty('userAttributesSchema');
  });

  test('has handler field matching PostConfirmationHandler', () => {
    expectTypeOf<PostConfirmationRouteDefinition['handler']>().toEqualTypeOf<PostConfirmationHandler>();
  });

  test('filters use PostConfirmationTriggerSource', () => {
    expectTypeOf<NonNullable<PostConfirmationRouteDefinition['filters']>>().toEqualTypeOf<
      CognitoFilters<PostConfirmationTriggerSource>
    >();
  });
});
