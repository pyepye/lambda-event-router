// Cognito sends this in place of an app client id when an admin call creates a user. An admin
// confirmation delivers no client id at all, so this does not stand in for every admin call.
export const ADMIN_CALLER_CLIENT_ID = 'CLIENT_ID_NOT_APPLICABLE';

// A username with this prefix never gets an account.
export const TEST_ACCOUNT_PREFIX = 'test-';

// The answer the custom auth challenge accepts.
export const CHALLENGE_ANSWER = 'applicant-reference-8842';

// Every applicant in the portal Cognito is replacing. A real migration would query that system.
export const LEGACY_ACCOUNT_PREFIX = 'legacy-';
export const LEGACY_PASSWORD = 'Legacy-Portal-2019';
export const LEGACY_PROGRAMME = 'msc-classics';

// Mail to the SES mailbox simulator is accepted and discarded, so no verification code reaches an
// inbox. Cognito counts code sends per destination address and rejects a sign-up once an address is
// over its limit, so every user needs an address of its own.
export function simulatorEmail(label: string): string {
  return `success+${label}@simulator.amazonses.com`;
}
