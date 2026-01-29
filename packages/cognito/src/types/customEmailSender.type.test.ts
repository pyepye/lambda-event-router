import type { Context, CustomEmailSenderTriggerEvent } from 'aws-lambda';
import type {
  CognitoFilters,
  CustomEmailSenderHandler,
  CustomEmailSenderRequest,
  CustomEmailSenderResponse,
  CustomEmailSenderRouteDefinition,
  CustomEmailSenderTriggerSource,
  UserAttributes,
} from './index.js';

suite('CustomEmailSenderTriggerSource', () => {
  test('resolves to expected literals', () => {
    expectTypeOf<CustomEmailSenderTriggerSource>().toEqualTypeOf<
      | 'CustomEmailSender_SignUp'
      | 'CustomEmailSender_ResendCode'
      | 'CustomEmailSender_ForgotPassword'
      | 'CustomEmailSender_UpdateUserAttribute'
      | 'CustomEmailSender_VerifyUserAttribute'
      | 'CustomEmailSender_AdminCreateUser'
      | 'CustomEmailSender_AccountTakeOverNotification'
      | 'CustomEmailSender_Authentication'
    >();
  });
});

suite('CustomEmailSenderRequest', () => {
  test('has triggerSource field', () => {
    expectTypeOf<CustomEmailSenderRequest['triggerSource']>().toEqualTypeOf<CustomEmailSenderTriggerSource>();
  });

  test('has userAttributes field', () => {
    expectTypeOf<CustomEmailSenderRequest['userAttributes']>().toEqualTypeOf<UserAttributes>();
  });

  test('has event field', () => {
    expectTypeOf<CustomEmailSenderRequest['event']>().toEqualTypeOf<CustomEmailSenderTriggerEvent>();
  });

  test('has context field', () => {
    expectTypeOf<CustomEmailSenderRequest['context']>().toEqualTypeOf<Context>();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<CustomEmailSenderRequest<CustomAttributes>['userAttributes']>().toEqualTypeOf<CustomAttributes>();
  });
});

suite('CustomEmailSenderResponse', () => {
  test('is undefined', () => {
    expectTypeOf<CustomEmailSenderResponse>().toEqualTypeOf<undefined>();
  });
});

suite('CustomEmailSenderHandler', () => {
  test('accepts CustomEmailSenderRequest and returns Promise<CustomEmailSenderTriggerEvent>', () => {
    expectTypeOf<CustomEmailSenderHandler>().toEqualTypeOf<
      (request: CustomEmailSenderRequest) => Promise<CustomEmailSenderTriggerEvent>
    >();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<CustomEmailSenderHandler<CustomAttributes>>().toEqualTypeOf<
      (request: CustomEmailSenderRequest<CustomAttributes>) => Promise<CustomEmailSenderTriggerEvent>
    >();
  });
});

suite('CustomEmailSenderRouteDefinition', () => {
  test('has optional filters field', () => {
    expectTypeOf<CustomEmailSenderRouteDefinition>().toHaveProperty('filters');
  });

  test('has optional userAttributesSchema field', () => {
    expectTypeOf<CustomEmailSenderRouteDefinition>().toHaveProperty('userAttributesSchema');
  });

  test('has handler field matching CustomEmailSenderHandler', () => {
    expectTypeOf<CustomEmailSenderRouteDefinition['handler']>().toEqualTypeOf<CustomEmailSenderHandler>();
  });

  test('filters use CustomEmailSenderTriggerSource', () => {
    expectTypeOf<NonNullable<CustomEmailSenderRouteDefinition['filters']>>().toEqualTypeOf<
      CognitoFilters<CustomEmailSenderTriggerSource>
    >();
  });
});
