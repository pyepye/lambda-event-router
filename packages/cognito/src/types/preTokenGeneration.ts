import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Context, PreTokenGenerationTriggerEvent } from 'aws-lambda';
import type { CognitoFilters, UserAttributes } from './common.js';
import type { CognitoMiddleware } from './router.js';

// PreTokenGeneration trigger sources - derived from aws-lambda
export type PreTokenGenerationTriggerSource = PreTokenGenerationTriggerEvent['triggerSource'];

// PreTokenGeneration response - derived from aws-lambda
export type PreTokenGenerationResponse = PreTokenGenerationTriggerEvent['response'];

// PreTokenGeneration request - simplified to just essential fields
export interface PreTokenGenerationRequest<TUserAttributes extends UserAttributes = UserAttributes> {
  triggerSource: PreTokenGenerationTriggerSource;
  userAttributes: TUserAttributes;
  event: PreTokenGenerationTriggerEvent;
  context: Context;
}

// PreTokenGeneration handler type
// Handlers modify the cloned event and return it
export type PreTokenGenerationHandler<TUserAttributes extends UserAttributes = UserAttributes> = (
  request: PreTokenGenerationRequest<TUserAttributes>,
) => Promise<PreTokenGenerationTriggerEvent>;

// PreTokenGeneration route definition
export interface PreTokenGenerationRouteDefinition<TUserAttributes extends UserAttributes = UserAttributes> {
  filters?: CognitoFilters<PreTokenGenerationTriggerSource>;
  userAttributesSchema?: StandardSchemaV1<unknown, TUserAttributes>;
  middleware?: CognitoMiddleware[];
  handler: PreTokenGenerationHandler<TUserAttributes>;
}
