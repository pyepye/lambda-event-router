import type { Context, CustomMessageTriggerEvent } from 'aws-lambda';
import type {
  CognitoFilters,
  CustomMessageHandler,
  CustomMessageRequest,
  CustomMessageResponse,
  CustomMessageRouteDefinition,
  CustomMessageTriggerSource,
  UserAttributes,
} from './index.js';

suite('CustomMessageTriggerSource', () => {
  test('resolves to expected literals', () => {
    expectTypeOf<CustomMessageTriggerSource>().toEqualTypeOf<
      | 'CustomMessage_SignUp'
      | 'CustomMessage_AdminCreateUser'
      | 'CustomMessage_ResendCode'
      | 'CustomMessage_ForgotPassword'
      | 'CustomMessage_UpdateUserAttribute'
      | 'CustomMessage_VerifyUserAttribute'
      | 'CustomMessage_Authentication'
    >();
  });
});

suite('CustomMessageRequest', () => {
  test('has triggerSource field', () => {
    expectTypeOf<CustomMessageRequest['triggerSource']>().toEqualTypeOf<CustomMessageTriggerSource>();
  });

  test('has userAttributes field', () => {
    expectTypeOf<CustomMessageRequest['userAttributes']>().toEqualTypeOf<UserAttributes>();
  });

  test('has event field', () => {
    expectTypeOf<CustomMessageRequest['event']>().toEqualTypeOf<CustomMessageTriggerEvent>();
  });

  test('has context field', () => {
    expectTypeOf<CustomMessageRequest['context']>().toEqualTypeOf<Context>();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<CustomMessageRequest<CustomAttributes>['userAttributes']>().toEqualTypeOf<CustomAttributes>();
  });
});

suite('CustomMessageResponse', () => {
  test('matches event response type', () => {
    expectTypeOf<CustomMessageResponse>().toEqualTypeOf<CustomMessageTriggerEvent['response']>();
  });
});

suite('CustomMessageHandler', () => {
  test('accepts CustomMessageRequest and returns Promise<CustomMessageTriggerEvent>', () => {
    expectTypeOf<CustomMessageHandler>().toEqualTypeOf<
      (request: CustomMessageRequest) => Promise<CustomMessageTriggerEvent>
    >();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<CustomMessageHandler<CustomAttributes>>().toEqualTypeOf<
      (request: CustomMessageRequest<CustomAttributes>) => Promise<CustomMessageTriggerEvent>
    >();
  });
});

suite('CustomMessageRouteDefinition', () => {
  test('has optional filters field', () => {
    expectTypeOf<CustomMessageRouteDefinition>().toHaveProperty('filters');
  });

  test('has optional userAttributesSchema field', () => {
    expectTypeOf<CustomMessageRouteDefinition>().toHaveProperty('userAttributesSchema');
  });

  test('has handler field matching CustomMessageHandler', () => {
    expectTypeOf<CustomMessageRouteDefinition['handler']>().toEqualTypeOf<CustomMessageHandler>();
  });

  test('filters use CustomMessageTriggerSource', () => {
    expectTypeOf<NonNullable<CustomMessageRouteDefinition['filters']>>().toEqualTypeOf<
      CognitoFilters<CustomMessageTriggerSource>
    >();
  });
});
