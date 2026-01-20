// Common types
export type { CognitoFilterInput, CognitoFilters, UserAttributeFilter, UserAttributes } from './common.js';

// PreSignUp types
export type {
  PreSignUpHandler,
  PreSignUpRequest,
  PreSignUpResponse,
  PreSignUpRouteDefinition,
  PreSignUpTriggerSource,
} from './preSignUp.js';

// Authentication types (Pre, Post, DefineChallenge, CreateChallenge, VerifyChallenge)
export type {
  // Trigger sources
  CreateAuthChallengeTriggerSource,
  DefineAuthChallengeTriggerSource,
  PostAuthenticationTriggerSource,
  PreAuthenticationTriggerSource,
  VerifyAuthChallengeResponseTriggerSource,
  // PreAuthentication
  PreAuthenticationHandler,
  PreAuthenticationRequest,
  PreAuthenticationResponse,
  PreAuthenticationRouteDefinition,
  // PostAuthentication
  PostAuthenticationHandler,
  PostAuthenticationRequest,
  PostAuthenticationResponse,
  PostAuthenticationRouteDefinition,
  // DefineAuthChallenge
  DefineAuthChallengeHandler,
  DefineAuthChallengeRequest,
  DefineAuthChallengeResponse,
  DefineAuthChallengeRouteDefinition,
  // CreateAuthChallenge
  CreateAuthChallengeHandler,
  CreateAuthChallengeRequest,
  CreateAuthChallengeResponse,
  CreateAuthChallengeRouteDefinition,
  // VerifyAuthChallengeResponse
  VerifyAuthChallengeResponseHandler,
  VerifyAuthChallengeResponseRequest,
  VerifyAuthChallengeResponseResponse,
  VerifyAuthChallengeResponseRouteDefinition,
} from './authentication.js';

// PostConfirmation types
export type {
  PostConfirmationHandler,
  PostConfirmationRequest,
  PostConfirmationResponse,
  PostConfirmationRouteDefinition,
  PostConfirmationTriggerSource,
} from './postConfirmation.js';

// CustomMessage types
export type {
  CustomMessageHandler,
  CustomMessageRequest,
  CustomMessageResponse,
  CustomMessageRouteDefinition,
  CustomMessageTriggerSource,
} from './customMessage.js';

// CustomEmailSender types
export type {
  CustomEmailSenderHandler,
  CustomEmailSenderRequest,
  CustomEmailSenderResponse,
  CustomEmailSenderRouteDefinition,
  CustomEmailSenderTriggerSource,
} from './customEmailSender.js';

// PreTokenGeneration types
export type {
  PreTokenGenerationHandler,
  PreTokenGenerationRequest,
  PreTokenGenerationResponse,
  PreTokenGenerationRouteDefinition,
  PreTokenGenerationTriggerSource,
} from './preTokenGeneration.js';

// UserMigration types
export type {
  UserMigrationHandler,
  UserMigrationRequest,
  UserMigrationResponse,
  UserMigrationRouteDefinition,
  UserMigrationTriggerSource,
} from './userMigration.js';

// Router types
export type {
  CognitoEvent,
  CognitoRequest,
  CognitoRouteDefinition,
  CognitoTriggerSource,
  EventForTrigger,
  RequestForTrigger,
  RouteBuilder,
  RouteInput,
  TypedRouteDefinition,
} from './router.js';
