import { test } from '@lambda-event-router/testing';
import type { PreSignUpTriggerEvent } from 'aws-lambda';
import { CognitoRouter, createCognitoRouter, defineRoute } from './CognitoRouter.js';

describe('CognitoRouter', () => {
  describe('createCognitoRouter', () => {
    it('creates a CognitoRouter instance', () => {
      const router = createCognitoRouter();
      expect(router).toBeInstanceOf(CognitoRouter);
    });
  });

  describe('canHandleEvent', () => {
    it('returns true for a valid Cognito event', () => {
      const router = new CognitoRouter();
      const event = { triggerSource: 'PreSignUp_SignUp', userPoolId: 'us-east-1_TestPool' };
      expect(router.canHandleEvent(event)).toBe(true);
    });

    it('returns false for a non-Cognito event', () => {
      const router = new CognitoRouter();
      const event = { Records: [{ eventSource: 'aws:sqs' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });
  });

  describe('route', () => {
    it('returns the router instance for chaining', () => {
      const router = new CognitoRouter();

      const result = router.route({
        handler: vi.fn(),
      });

      expect(result).toBe(router);
    });
  });

  describe('preSignUp', () => {
    it('returns the router instance for chaining', () => {
      const router = new CognitoRouter();

      const result = router.preSignUp(
        defineRoute({
          filters: { triggerSources: ['PreSignUp_SignUp'] },
        }).handle(async ({ event }) => event),
      );

      expect(result).toBe(router);
    });
  });

  describe('postConfirmation', () => {
    it('returns the router instance for chaining', () => {
      const router = new CognitoRouter();

      const result = router.postConfirmation(
        defineRoute({
          filters: { triggerSources: ['PostConfirmation_ConfirmSignUp'] },
        }).handle(async ({ event }) => event),
      );

      expect(result).toBe(router);
    });
  });

  describe('handleEvent', () => {
    test('calls the matched handler with the correct request', async ({ cognitoPreSignUpHandlerEvent }) => {
      const router = new CognitoRouter();
      const handler = vi.fn().mockImplementation(async ({ event }) => event);
      router.preSignUp(
        defineRoute({
          filters: { triggerSources: ['PreSignUp_SignUp'] },
        }).handle(handler),
      );

      const { event, context } = cognitoPreSignUpHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          triggerSource: 'PreSignUp_SignUp',
          userAttributes: { email: 'test@example.com' },
          context,
        }),
      );
    });
  });

  describe('defineRoute', () => {
    it('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: { triggerSources: ['PreSignUp_SignUp'] },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });
  });

  describe('full event processing', () => {
    test('routes a PreSignUp event and returns the modified event', async ({ cognitoPreSignUpEvent, context }) => {
      const preSignUpHandler = vi.fn().mockImplementation(async ({ event }) => {
        event.response.autoConfirmUser = true;
        return event;
      });
      const postConfirmationHandler = vi.fn().mockImplementation(async ({ event }) => event);

      const router = createCognitoRouter();
      router.preSignUp(
        defineRoute({
          filters: { triggerSources: ['PreSignUp_SignUp'] },
        }).handle(preSignUpHandler),
      );
      router.postConfirmation(
        defineRoute({
          filters: { triggerSources: ['PostConfirmation_ConfirmSignUp'] },
        }).handle(postConfirmationHandler),
      );

      const event = cognitoPreSignUpEvent();
      const mockContext = context();
      const result = await router.handleEvent(event, mockContext);

      expect(preSignUpHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          triggerSource: 'PreSignUp_SignUp',
          userAttributes: { email: 'test@example.com' },
        }),
      );
      expect(postConfirmationHandler).not.toHaveBeenCalled();
      const preSignUpResult = result as PreSignUpTriggerEvent;
      expect(preSignUpResult.response.autoConfirmUser).toBe(true);
    });
  });
});
