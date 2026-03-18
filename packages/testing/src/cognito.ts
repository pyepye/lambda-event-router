import type {
  Context,
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
import { createMockContext } from './context.js';
import { deepMerge } from './deepMerge.js';
import type { DeepPartial } from './deepPartial.js';
import { type FixtureMap, fixture } from './fixtureHelper.js';

export interface CognitoHandlerEvent<TEvent> {
  event: TEvent;
  context: Context;
}

interface CognitoBaseOverrides {
  version?: string;
  region?: string;
  userPoolId?: string;
  userName?: string;
  callerContext?: DeepPartial<PreSignUpTriggerEvent['callerContext']>;
}

type CognitoTriggerOverrides<TEvent extends { request: object; response: object }> = CognitoBaseOverrides & {
  request?: DeepPartial<TEvent['request']>;
  response?: DeepPartial<TEvent['response']>;
};

function createBaseFields(overrides: CognitoBaseOverrides): Record<string, unknown> {
  const defaults = {
    version: '1',
    region: 'us-east-1',
    userPoolId: 'us-east-1_TestPool',
    userName: 'test-user',
    callerContext: {
      awsSdkVersion: '3.0.0',
      clientId: 'test-client-id',
    },
  };

  return deepMerge(defaults, overrides);
}

// =============================================================================
// PreSignUp
// =============================================================================

export type CognitoPreSignUpEventOverrides = CognitoTriggerOverrides<PreSignUpTriggerEvent>;

export function createCognitoPreSignUpEvent(overrides: CognitoPreSignUpEventOverrides = {}): PreSignUpTriggerEvent {
  const { request, response, ...baseOverrides } = overrides;

  return {
    ...createBaseFields(baseOverrides),
    triggerSource: 'PreSignUp_SignUp',
    request: { userAttributes: { email: 'test@example.com' }, ...request },
    response: { autoConfirmUser: false, autoVerifyEmail: false, autoVerifyPhone: false, ...response },
  } as PreSignUpTriggerEvent;
}

export function createCognitoPreSignUpHandlerEvent(
  options: { event?: CognitoPreSignUpEventOverrides; context?: Partial<Context> } = {},
): CognitoHandlerEvent<PreSignUpTriggerEvent> {
  return { event: createCognitoPreSignUpEvent(options.event), context: createMockContext(options.context) };
}

// =============================================================================
// PreAuthentication
// =============================================================================

export type CognitoPreAuthenticationEventOverrides = CognitoTriggerOverrides<PreAuthenticationTriggerEvent>;

export function createCognitoPreAuthenticationEvent(
  overrides: CognitoPreAuthenticationEventOverrides = {},
): PreAuthenticationTriggerEvent {
  const { request, response, ...baseOverrides } = overrides;

  return {
    ...createBaseFields(baseOverrides),
    triggerSource: 'PreAuthentication_Authentication',
    request: { userAttributes: { email: 'test@example.com' }, ...request },
    response: { ...response },
  } as PreAuthenticationTriggerEvent;
}

export function createCognitoPreAuthenticationHandlerEvent(
  options: { event?: CognitoPreAuthenticationEventOverrides; context?: Partial<Context> } = {},
): CognitoHandlerEvent<PreAuthenticationTriggerEvent> {
  return {
    event: createCognitoPreAuthenticationEvent(options.event),
    context: createMockContext(options.context),
  };
}

// =============================================================================
// PostAuthentication
// =============================================================================

export type CognitoPostAuthenticationEventOverrides = CognitoTriggerOverrides<PostAuthenticationTriggerEvent>;

export function createCognitoPostAuthenticationEvent(
  overrides: CognitoPostAuthenticationEventOverrides = {},
): PostAuthenticationTriggerEvent {
  const { request, response, ...baseOverrides } = overrides;

  return {
    ...createBaseFields(baseOverrides),
    triggerSource: 'PostAuthentication_Authentication',
    request: { userAttributes: { email: 'test@example.com' }, newDeviceUsed: false, ...request },
    response: { ...response },
  } as PostAuthenticationTriggerEvent;
}

export function createCognitoPostAuthenticationHandlerEvent(
  options: { event?: CognitoPostAuthenticationEventOverrides; context?: Partial<Context> } = {},
): CognitoHandlerEvent<PostAuthenticationTriggerEvent> {
  return {
    event: createCognitoPostAuthenticationEvent(options.event),
    context: createMockContext(options.context),
  };
}

// =============================================================================
// PostConfirmation
// =============================================================================

export type CognitoPostConfirmationEventOverrides = CognitoTriggerOverrides<PostConfirmationTriggerEvent>;

export function createCognitoPostConfirmationEvent(
  overrides: CognitoPostConfirmationEventOverrides = {},
): PostConfirmationTriggerEvent {
  const { request, response, ...baseOverrides } = overrides;

  return {
    ...createBaseFields(baseOverrides),
    triggerSource: 'PostConfirmation_ConfirmSignUp',
    request: { userAttributes: { email: 'test@example.com' }, ...request },
    response: { ...response },
  } as PostConfirmationTriggerEvent;
}

export function createCognitoPostConfirmationHandlerEvent(
  options: { event?: CognitoPostConfirmationEventOverrides; context?: Partial<Context> } = {},
): CognitoHandlerEvent<PostConfirmationTriggerEvent> {
  return {
    event: createCognitoPostConfirmationEvent(options.event),
    context: createMockContext(options.context),
  };
}

// =============================================================================
// DefineAuthChallenge
// =============================================================================

export type CognitoDefineAuthChallengeEventOverrides = CognitoTriggerOverrides<DefineAuthChallengeTriggerEvent>;

export function createCognitoDefineAuthChallengeEvent(
  overrides: CognitoDefineAuthChallengeEventOverrides = {},
): DefineAuthChallengeTriggerEvent {
  const { request, response, ...baseOverrides } = overrides;

  return {
    ...createBaseFields(baseOverrides),
    triggerSource: 'DefineAuthChallenge_Authentication',
    request: { userAttributes: { email: 'test@example.com' }, session: [], ...request },
    response: { failAuthentication: false, issueTokens: false, ...response },
  } as DefineAuthChallengeTriggerEvent;
}

export function createCognitoDefineAuthChallengeHandlerEvent(
  options: { event?: CognitoDefineAuthChallengeEventOverrides; context?: Partial<Context> } = {},
): CognitoHandlerEvent<DefineAuthChallengeTriggerEvent> {
  return {
    event: createCognitoDefineAuthChallengeEvent(options.event),
    context: createMockContext(options.context),
  };
}

// =============================================================================
// CreateAuthChallenge
// =============================================================================

export type CognitoCreateAuthChallengeEventOverrides = CognitoTriggerOverrides<CreateAuthChallengeTriggerEvent>;

export function createCognitoCreateAuthChallengeEvent(
  overrides: CognitoCreateAuthChallengeEventOverrides = {},
): CreateAuthChallengeTriggerEvent {
  const { request, response, ...baseOverrides } = overrides;

  return {
    ...createBaseFields(baseOverrides),
    triggerSource: 'CreateAuthChallenge_Authentication',
    request: {
      userAttributes: { email: 'test@example.com' },
      challengeName: 'CUSTOM_CHALLENGE',
      session: [],
      ...request,
    },
    response: { publicChallengeParameters: {}, privateChallengeParameters: {}, challengeMetadata: '', ...response },
  } as CreateAuthChallengeTriggerEvent;
}

export function createCognitoCreateAuthChallengeHandlerEvent(
  options: { event?: CognitoCreateAuthChallengeEventOverrides; context?: Partial<Context> } = {},
): CognitoHandlerEvent<CreateAuthChallengeTriggerEvent> {
  return {
    event: createCognitoCreateAuthChallengeEvent(options.event),
    context: createMockContext(options.context),
  };
}

// =============================================================================
// VerifyAuthChallengeResponse
// =============================================================================

export type CognitoVerifyAuthChallengeResponseEventOverrides =
  CognitoTriggerOverrides<VerifyAuthChallengeResponseTriggerEvent>;

export function createCognitoVerifyAuthChallengeResponseEvent(
  overrides: CognitoVerifyAuthChallengeResponseEventOverrides = {},
): VerifyAuthChallengeResponseTriggerEvent {
  const { request, response, ...baseOverrides } = overrides;

  return {
    ...createBaseFields(baseOverrides),
    triggerSource: 'VerifyAuthChallengeResponse_Authentication',
    request: {
      userAttributes: { email: 'test@example.com' },
      privateChallengeParameters: {},
      challengeAnswer: '',
      ...request,
    },
    response: { answerCorrect: false, ...response },
  } as VerifyAuthChallengeResponseTriggerEvent;
}

export function createCognitoVerifyAuthChallengeResponseHandlerEvent(
  options: { event?: CognitoVerifyAuthChallengeResponseEventOverrides; context?: Partial<Context> } = {},
): CognitoHandlerEvent<VerifyAuthChallengeResponseTriggerEvent> {
  return {
    event: createCognitoVerifyAuthChallengeResponseEvent(options.event),
    context: createMockContext(options.context),
  };
}

// =============================================================================
// CustomMessage
// =============================================================================

export type CognitoCustomMessageEventOverrides = CognitoTriggerOverrides<CustomMessageTriggerEvent>;

export function createCognitoCustomMessageEvent(
  overrides: CognitoCustomMessageEventOverrides = {},
): CustomMessageTriggerEvent {
  const { request, response, ...baseOverrides } = overrides;

  return {
    ...createBaseFields(baseOverrides),
    triggerSource: 'CustomMessage_SignUp',
    request: {
      userAttributes: { email: 'test@example.com' },
      codeParameter: '{####}',
      linkParameter: '{##link##}',
      usernameParameter: null,
      ...request,
    },
    response: { smsMessage: null, emailMessage: null, emailSubject: null, ...response },
  } as CustomMessageTriggerEvent;
}

export function createCognitoCustomMessageHandlerEvent(
  options: { event?: CognitoCustomMessageEventOverrides; context?: Partial<Context> } = {},
): CognitoHandlerEvent<CustomMessageTriggerEvent> {
  return { event: createCognitoCustomMessageEvent(options.event), context: createMockContext(options.context) };
}

// =============================================================================
// CustomEmailSender
// =============================================================================

export type CognitoCustomEmailSenderEventOverrides = CognitoTriggerOverrides<CustomEmailSenderTriggerEvent>;

export function createCognitoCustomEmailSenderEvent(
  overrides: CognitoCustomEmailSenderEventOverrides = {},
): CustomEmailSenderTriggerEvent {
  const { request, response, ...baseOverrides } = overrides;

  return {
    ...createBaseFields(baseOverrides),
    triggerSource: 'CustomEmailSender_SignUp',
    request: {
      type: 'customEmailSenderRequestV1',
      code: null,
      userAttributes: { email: 'test@example.com' },
      ...request,
    },
    response: { ...response },
  } as CustomEmailSenderTriggerEvent;
}

export function createCognitoCustomEmailSenderHandlerEvent(
  options: { event?: CognitoCustomEmailSenderEventOverrides; context?: Partial<Context> } = {},
): CognitoHandlerEvent<CustomEmailSenderTriggerEvent> {
  return {
    event: createCognitoCustomEmailSenderEvent(options.event),
    context: createMockContext(options.context),
  };
}

// =============================================================================
// PreTokenGeneration
// =============================================================================

export type CognitoPreTokenGenerationEventOverrides = CognitoTriggerOverrides<PreTokenGenerationTriggerEvent>;

export function createCognitoPreTokenGenerationEvent(
  overrides: CognitoPreTokenGenerationEventOverrides = {},
): PreTokenGenerationTriggerEvent {
  const { request, response, ...baseOverrides } = overrides;

  return {
    ...createBaseFields(baseOverrides),
    triggerSource: 'TokenGeneration_Authentication',
    request: { userAttributes: { email: 'test@example.com' }, groupConfiguration: {}, ...request },
    response: { claimsOverrideDetails: {}, ...response },
  } as PreTokenGenerationTriggerEvent;
}

export function createCognitoPreTokenGenerationHandlerEvent(
  options: { event?: CognitoPreTokenGenerationEventOverrides; context?: Partial<Context> } = {},
): CognitoHandlerEvent<PreTokenGenerationTriggerEvent> {
  return {
    event: createCognitoPreTokenGenerationEvent(options.event),
    context: createMockContext(options.context),
  };
}

// =============================================================================
// UserMigration
// =============================================================================

export type CognitoUserMigrationEventOverrides = CognitoTriggerOverrides<UserMigrationTriggerEvent>;

export function createCognitoUserMigrationEvent(
  overrides: CognitoUserMigrationEventOverrides = {},
): UserMigrationTriggerEvent {
  const { request, response, ...baseOverrides } = overrides;

  return {
    ...createBaseFields(baseOverrides),
    triggerSource: 'UserMigration_Authentication',
    request: { password: 'test-password', ...request },
    response: { userAttributes: {}, desiredDeliveryMediums: ['EMAIL'], forceAliasCreation: false, ...response },
  } as UserMigrationTriggerEvent;
}

export function createCognitoUserMigrationHandlerEvent(
  options: { event?: CognitoUserMigrationEventOverrides; context?: Partial<Context> } = {},
): CognitoHandlerEvent<UserMigrationTriggerEvent> {
  return { event: createCognitoUserMigrationEvent(options.event), context: createMockContext(options.context) };
}

export interface CognitoFixtures {
  cognitoPreSignUpEvent: typeof createCognitoPreSignUpEvent;
  cognitoPreSignUpHandlerEvent: typeof createCognitoPreSignUpHandlerEvent;
  cognitoPreAuthenticationEvent: typeof createCognitoPreAuthenticationEvent;
  cognitoPreAuthenticationHandlerEvent: typeof createCognitoPreAuthenticationHandlerEvent;
  cognitoPostAuthenticationEvent: typeof createCognitoPostAuthenticationEvent;
  cognitoPostAuthenticationHandlerEvent: typeof createCognitoPostAuthenticationHandlerEvent;
  cognitoPostConfirmationEvent: typeof createCognitoPostConfirmationEvent;
  cognitoPostConfirmationHandlerEvent: typeof createCognitoPostConfirmationHandlerEvent;
  cognitoDefineAuthChallengeEvent: typeof createCognitoDefineAuthChallengeEvent;
  cognitoDefineAuthChallengeHandlerEvent: typeof createCognitoDefineAuthChallengeHandlerEvent;
  cognitoCreateAuthChallengeEvent: typeof createCognitoCreateAuthChallengeEvent;
  cognitoCreateAuthChallengeHandlerEvent: typeof createCognitoCreateAuthChallengeHandlerEvent;
  cognitoVerifyAuthChallengeResponseEvent: typeof createCognitoVerifyAuthChallengeResponseEvent;
  cognitoVerifyAuthChallengeResponseHandlerEvent: typeof createCognitoVerifyAuthChallengeResponseHandlerEvent;
  cognitoCustomMessageEvent: typeof createCognitoCustomMessageEvent;
  cognitoCustomMessageHandlerEvent: typeof createCognitoCustomMessageHandlerEvent;
  cognitoCustomEmailSenderEvent: typeof createCognitoCustomEmailSenderEvent;
  cognitoCustomEmailSenderHandlerEvent: typeof createCognitoCustomEmailSenderHandlerEvent;
  cognitoPreTokenGenerationEvent: typeof createCognitoPreTokenGenerationEvent;
  cognitoPreTokenGenerationHandlerEvent: typeof createCognitoPreTokenGenerationHandlerEvent;
  cognitoUserMigrationEvent: typeof createCognitoUserMigrationEvent;
  cognitoUserMigrationHandlerEvent: typeof createCognitoUserMigrationHandlerEvent;
}

export const cognitoFixtures: FixtureMap<CognitoFixtures> = {
  cognitoPreSignUpEvent: fixture(createCognitoPreSignUpEvent),
  cognitoPreSignUpHandlerEvent: fixture(createCognitoPreSignUpHandlerEvent),
  cognitoPreAuthenticationEvent: fixture(createCognitoPreAuthenticationEvent),
  cognitoPreAuthenticationHandlerEvent: fixture(createCognitoPreAuthenticationHandlerEvent),
  cognitoPostAuthenticationEvent: fixture(createCognitoPostAuthenticationEvent),
  cognitoPostAuthenticationHandlerEvent: fixture(createCognitoPostAuthenticationHandlerEvent),
  cognitoPostConfirmationEvent: fixture(createCognitoPostConfirmationEvent),
  cognitoPostConfirmationHandlerEvent: fixture(createCognitoPostConfirmationHandlerEvent),
  cognitoDefineAuthChallengeEvent: fixture(createCognitoDefineAuthChallengeEvent),
  cognitoDefineAuthChallengeHandlerEvent: fixture(createCognitoDefineAuthChallengeHandlerEvent),
  cognitoCreateAuthChallengeEvent: fixture(createCognitoCreateAuthChallengeEvent),
  cognitoCreateAuthChallengeHandlerEvent: fixture(createCognitoCreateAuthChallengeHandlerEvent),
  cognitoVerifyAuthChallengeResponseEvent: fixture(createCognitoVerifyAuthChallengeResponseEvent),
  cognitoVerifyAuthChallengeResponseHandlerEvent: fixture(createCognitoVerifyAuthChallengeResponseHandlerEvent),
  cognitoCustomMessageEvent: fixture(createCognitoCustomMessageEvent),
  cognitoCustomMessageHandlerEvent: fixture(createCognitoCustomMessageHandlerEvent),
  cognitoCustomEmailSenderEvent: fixture(createCognitoCustomEmailSenderEvent),
  cognitoCustomEmailSenderHandlerEvent: fixture(createCognitoCustomEmailSenderHandlerEvent),
  cognitoPreTokenGenerationEvent: fixture(createCognitoPreTokenGenerationEvent),
  cognitoPreTokenGenerationHandlerEvent: fixture(createCognitoPreTokenGenerationHandlerEvent),
  cognitoUserMigrationEvent: fixture(createCognitoUserMigrationEvent),
  cognitoUserMigrationHandlerEvent: fixture(createCognitoUserMigrationHandlerEvent),
};
