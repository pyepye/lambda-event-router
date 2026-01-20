// User attributes type
export type UserAttributes = Record<string, string>;

// User attribute filter - can be exact match, RegExp, or function
export type UserAttributeFilter = string | RegExp | ((value: string) => boolean);

// Filter input for custom filters
export interface CognitoFilterInput<TTriggerSource extends string = string> {
  triggerSource: TTriggerSource;
  userPoolId: string;
  userName: string;
  callerContext: {
    awsSdkVersion: string;
    clientId: string;
  };
  request: {
    userAttributes?: UserAttributes;
  };
  event: unknown;
}

// Filters for routing
export interface CognitoFilters<TTriggerSource extends string = string> {
  triggerSources?: TTriggerSource[];
  userPoolIds?: string[];
  clientIds?: string[];
  userAttributes?: Record<string, UserAttributeFilter>;
  customFilter?: (input: CognitoFilterInput<TTriggerSource>) => boolean;
}

// Generic route definition (used internally by the router)
// Trigger-specific route definitions are in their respective type files
