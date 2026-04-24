import type { PreSignUpTriggerEvent } from 'aws-lambda';

import type { FilterStringMatcher } from '@lambda-event-router/base';

// User attributes type - derived from aws-lambda
export type UserAttributes = NonNullable<PreSignUpTriggerEvent['request']['userAttributes']>;

// User attribute filter - can be exact match, RegExp, or function
export type UserAttributeFilter = string | RegExp | ((value: string) => boolean);

// Filter input for custom filters - uses types derived from aws-lambda
// TODO: is TTriggerSource a string really?
export interface CognitoFilterInput<TTriggerSource extends string = string> {
  triggerSource: TTriggerSource;
  userPoolId: PreSignUpTriggerEvent['userPoolId'];
  userName: PreSignUpTriggerEvent['userName'];
  callerContext: PreSignUpTriggerEvent['callerContext'];
  request: {
    userAttributes?: UserAttributes;
  };
  event: unknown;
}

// Filters for routing
export interface CognitoFilters<TTriggerSource extends string = string> {
  triggerSource?: TTriggerSource | TTriggerSource[];
  userPoolId?: FilterStringMatcher;
  clientId?: FilterStringMatcher;
  userAttributes?: Record<string, FilterStringMatcher>;
  customFilter?: (input: CognitoFilterInput<TTriggerSource>) => boolean | Promise<boolean>;
}

// Generic route definition (used internally by the router)
// Trigger-specific route definitions are in their respective type files
