import { defineRoute } from '@lambda-event-router/cognito';

// CustomMessage - customize verification messages
// Handlers modify the cloned event and return it
export const customMessageSignUpRoute = defineRoute({
  filters: {
    triggerSources: ['CustomMessage_SignUp'],
  },
}).handle(async ({ event }) => {
  console.log(`Custom signup message for: ${event.userName}`);

  event.response.emailSubject = 'Welcome! Please verify your email';
  event.response.emailMessage = `Hi ${event.request.userAttributes.name || event.userName},\n\nYour verification code is: ${event.request.codeParameter}\n\nThanks for signing up!`;
  event.response.smsMessage = `Your verification code is: ${event.request.codeParameter}`;

  return event;
});

// Handlers modify the cloned event and return it
export const customMessageForgotPasswordRoute = defineRoute({
  filters: {
    triggerSources: ['CustomMessage_ForgotPassword'],
  },
}).handle(async ({ event }) => {
  console.log(`Password reset message for: ${event.userName}`);

  event.response.emailSubject = 'Password Reset Request';
  event.response.emailMessage = `Hi ${event.request.userAttributes.name || event.userName},\n\nYour password reset code is: ${event.request.codeParameter}`;
  event.response.smsMessage = `Your password reset code is: ${event.request.codeParameter}`;

  return event;
});
