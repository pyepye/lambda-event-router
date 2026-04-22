import type { CustomEmailSenderTriggerEvent } from 'aws-lambda';

import { testCognitoTriggerTypes } from './common.type.test.js';
import type {
  CustomEmailSenderHandler,
  CustomEmailSenderRequest,
  CustomEmailSenderResponse,
  CustomEmailSenderRouteDefinition,
  CustomEmailSenderTriggerSource,
} from './index.js';

type CustomAttributes = { email: string } & Record<string, string>;

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

suite('CustomEmailSenderResponse', () => {
  test('is undefined', () => {
    expectTypeOf<CustomEmailSenderResponse>().toEqualTypeOf<undefined>();
  });
});

testCognitoTriggerTypes<
  CustomEmailSenderTriggerSource,
  CustomEmailSenderTriggerEvent,
  CustomEmailSenderRequest,
  CustomEmailSenderRequest<CustomAttributes>,
  CustomEmailSenderHandler,
  CustomEmailSenderHandler<CustomAttributes>,
  CustomEmailSenderRouteDefinition
>('CustomEmailSender');
