import { logger } from '@lambda-event-router/base';
import type { CognitoEvent, CognitoRequest } from '@lambda-event-router/cognito';
import { defineRoute } from '@lambda-event-router/cognito';

import { APPLICANTS_POOL_ID, STAFF_POOL_ID } from '../config.js';
import { withDepartment } from '../middleware/withDepartment.js';
import { TEST_ACCOUNT_PREFIX } from '../utils/constants.js';
import { StaffAttributesSchema } from '../utils/schemas.js';

// Only a custom filter reaches userName, so the test-account check cannot be written as any of the
// other filters. Registered first, ahead of the routes a test account's attributes would also match.
export const rejectTestAccount = defineRoute({
  filters: {
    triggerSource: 'PreSignUp_SignUp',
    custom: ({ userName }) => userName.startsWith(TEST_ACCOUNT_PREFIX),
  },
}).handle(async ({ event }) => {
  throw new Error(`Test accounts cannot sign up: ${event.userName}`);
});

// Admissions and registry staff skip email confirmation. The schema runs after the filters match, so
// a sign-up from those departments without a staff number fails here rather than falling to the next route.
export const autoConfirmSeniorStaff = defineRoute({
  filters: {
    triggerSource: 'PreSignUp_SignUp',
    userPoolId: STAFF_POOL_ID,
    userAttributes: { 'custom:department': ['admissions', 'registry'] },
  },
  userAttributesSchema: StaffAttributesSchema,
  middleware: [withDepartment],
}).handle(async ({ event, userAttributes }) => {
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;

  logger.info({
    message: 'Senior staff sign-up confirmed',
    userName: event.userName,
    department: userAttributes['custom:department'],
  });

  return event;
});

// Every other department confirms by email.
export const holdStaffSignUp = defineRoute({
  filters: { triggerSource: 'PreSignUp_SignUp', userPoolId: STAFF_POOL_ID },
}).handle(async ({ event, userAttributes }) => {
  logger.info({
    message: 'Staff sign-up waiting on email confirmation',
    userName: event.userName,
    department: userAttributes['custom:department'],
  });

  return event;
});

// Taught masters applicants go to the review queue. A programme outside that set matches no route,
// and the sign-up fails.
export const queueApplicantReview = defineRoute({
  filters: {
    triggerSource: 'PreSignUp_SignUp',
    userPoolId: APPLICANTS_POOL_ID,
    userAttributes: { 'custom:programme': 'msc-*' },
  },
}).handle(async ({ event, userAttributes }) => {
  logger.info({
    message: 'Applicant queued for review',
    userName: event.userName,
    programme: userAttributes['custom:programme'],
  });

  return event;
});

// Registered through route(), which types the handler against the wide union rather than one family.
// Its clientId filter is what picks admin creations out of the whole PreSignUp family, so a self
// sign-up reaches the routes below instead.
export async function recordAdminCreatedUser({ event }: CognitoRequest): Promise<CognitoEvent> {
  logger.info({ message: 'Admin created a user', userName: event.userName, userPoolId: event.userPoolId });

  return event;
}
