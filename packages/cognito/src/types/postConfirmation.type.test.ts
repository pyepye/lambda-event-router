import type { PostConfirmationTriggerEvent } from 'aws-lambda';
import { testCognitoTriggerTypes } from './common.type.test.js';
import type {
  PostConfirmationHandler,
  PostConfirmationRequest,
  PostConfirmationResponse,
  PostConfirmationRouteDefinition,
  PostConfirmationTriggerSource,
} from './index.js';

type CustomAttributes = { email: string } & Record<string, string>;

suite('PostConfirmationTriggerSource', () => {
  test('resolves to expected literals', () => {
    expectTypeOf<PostConfirmationTriggerSource>().toEqualTypeOf<
      'PostConfirmation_ConfirmSignUp' | 'PostConfirmation_ConfirmForgotPassword'
    >();
  });
});

suite('PostConfirmationResponse', () => {
  test('is undefined', () => {
    expectTypeOf<PostConfirmationResponse>().toEqualTypeOf<undefined>();
  });
});

testCognitoTriggerTypes<
  PostConfirmationTriggerSource,
  PostConfirmationTriggerEvent,
  PostConfirmationRequest,
  PostConfirmationRequest<CustomAttributes>,
  PostConfirmationHandler,
  PostConfirmationHandler<CustomAttributes>,
  PostConfirmationRouteDefinition
>('PostConfirmation');
