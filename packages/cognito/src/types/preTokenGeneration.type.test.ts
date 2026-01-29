import type { Context, PreTokenGenerationTriggerEvent } from 'aws-lambda';
import type {
  CognitoFilters,
  PreTokenGenerationHandler,
  PreTokenGenerationRequest,
  PreTokenGenerationResponse,
  PreTokenGenerationRouteDefinition,
  PreTokenGenerationTriggerSource,
  UserAttributes,
} from './index.js';

suite('PreTokenGenerationTriggerSource', () => {
  test('resolves to expected literals', () => {
    expectTypeOf<PreTokenGenerationTriggerSource>().toEqualTypeOf<
      | 'TokenGeneration_HostedAuth'
      | 'TokenGeneration_Authentication'
      | 'TokenGeneration_NewPasswordChallenge'
      | 'TokenGeneration_AuthenticateDevice'
      | 'TokenGeneration_RefreshTokens'
    >();
  });
});

suite('PreTokenGenerationRequest', () => {
  test('has triggerSource field', () => {
    expectTypeOf<PreTokenGenerationRequest['triggerSource']>().toEqualTypeOf<PreTokenGenerationTriggerSource>();
  });

  test('has userAttributes field', () => {
    expectTypeOf<PreTokenGenerationRequest['userAttributes']>().toEqualTypeOf<UserAttributes>();
  });

  test('has event field', () => {
    expectTypeOf<PreTokenGenerationRequest['event']>().toEqualTypeOf<PreTokenGenerationTriggerEvent>();
  });

  test('has context field', () => {
    expectTypeOf<PreTokenGenerationRequest['context']>().toEqualTypeOf<Context>();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<PreTokenGenerationRequest<CustomAttributes>['userAttributes']>().toEqualTypeOf<CustomAttributes>();
  });
});

suite('PreTokenGenerationResponse', () => {
  test('matches event response type', () => {
    expectTypeOf<PreTokenGenerationResponse>().toEqualTypeOf<PreTokenGenerationTriggerEvent['response']>();
  });
});

suite('PreTokenGenerationHandler', () => {
  test('accepts PreTokenGenerationRequest and returns Promise<PreTokenGenerationTriggerEvent>', () => {
    expectTypeOf<PreTokenGenerationHandler>().toEqualTypeOf<
      (request: PreTokenGenerationRequest) => Promise<PreTokenGenerationTriggerEvent>
    >();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<PreTokenGenerationHandler<CustomAttributes>>().toEqualTypeOf<
      (request: PreTokenGenerationRequest<CustomAttributes>) => Promise<PreTokenGenerationTriggerEvent>
    >();
  });
});

suite('PreTokenGenerationRouteDefinition', () => {
  test('has optional filters field', () => {
    expectTypeOf<PreTokenGenerationRouteDefinition>().toHaveProperty('filters');
  });

  test('has optional userAttributesSchema field', () => {
    expectTypeOf<PreTokenGenerationRouteDefinition>().toHaveProperty('userAttributesSchema');
  });

  test('has handler field matching PreTokenGenerationHandler', () => {
    expectTypeOf<PreTokenGenerationRouteDefinition['handler']>().toEqualTypeOf<PreTokenGenerationHandler>();
  });

  test('filters use PreTokenGenerationTriggerSource', () => {
    expectTypeOf<NonNullable<PreTokenGenerationRouteDefinition['filters']>>().toEqualTypeOf<
      CognitoFilters<PreTokenGenerationTriggerSource>
    >();
  });
});
