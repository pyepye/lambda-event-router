import type { Context, PreSignUpTriggerEvent } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { CognitoFilters, UserAttributes } from './common.js';
import type { CognitoMiddleware } from './router.js';

// PreSignUp trigger sources - derived from aws-lambda
export type PreSignUpTriggerSource = PreSignUpTriggerEvent['triggerSource'];

// PreSignUp response - derived from aws-lambda
export type PreSignUpResponse = PreSignUpTriggerEvent['response'];

// PreSignUp request - simplified to just essential fields
export interface PreSignUpRequest<TUserAttributes = UserAttributes> {
  triggerSource: PreSignUpTriggerSource;
  userAttributes: TUserAttributes;
  event: PreSignUpTriggerEvent;
  context: Context;
}

// PreSignUp handler type
// Handlers modify the cloned event and return it
export type PreSignUpHandler<TUserAttributes = UserAttributes> = (
  request: PreSignUpRequest<TUserAttributes>,
) => Promise<PreSignUpTriggerEvent>;

// PreSignUp route definition
export interface PreSignUpRouteDefinition<TUserAttributes = UserAttributes> {
  filters?: CognitoFilters<PreSignUpTriggerSource>;
  userAttributesSchema?: StandardSchemaV1<unknown, TUserAttributes>;
  middleware?: CognitoMiddleware<NoInfer<TUserAttributes>>[];
  handler: PreSignUpHandler<TUserAttributes>;
}
