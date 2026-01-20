import { defineRoute } from '@lambda-event-router/cognito';

// VerifyAuthChallengeResponse - verify the user's answer
// Handlers modify the cloned event and return it
export const verifyAuthChallengeResponseRoute = defineRoute({
  filters: {
    triggerSources: ['VerifyAuthChallengeResponse_Authentication'],
  },
}).handle(async ({ event }) => {
  const { challengeAnswer, privateChallengeParameters } = event.request;

  console.log(`Verifying challenge response for: ${event.userName}`);

  const expectedAnswer = privateChallengeParameters.expectedAnswer;
  const answerCorrect = challengeAnswer === expectedAnswer;

  console.log(`Answer correct: ${answerCorrect}`);

  event.response.answerCorrect = answerCorrect;

  return event;
});
