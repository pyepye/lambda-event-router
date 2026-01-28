import { test } from '@lambda-event-router/testing';
import { CognitoRouter } from './CognitoRouter.js';

suite('CognitoRouter - trigger methods', () => {
  suite('addTriggerRoute', () => {
    let router: CognitoRouter;

    beforeEach(() => {
      router = new CognitoRouter();
    });

    test('uses definition triggerSources when provided', ({ cognitoPreSignUpEvent }) => {
      router.preSignUp({
        filters: { triggerSources: ['PreSignUp_AdminCreateUser'] },
        handler: vi.fn(),
      });

      const event = cognitoPreSignUpEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, event.triggerSource);

      expect(result).toBeUndefined();
    });

    test('copies userPoolIds, clientIds, userAttributes, customFilter from filters', ({ cognitoPreSignUpEvent }) => {
      const customFilter = vi.fn().mockReturnValue(true);
      router.preSignUp({
        filters: {
          userPoolIds: ['us-east-1_TestPool'],
          clientIds: ['test-client-id'],
          userAttributes: { email: 'test@example.com' },
          customFilter,
        },
        handler: vi.fn(),
      });

      const event = cognitoPreSignUpEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, event.triggerSource);

      expect(result).toBeDefined();
      expect(customFilter).toHaveBeenCalled();
    });
  });

  suite('chaining', () => {
    let router: CognitoRouter;

    beforeEach(() => {
      router = new CognitoRouter();
    });

    test.each([
      'preSignUp',
      'preAuthentication',
      'postAuthentication',
      'postConfirmation',
      'defineAuthChallenge',
      'createAuthChallenge',
      'verifyAuthChallengeResponse',
      'customMessage',
      'customEmailSender',
      'preTokenGeneration',
      'userMigration',
      'preSignUpSignUp',
      'preSignUpAdminCreateUser',
      'preSignUpExternalProvider',
      'preAuthenticationAuthentication',
      'postAuthenticationAuthentication',
      'postConfirmationConfirmSignUp',
      'postConfirmationConfirmForgotPassword',
      'defineAuthChallengeAuthentication',
      'createAuthChallengeAuthentication',
      'verifyAuthChallengeResponseAuthentication',
      'customMessageSignUp',
      'customMessageAdminCreateUser',
      'customMessageResendCode',
      'customMessageForgotPassword',
      'customMessageUpdateUserAttribute',
      'customMessageVerifyUserAttribute',
      'customMessageAuthentication',
      'customEmailSenderSignUp',
      'customEmailSenderResendCode',
      'customEmailSenderForgotPassword',
      'customEmailSenderUpdateUserAttribute',
      'customEmailSenderVerifyUserAttribute',
      'customEmailSenderAdminCreateUser',
      'customEmailSenderAuthentication',
      'customEmailSenderAccountTakeOverNotification',
      'preTokenGenerationHostedAuth',
      'preTokenGenerationAuthentication',
      'preTokenGenerationNewPasswordChallenge',
      'preTokenGenerationAuthenticateDevice',
      'preTokenGenerationRefreshTokens',
      'userMigrationAuthentication',
      'userMigrationForgotPassword',
    ] as const)('%s returns the router instance', (method) => {
      // @ts-expect-error - calling union of method signatures
      const result = router[method]({ handler: vi.fn() });
      expect(result).toBe(router);
    });
  });

  suite('convenience methods - default trigger sources', () => {
    let router: CognitoRouter;

    beforeEach(() => {
      router = new CognitoRouter();
    });

    test('preSignUp matches all PreSignUp trigger sources', ({ cognitoPreSignUpEvent }) => {
      router.preSignUp({ handler: vi.fn() });

      const preSignUpTriggers = [
        'PreSignUp_SignUp',
        'PreSignUp_AdminCreateUser',
        'PreSignUp_ExternalProvider',
      ] as const;
      for (const triggerSource of preSignUpTriggers) {
        const event = cognitoPreSignUpEvent();
        event.triggerSource = triggerSource;
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);
        expect(result).toBeDefined();
      }
    });

    test('preAuthentication matches PreAuthentication_Authentication', ({ cognitoPreAuthenticationEvent }) => {
      router.preAuthentication({ handler: vi.fn() });

      const event = cognitoPreAuthenticationEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, event.triggerSource);

      expect(result).toBeDefined();
    });

    test('postAuthentication matches PostAuthentication_Authentication', ({ cognitoPostAuthenticationEvent }) => {
      router.postAuthentication({ handler: vi.fn() });

      const event = cognitoPostAuthenticationEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, event.triggerSource);

      expect(result).toBeDefined();
    });

    test('postConfirmation matches all PostConfirmation trigger sources', ({ cognitoPostConfirmationEvent }) => {
      router.postConfirmation({ handler: vi.fn() });

      const postConfirmationTriggers = [
        'PostConfirmation_ConfirmSignUp',
        'PostConfirmation_ConfirmForgotPassword',
      ] as const;
      for (const triggerSource of postConfirmationTriggers) {
        const event = cognitoPostConfirmationEvent();
        event.triggerSource = triggerSource;
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);
        expect(result).toBeDefined();
      }
    });

    test('defineAuthChallenge matches DefineAuthChallenge_Authentication', ({ cognitoDefineAuthChallengeEvent }) => {
      router.defineAuthChallenge({ handler: vi.fn() });

      const event = cognitoDefineAuthChallengeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, event.triggerSource);

      expect(result).toBeDefined();
    });

    test('createAuthChallenge matches CreateAuthChallenge_Authentication', ({ cognitoCreateAuthChallengeEvent }) => {
      router.createAuthChallenge({ handler: vi.fn() });

      const event = cognitoCreateAuthChallengeEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, event.triggerSource);

      expect(result).toBeDefined();
    });

    test('verifyAuthChallengeResponse matches VerifyAuthChallengeResponse_Authentication', ({
      cognitoVerifyAuthChallengeResponseEvent,
    }) => {
      router.verifyAuthChallengeResponse({ handler: vi.fn() });

      const event = cognitoVerifyAuthChallengeResponseEvent();
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event, event.triggerSource);

      expect(result).toBeDefined();
    });

    test('customMessage matches all CustomMessage trigger sources', ({ cognitoCustomMessageEvent }) => {
      router.customMessage({ handler: vi.fn() });

      const triggerSources = [
        'CustomMessage_SignUp',
        'CustomMessage_AdminCreateUser',
        'CustomMessage_ResendCode',
        'CustomMessage_ForgotPassword',
        'CustomMessage_UpdateUserAttribute',
        'CustomMessage_VerifyUserAttribute',
        'CustomMessage_Authentication',
      ] as const;

      for (const triggerSource of triggerSources) {
        const event = cognitoCustomMessageEvent();
        event.triggerSource = triggerSource;
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);
        expect(result).toBeDefined();
      }
    });

    test('customEmailSender matches all CustomEmailSender trigger sources', ({ cognitoCustomEmailSenderEvent }) => {
      router.customEmailSender({ handler: vi.fn() });

      const triggerSources = [
        'CustomEmailSender_SignUp',
        'CustomEmailSender_ResendCode',
        'CustomEmailSender_ForgotPassword',
        'CustomEmailSender_UpdateUserAttribute',
        'CustomEmailSender_VerifyUserAttribute',
        'CustomEmailSender_AdminCreateUser',
        'CustomEmailSender_Authentication',
        'CustomEmailSender_AccountTakeOverNotification',
      ] as const;

      for (const triggerSource of triggerSources) {
        const event = cognitoCustomEmailSenderEvent();
        event.triggerSource = triggerSource;
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);
        expect(result).toBeDefined();
      }
    });

    test('preTokenGeneration matches all TokenGeneration trigger sources', ({ cognitoPreTokenGenerationEvent }) => {
      router.preTokenGeneration({ handler: vi.fn() });

      const triggerSources = [
        'TokenGeneration_HostedAuth',
        'TokenGeneration_Authentication',
        'TokenGeneration_NewPasswordChallenge',
        'TokenGeneration_AuthenticateDevice',
        'TokenGeneration_RefreshTokens',
      ] as const;

      for (const triggerSource of triggerSources) {
        const event = cognitoPreTokenGenerationEvent();
        event.triggerSource = triggerSource;
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);
        expect(result).toBeDefined();
      }
    });

    test('userMigration matches all UserMigration trigger sources', ({ cognitoUserMigrationEvent }) => {
      router.userMigration({ handler: vi.fn() });

      const userMigrationTriggers = ['UserMigration_Authentication', 'UserMigration_ForgotPassword'] as const;
      for (const triggerSource of userMigrationTriggers) {
        const event = cognitoUserMigrationEvent();
        event.triggerSource = triggerSource;
        // @ts-expect-error - testing private method directly
        const result = router.matchRoute(event, event.triggerSource);
        expect(result).toBeDefined();
      }
    });
  });

  suite('individual trigger source methods - specificity', () => {
    test('preSignUpSignUp matches only PreSignUp_SignUp', ({ cognitoPreSignUpEvent }) => {
      const router = new CognitoRouter();
      router.preSignUpSignUp({ handler: vi.fn() });

      const matchEvent = cognitoPreSignUpEvent();
      // @ts-expect-error - testing private method directly
      expect(router.matchRoute(matchEvent, matchEvent.triggerSource)).toBeDefined();

      const noMatchEvent = cognitoPreSignUpEvent();
      noMatchEvent.triggerSource = 'PreSignUp_AdminCreateUser';
      // @ts-expect-error - testing private method directly
      expect(router.matchRoute(noMatchEvent, noMatchEvent.triggerSource)).toBeUndefined();
    });

    test('preSignUpAdminCreateUser matches only PreSignUp_AdminCreateUser', ({ cognitoPreSignUpEvent }) => {
      const router = new CognitoRouter();
      router.preSignUpAdminCreateUser({ handler: vi.fn() });

      const matchEvent = cognitoPreSignUpEvent();
      matchEvent.triggerSource = 'PreSignUp_AdminCreateUser';
      // @ts-expect-error - testing private method directly
      expect(router.matchRoute(matchEvent, matchEvent.triggerSource)).toBeDefined();

      const noMatchEvent = cognitoPreSignUpEvent();
      // @ts-expect-error - testing private method directly
      expect(router.matchRoute(noMatchEvent, noMatchEvent.triggerSource)).toBeUndefined();
    });

    test('preSignUpExternalProvider matches only PreSignUp_ExternalProvider', ({ cognitoPreSignUpEvent }) => {
      const router = new CognitoRouter();
      router.preSignUpExternalProvider({ handler: vi.fn() });

      const matchEvent = cognitoPreSignUpEvent();
      matchEvent.triggerSource = 'PreSignUp_ExternalProvider';
      // @ts-expect-error - testing private method directly
      expect(router.matchRoute(matchEvent, matchEvent.triggerSource)).toBeDefined();

      const noMatchEvent = cognitoPreSignUpEvent();
      // @ts-expect-error - testing private method directly
      expect(router.matchRoute(noMatchEvent, noMatchEvent.triggerSource)).toBeUndefined();
    });

    test('postConfirmationConfirmSignUp matches only PostConfirmation_ConfirmSignUp', ({
      cognitoPostConfirmationEvent,
    }) => {
      const router = new CognitoRouter();
      router.postConfirmationConfirmSignUp({ handler: vi.fn() });

      const matchEvent = cognitoPostConfirmationEvent();
      // @ts-expect-error - testing private method directly
      expect(router.matchRoute(matchEvent, matchEvent.triggerSource)).toBeDefined();

      const noMatchEvent = cognitoPostConfirmationEvent();
      noMatchEvent.triggerSource = 'PostConfirmation_ConfirmForgotPassword';
      // @ts-expect-error - testing private method directly
      expect(router.matchRoute(noMatchEvent, noMatchEvent.triggerSource)).toBeUndefined();
    });

    test('customMessageSignUp matches only CustomMessage_SignUp', ({ cognitoCustomMessageEvent }) => {
      const router = new CognitoRouter();
      router.customMessageSignUp({ handler: vi.fn() });

      const matchEvent = cognitoCustomMessageEvent();
      // @ts-expect-error - testing private method directly
      expect(router.matchRoute(matchEvent, matchEvent.triggerSource)).toBeDefined();

      const noMatchEvent = cognitoCustomMessageEvent();
      noMatchEvent.triggerSource = 'CustomMessage_ForgotPassword';
      // @ts-expect-error - testing private method directly
      expect(router.matchRoute(noMatchEvent, noMatchEvent.triggerSource)).toBeUndefined();
    });

    test('customEmailSenderSignUp matches only CustomEmailSender_SignUp', ({ cognitoCustomEmailSenderEvent }) => {
      const router = new CognitoRouter();
      router.customEmailSenderSignUp({ handler: vi.fn() });

      const matchEvent = cognitoCustomEmailSenderEvent();
      // @ts-expect-error - testing private method directly
      expect(router.matchRoute(matchEvent, matchEvent.triggerSource)).toBeDefined();

      const noMatchEvent = cognitoCustomEmailSenderEvent();
      noMatchEvent.triggerSource = 'CustomEmailSender_ForgotPassword';
      // @ts-expect-error - testing private method directly
      expect(router.matchRoute(noMatchEvent, noMatchEvent.triggerSource)).toBeUndefined();
    });

    test('preTokenGenerationHostedAuth matches only TokenGeneration_HostedAuth', ({
      cognitoPreTokenGenerationEvent,
    }) => {
      const router = new CognitoRouter();
      router.preTokenGenerationHostedAuth({ handler: vi.fn() });

      const matchEvent = cognitoPreTokenGenerationEvent();
      matchEvent.triggerSource = 'TokenGeneration_HostedAuth';
      // @ts-expect-error - testing private method directly
      expect(router.matchRoute(matchEvent, matchEvent.triggerSource)).toBeDefined();

      const noMatchEvent = cognitoPreTokenGenerationEvent();
      // @ts-expect-error - testing private method directly
      expect(router.matchRoute(noMatchEvent, noMatchEvent.triggerSource)).toBeUndefined();
    });

    test('userMigrationAuthentication matches only UserMigration_Authentication', ({ cognitoUserMigrationEvent }) => {
      const router = new CognitoRouter();
      router.userMigrationAuthentication({ handler: vi.fn() });

      const matchEvent = cognitoUserMigrationEvent();
      // @ts-expect-error - testing private method directly
      expect(router.matchRoute(matchEvent, matchEvent.triggerSource)).toBeDefined();

      const noMatchEvent = cognitoUserMigrationEvent();
      noMatchEvent.triggerSource = 'UserMigration_ForgotPassword';
      // @ts-expect-error - testing private method directly
      expect(router.matchRoute(noMatchEvent, noMatchEvent.triggerSource)).toBeUndefined();
    });
  });
});
