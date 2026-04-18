import type { EventTypeRouter } from '@lambda-event-router/base';
import { handleEventWithMiddleware, isObject, validateSchema } from '@lambda-event-router/base';
import type { StandardSchemaV1 } from '@standard-schema/spec';
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
import type {
  CognitoFilters,
  CognitoMiddleware,
  CognitoRequest,
  CognitoRouteDefinition,
  CognitoRouterOptions,
  CognitoTriggerSource,
  // CreateAuthChallenge
  CreateAuthChallengeRouteDefinition,
  CreateAuthChallengeTriggerSource,
  // CustomEmailSender
  CustomEmailSenderRouteDefinition,
  CustomEmailSenderTriggerSource,
  // CustomMessage
  CustomMessageRouteDefinition,
  CustomMessageTriggerSource,
  // DefineAuthChallenge
  DefineAuthChallengeRouteDefinition,
  DefineAuthChallengeTriggerSource,
  EventForTrigger,
  // PostAuthentication
  PostAuthenticationRouteDefinition,
  PostAuthenticationTriggerSource,
  // PostConfirmation
  PostConfirmationRouteDefinition,
  PostConfirmationTriggerSource,
  // PreAuthentication
  PreAuthenticationRouteDefinition,
  PreAuthenticationTriggerSource,
  // PreSignUp
  PreSignUpRouteDefinition,
  PreSignUpTriggerSource,
  // PreTokenGeneration
  PreTokenGenerationRouteDefinition,
  PreTokenGenerationTriggerSource,
  RequestForTrigger,
  RouteBuilder,
  RouteInput,
  TypedRouteDefinition,
  UserAttributeFilter,
  UserAttributes,
  // UserMigration
  UserMigrationRouteDefinition,
  UserMigrationTriggerSource,
  // VerifyAuthChallengeResponse
  VerifyAuthChallengeResponseRouteDefinition,
  VerifyAuthChallengeResponseTriggerSource,
} from './types/index.js';

// Re-export types for convenience
export type { CognitoRequest, CognitoRouteDefinition, TypedRouteDefinition } from './types/index.js';

// =============================================================================
// defineRoute function
// =============================================================================

// defineRoute function with type inference from triggerSource
// Handlers modify the cloned event and return it
export function defineRoute<
  const TTrigger extends CognitoTriggerSource,
  TUserAttributesSchema extends StandardSchemaV1 | undefined = undefined,
  TUserAttributes extends UserAttributes = TUserAttributesSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TUserAttributesSchema> & UserAttributes
    : UserAttributes,
>(config: RouteInput<TTrigger, TUserAttributesSchema>): RouteBuilder<TTrigger, TUserAttributes> {
  return {
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler): TypedRouteDefinition<TTrigger, TUserAttributes> {
      return {
        filters: config.filters as CognitoFilters<TTrigger> | undefined,
        userAttributesSchema: config.userAttributesSchema as StandardSchemaV1<unknown, TUserAttributes> | undefined,
        middleware: config.middleware,
        handler: handler as (
          request: RequestForTrigger<TTrigger, TUserAttributes>,
        ) => Promise<EventForTrigger<TTrigger>>,
      };
    },
  };
}

// =============================================================================
// Trigger source constants
// =============================================================================

const PRE_SIGN_UP_TRIGGER_SOURCES: PreSignUpTriggerSource[] = [
  'PreSignUp_SignUp',
  'PreSignUp_AdminCreateUser',
  'PreSignUp_ExternalProvider',
];

const PRE_AUTHENTICATION_TRIGGER_SOURCES: PreAuthenticationTriggerSource[] = ['PreAuthentication_Authentication'];
const POST_AUTHENTICATION_TRIGGER_SOURCES: PostAuthenticationTriggerSource[] = ['PostAuthentication_Authentication'];

const POST_CONFIRMATION_TRIGGER_SOURCES: PostConfirmationTriggerSource[] = [
  'PostConfirmation_ConfirmSignUp',
  'PostConfirmation_ConfirmForgotPassword',
];

const DEFINE_AUTH_CHALLENGE_TRIGGER_SOURCES: DefineAuthChallengeTriggerSource[] = [
  'DefineAuthChallenge_Authentication',
];
const CREATE_AUTH_CHALLENGE_TRIGGER_SOURCES: CreateAuthChallengeTriggerSource[] = [
  'CreateAuthChallenge_Authentication',
];
const VERIFY_AUTH_CHALLENGE_RESPONSE_TRIGGER_SOURCES: VerifyAuthChallengeResponseTriggerSource[] = [
  'VerifyAuthChallengeResponse_Authentication',
];

const CUSTOM_MESSAGE_TRIGGER_SOURCES: CustomMessageTriggerSource[] = [
  'CustomMessage_SignUp',
  'CustomMessage_AdminCreateUser',
  'CustomMessage_ResendCode',
  'CustomMessage_ForgotPassword',
  'CustomMessage_UpdateUserAttribute',
  'CustomMessage_VerifyUserAttribute',
  'CustomMessage_Authentication',
];

const CUSTOM_EMAIL_SENDER_TRIGGER_SOURCES: CustomEmailSenderTriggerSource[] = [
  'CustomEmailSender_SignUp',
  'CustomEmailSender_ResendCode',
  'CustomEmailSender_ForgotPassword',
  'CustomEmailSender_UpdateUserAttribute',
  'CustomEmailSender_VerifyUserAttribute',
  'CustomEmailSender_AdminCreateUser',
  'CustomEmailSender_Authentication',
  'CustomEmailSender_AccountTakeOverNotification',
];

const PRE_TOKEN_GENERATION_TRIGGER_SOURCES: PreTokenGenerationTriggerSource[] = [
  'TokenGeneration_HostedAuth',
  'TokenGeneration_Authentication',
  'TokenGeneration_NewPasswordChallenge',
  'TokenGeneration_AuthenticateDevice',
  'TokenGeneration_RefreshTokens',
];

const USER_MIGRATION_TRIGGER_SOURCES: UserMigrationTriggerSource[] = [
  'UserMigration_Authentication',
  'UserMigration_ForgotPassword',
];

// =============================================================================
// Type guards
// =============================================================================

// Type guard using Object.hasOwn() for property checking
function hasUserAttributes(request: object): request is { userAttributes: UserAttributes } {
  return Object.hasOwn(request, 'userAttributes');
}

// =============================================================================
// Internal types
// =============================================================================

interface InternalRoute {
  filters: CognitoFilters<CognitoTriggerSource>;
  userAttributesSchema?: StandardSchemaV1;
  middleware?: CognitoMiddleware[];
  handler: (request: CognitoRequest) => Promise<CognitoEvent>;
}

interface InternalRouteInput {
  filters?: CognitoFilters<CognitoTriggerSource>;
  userAttributesSchema?: StandardSchemaV1;
  middleware?: CognitoMiddleware[];
  handler: unknown;
}

// Cognito event type (union of all supported trigger events)
type CognitoEvent =
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

// Response type (returns the modified event)
type CognitoResponse = CognitoEvent;

// =============================================================================
// CognitoRouter class
// =============================================================================

export class CognitoRouter implements EventTypeRouter<CognitoEvent, CognitoResponse> {
  private routes: InternalRoute[] = [];
  private middleware: CognitoMiddleware[] = [];

  constructor(options?: CognitoRouterOptions) {
    this.middleware = options?.middleware ?? [];
  }

  canHandleEvent(event: unknown): event is CognitoEvent {
    if (!isObject(event)) return false;
    if (typeof event.triggerSource !== 'string') return false;
    if (typeof event.userPoolId !== 'string') return false;
    return true;
  }

  // Generic route method
  // Handlers receive a cloned event, modify it, and return it
  route<TUserAttributes extends UserAttributes>(definition: CognitoRouteDefinition<TUserAttributes>): this {
    this.routes.push({
      filters: definition.filters ?? {},
      userAttributesSchema: definition.userAttributesSchema,
      middleware: definition.middleware,
      handler: definition.handler as (request: CognitoRequest) => Promise<CognitoEvent>,
    });
    return this;
  }

  // =============================================================================
  // Convenience methods for each trigger type
  // =============================================================================

  preSignUp<TTrigger extends PreSignUpTriggerSource, TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<TTrigger, TUserAttributes> | PreSignUpRouteDefinition<TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, PRE_SIGN_UP_TRIGGER_SOURCES);
  }

  preAuthentication<TTrigger extends PreAuthenticationTriggerSource, TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<TTrigger, TUserAttributes> | PreAuthenticationRouteDefinition<TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, PRE_AUTHENTICATION_TRIGGER_SOURCES);
  }

  postAuthentication<TTrigger extends PostAuthenticationTriggerSource, TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<TTrigger, TUserAttributes> | PostAuthenticationRouteDefinition<TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, POST_AUTHENTICATION_TRIGGER_SOURCES);
  }

  postConfirmation<TTrigger extends PostConfirmationTriggerSource, TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<TTrigger, TUserAttributes> | PostConfirmationRouteDefinition<TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, POST_CONFIRMATION_TRIGGER_SOURCES);
  }

  defineAuthChallenge<TTrigger extends DefineAuthChallengeTriggerSource, TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<TTrigger, TUserAttributes> | DefineAuthChallengeRouteDefinition<TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, DEFINE_AUTH_CHALLENGE_TRIGGER_SOURCES);
  }

  createAuthChallenge<TTrigger extends CreateAuthChallengeTriggerSource, TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<TTrigger, TUserAttributes> | CreateAuthChallengeRouteDefinition<TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, CREATE_AUTH_CHALLENGE_TRIGGER_SOURCES);
  }

  verifyAuthChallengeResponse<
    TTrigger extends VerifyAuthChallengeResponseTriggerSource,
    TUserAttributes extends UserAttributes,
  >(
    definition:
      | TypedRouteDefinition<TTrigger, TUserAttributes>
      | VerifyAuthChallengeResponseRouteDefinition<TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, VERIFY_AUTH_CHALLENGE_RESPONSE_TRIGGER_SOURCES);
  }

  customMessage<TTrigger extends CustomMessageTriggerSource, TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<TTrigger, TUserAttributes> | CustomMessageRouteDefinition<TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, CUSTOM_MESSAGE_TRIGGER_SOURCES);
  }

  customEmailSender<TTrigger extends CustomEmailSenderTriggerSource, TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<TTrigger, TUserAttributes> | CustomEmailSenderRouteDefinition<TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, CUSTOM_EMAIL_SENDER_TRIGGER_SOURCES);
  }

  preTokenGeneration<TTrigger extends PreTokenGenerationTriggerSource, TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<TTrigger, TUserAttributes> | PreTokenGenerationRouteDefinition<TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, PRE_TOKEN_GENERATION_TRIGGER_SOURCES);
  }

  userMigration<TTrigger extends UserMigrationTriggerSource, TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<TTrigger, TUserAttributes> | UserMigrationRouteDefinition<TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, USER_MIGRATION_TRIGGER_SOURCES);
  }

  // =============================================================================
  // Individual trigger source methods
  // These provide type-safe routing for specific trigger sources
  // =============================================================================

  // PreSignUp individual methods
  preSignUpSignUp<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'PreSignUp_SignUp', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['PreSignUp_SignUp']);
  }

  preSignUpAdminCreateUser<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'PreSignUp_AdminCreateUser', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['PreSignUp_AdminCreateUser']);
  }

  preSignUpExternalProvider<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'PreSignUp_ExternalProvider', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['PreSignUp_ExternalProvider']);
  }

  // PreAuthentication individual method
  preAuthenticationAuthentication<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'PreAuthentication_Authentication', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['PreAuthentication_Authentication']);
  }

  // PostAuthentication individual method
  postAuthenticationAuthentication<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'PostAuthentication_Authentication', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['PostAuthentication_Authentication']);
  }

  // PostConfirmation individual methods
  postConfirmationConfirmSignUp<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'PostConfirmation_ConfirmSignUp', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['PostConfirmation_ConfirmSignUp']);
  }

  postConfirmationConfirmForgotPassword<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'PostConfirmation_ConfirmForgotPassword', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['PostConfirmation_ConfirmForgotPassword']);
  }

  // DefineAuthChallenge individual method
  defineAuthChallengeAuthentication<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'DefineAuthChallenge_Authentication', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['DefineAuthChallenge_Authentication']);
  }

  // CreateAuthChallenge individual method
  createAuthChallengeAuthentication<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'CreateAuthChallenge_Authentication', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['CreateAuthChallenge_Authentication']);
  }

  // VerifyAuthChallengeResponse individual method
  verifyAuthChallengeResponseAuthentication<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'VerifyAuthChallengeResponse_Authentication', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['VerifyAuthChallengeResponse_Authentication']);
  }

  // CustomMessage individual methods
  customMessageSignUp<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'CustomMessage_SignUp', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['CustomMessage_SignUp']);
  }

  customMessageAdminCreateUser<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'CustomMessage_AdminCreateUser', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['CustomMessage_AdminCreateUser']);
  }

  customMessageResendCode<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'CustomMessage_ResendCode', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['CustomMessage_ResendCode']);
  }

  customMessageForgotPassword<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'CustomMessage_ForgotPassword', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['CustomMessage_ForgotPassword']);
  }

  customMessageUpdateUserAttribute<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'CustomMessage_UpdateUserAttribute', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['CustomMessage_UpdateUserAttribute']);
  }

  customMessageVerifyUserAttribute<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'CustomMessage_VerifyUserAttribute', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['CustomMessage_VerifyUserAttribute']);
  }

  customMessageAuthentication<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'CustomMessage_Authentication', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['CustomMessage_Authentication']);
  }

  // CustomEmailSender individual methods
  customEmailSenderSignUp<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'CustomEmailSender_SignUp', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['CustomEmailSender_SignUp']);
  }

  customEmailSenderResendCode<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'CustomEmailSender_ResendCode', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['CustomEmailSender_ResendCode']);
  }

  customEmailSenderForgotPassword<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'CustomEmailSender_ForgotPassword', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['CustomEmailSender_ForgotPassword']);
  }

  customEmailSenderUpdateUserAttribute<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'CustomEmailSender_UpdateUserAttribute', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['CustomEmailSender_UpdateUserAttribute']);
  }

  customEmailSenderVerifyUserAttribute<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'CustomEmailSender_VerifyUserAttribute', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['CustomEmailSender_VerifyUserAttribute']);
  }

  customEmailSenderAdminCreateUser<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'CustomEmailSender_AdminCreateUser', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['CustomEmailSender_AdminCreateUser']);
  }

  customEmailSenderAuthentication<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'CustomEmailSender_Authentication', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['CustomEmailSender_Authentication']);
  }

  customEmailSenderAccountTakeOverNotification<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'CustomEmailSender_AccountTakeOverNotification', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['CustomEmailSender_AccountTakeOverNotification']);
  }

  // PreTokenGeneration individual methods
  preTokenGenerationHostedAuth<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'TokenGeneration_HostedAuth', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['TokenGeneration_HostedAuth']);
  }

  preTokenGenerationAuthentication<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'TokenGeneration_Authentication', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['TokenGeneration_Authentication']);
  }

  preTokenGenerationNewPasswordChallenge<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'TokenGeneration_NewPasswordChallenge', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['TokenGeneration_NewPasswordChallenge']);
  }

  preTokenGenerationAuthenticateDevice<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'TokenGeneration_AuthenticateDevice', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['TokenGeneration_AuthenticateDevice']);
  }

  preTokenGenerationRefreshTokens<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'TokenGeneration_RefreshTokens', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['TokenGeneration_RefreshTokens']);
  }

  // UserMigration individual methods
  userMigrationAuthentication<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'UserMigration_Authentication', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['UserMigration_Authentication']);
  }

  userMigrationForgotPassword<TUserAttributes extends UserAttributes>(
    definition: TypedRouteDefinition<'UserMigration_ForgotPassword', TUserAttributes>,
  ): this {
    return this.addTriggerRoute(definition as InternalRouteInput, ['UserMigration_ForgotPassword']);
  }

  // =============================================================================
  // Private helper methods
  // =============================================================================

  private addTriggerRoute(definition: InternalRouteInput, defaultTriggerSources: CognitoTriggerSource[]): this {
    let triggerSources = defaultTriggerSources;
    if (definition.filters?.triggerSource) {
      triggerSources = Array.isArray(definition.filters?.triggerSource)
        ? definition.filters?.triggerSource
        : [definition.filters?.triggerSource];
    }

    this.routes.push({
      filters: {
        userPoolId: definition.filters?.userPoolId,
        clientId: definition.filters?.clientId,
        userAttributes: definition.filters?.userAttributes,
        customFilter: definition.filters?.customFilter,
        triggerSource: triggerSources,
      },
      userAttributesSchema: definition.userAttributesSchema,
      middleware: definition.middleware,
      handler: definition.handler as (request: CognitoRequest) => Promise<CognitoEvent>,
    });
    return this;
  }

  async handleEvent(event: CognitoEvent, context: Context): Promise<CognitoResponse> {
    const triggerSource = event.triggerSource;

    const route = await this.matchRoute(event, triggerSource);
    if (!route) {
      throw new Error(`No route matched for trigger ${triggerSource}`);
    }

    // Clone the event to treat the original as immutable
    const eventClone = structuredClone(event);

    // UserMigration events don't have userAttributes on request (user doesn't exist yet)
    const rawUserAttributes = hasUserAttributes(eventClone.request) ? eventClone.request.userAttributes : {};
    const userAttributes = await validateSchema(
      rawUserAttributes,
      route.userAttributesSchema,
      `User attributes validation failed for trigger ${triggerSource}`,
    );

    const request: CognitoRequest = { triggerSource, userAttributes, event: eventClone, context } as CognitoRequest;
    // Handler modifies the cloned event and returns it

    const allMiddleware = [...this.middleware, ...(route.middleware ?? [])];
    return await handleEventWithMiddleware(allMiddleware, request, route.handler);
  }

  private async matchRoute(
    event: CognitoEvent,
    triggerSource: CognitoTriggerSource,
  ): Promise<InternalRoute | undefined> {
    // UserMigration events don't have userAttributes on request
    const userAttributes = hasUserAttributes(event.request) ? event.request.userAttributes : undefined;

    for (const route of this.routes) {
      const { filters } = route;

      if (filters.triggerSource) {
        const triggerSources = Array.isArray(filters.triggerSource) ? filters.triggerSource : [filters.triggerSource];
        if (!triggerSources.includes(triggerSource)) {
          continue;
        }
      }

      if (filters.userPoolId) {
        const userPoolIds = Array.isArray(filters.userPoolId) ? filters.userPoolId : [filters.userPoolId];
        if (!userPoolIds.includes(event.userPoolId)) {
          continue;
        }
      }

      if (filters.clientId) {
        const clientIds = Array.isArray(filters.clientId) ? filters.clientId : [filters.clientId];
        if (!clientIds.includes(event.callerContext.clientId)) {
          continue;
        }
      }

      if (filters.userAttributes && userAttributes) {
        let allAttributesMatch = true;
        for (const [key, filter] of Object.entries(filters.userAttributes)) {
          const value = userAttributes[key];
          if (!this.matchUserAttribute(value, filter)) {
            allAttributesMatch = false;
            break;
          }
        }
        if (!allAttributesMatch) {
          continue;
        }
      }

      if (filters.customFilter) {
        const filterInput = {
          triggerSource,
          userPoolId: event.userPoolId,
          userName: event.userName,
          callerContext: event.callerContext,
          request: { userAttributes },
          event,
        };
        const match = await filters.customFilter(filterInput);
        if (!match) continue;
      }

      return route;
    }

    return undefined;
  }

  private matchUserAttribute(value: string | undefined, filter: UserAttributeFilter): boolean {
    if (value === undefined) return false;
    if (typeof filter === 'string') return value === filter;
    if (filter instanceof RegExp) return filter.test(value);
    /* v8 ignore next -- @preserve - Always true after string/RegExp checks. Branch unreachable */
    if (typeof filter === 'function') return filter(value);
    /* v8 ignore next -- @preserve - Guard is for TS. All UserAttributeFilter variants handled above */
    return false;
  }
}

export function createCognitoRouter(options?: CognitoRouterOptions): CognitoRouter {
  return new CognitoRouter(options);
}
