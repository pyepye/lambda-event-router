import type {
  Context,
  CreateAuthChallengeTriggerEvent,
  DefineAuthChallengeTriggerEvent,
  PostAuthenticationTriggerEvent,
  PreAuthenticationTriggerEvent,
  VerifyAuthChallengeResponseTriggerEvent,
} from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { CognitoFilters, UserAttributes } from './common.js';
import type { CognitoMiddleware } from './router.js';

// =============================================================================
// Trigger Sources - derived from aws-lambda
// =============================================================================

export type PreAuthenticationTriggerSource = PreAuthenticationTriggerEvent['triggerSource'];
export type PostAuthenticationTriggerSource = PostAuthenticationTriggerEvent['triggerSource'];
export type DefineAuthChallengeTriggerSource = DefineAuthChallengeTriggerEvent['triggerSource'];
export type CreateAuthChallengeTriggerSource = CreateAuthChallengeTriggerEvent['triggerSource'];
export type VerifyAuthChallengeResponseTriggerSource = VerifyAuthChallengeResponseTriggerEvent['triggerSource'];

// =============================================================================
// PreAuthentication
// =============================================================================

export interface PreAuthenticationRequest<TUserAttributes extends UserAttributes = UserAttributes> {
  triggerSource: PreAuthenticationTriggerSource;
  userAttributes: TUserAttributes;
  event: PreAuthenticationTriggerEvent;
  context: Context;
}

export type PreAuthenticationResponse = PreAuthenticationTriggerEvent['response'];

// Handlers modify the cloned event and return it
export type PreAuthenticationHandler<TUserAttributes extends UserAttributes = UserAttributes> = (
  request: PreAuthenticationRequest<TUserAttributes>,
) => Promise<PreAuthenticationTriggerEvent>;

export interface PreAuthenticationRouteDefinition<TUserAttributes extends UserAttributes = UserAttributes> {
  filters?: CognitoFilters<PreAuthenticationTriggerSource>;
  userAttributesSchema?: StandardSchemaV1<unknown, TUserAttributes>;
  middleware?: CognitoMiddleware<NoInfer<TUserAttributes>>[];
  handler: PreAuthenticationHandler<TUserAttributes>;
}

// =============================================================================
// PostAuthentication
// =============================================================================

export interface PostAuthenticationRequest<TUserAttributes extends UserAttributes = UserAttributes> {
  triggerSource: PostAuthenticationTriggerSource;
  userAttributes: TUserAttributes;
  event: PostAuthenticationTriggerEvent;
  context: Context;
}

export type PostAuthenticationResponse = PostAuthenticationTriggerEvent['response'];

// Handlers modify the cloned event and return it
export type PostAuthenticationHandler<TUserAttributes extends UserAttributes = UserAttributes> = (
  request: PostAuthenticationRequest<TUserAttributes>,
) => Promise<PostAuthenticationTriggerEvent>;

export interface PostAuthenticationRouteDefinition<TUserAttributes extends UserAttributes = UserAttributes> {
  filters?: CognitoFilters<PostAuthenticationTriggerSource>;
  userAttributesSchema?: StandardSchemaV1<unknown, TUserAttributes>;
  middleware?: CognitoMiddleware<NoInfer<TUserAttributes>>[];
  handler: PostAuthenticationHandler<TUserAttributes>;
}

// =============================================================================
// DefineAuthChallenge
// =============================================================================

export interface DefineAuthChallengeRequest<TUserAttributes extends UserAttributes = UserAttributes> {
  triggerSource: DefineAuthChallengeTriggerSource;
  userAttributes: TUserAttributes;
  event: DefineAuthChallengeTriggerEvent;
  context: Context;
}

export type DefineAuthChallengeResponse = DefineAuthChallengeTriggerEvent['response'];

// Handlers modify the cloned event and return it
export type DefineAuthChallengeHandler<TUserAttributes extends UserAttributes = UserAttributes> = (
  request: DefineAuthChallengeRequest<TUserAttributes>,
) => Promise<DefineAuthChallengeTriggerEvent>;

export interface DefineAuthChallengeRouteDefinition<TUserAttributes extends UserAttributes = UserAttributes> {
  filters?: CognitoFilters<DefineAuthChallengeTriggerSource>;
  userAttributesSchema?: StandardSchemaV1<unknown, TUserAttributes>;
  middleware?: CognitoMiddleware<NoInfer<TUserAttributes>>[];
  handler: DefineAuthChallengeHandler<TUserAttributes>;
}

// =============================================================================
// CreateAuthChallenge
// =============================================================================

export interface CreateAuthChallengeRequest<TUserAttributes extends UserAttributes = UserAttributes> {
  triggerSource: CreateAuthChallengeTriggerSource;
  userAttributes: TUserAttributes;
  event: CreateAuthChallengeTriggerEvent;
  context: Context;
}

export type CreateAuthChallengeResponse = CreateAuthChallengeTriggerEvent['response'];

// Handlers modify the cloned event and return it
export type CreateAuthChallengeHandler<TUserAttributes extends UserAttributes = UserAttributes> = (
  request: CreateAuthChallengeRequest<TUserAttributes>,
) => Promise<CreateAuthChallengeTriggerEvent>;

export interface CreateAuthChallengeRouteDefinition<TUserAttributes extends UserAttributes = UserAttributes> {
  filters?: CognitoFilters<CreateAuthChallengeTriggerSource>;
  userAttributesSchema?: StandardSchemaV1<unknown, TUserAttributes>;
  middleware?: CognitoMiddleware<NoInfer<TUserAttributes>>[];
  handler: CreateAuthChallengeHandler<TUserAttributes>;
}

// =============================================================================
// VerifyAuthChallengeResponse
// =============================================================================

export interface VerifyAuthChallengeResponseRequest<TUserAttributes extends UserAttributes = UserAttributes> {
  triggerSource: VerifyAuthChallengeResponseTriggerSource;
  userAttributes: TUserAttributes;
  event: VerifyAuthChallengeResponseTriggerEvent;
  context: Context;
}

export type VerifyAuthChallengeResponseResponse = VerifyAuthChallengeResponseTriggerEvent['response'];

// Handlers modify the cloned event and return it
export type VerifyAuthChallengeResponseHandler<TUserAttributes extends UserAttributes = UserAttributes> = (
  request: VerifyAuthChallengeResponseRequest<TUserAttributes>,
) => Promise<VerifyAuthChallengeResponseTriggerEvent>;

export interface VerifyAuthChallengeResponseRouteDefinition<TUserAttributes extends UserAttributes = UserAttributes> {
  filters?: CognitoFilters<VerifyAuthChallengeResponseTriggerSource>;
  userAttributesSchema?: StandardSchemaV1<unknown, TUserAttributes>;
  middleware?: CognitoMiddleware<NoInfer<TUserAttributes>>[];
  handler: VerifyAuthChallengeResponseHandler<TUserAttributes>;
}
