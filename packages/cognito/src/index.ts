// Router exports

export type { CognitoRequest, CognitoRouteDefinition, TypedRouteDefinition } from './CognitoRouter.js';
export { CognitoRouter, createCognitoRouter, defineRoute } from './CognitoRouter.js';
// All type exports
export type {
  // Common
  CognitoEvent,
  CognitoFilterInput,
  CognitoFilters,
  CognitoMiddleware,
  CognitoRouterOptions,
  CognitoTriggerSource,
  // CreateAuthChallenge
  CreateAuthChallengeHandler,
  CreateAuthChallengeRequest,
  CreateAuthChallengeResponse,
  CreateAuthChallengeRouteDefinition,
  CreateAuthChallengeTriggerSource,
  // CustomEmailSender
  CustomEmailSenderHandler,
  CustomEmailSenderRequest,
  CustomEmailSenderResponse,
  CustomEmailSenderRouteDefinition,
  CustomEmailSenderTriggerSource,
  // CustomMessage
  CustomMessageHandler,
  CustomMessageRequest,
  CustomMessageResponse,
  CustomMessageRouteDefinition,
  CustomMessageTriggerSource,
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
  UserAttributeFilter,
  UserAttributes,
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
