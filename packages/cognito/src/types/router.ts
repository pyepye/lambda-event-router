import type { StandardSchemaV1 } from '@standard-schema/spec';
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
  userAttributesSchema?: StandardSchemaV1<unknown, TUserAttributes>;
  handler: (request: CognitoRequest<TUserAttributes>) => Promise<CognitoEvent>;
}

// =============================================================================
// Type mappings for defineRoute()
// =============================================================================

// Mapped type: trigger source -> request type
type TriggerRequestMap<TUserAttributes extends UserAttributes = UserAttributes> = {
  [K in PreSignUpTriggerSource]: PreSignUpRequest<TUserAttributes>;
} & { [K in PreAuthenticationTriggerSource]: PreAuthenticationRequest<TUserAttributes> } & {
  [K in PostAuthenticationTriggerSource]: PostAuthenticationRequest<TUserAttributes>;
} & { [K in PostConfirmationTriggerSource]: PostConfirmationRequest<TUserAttributes> } & {
  [K in DefineAuthChallengeTriggerSource]: DefineAuthChallengeRequest<TUserAttributes>;
} & { [K in CreateAuthChallengeTriggerSource]: CreateAuthChallengeRequest<TUserAttributes> } & {
  [K in VerifyAuthChallengeResponseTriggerSource]: VerifyAuthChallengeResponseRequest<TUserAttributes>;
} & { [K in CustomMessageTriggerSource]: CustomMessageRequest<TUserAttributes> } & {
  [K in CustomEmailSenderTriggerSource]: CustomEmailSenderRequest<TUserAttributes>;
} & { [K in PreTokenGenerationTriggerSource]: PreTokenGenerationRequest<TUserAttributes> } & {
  [K in UserMigrationTriggerSource]: UserMigrationRequest<TUserAttributes>;
};

export type RequestForTrigger<
  TTrigger extends CognitoTriggerSource,
  TUserAttributes extends UserAttributes = UserAttributes,
> = TriggerRequestMap<TUserAttributes>[TTrigger];

// Mapped type: trigger source -> event type
type TriggerEventMap = { [K in PreSignUpTriggerSource]: PreSignUpTriggerEvent } & {
  [K in PreAuthenticationTriggerSource]: PreAuthenticationTriggerEvent;
} & { [K in PostAuthenticationTriggerSource]: PostAuthenticationTriggerEvent } & {
  [K in PostConfirmationTriggerSource]: PostConfirmationTriggerEvent;
} & { [K in DefineAuthChallengeTriggerSource]: DefineAuthChallengeTriggerEvent } & {
  [K in CreateAuthChallengeTriggerSource]: CreateAuthChallengeTriggerEvent;
} & { [K in VerifyAuthChallengeResponseTriggerSource]: VerifyAuthChallengeResponseTriggerEvent } & {
  [K in CustomMessageTriggerSource]: CustomMessageTriggerEvent;
} & { [K in CustomEmailSenderTriggerSource]: CustomEmailSenderTriggerEvent } & {
  [K in PreTokenGenerationTriggerSource]: PreTokenGenerationTriggerEvent;
} & { [K in UserMigrationTriggerSource]: UserMigrationTriggerEvent };

export type EventForTrigger<TTrigger extends CognitoTriggerSource> = TriggerEventMap[TTrigger];

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
  userAttributesSchema?: StandardSchemaV1<unknown, TUserAttributes>;
  handler: (request: RequestForTrigger<TTrigger, TUserAttributes>) => Promise<EventForTrigger<TTrigger>>;
}

// Input filters for defineRoute
export interface RouteInputFilters<TTrigger extends CognitoTriggerSource> {
  triggerSources?: readonly TTrigger[];
  userPoolIds?: readonly PreSignUpTriggerEvent['userPoolId'][];
  clientIds?: readonly PreSignUpTriggerEvent['callerContext']['clientId'][];
  userAttributes?: Record<string, string | RegExp | ((value: string) => boolean)>;
}

// Input for defineRoute
export interface RouteInput<
  TTrigger extends CognitoTriggerSource,
  TUserAttributesSchema extends StandardSchemaV1 | undefined = undefined,
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
