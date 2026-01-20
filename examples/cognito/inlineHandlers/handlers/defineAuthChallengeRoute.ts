import { defineRoute } from '@lambda-event-router/cognito';

// DefineAuthChallenge - control the authentication flow
// Handlers modify the cloned event and return it
export const defineAuthChallengeRoute = defineRoute({
  filters: {
    triggerSources: ['DefineAuthChallenge_Authentication'],
  },
}).handle(async ({ event }) => {
  const { session } = event.request;

  console.log(`Defining auth challenge for: ${event.userName}`);
  console.log(`Session length: ${session.length}`);

  // If no session yet, start with custom challenge
  if (session.length === 0) {
    event.response.challengeName = 'CUSTOM_CHALLENGE';
    event.response.failAuthentication = false;
    event.response.issueTokens = false;
    return event;
  }

  // Check last challenge result
  const lastChallenge = session[session.length - 1];
  if (!lastChallenge) {
    event.response.challengeName = 'CUSTOM_CHALLENGE';
    event.response.failAuthentication = false;
    event.response.issueTokens = false;
    return event;
  }

  // If custom challenge was successful, issue tokens
  if (lastChallenge.challengeName === 'CUSTOM_CHALLENGE' && lastChallenge.challengeResult) {
    event.response.failAuthentication = false;
    event.response.issueTokens = true;
    return event;
  }

  // Too many failed attempts
  if (session.length >= 3) {
    event.response.failAuthentication = true;
    event.response.issueTokens = false;
    return event;
  }

  // Retry custom challenge
  event.response.challengeName = 'CUSTOM_CHALLENGE';
  event.response.failAuthentication = false;
  event.response.issueTokens = false;

  return event;
});
