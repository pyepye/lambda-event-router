import type { CognitoEvent, CognitoFilterInput, CognitoRequest } from '@lambda-event-router/cognito';

// Custom filter function for complex logic
export function isTestUser({ triggerSource, userName }: CognitoFilterInput): boolean {
  // Example: Only match test users in non-production triggers
  return userName.startsWith('test_') && !triggerSource.includes('Admin');
}

// Type guard for PreSignUp response
function hasAutoConfirmUser(response: object): response is { autoConfirmUser: boolean } {
  return Object.hasOwn(response, 'autoConfirmUser');
}

// Generic handler - receives union of all request types
// Handlers modify the cloned event and return it
export async function genericHandler(request: CognitoRequest): Promise<CognitoEvent> {
  console.log(`[Audit] Trigger: ${request.triggerSource}, User: ${request.event.userName}`);

  // Handle based on trigger type
  if (request.triggerSource.startsWith('PreSignUp_')) {
    // Narrow type based on trigger and mutate response
    if (hasAutoConfirmUser(request.event.response)) {
      request.event.response.autoConfirmUser = false;
    }
  }

  // Other triggers may have no response modification

  return request.event;
}
