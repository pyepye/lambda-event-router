import type {
  CreateAuthChallengeRequest,
  DefineAuthChallengeRequest,
  VerifyAuthChallengeResponseRequest,
} from '@lambda-event-router/cognito';
import type {
  CreateAuthChallengeTriggerEvent,
  DefineAuthChallengeTriggerEvent,
  VerifyAuthChallengeResponseTriggerEvent,
} from 'aws-lambda';

// Define the authentication flow
// Handlers modify the cloned event and return it
export async function defineAuthChallenge(
  request: DefineAuthChallengeRequest,
): Promise<DefineAuthChallengeTriggerEvent> {
  const { event } = request;
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
}

// Create the challenge (e.g., generate OTP)
// Handlers modify the cloned event and return it
export async function createAuthChallenge(
  request: CreateAuthChallengeRequest,
): Promise<CreateAuthChallengeTriggerEvent> {
  const { event } = request;

  console.log(`Creating auth challenge for: ${event.userName}`);
  console.log(`Challenge name: ${event.request.challengeName}`);

  // Generate a 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // In production, send OTP via SMS/email
  // await sendOtp(event.userName, otp);

  console.log(`Generated OTP for ${event.userName}: ${otp}`);

  event.response.publicChallengeParameters = {
    hint: 'Enter the 6-digit code sent to your phone',
  };
  event.response.privateChallengeParameters = {
    expectedAnswer: otp,
  };
  event.response.challengeMetadata = `OTP_CHALLENGE_${Date.now()}`;

  return event;
}

// Verify the challenge response
// Handlers modify the cloned event and return it
export async function verifyAuthChallengeResponse(
  request: VerifyAuthChallengeResponseRequest,
): Promise<VerifyAuthChallengeResponseTriggerEvent> {
  const { event } = request;
  const { challengeAnswer, privateChallengeParameters } = event.request;

  console.log(`Verifying challenge response for: ${event.userName}`);

  const expectedAnswer = privateChallengeParameters.expectedAnswer;
  const answerCorrect = challengeAnswer === expectedAnswer;

  console.log(`Answer correct: ${answerCorrect}`);

  event.response.answerCorrect = answerCorrect;

  return event;
}
