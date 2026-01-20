import type { Schema } from '@lambda-event-router/base';
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
  CognitoFilters,
  CreateAuthChallengeRequest,
  CreateAuthChallengeTriggerSource,
  CustomEmailSenderRequest,
  CustomEmailSenderTriggerSource,
  CustomMessageRequest,
  CustomMessageTriggerSource,
  DefineAuthChallengeRequest,
  DefineAuthChallengeTriggerSource,
  PostAuthenticationRequest,
  PostAuthenticationTriggerSource,
  PostConfirmationRequest,
  PostConfirmationTriggerSource,
  PreAuthenticationRequest,
  PreAuthenticationTriggerSource,
  PreSignUpRequest,
  PreSignUpTriggerSource,
  PreTokenGenerationRequest,
  PreTokenGenerationTriggerSource,
  UserAttributes,
  UserMigrationRequest,
  UserMigrationTriggerSource,
  VerifyAuthChallengeResponseRequest,
  VerifyAuthChallengeResponseTriggerSource,
} from './index.js';

// Union of all trigger sources
export type CognitoTriggerSource =
  | PreSignUpTriggerSource
  | PreAuthenticationTriggerSource
  | PostAuthenticationTriggerSource
  | PostConfirmationTriggerSource
  | DefineAuthChallengeTriggerSource
  | CreateAuthChallengeTriggerSource
  | VerifyAuthChallengeResponseTriggerSource
  | CustomMessageTriggerSource
  | CustomEmailSenderTriggerSource
  | PreTokenGenerationTriggerSource
  | UserMigrationTriggerSource;

// Union of all Cognito event types
export type CognitoEvent =
  | PreSignUpTriggerEvent
  | PreAuthenticationTriggerEvent
  | PostAuthenticationTriggerEvent
  | PostConfirmationTriggerEvent
  | DefineAuthChallengeTriggerEvent
  | CreateAuthChallengeTriggerEvent
  | VerifyAuthChallengeResponseTriggerEvent
  | CustomMessageTriggerEvent
  | CustomEmailSenderTriggerEvent
  | PreTokenGenerationTriggerEvent
  | UserMigrationTriggerEvent;

// =============================================================================
// Generic types for route() method
// =============================================================================

// Generic Cognito request type for handlers
export type CognitoRequest<TUserAttributes extends UserAttributes = UserAttributes> =
  | PreSignUpRequest<TUserAttributes>
  | PreAuthenticationRequest<TUserAttributes>
  | PostAuthenticationRequest<TUserAttributes>
  | PostConfirmationRequest<TUserAttributes>
  | DefineAuthChallengeRequest<TUserAttributes>
  | CreateAuthChallengeRequest<TUserAttributes>
  | VerifyAuthChallengeResponseRequest<TUserAttributes>
  | CustomMessageRequest<TUserAttributes>
  | CustomEmailSenderRequest<TUserAttributes>
  | PreTokenGenerationRequest<TUserAttributes>
  | UserMigrationRequest<TUserAttributes>;

// Route definition for generic .route() method
// Handlers receive a cloned event, modify it, and return it
export interface CognitoRouteDefinition<TUserAttributes extends UserAttributes> {
  filters?: CognitoFilters;
  userAttributesSchema?: Schema<TUserAttributes>;
  handler: (request: CognitoRequest<TUserAttributes>) => Promise<CognitoEvent>;
}

// =============================================================================
// Type mappings for defineRoute()
// =============================================================================

// Type mapping: trigger source -> request type
export type RequestForTrigger<
  TTrigger extends CognitoTriggerSource,
  TUserAttributes extends UserAttributes = UserAttributes,
> = TTrigger extends PreSignUpTriggerSource
  ? PreSignUpRequest<TUserAttributes>
  : TTrigger extends PreAuthenticationTriggerSource
    ? PreAuthenticationRequest<TUserAttributes>
    : TTrigger extends PostAuthenticationTriggerSource
      ? PostAuthenticationRequest<TUserAttributes>
      : TTrigger extends PostConfirmationTriggerSource
        ? PostConfirmationRequest<TUserAttributes>
        : TTrigger extends DefineAuthChallengeTriggerSource
          ? DefineAuthChallengeRequest<TUserAttributes>
          : TTrigger extends CreateAuthChallengeTriggerSource
            ? CreateAuthChallengeRequest<TUserAttributes>
            : TTrigger extends VerifyAuthChallengeResponseTriggerSource
              ? VerifyAuthChallengeResponseRequest<TUserAttributes>
              : TTrigger extends CustomMessageTriggerSource
                ? CustomMessageRequest<TUserAttributes>
                : TTrigger extends CustomEmailSenderTriggerSource
                  ? CustomEmailSenderRequest<TUserAttributes>
                  : TTrigger extends PreTokenGenerationTriggerSource
                    ? PreTokenGenerationRequest<TUserAttributes>
                    : TTrigger extends UserMigrationTriggerSource
                      ? UserMigrationRequest<TUserAttributes>
                      : never;

// Type mapping: trigger source -> event type
export type EventForTrigger<TTrigger extends CognitoTriggerSource> = TTrigger extends PreSignUpTriggerSource
  ? PreSignUpTriggerEvent
  : TTrigger extends PreAuthenticationTriggerSource
    ? PreAuthenticationTriggerEvent
    : TTrigger extends PostAuthenticationTriggerSource
      ? PostAuthenticationTriggerEvent
      : TTrigger extends PostConfirmationTriggerSource
        ? PostConfirmationTriggerEvent
        : TTrigger extends DefineAuthChallengeTriggerSource
          ? DefineAuthChallengeTriggerEvent
          : TTrigger extends CreateAuthChallengeTriggerSource
            ? CreateAuthChallengeTriggerEvent
            : TTrigger extends VerifyAuthChallengeResponseTriggerSource
              ? VerifyAuthChallengeResponseTriggerEvent
              : TTrigger extends CustomMessageTriggerSource
                ? CustomMessageTriggerEvent
                : TTrigger extends CustomEmailSenderTriggerSource
                  ? CustomEmailSenderTriggerEvent
                  : TTrigger extends PreTokenGenerationTriggerSource
                    ? PreTokenGenerationTriggerEvent
                    : TTrigger extends UserMigrationTriggerSource
                      ? UserMigrationTriggerEvent
                      : never;

// =============================================================================
// Route definition types
// =============================================================================

// Route definition returned by defineRoute().handle()
// Handlers receive a cloned event, modify it, and return it
export interface TypedRouteDefinition<
  TTrigger extends CognitoTriggerSource,
  TUserAttributes extends UserAttributes = UserAttributes,
> {
  filters?: CognitoFilters<TTrigger>;
  userAttributesSchema?: Schema<TUserAttributes>;
  handler: (request: RequestForTrigger<TTrigger, TUserAttributes>) => Promise<EventForTrigger<TTrigger>>;
}

// Input filters for defineRoute
export interface RouteInputFilters<TTrigger extends CognitoTriggerSource> {
  triggerSources?: readonly TTrigger[];
  userPoolIds?: readonly string[];
  clientIds?: readonly string[];
  userAttributes?: Record<string, string | RegExp | ((value: string) => boolean)>;
}

// Input for defineRoute
export interface RouteInput<
  TTrigger extends CognitoTriggerSource,
  TUserAttributesSchema extends Schema<unknown> | undefined = undefined,
> {
  filters?: RouteInputFilters<TTrigger>;
  userAttributesSchema?: TUserAttributesSchema;
}

// Route builder returned by defineRoute
// Handlers receive a cloned event, modify it, and return it
export interface RouteBuilder<TTrigger extends CognitoTriggerSource, TUserAttributes extends UserAttributes> {
  handle(
    handler: (request: RequestForTrigger<TTrigger, TUserAttributes>) => Promise<EventForTrigger<TTrigger>>,
  ): TypedRouteDefinition<TTrigger, TUserAttributes>;
}
