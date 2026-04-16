import type { PreSignUpTriggerEvent } from 'aws-lambda';

// User attributes type - derived from aws-lambda
export type UserAttributes = NonNullable<PreSignUpTriggerEvent['request']['userAttributes']>;

// User attribute filter - can be exact match, RegExp, or function
export type UserAttributeFilter = string | RegExp | ((value: string) => boolean);

// Filter input for custom filters - uses types derived from aws-lambda
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
  userPoolId?: PreSignUpTriggerEvent['userPoolId'] | PreSignUpTriggerEvent['userPoolId'][];
  clientId?: PreSignUpTriggerEvent['callerContext']['clientId'] | PreSignUpTriggerEvent['callerContext']['clientId'][];
  userAttributes?: Record<string, UserAttributeFilter>;
  customFilter?: (input: CognitoFilterInput<TTriggerSource>) => boolean;
}

// Generic route definition (used internally by the router)
// Trigger-specific route definitions are in their respective type files
