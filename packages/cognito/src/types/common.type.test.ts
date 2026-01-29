import type { PreSignUpTriggerEvent } from 'aws-lambda';
import type { CognitoFilterInput, CognitoFilters, UserAttributeFilter, UserAttributes } from './index.js';

suite('UserAttributes', () => {
  test('is Record<string, string>', () => {
    expectTypeOf<UserAttributes>().toEqualTypeOf<Record<string, string>>();
  });
});

suite('UserAttributeFilter', () => {
  test('accepts string', () => {
    expectTypeOf<string>().toMatchTypeOf<UserAttributeFilter>();
  });

  test('accepts RegExp', () => {
    expectTypeOf<RegExp>().toMatchTypeOf<UserAttributeFilter>();
  });

  test('accepts function', () => {
    expectTypeOf<(value: string) => boolean>().toMatchTypeOf<UserAttributeFilter>();
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
  test('has optional triggerSources field', () => {
    expectTypeOf<CognitoFilters>().toHaveProperty('triggerSources');
  });

  test('has optional userPoolIds field', () => {
    expectTypeOf<CognitoFilters>().toHaveProperty('userPoolIds');
  });

  test('has optional clientIds field', () => {
    expectTypeOf<CognitoFilters>().toHaveProperty('clientIds');
  });

  test('has optional userAttributes field', () => {
    expectTypeOf<CognitoFilters>().toHaveProperty('userAttributes');
  });

  test('has optional customFilter field', () => {
    expectTypeOf<CognitoFilters>().toHaveProperty('customFilter');
  });

  test('narrows triggerSources with generic', () => {
    type Narrowed = NonNullable<CognitoFilters<'PreSignUp_SignUp'>['triggerSources']>;
    expectTypeOf<Narrowed>().toEqualTypeOf<'PreSignUp_SignUp'[]>();
  });
});
