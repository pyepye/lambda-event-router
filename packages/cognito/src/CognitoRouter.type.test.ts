import { createMockSchema } from '@lambda-event-router/testing';

import { createCognitoRouter, defineRoute } from './CognitoRouter.js';
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
    const router = createCognitoRouter().preSignUp({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<PreSignUpRequest>();
        return request.event;
      },
    });

    expect(router).toBeDefined();
  });

  test('types the custom filter', () => {
    const router = createCognitoRouter().preSignUp({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<PreSignUpTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: PreSignUpRequest) => event,
    });

    expect(router).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'PreSignUp_SignUp' } }).handle(
      async ({ event }) => event,
    );

    const router = createCognitoRouter().preSignUp(definition);

    expect(router).toBeDefined();
  });

  test('types an inferred handler with the attribute schema output', () => {
    const router = createCognitoRouter().preSignUp({
      userAttributesSchema: createMockSchema<VerifiedAttributes>(),
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request.userAttributes).toEqualTypeOf<VerifiedAttributes>();
        return request.event;
      },
    });

    expect(router).toBeDefined();
  });
});

suite('preAuthentication()', () => {
  test('types an inferred handler', () => {
    const router = createCognitoRouter().preAuthentication({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<PreAuthenticationRequest>();
        return request.event;
      },
    });

    expect(router).toBeDefined();
  });

  test('types the custom filter', () => {
    const router = createCognitoRouter().preAuthentication({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<PreAuthenticationTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: PreAuthenticationRequest) => event,
    });

    expect(router).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'PreAuthentication_Authentication' } }).handle(
      async ({ event }) => event,
    );

    const router = createCognitoRouter().preAuthentication(definition);

    expect(router).toBeDefined();
  });
});

suite('postAuthentication()', () => {
  test('types an inferred handler', () => {
    const router = createCognitoRouter().postAuthentication({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<PostAuthenticationRequest>();
        return request.event;
      },
    });

    expect(router).toBeDefined();
  });

  test('types the custom filter', () => {
    const router = createCognitoRouter().postAuthentication({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<PostAuthenticationTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: PostAuthenticationRequest) => event,
    });

    expect(router).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'PostAuthentication_Authentication' } }).handle(
      async ({ event }) => event,
    );

    const router = createCognitoRouter().postAuthentication(definition);

    expect(router).toBeDefined();
  });
});

suite('postConfirmation()', () => {
  test('types an inferred handler', () => {
    const router = createCognitoRouter().postConfirmation({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<PostConfirmationRequest>();
        return request.event;
      },
    });

    expect(router).toBeDefined();
  });

  test('types the custom filter', () => {
    const router = createCognitoRouter().postConfirmation({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<PostConfirmationTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: PostConfirmationRequest) => event,
    });

    expect(router).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'PostConfirmation_ConfirmSignUp' } }).handle(
      async ({ event }) => event,
    );

    const router = createCognitoRouter().postConfirmation(definition);

    expect(router).toBeDefined();
  });
});

suite('defineAuthChallenge()', () => {
  test('types an inferred handler', () => {
    const router = createCognitoRouter().defineAuthChallenge({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<DefineAuthChallengeRequest>();
        return request.event;
      },
    });

    expect(router).toBeDefined();
  });

  test('types the custom filter', () => {
    const router = createCognitoRouter().defineAuthChallenge({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<DefineAuthChallengeTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: DefineAuthChallengeRequest) => event,
    });

    expect(router).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'DefineAuthChallenge_Authentication' } }).handle(
      async ({ event }) => event,
    );

    const router = createCognitoRouter().defineAuthChallenge(definition);

    expect(router).toBeDefined();
  });
});

suite('createAuthChallenge()', () => {
  test('types an inferred handler', () => {
    const router = createCognitoRouter().createAuthChallenge({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<CreateAuthChallengeRequest>();
        return request.event;
      },
    });

    expect(router).toBeDefined();
  });

  test('types the custom filter', () => {
    const router = createCognitoRouter().createAuthChallenge({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<CreateAuthChallengeTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: CreateAuthChallengeRequest) => event,
    });

    expect(router).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'CreateAuthChallenge_Authentication' } }).handle(
      async ({ event }) => event,
    );

    const router = createCognitoRouter().createAuthChallenge(definition);

    expect(router).toBeDefined();
  });
});

suite('verifyAuthChallengeResponse()', () => {
  test('types an inferred handler', () => {
    const router = createCognitoRouter().verifyAuthChallengeResponse({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<VerifyAuthChallengeResponseRequest>();
        return request.event;
      },
    });

    expect(router).toBeDefined();
  });

  test('types the custom filter', () => {
    const router = createCognitoRouter().verifyAuthChallengeResponse({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<VerifyAuthChallengeResponseTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: VerifyAuthChallengeResponseRequest) => event,
    });

    expect(router).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'VerifyAuthChallengeResponse_Authentication' } }).handle(
      async ({ event }) => event,
    );

    const router = createCognitoRouter().verifyAuthChallengeResponse(definition);

    expect(router).toBeDefined();
  });
});

suite('customMessage()', () => {
  test('types an inferred handler', () => {
    const router = createCognitoRouter().customMessage({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<CustomMessageRequest>();
        return request.event;
      },
    });

    expect(router).toBeDefined();
  });

  test('types the custom filter', () => {
    const router = createCognitoRouter().customMessage({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<CustomMessageTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: CustomMessageRequest) => event,
    });

    expect(router).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'CustomMessage_SignUp' } }).handle(
      async ({ event }) => event,
    );

    const router = createCognitoRouter().customMessage(definition);

    expect(router).toBeDefined();
  });
});

suite('customEmailSender()', () => {
  test('types an inferred handler', () => {
    const router = createCognitoRouter().customEmailSender({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<CustomEmailSenderRequest>();
        return request.event;
      },
    });

    expect(router).toBeDefined();
  });

  test('types the custom filter', () => {
    const router = createCognitoRouter().customEmailSender({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<CustomEmailSenderTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: CustomEmailSenderRequest) => event,
    });

    expect(router).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'CustomEmailSender_SignUp' } }).handle(
      async ({ event }) => event,
    );

    const router = createCognitoRouter().customEmailSender(definition);

    expect(router).toBeDefined();
  });
});

suite('preTokenGeneration()', () => {
  test('types an inferred handler', () => {
    const router = createCognitoRouter().preTokenGeneration({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<PreTokenGenerationRequest>();
        return request.event;
      },
    });

    expect(router).toBeDefined();
  });

  test('types the custom filter', () => {
    const router = createCognitoRouter().preTokenGeneration({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<PreTokenGenerationTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: PreTokenGenerationRequest) => event,
    });

    expect(router).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'TokenGeneration_HostedAuth' } }).handle(
      async ({ event }) => event,
    );

    const router = createCognitoRouter().preTokenGeneration(definition);

    expect(router).toBeDefined();
  });
});

suite('userMigration()', () => {
  test('types an inferred handler', () => {
    const router = createCognitoRouter().userMigration({
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request).toEqualTypeOf<UserMigrationRequest>();
        return request.event;
      },
    });

    expect(router).toBeDefined();
  });

  test('types the custom filter', () => {
    const router = createCognitoRouter().userMigration({
      filters: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<CognitoFilterInput<UserMigrationTriggerSource>>();
          return true;
        },
      },
      handler: async ({ event }: UserMigrationRequest) => event,
    });

    expect(router).toBeDefined();
  });

  test('takes a trigger-pinned defineRoute result', () => {
    const definition = defineRoute({ filters: { triggerSource: 'UserMigration_Authentication' } }).handle(
      async ({ event }) => event,
    );

    const router = createCognitoRouter().userMigration(definition);

    expect(router).toBeDefined();
  });
});
