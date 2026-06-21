import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/cognito';

import { CHALLENGE_ANSWER } from '../utils/constants.js';

const CUSTOM_CHALLENGE = 'CUSTOM_CHALLENGE';

// Drives the whole custom flow: ask once, issue tokens on a correct answer, fail on anything else.
// Cognito calls this again after each response, with the outcome appended to request.session.
export const defineApplicantChallenge = defineRoute({
  filters: { triggerSource: 'DefineAuthChallenge_Authentication' },
}).handle(async ({ event }) => {
  const attempts = event.request.session;
  const lastAttempt = attempts.at(-1);

  if (attempts.length === 0) {
    event.response.challengeName = CUSTOM_CHALLENGE;
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
  } else if (lastAttempt?.challengeName === CUSTOM_CHALLENGE && lastAttempt.challengeResult) {
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
  } else {
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
  }

  logger.info({
    message: 'Auth challenge decided',
    userName: event.userName,
    attempts: attempts.length,
    issueTokens: event.response.issueTokens,
    failAuthentication: event.response.failAuthentication,
  });

  return event;
});

// publicChallengeParameters reach the client in the InitiateAuth response. privateChallengeParameters
// stay inside Cognito and come back to verifyApplicantChallenge.
export const createApplicantChallenge = defineRoute({
  filters: { triggerSource: 'CreateAuthChallenge_Authentication' },
}).handle(async ({ event }) => {
  if (event.request.challengeName !== CUSTOM_CHALLENGE) return event;

  event.response.publicChallengeParameters = { question: 'What is your applicant reference?' };
  event.response.privateChallengeParameters = { answer: CHALLENGE_ANSWER };
  event.response.challengeMetadata = 'APPLICANT_REFERENCE';

  logger.info({ message: 'Auth challenge created', userName: event.userName });

  return event;
});

export const verifyApplicantChallenge = defineRoute({
  filters: { triggerSource: 'VerifyAuthChallengeResponse_Authentication' },
}).handle(async ({ event }) => {
  event.response.answerCorrect = event.request.challengeAnswer === event.request.privateChallengeParameters.answer;

  logger.info({
    message: 'Auth challenge answered',
    userName: event.userName,
    answerCorrect: event.response.answerCorrect,
  });

  return event;
});
