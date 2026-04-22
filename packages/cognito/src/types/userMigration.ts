import type { Context, UserMigrationTriggerEvent } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { CognitoFilters, UserAttributes } from './common.js';
import type { CognitoMiddleware } from './router.js';

// UserMigration trigger sources - derived from aws-lambda
export type UserMigrationTriggerSource = UserMigrationTriggerEvent['triggerSource'];

// UserMigration response - derived from aws-lambda
export type UserMigrationResponse = UserMigrationTriggerEvent['response'];

// UserMigration request - simplified to just essential fields
// Note: userAttributes will be empty for migration as user doesn't exist yet
export interface UserMigrationRequest<TUserAttributes extends UserAttributes = UserAttributes> {
  triggerSource: UserMigrationTriggerSource;
  userAttributes: TUserAttributes;
  event: UserMigrationTriggerEvent;
  context: Context;
}

// UserMigration handler type
// Handlers modify the cloned event and return it
export type UserMigrationHandler<TUserAttributes extends UserAttributes = UserAttributes> = (
  request: UserMigrationRequest<TUserAttributes>,
) => Promise<UserMigrationTriggerEvent>;

// UserMigration route definition
export interface UserMigrationRouteDefinition<TUserAttributes extends UserAttributes = UserAttributes> {
  filters?: CognitoFilters<UserMigrationTriggerSource>;
  userAttributesSchema?: StandardSchemaV1<unknown, TUserAttributes>;
  middleware?: CognitoMiddleware[];
  handler: UserMigrationHandler<TUserAttributes>;
}
