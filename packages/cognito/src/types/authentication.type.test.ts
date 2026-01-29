import type {
  Context,
  CreateAuthChallengeTriggerEvent,
  DefineAuthChallengeTriggerEvent,
  PostAuthenticationTriggerEvent,
  PreAuthenticationTriggerEvent,
  VerifyAuthChallengeResponseTriggerEvent,
} from 'aws-lambda';
import type {
  CognitoFilters,
  CreateAuthChallengeHandler,
  CreateAuthChallengeRequest,
  CreateAuthChallengeResponse,
  CreateAuthChallengeRouteDefinition,
  CreateAuthChallengeTriggerSource,
  DefineAuthChallengeHandler,
  DefineAuthChallengeRequest,
  DefineAuthChallengeResponse,
  DefineAuthChallengeRouteDefinition,
  DefineAuthChallengeTriggerSource,
  PostAuthenticationHandler,
  PostAuthenticationRequest,
  PostAuthenticationResponse,
  PostAuthenticationRouteDefinition,
  PostAuthenticationTriggerSource,
  PreAuthenticationHandler,
  PreAuthenticationRequest,
  PreAuthenticationResponse,
  PreAuthenticationRouteDefinition,
  PreAuthenticationTriggerSource,
  UserAttributes,
  VerifyAuthChallengeResponseHandler,
  VerifyAuthChallengeResponseRequest,
  VerifyAuthChallengeResponseResponse,
  VerifyAuthChallengeResponseRouteDefinition,
  VerifyAuthChallengeResponseTriggerSource,
} from './index.js';

// =============================================================================
// PreAuthentication
// =============================================================================

suite('PreAuthenticationTriggerSource', () => {
  test('resolves to expected literal', () => {
    expectTypeOf<PreAuthenticationTriggerSource>().toEqualTypeOf<'PreAuthentication_Authentication'>();
  });
});

suite('PreAuthenticationRequest', () => {
  test('has triggerSource field', () => {
    expectTypeOf<PreAuthenticationRequest['triggerSource']>().toEqualTypeOf<PreAuthenticationTriggerSource>();
  });

  test('has userAttributes field', () => {
    expectTypeOf<PreAuthenticationRequest['userAttributes']>().toEqualTypeOf<UserAttributes>();
  });

  test('has event field', () => {
    expectTypeOf<PreAuthenticationRequest['event']>().toEqualTypeOf<PreAuthenticationTriggerEvent>();
  });

  test('has context field', () => {
    expectTypeOf<PreAuthenticationRequest['context']>().toEqualTypeOf<Context>();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<PreAuthenticationRequest<CustomAttributes>['userAttributes']>().toEqualTypeOf<CustomAttributes>();
  });
});

suite('PreAuthenticationResponse', () => {
  test('matches event response type', () => {
    expectTypeOf<PreAuthenticationResponse>().toEqualTypeOf<PreAuthenticationTriggerEvent['response']>();
  });
});

suite('PreAuthenticationHandler', () => {
  test('accepts PreAuthenticationRequest and returns Promise<PreAuthenticationTriggerEvent>', () => {
    expectTypeOf<PreAuthenticationHandler>().toEqualTypeOf<
      (request: PreAuthenticationRequest) => Promise<PreAuthenticationTriggerEvent>
    >();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<PreAuthenticationHandler<CustomAttributes>>().toEqualTypeOf<
      (request: PreAuthenticationRequest<CustomAttributes>) => Promise<PreAuthenticationTriggerEvent>
    >();
  });
});

suite('PreAuthenticationRouteDefinition', () => {
  test('has optional filters field', () => {
    expectTypeOf<PreAuthenticationRouteDefinition>().toHaveProperty('filters');
  });

  test('has optional userAttributesSchema field', () => {
    expectTypeOf<PreAuthenticationRouteDefinition>().toHaveProperty('userAttributesSchema');
  });

  test('has handler field matching PreAuthenticationHandler', () => {
    expectTypeOf<PreAuthenticationRouteDefinition['handler']>().toEqualTypeOf<PreAuthenticationHandler>();
  });

  test('filters use PreAuthenticationTriggerSource', () => {
    expectTypeOf<NonNullable<PreAuthenticationRouteDefinition['filters']>>().toEqualTypeOf<
      CognitoFilters<PreAuthenticationTriggerSource>
    >();
  });
});

// =============================================================================
// PostAuthentication
// =============================================================================

suite('PostAuthenticationTriggerSource', () => {
  test('resolves to expected literal', () => {
    expectTypeOf<PostAuthenticationTriggerSource>().toEqualTypeOf<'PostAuthentication_Authentication'>();
  });
});

suite('PostAuthenticationRequest', () => {
  test('has triggerSource field', () => {
    expectTypeOf<PostAuthenticationRequest['triggerSource']>().toEqualTypeOf<PostAuthenticationTriggerSource>();
  });

  test('has userAttributes field', () => {
    expectTypeOf<PostAuthenticationRequest['userAttributes']>().toEqualTypeOf<UserAttributes>();
  });

  test('has event field', () => {
    expectTypeOf<PostAuthenticationRequest['event']>().toEqualTypeOf<PostAuthenticationTriggerEvent>();
  });

  test('has context field', () => {
    expectTypeOf<PostAuthenticationRequest['context']>().toEqualTypeOf<Context>();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<PostAuthenticationRequest<CustomAttributes>['userAttributes']>().toEqualTypeOf<CustomAttributes>();
  });
});

suite('PostAuthenticationResponse', () => {
  test('matches event response type', () => {
    expectTypeOf<PostAuthenticationResponse>().toEqualTypeOf<PostAuthenticationTriggerEvent['response']>();
  });
});

suite('PostAuthenticationHandler', () => {
  test('accepts PostAuthenticationRequest and returns Promise<PostAuthenticationTriggerEvent>', () => {
    expectTypeOf<PostAuthenticationHandler>().toEqualTypeOf<
      (request: PostAuthenticationRequest) => Promise<PostAuthenticationTriggerEvent>
    >();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<PostAuthenticationHandler<CustomAttributes>>().toEqualTypeOf<
      (request: PostAuthenticationRequest<CustomAttributes>) => Promise<PostAuthenticationTriggerEvent>
    >();
  });
});

suite('PostAuthenticationRouteDefinition', () => {
  test('has optional filters field', () => {
    expectTypeOf<PostAuthenticationRouteDefinition>().toHaveProperty('filters');
  });

  test('has optional userAttributesSchema field', () => {
    expectTypeOf<PostAuthenticationRouteDefinition>().toHaveProperty('userAttributesSchema');
  });

  test('has handler field matching PostAuthenticationHandler', () => {
    expectTypeOf<PostAuthenticationRouteDefinition['handler']>().toEqualTypeOf<PostAuthenticationHandler>();
  });

  test('filters use PostAuthenticationTriggerSource', () => {
    expectTypeOf<NonNullable<PostAuthenticationRouteDefinition['filters']>>().toEqualTypeOf<
      CognitoFilters<PostAuthenticationTriggerSource>
    >();
  });
});

// =============================================================================
// DefineAuthChallenge
// =============================================================================

suite('DefineAuthChallengeTriggerSource', () => {
  test('resolves to expected literal', () => {
    expectTypeOf<DefineAuthChallengeTriggerSource>().toEqualTypeOf<'DefineAuthChallenge_Authentication'>();
  });
});

suite('DefineAuthChallengeRequest', () => {
  test('has triggerSource field', () => {
    expectTypeOf<DefineAuthChallengeRequest['triggerSource']>().toEqualTypeOf<DefineAuthChallengeTriggerSource>();
  });

  test('has userAttributes field', () => {
    expectTypeOf<DefineAuthChallengeRequest['userAttributes']>().toEqualTypeOf<UserAttributes>();
  });

  test('has event field', () => {
    expectTypeOf<DefineAuthChallengeRequest['event']>().toEqualTypeOf<DefineAuthChallengeTriggerEvent>();
  });

  test('has context field', () => {
    expectTypeOf<DefineAuthChallengeRequest['context']>().toEqualTypeOf<Context>();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<DefineAuthChallengeRequest<CustomAttributes>['userAttributes']>().toEqualTypeOf<CustomAttributes>();
  });
});

suite('DefineAuthChallengeResponse', () => {
  test('matches event response type', () => {
    expectTypeOf<DefineAuthChallengeResponse>().toEqualTypeOf<DefineAuthChallengeTriggerEvent['response']>();
  });
});

suite('DefineAuthChallengeHandler', () => {
  test('accepts DefineAuthChallengeRequest and returns Promise<DefineAuthChallengeTriggerEvent>', () => {
    expectTypeOf<DefineAuthChallengeHandler>().toEqualTypeOf<
      (request: DefineAuthChallengeRequest) => Promise<DefineAuthChallengeTriggerEvent>
    >();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<DefineAuthChallengeHandler<CustomAttributes>>().toEqualTypeOf<
      (request: DefineAuthChallengeRequest<CustomAttributes>) => Promise<DefineAuthChallengeTriggerEvent>
    >();
  });
});

suite('DefineAuthChallengeRouteDefinition', () => {
  test('has optional filters field', () => {
    expectTypeOf<DefineAuthChallengeRouteDefinition>().toHaveProperty('filters');
  });

  test('has optional userAttributesSchema field', () => {
    expectTypeOf<DefineAuthChallengeRouteDefinition>().toHaveProperty('userAttributesSchema');
  });

  test('has handler field matching DefineAuthChallengeHandler', () => {
    expectTypeOf<DefineAuthChallengeRouteDefinition['handler']>().toEqualTypeOf<DefineAuthChallengeHandler>();
  });

  test('filters use DefineAuthChallengeTriggerSource', () => {
    expectTypeOf<NonNullable<DefineAuthChallengeRouteDefinition['filters']>>().toEqualTypeOf<
      CognitoFilters<DefineAuthChallengeTriggerSource>
    >();
  });
});

// =============================================================================
// CreateAuthChallenge
// =============================================================================

suite('CreateAuthChallengeTriggerSource', () => {
  test('resolves to expected literal', () => {
    expectTypeOf<CreateAuthChallengeTriggerSource>().toEqualTypeOf<'CreateAuthChallenge_Authentication'>();
  });
});

suite('CreateAuthChallengeRequest', () => {
  test('has triggerSource field', () => {
    expectTypeOf<CreateAuthChallengeRequest['triggerSource']>().toEqualTypeOf<CreateAuthChallengeTriggerSource>();
  });

  test('has userAttributes field', () => {
    expectTypeOf<CreateAuthChallengeRequest['userAttributes']>().toEqualTypeOf<UserAttributes>();
  });

  test('has event field', () => {
    expectTypeOf<CreateAuthChallengeRequest['event']>().toEqualTypeOf<CreateAuthChallengeTriggerEvent>();
  });

  test('has context field', () => {
    expectTypeOf<CreateAuthChallengeRequest['context']>().toEqualTypeOf<Context>();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<CreateAuthChallengeRequest<CustomAttributes>['userAttributes']>().toEqualTypeOf<CustomAttributes>();
  });
});

suite('CreateAuthChallengeResponse', () => {
  test('matches event response type', () => {
    expectTypeOf<CreateAuthChallengeResponse>().toEqualTypeOf<CreateAuthChallengeTriggerEvent['response']>();
  });
});

suite('CreateAuthChallengeHandler', () => {
  test('accepts CreateAuthChallengeRequest and returns Promise<CreateAuthChallengeTriggerEvent>', () => {
    expectTypeOf<CreateAuthChallengeHandler>().toEqualTypeOf<
      (request: CreateAuthChallengeRequest) => Promise<CreateAuthChallengeTriggerEvent>
    >();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<CreateAuthChallengeHandler<CustomAttributes>>().toEqualTypeOf<
      (request: CreateAuthChallengeRequest<CustomAttributes>) => Promise<CreateAuthChallengeTriggerEvent>
    >();
  });
});

suite('CreateAuthChallengeRouteDefinition', () => {
  test('has optional filters field', () => {
    expectTypeOf<CreateAuthChallengeRouteDefinition>().toHaveProperty('filters');
  });

  test('has optional userAttributesSchema field', () => {
    expectTypeOf<CreateAuthChallengeRouteDefinition>().toHaveProperty('userAttributesSchema');
  });

  test('has handler field matching CreateAuthChallengeHandler', () => {
    expectTypeOf<CreateAuthChallengeRouteDefinition['handler']>().toEqualTypeOf<CreateAuthChallengeHandler>();
  });

  test('filters use CreateAuthChallengeTriggerSource', () => {
    expectTypeOf<NonNullable<CreateAuthChallengeRouteDefinition['filters']>>().toEqualTypeOf<
      CognitoFilters<CreateAuthChallengeTriggerSource>
    >();
  });
});

// =============================================================================
// VerifyAuthChallengeResponse
// =============================================================================

suite('VerifyAuthChallengeResponseTriggerSource', () => {
  test('resolves to expected literal', () => {
    expectTypeOf<VerifyAuthChallengeResponseTriggerSource>().toEqualTypeOf<'VerifyAuthChallengeResponse_Authentication'>();
  });
});

suite('VerifyAuthChallengeResponseRequest', () => {
  test('has triggerSource field', () => {
    expectTypeOf<
      VerifyAuthChallengeResponseRequest['triggerSource']
    >().toEqualTypeOf<VerifyAuthChallengeResponseTriggerSource>();
  });

  test('has userAttributes field', () => {
    expectTypeOf<VerifyAuthChallengeResponseRequest['userAttributes']>().toEqualTypeOf<UserAttributes>();
  });

  test('has event field', () => {
    expectTypeOf<
      VerifyAuthChallengeResponseRequest['event']
    >().toEqualTypeOf<VerifyAuthChallengeResponseTriggerEvent>();
  });

  test('has context field', () => {
    expectTypeOf<VerifyAuthChallengeResponseRequest['context']>().toEqualTypeOf<Context>();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<
      VerifyAuthChallengeResponseRequest<CustomAttributes>['userAttributes']
    >().toEqualTypeOf<CustomAttributes>();
  });
});

suite('VerifyAuthChallengeResponseResponse', () => {
  test('matches event response type', () => {
    expectTypeOf<VerifyAuthChallengeResponseResponse>().toEqualTypeOf<
      VerifyAuthChallengeResponseTriggerEvent['response']
    >();
  });
});

suite('VerifyAuthChallengeResponseHandler', () => {
  test('accepts VerifyAuthChallengeResponseRequest and returns Promise<VerifyAuthChallengeResponseTriggerEvent>', () => {
    expectTypeOf<VerifyAuthChallengeResponseHandler>().toEqualTypeOf<
      (request: VerifyAuthChallengeResponseRequest) => Promise<VerifyAuthChallengeResponseTriggerEvent>
    >();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<VerifyAuthChallengeResponseHandler<CustomAttributes>>().toEqualTypeOf<
      (
        request: VerifyAuthChallengeResponseRequest<CustomAttributes>,
      ) => Promise<VerifyAuthChallengeResponseTriggerEvent>
    >();
  });
});

suite('VerifyAuthChallengeResponseRouteDefinition', () => {
  test('has optional filters field', () => {
    expectTypeOf<VerifyAuthChallengeResponseRouteDefinition>().toHaveProperty('filters');
  });

  test('has optional userAttributesSchema field', () => {
    expectTypeOf<VerifyAuthChallengeResponseRouteDefinition>().toHaveProperty('userAttributesSchema');
  });

  test('has handler field matching VerifyAuthChallengeResponseHandler', () => {
    expectTypeOf<
      VerifyAuthChallengeResponseRouteDefinition['handler']
    >().toEqualTypeOf<VerifyAuthChallengeResponseHandler>();
  });

  test('filters use VerifyAuthChallengeResponseTriggerSource', () => {
    expectTypeOf<NonNullable<VerifyAuthChallengeResponseRouteDefinition['filters']>>().toEqualTypeOf<
      CognitoFilters<VerifyAuthChallengeResponseTriggerSource>
    >();
  });
});
