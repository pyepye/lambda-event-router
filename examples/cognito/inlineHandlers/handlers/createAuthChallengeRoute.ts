import { defineRoute } from '@lambda-event-router/cognito';

// CreateAuthChallenge - generate the challenge (e.g., OTP)
// Handlers modify the cloned event and return it
export const createAuthChallengeRoute = defineRoute({
  filters: {
    triggerSource: 'CreateAuthChallenge_Authentication',
  },
}).handle(async ({ event }) => {
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
});
