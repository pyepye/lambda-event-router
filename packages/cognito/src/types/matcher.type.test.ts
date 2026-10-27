import type {
  CreateAuthChallengeTriggerEvent,
  CustomEmailSenderTriggerEvent,
  CustomMessageTriggerEvent,
  DefineAuthChallengeTriggerEvent,
  PostAuthenticationTriggerEvent,
  PostConfirmationTriggerEvent,
  PreAuthenticationTriggerEvent,
  PreSignUpTriggerEvent,
  PreTokenGenerationTriggerEvent,
  UserMigrationTriggerEvent,
  VerifyAuthChallengeResponseTriggerEvent,
} from 'aws-lambda';

import type {
  CreateAuthChallengeRequest,
  CustomEmailSenderRequest,
  CustomMessageRequest,
  DefineAuthChallengeRequest,
  EventForTrigger,
  PostAuthenticationRequest,
  PostConfirmationRequest,
  PreAuthenticationRequest,
  PreSignUpRequest,
  PreTokenGenerationRequest,
  RequestForTrigger,
  UserMigrationRequest,
  VerifyAuthChallengeResponseRequest,
} from './index.js';

suite('RequestForTrigger', () => {
  test('maps PreSignUp trigger to PreSignUpRequest', () => {
    expectTypeOf<RequestForTrigger<'PreSignUp_SignUp'>>().toEqualTypeOf<PreSignUpRequest>();
  });

  test('maps all PreSignUp variants to PreSignUpRequest', () => {
    expectTypeOf<RequestForTrigger<'PreSignUp_AdminCreateUser'>>().toEqualTypeOf<PreSignUpRequest>();
    expectTypeOf<RequestForTrigger<'PreSignUp_ExternalProvider'>>().toEqualTypeOf<PreSignUpRequest>();
  });

  test('maps PreAuthentication trigger to PreAuthenticationRequest', () => {
    expectTypeOf<RequestForTrigger<'PreAuthentication_Authentication'>>().toEqualTypeOf<PreAuthenticationRequest>();
  });

  test('maps PostAuthentication trigger to PostAuthenticationRequest', () => {
    expectTypeOf<RequestForTrigger<'PostAuthentication_Authentication'>>().toEqualTypeOf<PostAuthenticationRequest>();
  });

  test('maps PostConfirmation trigger to PostConfirmationRequest', () => {
    expectTypeOf<RequestForTrigger<'PostConfirmation_ConfirmSignUp'>>().toEqualTypeOf<PostConfirmationRequest>();
    expectTypeOf<
      RequestForTrigger<'PostConfirmation_ConfirmForgotPassword'>
    >().toEqualTypeOf<PostConfirmationRequest>();
  });

  test('maps DefineAuthChallenge trigger to DefineAuthChallengeRequest', () => {
    expectTypeOf<RequestForTrigger<'DefineAuthChallenge_Authentication'>>().toEqualTypeOf<DefineAuthChallengeRequest>();
  });

  test('maps CreateAuthChallenge trigger to CreateAuthChallengeRequest', () => {
    expectTypeOf<RequestForTrigger<'CreateAuthChallenge_Authentication'>>().toEqualTypeOf<CreateAuthChallengeRequest>();
  });

  test('maps VerifyAuthChallengeResponse trigger to VerifyAuthChallengeResponseRequest', () => {
    expectTypeOf<
      RequestForTrigger<'VerifyAuthChallengeResponse_Authentication'>
    >().toEqualTypeOf<VerifyAuthChallengeResponseRequest>();
  });

  test('maps CustomMessage trigger to CustomMessageRequest', () => {
    expectTypeOf<RequestForTrigger<'CustomMessage_SignUp'>>().toEqualTypeOf<CustomMessageRequest>();
  });

  test('maps all CustomMessage variants to CustomMessageRequest', () => {
    expectTypeOf<RequestForTrigger<'CustomMessage_AdminCreateUser'>>().toEqualTypeOf<CustomMessageRequest>();
    expectTypeOf<RequestForTrigger<'CustomMessage_ResendCode'>>().toEqualTypeOf<CustomMessageRequest>();
    expectTypeOf<RequestForTrigger<'CustomMessage_ForgotPassword'>>().toEqualTypeOf<CustomMessageRequest>();
    expectTypeOf<RequestForTrigger<'CustomMessage_UpdateUserAttribute'>>().toEqualTypeOf<CustomMessageRequest>();
    expectTypeOf<RequestForTrigger<'CustomMessage_VerifyUserAttribute'>>().toEqualTypeOf<CustomMessageRequest>();
    expectTypeOf<RequestForTrigger<'CustomMessage_Authentication'>>().toEqualTypeOf<CustomMessageRequest>();
  });

  test('maps CustomEmailSender trigger to CustomEmailSenderRequest', () => {
    expectTypeOf<RequestForTrigger<'CustomEmailSender_SignUp'>>().toEqualTypeOf<CustomEmailSenderRequest>();
  });

  test('maps all CustomEmailSender variants to CustomEmailSenderRequest', () => {
    expectTypeOf<RequestForTrigger<'CustomEmailSender_ResendCode'>>().toEqualTypeOf<CustomEmailSenderRequest>();
    expectTypeOf<RequestForTrigger<'CustomEmailSender_ForgotPassword'>>().toEqualTypeOf<CustomEmailSenderRequest>();
    expectTypeOf<
      RequestForTrigger<'CustomEmailSender_UpdateUserAttribute'>
    >().toEqualTypeOf<CustomEmailSenderRequest>();
    expectTypeOf<
      RequestForTrigger<'CustomEmailSender_VerifyUserAttribute'>
    >().toEqualTypeOf<CustomEmailSenderRequest>();
    expectTypeOf<RequestForTrigger<'CustomEmailSender_AdminCreateUser'>>().toEqualTypeOf<CustomEmailSenderRequest>();
    expectTypeOf<RequestForTrigger<'CustomEmailSender_Authentication'>>().toEqualTypeOf<CustomEmailSenderRequest>();
    expectTypeOf<
      RequestForTrigger<'CustomEmailSender_AccountTakeOverNotification'>
    >().toEqualTypeOf<CustomEmailSenderRequest>();
  });

  test('maps PreTokenGeneration trigger to PreTokenGenerationRequest', () => {
    expectTypeOf<RequestForTrigger<'TokenGeneration_HostedAuth'>>().toEqualTypeOf<PreTokenGenerationRequest>();
  });

  test('maps all PreTokenGeneration variants to PreTokenGenerationRequest', () => {
    expectTypeOf<RequestForTrigger<'TokenGeneration_Authentication'>>().toEqualTypeOf<PreTokenGenerationRequest>();
    expectTypeOf<
      RequestForTrigger<'TokenGeneration_NewPasswordChallenge'>
    >().toEqualTypeOf<PreTokenGenerationRequest>();
    expectTypeOf<RequestForTrigger<'TokenGeneration_AuthenticateDevice'>>().toEqualTypeOf<PreTokenGenerationRequest>();
    expectTypeOf<RequestForTrigger<'TokenGeneration_RefreshTokens'>>().toEqualTypeOf<PreTokenGenerationRequest>();
  });

  test('maps UserMigration trigger to UserMigrationRequest', () => {
    expectTypeOf<RequestForTrigger<'UserMigration_Authentication'>>().toEqualTypeOf<UserMigrationRequest>();
  });

  test('maps all UserMigration variants to UserMigrationRequest', () => {
    expectTypeOf<RequestForTrigger<'UserMigration_ForgotPassword'>>().toEqualTypeOf<UserMigrationRequest>();
  });

  test('preserves custom user attributes generic for PreSignUp', () => {
    type CustomAttributes = { email: string; name: string } & Record<string, string>;
    expectTypeOf<RequestForTrigger<'PreSignUp_SignUp', CustomAttributes>>().toEqualTypeOf<
      PreSignUpRequest<CustomAttributes>
    >();
  });

  test('preserves custom user attributes generic for PreAuthentication', () => {
    type CustomAttributes = { email: string; name: string } & Record<string, string>;
    expectTypeOf<RequestForTrigger<'PreAuthentication_Authentication', CustomAttributes>>().toEqualTypeOf<
      PreAuthenticationRequest<CustomAttributes>
    >();
  });

  test('preserves custom user attributes generic for CustomMessage', () => {
    type CustomAttributes = { email: string; name: string } & Record<string, string>;
    expectTypeOf<RequestForTrigger<'CustomMessage_SignUp', CustomAttributes>>().toEqualTypeOf<
      CustomMessageRequest<CustomAttributes>
    >();
  });

  test('preserves custom user attributes generic for UserMigration', () => {
    type CustomAttributes = { email: string; name: string } & Record<string, string>;
    expectTypeOf<RequestForTrigger<'UserMigration_Authentication', CustomAttributes>>().toEqualTypeOf<
      UserMigrationRequest<CustomAttributes>
    >();
  });

  test('resolves cross-family union to union of request types', () => {
    expectTypeOf<RequestForTrigger<'PreSignUp_SignUp' | 'PostAuthentication_Authentication'>>().toEqualTypeOf<
      PreSignUpRequest | PostAuthenticationRequest
    >();
  });
});

suite('EventForTrigger', () => {
  test('maps PreSignUp trigger to PreSignUpTriggerEvent', () => {
    expectTypeOf<EventForTrigger<'PreSignUp_SignUp'>>().toEqualTypeOf<PreSignUpTriggerEvent>();
  });

  test('maps all PreSignUp variants to PreSignUpTriggerEvent', () => {
    expectTypeOf<EventForTrigger<'PreSignUp_AdminCreateUser'>>().toEqualTypeOf<PreSignUpTriggerEvent>();
    expectTypeOf<EventForTrigger<'PreSignUp_ExternalProvider'>>().toEqualTypeOf<PreSignUpTriggerEvent>();
  });

  test('maps PreAuthentication trigger to PreAuthenticationTriggerEvent', () => {
    expectTypeOf<EventForTrigger<'PreAuthentication_Authentication'>>().toEqualTypeOf<PreAuthenticationTriggerEvent>();
  });

  test('maps PostAuthentication trigger to PostAuthenticationTriggerEvent', () => {
    expectTypeOf<
      EventForTrigger<'PostAuthentication_Authentication'>
    >().toEqualTypeOf<PostAuthenticationTriggerEvent>();
  });

  test('maps PostConfirmation trigger to PostConfirmationTriggerEvent', () => {
    expectTypeOf<EventForTrigger<'PostConfirmation_ConfirmSignUp'>>().toEqualTypeOf<PostConfirmationTriggerEvent>();
  });

  test('maps all PostConfirmation variants to PostConfirmationTriggerEvent', () => {
    expectTypeOf<
      EventForTrigger<'PostConfirmation_ConfirmForgotPassword'>
    >().toEqualTypeOf<PostConfirmationTriggerEvent>();
  });

  test('maps DefineAuthChallenge trigger to DefineAuthChallengeTriggerEvent', () => {
    expectTypeOf<
      EventForTrigger<'DefineAuthChallenge_Authentication'>
    >().toEqualTypeOf<DefineAuthChallengeTriggerEvent>();
  });

  test('maps CreateAuthChallenge trigger to CreateAuthChallengeTriggerEvent', () => {
    expectTypeOf<
      EventForTrigger<'CreateAuthChallenge_Authentication'>
    >().toEqualTypeOf<CreateAuthChallengeTriggerEvent>();
  });

  test('maps VerifyAuthChallengeResponse trigger to VerifyAuthChallengeResponseTriggerEvent', () => {
    expectTypeOf<
      EventForTrigger<'VerifyAuthChallengeResponse_Authentication'>
    >().toEqualTypeOf<VerifyAuthChallengeResponseTriggerEvent>();
  });

  test('maps CustomMessage trigger to CustomMessageTriggerEvent', () => {
    expectTypeOf<EventForTrigger<'CustomMessage_SignUp'>>().toEqualTypeOf<CustomMessageTriggerEvent>();
  });

  test('maps all CustomMessage variants to CustomMessageTriggerEvent', () => {
    expectTypeOf<EventForTrigger<'CustomMessage_AdminCreateUser'>>().toEqualTypeOf<CustomMessageTriggerEvent>();
    expectTypeOf<EventForTrigger<'CustomMessage_ResendCode'>>().toEqualTypeOf<CustomMessageTriggerEvent>();
    expectTypeOf<EventForTrigger<'CustomMessage_ForgotPassword'>>().toEqualTypeOf<CustomMessageTriggerEvent>();
    expectTypeOf<EventForTrigger<'CustomMessage_UpdateUserAttribute'>>().toEqualTypeOf<CustomMessageTriggerEvent>();
    expectTypeOf<EventForTrigger<'CustomMessage_VerifyUserAttribute'>>().toEqualTypeOf<CustomMessageTriggerEvent>();
    expectTypeOf<EventForTrigger<'CustomMessage_Authentication'>>().toEqualTypeOf<CustomMessageTriggerEvent>();
  });

  test('maps CustomEmailSender trigger to CustomEmailSenderTriggerEvent', () => {
    expectTypeOf<EventForTrigger<'CustomEmailSender_SignUp'>>().toEqualTypeOf<CustomEmailSenderTriggerEvent>();
  });

  test('maps all CustomEmailSender variants to CustomEmailSenderTriggerEvent', () => {
    expectTypeOf<EventForTrigger<'CustomEmailSender_ResendCode'>>().toEqualTypeOf<CustomEmailSenderTriggerEvent>();
    expectTypeOf<EventForTrigger<'CustomEmailSender_ForgotPassword'>>().toEqualTypeOf<CustomEmailSenderTriggerEvent>();
    expectTypeOf<
      EventForTrigger<'CustomEmailSender_UpdateUserAttribute'>
    >().toEqualTypeOf<CustomEmailSenderTriggerEvent>();
    expectTypeOf<
      EventForTrigger<'CustomEmailSender_VerifyUserAttribute'>
    >().toEqualTypeOf<CustomEmailSenderTriggerEvent>();
    expectTypeOf<EventForTrigger<'CustomEmailSender_AdminCreateUser'>>().toEqualTypeOf<CustomEmailSenderTriggerEvent>();
    expectTypeOf<EventForTrigger<'CustomEmailSender_Authentication'>>().toEqualTypeOf<CustomEmailSenderTriggerEvent>();
    expectTypeOf<
      EventForTrigger<'CustomEmailSender_AccountTakeOverNotification'>
    >().toEqualTypeOf<CustomEmailSenderTriggerEvent>();
  });

  test('maps PreTokenGeneration trigger to PreTokenGenerationTriggerEvent', () => {
    expectTypeOf<EventForTrigger<'TokenGeneration_HostedAuth'>>().toEqualTypeOf<PreTokenGenerationTriggerEvent>();
  });

  test('maps all PreTokenGeneration variants to PreTokenGenerationTriggerEvent', () => {
    expectTypeOf<EventForTrigger<'TokenGeneration_Authentication'>>().toEqualTypeOf<PreTokenGenerationTriggerEvent>();
    expectTypeOf<
      EventForTrigger<'TokenGeneration_NewPasswordChallenge'>
    >().toEqualTypeOf<PreTokenGenerationTriggerEvent>();
    expectTypeOf<
      EventForTrigger<'TokenGeneration_AuthenticateDevice'>
    >().toEqualTypeOf<PreTokenGenerationTriggerEvent>();
    expectTypeOf<EventForTrigger<'TokenGeneration_RefreshTokens'>>().toEqualTypeOf<PreTokenGenerationTriggerEvent>();
  });

  test('maps UserMigration trigger to UserMigrationTriggerEvent', () => {
    expectTypeOf<EventForTrigger<'UserMigration_Authentication'>>().toEqualTypeOf<UserMigrationTriggerEvent>();
  });

  test('maps all UserMigration variants to UserMigrationTriggerEvent', () => {
    expectTypeOf<EventForTrigger<'UserMigration_ForgotPassword'>>().toEqualTypeOf<UserMigrationTriggerEvent>();
  });
});
