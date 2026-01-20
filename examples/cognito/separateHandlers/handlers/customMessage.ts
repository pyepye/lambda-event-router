import type { CustomMessageRequest } from '@lambda-event-router/cognito';
import type { CustomMessageTriggerEvent } from 'aws-lambda';

// Handlers modify the cloned event and return it
export async function customMessage(request: CustomMessageRequest): Promise<CustomMessageTriggerEvent> {
  const { event, triggerSource } = request;

  console.log(`Custom message for: ${event.userName}`);
  console.log(`Trigger: ${triggerSource}`);
  console.log(`Code parameter: ${event.request.codeParameter}`);

  // Customize verification messages based on trigger
  if (triggerSource === 'CustomMessage_SignUp') {
    event.response.emailSubject = 'Welcome! Please verify your email';
    event.response.emailMessage = `Hi ${event.request.userAttributes.name || event.userName},\n\nYour verification code is: ${event.request.codeParameter}\n\nThanks for signing up!`;
    event.response.smsMessage = `Your verification code is: ${event.request.codeParameter}`;
    return event;
  }

  if (triggerSource === 'CustomMessage_ForgotPassword') {
    event.response.emailSubject = 'Password Reset Request';
    event.response.emailMessage = `Hi ${event.request.userAttributes.name || event.userName},\n\nYour password reset code is: ${event.request.codeParameter}\n\nIf you didn't request this, please ignore this email.`;
    event.response.smsMessage = `Your password reset code is: ${event.request.codeParameter}`;
    return event;
  }

  // Default message for other triggers
  event.response.emailSubject = 'Your verification code';
  event.response.emailMessage = `Your code is: ${event.request.codeParameter}`;
  event.response.smsMessage = `Your code is: ${event.request.codeParameter}`;

  return event;
}
