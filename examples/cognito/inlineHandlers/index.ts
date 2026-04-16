import { LambdaRouter } from '@lambda-event-router/base';
import { type CognitoFilterInput, createCognitoRouter, type PreSignUpRequest } from '@lambda-event-router/cognito';
import type { Handler } from 'aws-lambda';

import { createAuthChallengeRoute } from './handlers/createAuthChallengeRoute.js';
import { customMessageForgotPasswordRoute, customMessageSignUpRoute } from './handlers/customMessageRoute.js';
import { defineAuthChallengeRoute } from './handlers/defineAuthChallengeRoute.js';
import { postAuthenticationRoute } from './handlers/postAuthenticationRoute.js';
import { postConfirmationRoute } from './handlers/postConfirmationRoute.js';
import { preAuthenticationRoute } from './handlers/preAuthenticationRoute.js';
import { preSignUpAdminCreateUserRoute } from './handlers/preSignUpAdminCreateUserRoute.js';
import { preSignUpAdminRoute } from './handlers/preSignUpAdminRoute.js';
import { preSignUpRoute } from './handlers/preSignUpRoute.js';
import { preSignUpSignUpRoute } from './handlers/preSignUpSignUpRoute.js';
import { preTokenGenerationRoute } from './handlers/preTokenGenerationRoute.js';
import { userMigrationRoute } from './handlers/userMigrationRoute.js';
import { verifyAuthChallengeResponseRoute } from './handlers/verifyAuthChallengeResponseRoute.js';

// Create the Cognito router
const cognitoRouter = createCognitoRouter();

// Register PreSignUp routes using grouped method
cognitoRouter.preSignUp(preSignUpRoute).preSignUp(preSignUpAdminRoute);

// Alternative: Register PreSignUp routes using individual trigger source methods
// These methods are type-safe and only accept the specific trigger source
cognitoRouter.preSignUpSignUp(preSignUpSignUpRoute).preSignUpAdminCreateUser(preSignUpAdminCreateUserRoute);

// Register authentication routes
cognitoRouter.preAuthentication(preAuthenticationRoute).postAuthentication(postAuthenticationRoute);

// Register PostConfirmation route
cognitoRouter.postConfirmation(postConfirmationRoute);

// Register custom auth challenge routes
cognitoRouter
  .defineAuthChallenge(defineAuthChallengeRoute)
  .createAuthChallenge(createAuthChallengeRoute)
  .verifyAuthChallengeResponse(verifyAuthChallengeResponseRoute);

// Register CustomMessage routes
cognitoRouter.customMessage(customMessageSignUpRoute).customMessage(customMessageForgotPasswordRoute);

// Register PreTokenGeneration route
cognitoRouter.preTokenGeneration(preTokenGenerationRoute);

// Register UserMigration route
cognitoRouter.userMigration(userMigrationRoute);

const ENTERPRISE_CLIENT_ID = 'enterprise-app-client-id';

// Register PreSignUp route with customFilter for enterprise clients
cognitoRouter.preSignUp({
  filters: {
    triggerSource: 'PreSignUp_SignUp',
    customFilter: ({ callerContext }: CognitoFilterInput) => {
      const clientId = callerContext.clientId;
      return clientId === ENTERPRISE_CLIENT_ID;
    },
  },
  handler: async ({ event }: PreSignUpRequest) => {
    console.log(`Enterprise signup: ${event.userName} via client ${event.callerContext.clientId}`);

    event.response.autoConfirmUser = true;
    event.response.autoVerifyEmail = true;

    return event;
  },
});

// Create the lambda router
const lambdaRouter = new LambdaRouter({
  routers: [cognitoRouter],
});

export const handler: Handler = lambdaRouter.handler();
