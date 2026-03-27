import { createMockSchema } from '@lambda-event-router/testing';
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
import { defineRoute } from './CognitoRouter.js';
import type {
  CognitoTriggerSource,
  CreateAuthChallengeRequest,
  CustomEmailSenderRequest,
  CustomMessageRequest,
  DefineAuthChallengeRequest,
  PostAuthenticationRequest,
  PostConfirmationRequest,
  PreAuthenticationRequest,
  PreSignUpRequest,
  PreTokenGenerationRequest,
  RouteBuilder,
  TypedRouteDefinition,
  UserAttributes,
  UserMigrationRequest,
  VerifyAuthChallengeResponseRequest,
} from './types/index.js';

suite('defineRoute type inference', () => {
  suite('trigger source narrowing', () => {
    test('narrows handler request to PreSignUpRequest for PreSignUp trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['PreSignUp_SignUp'] },
      });

      type Handler = Parameters<typeof builder.handle>[0];
      type Request = Parameters<Handler>[0];
      type Response = Awaited<ReturnType<Handler>>;

      expectTypeOf<Request>().toEqualTypeOf<PreSignUpRequest>();
      expectTypeOf<Response>().toEqualTypeOf<PreSignUpTriggerEvent>();
    });

    test('narrows handler request to PreAuthenticationRequest for PreAuthentication trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['PreAuthentication_Authentication'] },
      });

      type Handler = Parameters<typeof builder.handle>[0];
      type Request = Parameters<Handler>[0];
      type Response = Awaited<ReturnType<Handler>>;

      expectTypeOf<Request>().toEqualTypeOf<PreAuthenticationRequest>();
      expectTypeOf<Response>().toEqualTypeOf<PreAuthenticationTriggerEvent>();
    });

    test('narrows handler request to PostAuthenticationRequest for PostAuthentication trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['PostAuthentication_Authentication'] },
      });

      type Handler = Parameters<typeof builder.handle>[0];
      type Request = Parameters<Handler>[0];
      type Response = Awaited<ReturnType<Handler>>;

      expectTypeOf<Request>().toEqualTypeOf<PostAuthenticationRequest>();
      expectTypeOf<Response>().toEqualTypeOf<PostAuthenticationTriggerEvent>();
    });

    test('narrows handler request to PostConfirmationRequest for PostConfirmation trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['PostConfirmation_ConfirmSignUp'] },
      });

      type Handler = Parameters<typeof builder.handle>[0];
      type Request = Parameters<Handler>[0];
      type Response = Awaited<ReturnType<Handler>>;

      expectTypeOf<Request>().toEqualTypeOf<PostConfirmationRequest>();
      expectTypeOf<Response>().toEqualTypeOf<PostConfirmationTriggerEvent>();
    });

    test('narrows handler request to DefineAuthChallengeRequest for DefineAuthChallenge trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['DefineAuthChallenge_Authentication'] },
      });

      type Handler = Parameters<typeof builder.handle>[0];
      type Request = Parameters<Handler>[0];
      type Response = Awaited<ReturnType<Handler>>;

      expectTypeOf<Request>().toEqualTypeOf<DefineAuthChallengeRequest>();
      expectTypeOf<Response>().toEqualTypeOf<DefineAuthChallengeTriggerEvent>();
    });

    test('narrows handler request to CreateAuthChallengeRequest for CreateAuthChallenge trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['CreateAuthChallenge_Authentication'] },
      });

      type Handler = Parameters<typeof builder.handle>[0];
      type Request = Parameters<Handler>[0];
      type Response = Awaited<ReturnType<Handler>>;

      expectTypeOf<Request>().toEqualTypeOf<CreateAuthChallengeRequest>();
      expectTypeOf<Response>().toEqualTypeOf<CreateAuthChallengeTriggerEvent>();
    });

    test('narrows handler request to VerifyAuthChallengeResponseRequest for VerifyAuthChallengeResponse trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['VerifyAuthChallengeResponse_Authentication'] },
      });

      type Handler = Parameters<typeof builder.handle>[0];
      type Request = Parameters<Handler>[0];
      type Response = Awaited<ReturnType<Handler>>;

      expectTypeOf<Request>().toEqualTypeOf<VerifyAuthChallengeResponseRequest>();
      expectTypeOf<Response>().toEqualTypeOf<VerifyAuthChallengeResponseTriggerEvent>();
    });

    test('narrows handler request to CustomMessageRequest for CustomMessage trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['CustomMessage_SignUp'] },
      });

      type Handler = Parameters<typeof builder.handle>[0];
      type Request = Parameters<Handler>[0];
      type Response = Awaited<ReturnType<Handler>>;

      expectTypeOf<Request>().toEqualTypeOf<CustomMessageRequest>();
      expectTypeOf<Response>().toEqualTypeOf<CustomMessageTriggerEvent>();
    });

    test('narrows handler request to CustomEmailSenderRequest for CustomEmailSender trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['CustomEmailSender_SignUp'] },
      });

      type Handler = Parameters<typeof builder.handle>[0];
      type Request = Parameters<Handler>[0];
      type Response = Awaited<ReturnType<Handler>>;

      expectTypeOf<Request>().toEqualTypeOf<CustomEmailSenderRequest>();
      expectTypeOf<Response>().toEqualTypeOf<CustomEmailSenderTriggerEvent>();
    });

    test('narrows handler request to PreTokenGenerationRequest for PreTokenGeneration trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['TokenGeneration_HostedAuth'] },
      });

      type Handler = Parameters<typeof builder.handle>[0];
      type Request = Parameters<Handler>[0];
      type Response = Awaited<ReturnType<Handler>>;

      expectTypeOf<Request>().toEqualTypeOf<PreTokenGenerationRequest>();
      expectTypeOf<Response>().toEqualTypeOf<PreTokenGenerationTriggerEvent>();
    });

    test('narrows handler request to UserMigrationRequest for UserMigration trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['UserMigration_Authentication'] },
      });

      type Handler = Parameters<typeof builder.handle>[0];
      type Request = Parameters<Handler>[0];
      type Response = Awaited<ReturnType<Handler>>;

      expectTypeOf<Request>().toEqualTypeOf<UserMigrationRequest>();
      expectTypeOf<Response>().toEqualTypeOf<UserMigrationTriggerEvent>();
    });
  });

  suite('RouteBuilder return type', () => {
    test('returns RouteBuilder narrowed to PreSignUp trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['PreSignUp_SignUp'] },
      });

      expectTypeOf(builder).toEqualTypeOf<RouteBuilder<'PreSignUp_SignUp', UserAttributes>>();
    });

    test('returns RouteBuilder narrowed to PreAuthentication trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['PreAuthentication_Authentication'] },
      });

      expectTypeOf(builder).toEqualTypeOf<RouteBuilder<'PreAuthentication_Authentication', UserAttributes>>();
    });

    test('returns RouteBuilder narrowed to PostAuthentication trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['PostAuthentication_Authentication'] },
      });

      expectTypeOf(builder).toEqualTypeOf<RouteBuilder<'PostAuthentication_Authentication', UserAttributes>>();
    });

    test('returns RouteBuilder narrowed to PostConfirmation trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['PostConfirmation_ConfirmSignUp'] },
      });

      expectTypeOf(builder).toEqualTypeOf<RouteBuilder<'PostConfirmation_ConfirmSignUp', UserAttributes>>();
    });

    test('returns RouteBuilder narrowed to DefineAuthChallenge trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['DefineAuthChallenge_Authentication'] },
      });

      expectTypeOf(builder).toEqualTypeOf<RouteBuilder<'DefineAuthChallenge_Authentication', UserAttributes>>();
    });

    test('returns RouteBuilder narrowed to CreateAuthChallenge trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['CreateAuthChallenge_Authentication'] },
      });

      expectTypeOf(builder).toEqualTypeOf<RouteBuilder<'CreateAuthChallenge_Authentication', UserAttributes>>();
    });

    test('returns RouteBuilder narrowed to VerifyAuthChallengeResponse trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['VerifyAuthChallengeResponse_Authentication'] },
      });

      expectTypeOf(builder).toEqualTypeOf<RouteBuilder<'VerifyAuthChallengeResponse_Authentication', UserAttributes>>();
    });

    test('returns RouteBuilder narrowed to CustomMessage trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['CustomMessage_SignUp'] },
      });

      expectTypeOf(builder).toEqualTypeOf<RouteBuilder<'CustomMessage_SignUp', UserAttributes>>();
    });

    test('returns RouteBuilder narrowed to CustomEmailSender trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['CustomEmailSender_SignUp'] },
      });

      expectTypeOf(builder).toEqualTypeOf<RouteBuilder<'CustomEmailSender_SignUp', UserAttributes>>();
    });

    test('returns RouteBuilder narrowed to PreTokenGeneration trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['TokenGeneration_HostedAuth'] },
      });

      expectTypeOf(builder).toEqualTypeOf<RouteBuilder<'TokenGeneration_HostedAuth', UserAttributes>>();
    });

    test('returns RouteBuilder narrowed to UserMigration trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['UserMigration_Authentication'] },
      });

      expectTypeOf(builder).toEqualTypeOf<RouteBuilder<'UserMigration_Authentication', UserAttributes>>();
    });
  });

  suite('handle() return type', () => {
    test('returns TypedRouteDefinition narrowed to PreSignUp trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['PreSignUp_SignUp'] },
      });

      type HandleReturn = ReturnType<typeof builder.handle>;
      expectTypeOf<HandleReturn>().toEqualTypeOf<TypedRouteDefinition<'PreSignUp_SignUp', UserAttributes>>();
    });

    test('returns TypedRouteDefinition narrowed to PreAuthentication trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['PreAuthentication_Authentication'] },
      });

      type HandleReturn = ReturnType<typeof builder.handle>;
      expectTypeOf<HandleReturn>().toEqualTypeOf<
        TypedRouteDefinition<'PreAuthentication_Authentication', UserAttributes>
      >();
    });

    test('returns TypedRouteDefinition narrowed to PostAuthentication trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['PostAuthentication_Authentication'] },
      });

      type HandleReturn = ReturnType<typeof builder.handle>;
      expectTypeOf<HandleReturn>().toEqualTypeOf<
        TypedRouteDefinition<'PostAuthentication_Authentication', UserAttributes>
      >();
    });

    test('returns TypedRouteDefinition narrowed to PostConfirmation trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['PostConfirmation_ConfirmSignUp'] },
      });

      type HandleReturn = ReturnType<typeof builder.handle>;
      expectTypeOf<HandleReturn>().toEqualTypeOf<
        TypedRouteDefinition<'PostConfirmation_ConfirmSignUp', UserAttributes>
      >();
    });

    test('returns TypedRouteDefinition narrowed to DefineAuthChallenge trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['DefineAuthChallenge_Authentication'] },
      });

      type HandleReturn = ReturnType<typeof builder.handle>;
      expectTypeOf<HandleReturn>().toEqualTypeOf<
        TypedRouteDefinition<'DefineAuthChallenge_Authentication', UserAttributes>
      >();
    });

    test('returns TypedRouteDefinition narrowed to CreateAuthChallenge trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['CreateAuthChallenge_Authentication'] },
      });

      type HandleReturn = ReturnType<typeof builder.handle>;
      expectTypeOf<HandleReturn>().toEqualTypeOf<
        TypedRouteDefinition<'CreateAuthChallenge_Authentication', UserAttributes>
      >();
    });

    test('returns TypedRouteDefinition narrowed to VerifyAuthChallengeResponse trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['VerifyAuthChallengeResponse_Authentication'] },
      });

      type HandleReturn = ReturnType<typeof builder.handle>;
      expectTypeOf<HandleReturn>().toEqualTypeOf<
        TypedRouteDefinition<'VerifyAuthChallengeResponse_Authentication', UserAttributes>
      >();
    });

    test('returns TypedRouteDefinition narrowed to CustomMessage trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['CustomMessage_SignUp'] },
      });

      type HandleReturn = ReturnType<typeof builder.handle>;
      expectTypeOf<HandleReturn>().toEqualTypeOf<TypedRouteDefinition<'CustomMessage_SignUp', UserAttributes>>();
    });

    test('returns TypedRouteDefinition narrowed to CustomEmailSender trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['CustomEmailSender_SignUp'] },
      });

      type HandleReturn = ReturnType<typeof builder.handle>;
      expectTypeOf<HandleReturn>().toEqualTypeOf<TypedRouteDefinition<'CustomEmailSender_SignUp', UserAttributes>>();
    });

    test('returns TypedRouteDefinition narrowed to PreTokenGeneration trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['TokenGeneration_HostedAuth'] },
      });

      type HandleReturn = ReturnType<typeof builder.handle>;
      expectTypeOf<HandleReturn>().toEqualTypeOf<TypedRouteDefinition<'TokenGeneration_HostedAuth', UserAttributes>>();
    });

    test('returns TypedRouteDefinition narrowed to UserMigration trigger', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['UserMigration_Authentication'] },
      });

      type HandleReturn = ReturnType<typeof builder.handle>;
      expectTypeOf<HandleReturn>().toEqualTypeOf<
        TypedRouteDefinition<'UserMigration_Authentication', UserAttributes>
      >();
    });
  });

  suite('multiple trigger sources', () => {
    test('narrows to union when multiple trigger sources from same family', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['PreSignUp_SignUp', 'PreSignUp_AdminCreateUser'] },
      });

      expectTypeOf(builder).toEqualTypeOf<
        RouteBuilder<'PreSignUp_SignUp' | 'PreSignUp_AdminCreateUser', UserAttributes>
      >();

      type Handler = Parameters<typeof builder.handle>[0];
      type Request = Parameters<Handler>[0];
      type Response = Awaited<ReturnType<Handler>>;

      expectTypeOf<Request>().toEqualTypeOf<PreSignUpRequest>();
      expectTypeOf<Response>().toEqualTypeOf<PreSignUpTriggerEvent>();
    });
  });

  suite('defineRoute with no triggerSources', () => {
    test('infers broadest union when no filters provided', () => {
      const builder = defineRoute({});

      expectTypeOf(builder).toEqualTypeOf<RouteBuilder<CognitoTriggerSource, UserAttributes>>();
    });
  });

  suite('user attributes schema inference', () => {
    test('narrows user attributes when schema is provided', () => {
      type CustomAttributes = { email: string; name: string } & Record<string, string>;

      const mockSchema = createMockSchema<CustomAttributes>();

      const builder = defineRoute({
        filters: { triggerSources: ['PreSignUp_SignUp'] },
        userAttributesSchema: mockSchema,
      });

      type Handler = Parameters<typeof builder.handle>[0];
      type Request = Parameters<Handler>[0];

      expectTypeOf<Request['userAttributes']>().toEqualTypeOf<CustomAttributes>();
    });
  });
});
