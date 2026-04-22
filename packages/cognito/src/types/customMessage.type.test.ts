import type { CustomMessageTriggerEvent } from 'aws-lambda';

import { testCognitoTriggerTypes } from './common.type.test.js';
import type {
  CustomMessageHandler,
  CustomMessageRequest,
  CustomMessageResponse,
  CustomMessageRouteDefinition,
  CustomMessageTriggerSource,
} from './index.js';

type CustomAttributes = { email: string } & Record<string, string>;

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

suite('CustomMessageResponse', () => {
  test('matches event response type', () => {
    expectTypeOf<CustomMessageResponse>().toEqualTypeOf<CustomMessageTriggerEvent['response']>();
  });
});

testCognitoTriggerTypes<
  CustomMessageTriggerSource,
  CustomMessageTriggerEvent,
  CustomMessageRequest,
  CustomMessageRequest<CustomAttributes>,
  CustomMessageHandler,
  CustomMessageHandler<CustomAttributes>,
  CustomMessageRouteDefinition
>('CustomMessage');
