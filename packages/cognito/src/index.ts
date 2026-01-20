// Router exports
export { CognitoRouter, createCognitoRouter, defineRoute } from './CognitoRouter.js';
export type { CognitoRequest, CognitoRouteDefinition, TypedRouteDefinition } from './CognitoRouter.js';

// Re-export Schema for convenience
export type { Schema } from '@lambda-event-router/base';

// All type exports
export type {
  // Common
  CognitoEvent,
  CognitoFilterInput,
  CognitoFilters,
  CognitoTriggerSource,
  UserAttributeFilter,
  UserAttributes,
  // CreateAuthChallenge
  CreateAuthChallengeHandler,
  CreateAuthChallengeRequest,
  CreateAuthChallengeResponse,
  CreateAuthChallengeRouteDefinition,
  CreateAuthChallengeTriggerSource,
  // CustomMessage
  CustomMessageHandler,
  CustomMessageRequest,
  CustomMessageResponse,
  CustomMessageRouteDefinition,
  CustomMessageTriggerSource,
  // CustomEmailSender
  CustomEmailSenderHandler,
  CustomEmailSenderRequest,
  CustomEmailSenderResponse,
  CustomEmailSenderRouteDefinition,
  CustomEmailSenderTriggerSource,
  // DefineAuthChallenge
  DefineAuthChallengeHandler,
  DefineAuthChallengeRequest,
  DefineAuthChallengeResponse,
  DefineAuthChallengeRouteDefinition,
  DefineAuthChallengeTriggerSource,
  // PostAuthentication
  PostAuthenticationHandler,
  PostAuthenticationRequest,
  PostAuthenticationResponse,
  PostAuthenticationRouteDefinition,
  PostAuthenticationTriggerSource,
  // PostConfirmation
  PostConfirmationHandler,
  PostConfirmationRequest,
  PostConfirmationResponse,
  PostConfirmationRouteDefinition,
  PostConfirmationTriggerSource,
  // PreAuthentication
  PreAuthenticationHandler,
  PreAuthenticationRequest,
  PreAuthenticationResponse,
  PreAuthenticationRouteDefinition,
  PreAuthenticationTriggerSource,
  // PreSignUp
  PreSignUpHandler,
  PreSignUpRequest,
  PreSignUpResponse,
  PreSignUpRouteDefinition,
  PreSignUpTriggerSource,
  // PreTokenGeneration
  PreTokenGenerationHandler,
  PreTokenGenerationRequest,
  PreTokenGenerationResponse,
  PreTokenGenerationRouteDefinition,
  PreTokenGenerationTriggerSource,
  // UserMigration
  UserMigrationHandler,
  UserMigrationRequest,
  UserMigrationResponse,
  UserMigrationRouteDefinition,
  UserMigrationTriggerSource,
  // VerifyAuthChallengeResponse
  VerifyAuthChallengeResponseHandler,
  VerifyAuthChallengeResponseRequest,
  VerifyAuthChallengeResponseResponse,
  VerifyAuthChallengeResponseRouteDefinition,
  VerifyAuthChallengeResponseTriggerSource,
} from './types/index.js';
