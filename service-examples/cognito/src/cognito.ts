import { createCognitoRouter } from '@lambda-event-router/cognito';

import { blockWithdrawnApplicant, logSignIn } from './handlers/authentication.js';
import { provisionUser, recordPasswordReset } from './handlers/confirmation.js';
import {
  createApplicantChallenge,
  defineApplicantChallenge,
  verifyApplicantChallenge,
} from './handlers/customAuthChallenge.js';
import { deliverStaffCode } from './handlers/customEmailSender.js';
import { logDefaultMessage, writeResetEmail } from './handlers/messages.js';
import {
  autoConfirmSeniorStaff,
  holdStaffSignUp,
  queueApplicantReview,
  recordAdminCreatedUser,
  rejectTestAccount,
} from './handlers/signUp.js';
import { addApplicantClaims, markRefreshedToken } from './handlers/tokens.js';
import { migrateLegacyApplicant } from './handlers/userMigration.js';
import { logInvocation } from './middleware/logInvocation.js';
import { ADMIN_CALLER_CLIENT_ID } from './utils/constants.js';

export const cognitoRouter = createCognitoRouter({ middleware: [logInvocation] });

// Order matters and the first match wins. Each group runs from the narrowest filter to the widest, so
// a route with no filter beyond its trigger source is registered last in its group.
cognitoRouter
  .preSignUpSignUp(rejectTestAccount)
  .route({
    filters: {
      triggerSource: ['PreSignUp_SignUp', 'PreSignUp_AdminCreateUser', 'PreSignUp_ExternalProvider'],
      clientId: ADMIN_CALLER_CLIENT_ID,
    },
    handler: recordAdminCreatedUser,
  })
  .preSignUpSignUp(autoConfirmSeniorStaff)
  .preSignUpSignUp(holdStaffSignUp)
  .preSignUpSignUp(queueApplicantReview)
  .postConfirmationConfirmSignUp(provisionUser)
  .postConfirmationConfirmForgotPassword(recordPasswordReset)
  .preAuthenticationAuthentication(blockWithdrawnApplicant)
  .postAuthenticationAuthentication(logSignIn)
  .preTokenGenerationRefreshTokens(markRefreshedToken)
  .preTokenGeneration({ handler: addApplicantClaims })
  .defineAuthChallengeAuthentication(defineApplicantChallenge)
  .createAuthChallengeAuthentication(createApplicantChallenge)
  .verifyAuthChallengeResponseAuthentication(verifyApplicantChallenge)
  .userMigration({ handler: migrateLegacyApplicant })
  .customMessageForgotPassword(writeResetEmail)
  .customMessage({ handler: logDefaultMessage })
  .customEmailSender({ handler: deliverStaffCode });
