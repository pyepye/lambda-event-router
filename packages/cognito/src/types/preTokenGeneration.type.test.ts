import type { PreTokenGenerationTriggerEvent } from 'aws-lambda';

import { testCognitoTriggerTypes } from './common.type.test.js';
import type {
  PreTokenGenerationHandler,
  PreTokenGenerationRequest,
  PreTokenGenerationResponse,
  PreTokenGenerationRouteDefinition,
  PreTokenGenerationTriggerSource,
} from './index.js';

type CustomAttributes = { email: string } & Record<string, string>;

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

suite('PreTokenGenerationResponse', () => {
  test('matches event response type', () => {
    expectTypeOf<PreTokenGenerationResponse>().toEqualTypeOf<PreTokenGenerationTriggerEvent['response']>();
  });
});

testCognitoTriggerTypes<
  PreTokenGenerationTriggerSource,
  PreTokenGenerationTriggerEvent,
  PreTokenGenerationRequest,
  PreTokenGenerationRequest<CustomAttributes>,
  PreTokenGenerationHandler,
  PreTokenGenerationHandler<CustomAttributes>,
  PreTokenGenerationRouteDefinition
>('PreTokenGeneration');
