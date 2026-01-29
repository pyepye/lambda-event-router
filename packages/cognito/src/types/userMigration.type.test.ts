import type { Context, UserMigrationTriggerEvent } from 'aws-lambda';
import type {
  CognitoFilters,
  UserAttributes,
  UserMigrationHandler,
  UserMigrationRequest,
  UserMigrationResponse,
  UserMigrationRouteDefinition,
  UserMigrationTriggerSource,
} from './index.js';

suite('UserMigrationTriggerSource', () => {
  test('resolves to expected literals', () => {
    expectTypeOf<UserMigrationTriggerSource>().toEqualTypeOf<
      'UserMigration_Authentication' | 'UserMigration_ForgotPassword'
    >();
  });
});

suite('UserMigrationRequest', () => {
  test('has triggerSource field', () => {
    expectTypeOf<UserMigrationRequest['triggerSource']>().toEqualTypeOf<UserMigrationTriggerSource>();
  });

  test('has userAttributes field', () => {
    expectTypeOf<UserMigrationRequest['userAttributes']>().toEqualTypeOf<UserAttributes>();
  });

  test('has event field', () => {
    expectTypeOf<UserMigrationRequest['event']>().toEqualTypeOf<UserMigrationTriggerEvent>();
  });

  test('has context field', () => {
    expectTypeOf<UserMigrationRequest['context']>().toEqualTypeOf<Context>();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<UserMigrationRequest<CustomAttributes>['userAttributes']>().toEqualTypeOf<CustomAttributes>();
  });
});

suite('UserMigrationResponse', () => {
  test('matches event response type', () => {
    expectTypeOf<UserMigrationResponse>().toEqualTypeOf<UserMigrationTriggerEvent['response']>();
  });
});

suite('UserMigrationHandler', () => {
  test('accepts UserMigrationRequest and returns Promise<UserMigrationTriggerEvent>', () => {
    expectTypeOf<UserMigrationHandler>().toEqualTypeOf<
      (request: UserMigrationRequest) => Promise<UserMigrationTriggerEvent>
    >();
  });

  test('preserves custom user attributes generic', () => {
    type CustomAttributes = { email: string } & Record<string, string>;
    expectTypeOf<UserMigrationHandler<CustomAttributes>>().toEqualTypeOf<
      (request: UserMigrationRequest<CustomAttributes>) => Promise<UserMigrationTriggerEvent>
    >();
  });
});

suite('UserMigrationRouteDefinition', () => {
  test('has optional filters field', () => {
    expectTypeOf<UserMigrationRouteDefinition>().toHaveProperty('filters');
  });

  test('has optional userAttributesSchema field', () => {
    expectTypeOf<UserMigrationRouteDefinition>().toHaveProperty('userAttributesSchema');
  });

  test('has handler field matching UserMigrationHandler', () => {
    expectTypeOf<UserMigrationRouteDefinition['handler']>().toEqualTypeOf<UserMigrationHandler>();
  });

  test('filters use UserMigrationTriggerSource', () => {
    expectTypeOf<NonNullable<UserMigrationRouteDefinition['filters']>>().toEqualTypeOf<
      CognitoFilters<UserMigrationTriggerSource>
    >();
  });
});
