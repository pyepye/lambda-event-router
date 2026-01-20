import type { Handler } from 'aws-lambda';

import { EventRouter } from '@lambda-event-router/base';
import { createCognitoRouter } from '@lambda-event-router/cognito';

import {
  createAuthChallenge,
  defineAuthChallenge,
  verifyAuthChallengeResponse,
} from './handlers/customAuthChallenge.js';
import { customMessage } from './handlers/customMessage.js';
import { genericHandler, isTestUser } from './handlers/genericRoute.js';
import { postAuthentication } from './handlers/postAuthentication.js';
import { postConfirmation } from './handlers/postConfirmation.js';
import { preAuthentication } from './handlers/preAuthentication.js';
import { preTokenGeneration } from './handlers/preTokenGeneration.js';
import { UserAttributesSchema, preSignUp, preSignUpAdmin } from './handlers/preSignUp.js';
import { userMigration } from './handlers/userMigration.js';

const cognitoRouter = createCognitoRouter();

// =============================================================================
// Option 1: Using grouped method with triggerSources filter
// =============================================================================

// PreSignUp - self registration with schema validation
cognitoRouter.preSignUp({
  filters: {
    triggerSources: ['PreSignUp_SignUp'],
    userAttributes: {
      email: /@(company\.com|partner\.org)$/,
    },
  },
  handler: preSignUp,
  userAttributesSchema: UserAttributesSchema,
});

// PreSignUp - admin created users
cognitoRouter.preSignUp({
  filters: {
    triggerSources: ['PreSignUp_AdminCreateUser'],
  },
  handler: preSignUpAdmin,
});

// =============================================================================
// Option 2: Using individual trigger source methods (recommended)
// These are type-safe - you can only use the correct trigger source
// =============================================================================

// PreSignUp_SignUp - self registration
cognitoRouter.preSignUpSignUp({
  filters: {
    userAttributes: {
      email: /@(company\.com|partner\.org)$/,
    },
  },
  handler: preSignUp,
  userAttributesSchema: UserAttributesSchema,
});

// PreSignUp_AdminCreateUser - admin created users
cognitoRouter.preSignUpAdminCreateUser({
  handler: preSignUpAdmin,
});

// PreAuthentication - validate before authentication
cognitoRouter.preAuthentication({
  handler: preAuthentication,
});

// PostAuthentication - log successful logins
cognitoRouter.postAuthentication({
  handler: postAuthentication,
});

// PostConfirmation - handle user confirmation
cognitoRouter.postConfirmation({
  handler: postConfirmation,
});

// Custom authentication challenge flow
cognitoRouter.defineAuthChallenge({
  handler: defineAuthChallenge,
});

cognitoRouter.createAuthChallenge({
  handler: createAuthChallenge,
});

cognitoRouter.verifyAuthChallengeResponse({
  handler: verifyAuthChallengeResponse,
});

// CustomMessage - customize verification emails/SMS
cognitoRouter.customMessage({
  handler: customMessage,
});

// PreTokenGeneration - add custom claims to tokens
cognitoRouter.preTokenGeneration({
  handler: preTokenGeneration,
});

// UserMigration - migrate users from legacy system
cognitoRouter.userMigration({
  handler: userMigration,
});

// Generic route() method - handles any trigger type with custom filtering
cognitoRouter.route({
  filters: {
    userPoolIds: ['us-east-1_abc123'],
    customFilter: isTestUser,
  },
  handler: genericHandler,
});

const eventRouter = new EventRouter({
  routers: [cognitoRouter],
});

export const handler: Handler = eventRouter.handler();
