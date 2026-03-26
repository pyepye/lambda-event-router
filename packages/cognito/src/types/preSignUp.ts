import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Context, PreSignUpTriggerEvent } from 'aws-lambda';
import type { CognitoFilters, UserAttributes } from './common.js';

// PreSignUp trigger sources - derived from aws-lambda
export type PreSignUpTriggerSource = PreSignUpTriggerEvent['triggerSource'];

// PreSignUp response - derived from aws-lambda
export type PreSignUpResponse = PreSignUpTriggerEvent['response'];

// PreSignUp request - simplified to just essential fields
export interface PreSignUpRequest<TUserAttributes extends UserAttributes = UserAttributes> {
  triggerSource: PreSignUpTriggerSource;
  userAttributes: TUserAttributes;
  event: PreSignUpTriggerEvent;
  context: Context;
}

// PreSignUp handler type
// Handlers modify the cloned event and return it
export type PreSignUpHandler<TUserAttributes extends UserAttributes = UserAttributes> = (
  request: PreSignUpRequest<TUserAttributes>,
) => Promise<PreSignUpTriggerEvent>;

// PreSignUp route definition
export interface PreSignUpRouteDefinition<TUserAttributes extends UserAttributes = UserAttributes> {
  filters?: CognitoFilters<PreSignUpTriggerSource>;
  userAttributesSchema?: StandardSchemaV1<unknown, TUserAttributes>;
  handler: PreSignUpHandler<TUserAttributes>;
}
