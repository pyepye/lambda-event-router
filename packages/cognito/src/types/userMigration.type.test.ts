import type { UserMigrationTriggerEvent } from 'aws-lambda';

import { testCognitoTriggerTypes } from './common.type.test.js';
import type {
  UserMigrationHandler,
  UserMigrationRequest,
  UserMigrationResponse,
  UserMigrationRouteDefinition,
  UserMigrationTriggerSource,
} from './index.js';

type CustomAttributes = { email: string } & Record<string, string>;

suite('UserMigrationTriggerSource', () => {
  test('resolves to expected literals', () => {
    expectTypeOf<UserMigrationTriggerSource>().toEqualTypeOf<
      'UserMigration_Authentication' | 'UserMigration_ForgotPassword'
    >();
  });
});

suite('UserMigrationResponse', () => {
  test('matches event response type', () => {
    expectTypeOf<UserMigrationResponse>().toEqualTypeOf<UserMigrationTriggerEvent['response']>();
  });
});

testCognitoTriggerTypes<
  UserMigrationTriggerSource,
  UserMigrationTriggerEvent,
  UserMigrationRequest,
  UserMigrationRequest<CustomAttributes>,
  UserMigrationHandler,
  UserMigrationHandler<CustomAttributes>,
  UserMigrationRouteDefinition
>('UserMigration');
