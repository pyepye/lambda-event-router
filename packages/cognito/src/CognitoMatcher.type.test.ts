import { createMockSchema } from '@latcher/testing';

import { createCognitoMatcher, defineRoute } from './CognitoMatcher.js';
import type {
  CognitoFilterInput,
  CreateAuthChallengeRequest,
  CreateAuthChallengeTriggerSource,
  CustomEmailSenderRequest,
  CustomEmailSenderTriggerSource,
  CustomMessageRequest,
  CustomMessageTriggerSource,
  DefineAuthChallengeRequest,
  DefineAuthChallengeTriggerSource,
  PostAuthenticationRequest,
  PostAuthenticationTriggerSource,
  PostConfirmationRequest,
  PostConfirmationTriggerSource,
  PreAuthenticationRequest,
  PreAuthenticationTriggerSource,
  PreSignUpRequest,
  PreSignUpTriggerSource,
  PreTokenGenerationRequest,
  PreTokenGenerationTriggerSource,
  UserMigrationRequest,
  UserMigrationTriggerSource,
  VerifyAuthChallengeResponseRequest,
  VerifyAuthChallengeResponseTriggerSource,
} from './types/index.js';

interface VerifiedAttributes {
  email: string;
  emailVerified: boolean;
}

suite('preSignUp()', () => {
  test('types an inferred handler', () => {
    const matcher = createCognitoMatcher().preSignUp({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<PreSignUpRequest>();
        return request.event;
      },
    });

    expect(matcher).toBeDefined();
  });

  test('types the custom filter', () => {
    const matcher = createCognitoMatcher().preSignUp({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<PreSignUpTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: PreSignUpRequest) => event,
    });

    expect(matcher).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'PreSignUp_SignUp' } }).handle(
      async ({ event }) => event,
    );

    const matcher = createCognitoMatcher().preSignUp(definition);

    expect(matcher).toBeDefined();
  });

  test('types an inferred handler with the attribute schema output', () => {
    const matcher = createCognitoMatcher().preSignUp({
      userAttributesSchema: createMockSchema<VerifiedAttributes>(),
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request.userAttributes).toEqualTypeOf<VerifiedAttributes>();
        return request.event;
      },
    });

    expect(matcher).toBeDefined();
  });
});

suite('preAuthentication()', () => {
  test('types an inferred handler', () => {
    const matcher = createCognitoMatcher().preAuthentication({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<PreAuthenticationRequest>();
        return request.event;
      },
    });

    expect(matcher).toBeDefined();
  });

  test('types the custom filter', () => {
    const matcher = createCognitoMatcher().preAuthentication({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<PreAuthenticationTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: PreAuthenticationRequest) => event,
    });

    expect(matcher).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'PreAuthentication_Authentication' } }).handle(
      async ({ event }) => event,
    );

    const matcher = createCognitoMatcher().preAuthentication(definition);

    expect(matcher).toBeDefined();
  });
});

suite('postAuthentication()', () => {
  test('types an inferred handler', () => {
    const matcher = createCognitoMatcher().postAuthentication({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<PostAuthenticationRequest>();
        return request.event;
      },
    });

    expect(matcher).toBeDefined();
  });

  test('types the custom filter', () => {
    const matcher = createCognitoMatcher().postAuthentication({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<PostAuthenticationTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: PostAuthenticationRequest) => event,
    });

    expect(matcher).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'PostAuthentication_Authentication' } }).handle(
      async ({ event }) => event,
    );

    const matcher = createCognitoMatcher().postAuthentication(definition);

    expect(matcher).toBeDefined();
  });
});

suite('postConfirmation()', () => {
  test('types an inferred handler', () => {
    const matcher = createCognitoMatcher().postConfirmation({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<PostConfirmationRequest>();
        return request.event;
      },
    });

    expect(matcher).toBeDefined();
  });

  test('types the custom filter', () => {
    const matcher = createCognitoMatcher().postConfirmation({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<PostConfirmationTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: PostConfirmationRequest) => event,
    });

    expect(matcher).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'PostConfirmation_ConfirmSignUp' } }).handle(
      async ({ event }) => event,
    );

    const matcher = createCognitoMatcher().postConfirmation(definition);

    expect(matcher).toBeDefined();
  });
});

suite('defineAuthChallenge()', () => {
  test('types an inferred handler', () => {
    const matcher = createCognitoMatcher().defineAuthChallenge({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<DefineAuthChallengeRequest>();
        return request.event;
      },
    });

    expect(matcher).toBeDefined();
  });

  test('types the custom filter', () => {
    const matcher = createCognitoMatcher().defineAuthChallenge({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<DefineAuthChallengeTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: DefineAuthChallengeRequest) => event,
    });

    expect(matcher).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'DefineAuthChallenge_Authentication' } }).handle(
      async ({ event }) => event,
    );

    const matcher = createCognitoMatcher().defineAuthChallenge(definition);

    expect(matcher).toBeDefined();
  });
});

suite('createAuthChallenge()', () => {
  test('types an inferred handler', () => {
    const matcher = createCognitoMatcher().createAuthChallenge({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<CreateAuthChallengeRequest>();
        return request.event;
      },
    });

    expect(matcher).toBeDefined();
  });

  test('types the custom filter', () => {
    const matcher = createCognitoMatcher().createAuthChallenge({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<CreateAuthChallengeTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: CreateAuthChallengeRequest) => event,
    });

    expect(matcher).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'CreateAuthChallenge_Authentication' } }).handle(
      async ({ event }) => event,
    );

    const matcher = createCognitoMatcher().createAuthChallenge(definition);

    expect(matcher).toBeDefined();
  });
});

suite('verifyAuthChallengeResponse()', () => {
  test('types an inferred handler', () => {
    const matcher = createCognitoMatcher().verifyAuthChallengeResponse({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<VerifyAuthChallengeResponseRequest>();
        return request.event;
      },
    });

    expect(matcher).toBeDefined();
  });

  test('types the custom filter', () => {
    const matcher = createCognitoMatcher().verifyAuthChallengeResponse({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<VerifyAuthChallengeResponseTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: VerifyAuthChallengeResponseRequest) => event,
    });

    expect(matcher).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'VerifyAuthChallengeResponse_Authentication' } }).handle(
      async ({ event }) => event,
    );

    const matcher = createCognitoMatcher().verifyAuthChallengeResponse(definition);

    expect(matcher).toBeDefined();
  });
});

suite('customMessage()', () => {
  test('types an inferred handler', () => {
    const matcher = createCognitoMatcher().customMessage({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<CustomMessageRequest>();
        return request.event;
      },
    });

    expect(matcher).toBeDefined();
  });

  test('types the custom filter', () => {
    const matcher = createCognitoMatcher().customMessage({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<CustomMessageTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: CustomMessageRequest) => event,
    });

    expect(matcher).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'CustomMessage_SignUp' } }).handle(
      async ({ event }) => event,
    );

    const matcher = createCognitoMatcher().customMessage(definition);

    expect(matcher).toBeDefined();
  });
});

suite('customEmailSender()', () => {
  test('types an inferred handler', () => {
    const matcher = createCognitoMatcher().customEmailSender({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<CustomEmailSenderRequest>();
        return request.event;
      },
    });

    expect(matcher).toBeDefined();
  });

  test('types the custom filter', () => {
    const matcher = createCognitoMatcher().customEmailSender({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<CustomEmailSenderTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: CustomEmailSenderRequest) => event,
    });

    expect(matcher).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'CustomEmailSender_SignUp' } }).handle(
      async ({ event }) => event,
    );

    const matcher = createCognitoMatcher().customEmailSender(definition);

    expect(matcher).toBeDefined();
  });
});

suite('preTokenGeneration()', () => {
  test('types an inferred handler', () => {
    const matcher = createCognitoMatcher().preTokenGeneration({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<PreTokenGenerationRequest>();
        return request.event;
      },
    });

    expect(matcher).toBeDefined();
  });

  test('types the custom filter', () => {
    const matcher = createCognitoMatcher().preTokenGeneration({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<PreTokenGenerationTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: PreTokenGenerationRequest) => event,
    });

    expect(matcher).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'TokenGeneration_HostedAuth' } }).handle(
      async ({ event }) => event,
    );

    const matcher = createCognitoMatcher().preTokenGeneration(definition);

    expect(matcher).toBeDefined();
  });
});

suite('userMigration()', () => {
  test('types an inferred handler', () => {
    const matcher = createCognitoMatcher().userMigration({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<UserMigrationRequest>();
        return request.event;
      },
    });

    expect(matcher).toBeDefined();
  });

  test('types the custom filter', () => {
    const matcher = createCognitoMatcher().userMigration({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<UserMigrationTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: UserMigrationRequest) => event,
    });

    expect(matcher).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'UserMigration_Authentication' } }).handle(
      async ({ event }) => event,
    );

    const matcher = createCognitoMatcher().userMigration(definition);

    expect(matcher).toBeDefined();
  });
});
