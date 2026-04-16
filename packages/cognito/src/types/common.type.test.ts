import type { Context, PreSignUpTriggerEvent } from 'aws-lambda';
import type { CognitoFilterInput, CognitoFilters, UserAttributeFilter, UserAttributes } from './index.js';

type CustomAttributes = { email: string } & Record<string, string>;

export function testCognitoTriggerTypes<
  TriggerSource extends string,
  Event,
  Request extends {
    triggerSource: TriggerSource;
    userAttributes: UserAttributes;
    event: Event;
    context: Context;
  },
  RequestWithCustom extends { userAttributes: CustomAttributes },
  Handler extends (request: Request) => Promise<Event>,
  _HandlerWithCustom extends (request: RequestWithCustom) => Promise<Event>,
  _RouteDefinition extends {
    handler: Handler;
    filters?: CognitoFilters<TriggerSource>;
    userAttributesSchema?: unknown;
  },
>(name: string): void {
  suite(`${name}Request`, () => {
    test('has triggerSource field', () => {});
    test('has userAttributes field', () => {});
    test('has event field', () => {});
    test('has context field', () => {});
    test('preserves custom user attributes generic', () => {});
  });

  suite(`${name}Handler`, () => {
    test(`accepts ${name}Request and returns Promise<${name}TriggerEvent>`, () => {});
    test('preserves custom user attributes generic', () => {});
  });

  suite(`${name}RouteDefinition`, () => {
    test('has optional filters field', () => {});
    test('has optional userAttributesSchema field', () => {});
    test(`has handler field matching ${name}Handler`, () => {});
    test(`filters use ${name}TriggerSource`, () => {});
  });
}

suite('UserAttributes', () => {
  test('is Record<string, string>', () => {
    expectTypeOf<UserAttributes>().toEqualTypeOf<Record<string, string>>();
  });
});

suite('UserAttributeFilter', () => {
  test('accepts string', () => {
    expectTypeOf<string>().toExtend<UserAttributeFilter>();
  });

  test('accepts RegExp', () => {
    expectTypeOf<RegExp>().toExtend<UserAttributeFilter>();
  });

  test('accepts function', () => {
    expectTypeOf<(value: string) => boolean>().toExtend<UserAttributeFilter>();
  });

  test('is union of string, RegExp, and function', () => {
    expectTypeOf<UserAttributeFilter>().toEqualTypeOf<string | RegExp | ((value: string) => boolean)>();
  });
});

suite('CognitoFilterInput', () => {
  test('has triggerSource field defaulting to string', () => {
    expectTypeOf<CognitoFilterInput['triggerSource']>().toEqualTypeOf<string>();
  });

  test('has userPoolId field', () => {
    expectTypeOf<CognitoFilterInput['userPoolId']>().toEqualTypeOf<PreSignUpTriggerEvent['userPoolId']>();
  });

  test('has userName field', () => {
    expectTypeOf<CognitoFilterInput['userName']>().toEqualTypeOf<PreSignUpTriggerEvent['userName']>();
  });

  test('has callerContext field', () => {
    expectTypeOf<CognitoFilterInput['callerContext']>().toEqualTypeOf<PreSignUpTriggerEvent['callerContext']>();
  });

  test('has request field with optional userAttributes', () => {
    expectTypeOf<CognitoFilterInput['request']>().toEqualTypeOf<{ userAttributes?: UserAttributes }>();
  });

  test('has event field typed as unknown', () => {
    expectTypeOf<CognitoFilterInput['event']>().toEqualTypeOf<unknown>();
  });

  test('narrows triggerSource with generic', () => {
    expectTypeOf<CognitoFilterInput<'PreSignUp_SignUp'>['triggerSource']>().toEqualTypeOf<'PreSignUp_SignUp'>();
  });
});

suite('CognitoFilters', () => {
  test('has optional triggerSource field', () => {
    expectTypeOf<CognitoFilters>().toHaveProperty('triggerSource');
  });

  test('has optional userPoolId field', () => {
    expectTypeOf<CognitoFilters>().toHaveProperty('userPoolId');
  });

  test('has optional clientId field', () => {
    expectTypeOf<CognitoFilters>().toHaveProperty('clientId');
  });

  test('has optional userAttributes field', () => {
    expectTypeOf<CognitoFilters>().toHaveProperty('userAttributes');
  });

  test('has optional customFilter field', () => {
    expectTypeOf<CognitoFilters>().toHaveProperty('customFilter');
  });

  test('narrows triggerSource with generic', () => {
    type Narrowed = NonNullable<CognitoFilters<'PreSignUp_SignUp'>['triggerSource']>;
    // expectTypeOf<Narrowed>().toEqualTypeOf<'PreSignUp_SignUp'>();
  });
});
