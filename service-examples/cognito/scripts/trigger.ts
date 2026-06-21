import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import {
  AdminConfirmSignUpCommand,
  AdminCreateUserCommand,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  type AttributeType,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ForgotPasswordCommand,
  GetUserAttributeVerificationCodeCommand,
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
  UpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider';

import { CHALLENGE_ANSWER, LEGACY_PASSWORD, simulatorEmail } from '../src/utils/constants.js';

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? process.env.CDK_DEFAULT_REGION;
if (!region) throw new Error('Set AWS_REGION to the region the stack is deployed in.');

const stackName = process.argv[2] ?? 'ler-example-cognito';

const cognito = new CognitoIdentityProviderClient({ region });
const cloudFormation = new CloudFormationClient({ region });
const logs = new CloudWatchLogsClient({ region });

const PASSWORD = 'Portal-2026a';
const NEW_PASSWORD = 'Portal-2026b';
const CODE_WAIT_MS = 90_000;
const CODE_POLL_MS = 5_000;

const run = Date.now().toString(36);
const startedAt = Date.now();

// =============================================================================
// Stack outputs
// =============================================================================

const { Stacks } = await cloudFormation.send(new DescribeStacksCommand({ StackName: stackName }));
const outputs = new Map((Stacks?.[0]?.Outputs ?? []).map((entry) => [entry.OutputKey, entry.OutputValue]));

function output(key: string): string {
  const value = outputs.get(key);
  if (!value) throw new Error(`Stack ${stackName} has no output ${key}. Deploy it first.`);
  return value;
}

const applicantsPoolId = output('ApplicantsPoolId');
const applicantsClientId = output('ApplicantsClientId');
const staffPoolId = output('StaffPoolId');
const staffClientId = output('StaffClientId');
const workerLogGroup = output('WorkerLogGroupName');

// =============================================================================
// Helpers
// =============================================================================

function attributes(values: Record<string, string>): AttributeType[] {
  return Object.entries(values).map(([Name, Value]) => ({ Name, Value }));
}

function report(step: string, detail: string): void {
  console.log(`${step}: ${detail}`);
}

async function expectFailure(step: string, expected: string, action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(expected)) throw new Error(`${step}: expected "${expected}" but got "${message}"`);
    report(step, message);
    return;
  }
  throw new Error(`${step}: expected a failure containing "${expected}"`);
}

function claims(idToken: string): Record<string, unknown> {
  const payload = idToken.split('.')[1];
  if (!payload) throw new Error('ID token has no payload');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

function expectClaim(step: string, idToken: string, name: string, expected: string): void {
  const value = claims(idToken)[name];
  if (value !== expected) throw new Error(`${step}: claim ${name} is ${String(value)}, expected ${expected}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The custom email sender trigger is the only place a real code exists, so the reset flow reads it
// back out of the worker's log.
async function waitForStaffCode(userName: string): Promise<string> {
  const deadline = Date.now() + CODE_WAIT_MS;

  while (Date.now() < deadline) {
    const page = await logs.send(
      new FilterLogEventsCommand({
        logGroupName: workerLogGroup,
        startTime: startedAt,
        filterPattern: `"${userName}"`,
      }),
    );

    for (const event of page.events ?? []) {
      const parsed = parseLogLine(event.message);
      if (parsed?.message !== 'Staff code decrypted') continue;
      if (parsed.triggerSource !== 'CustomEmailSender_ForgotPassword') continue;
      if (typeof parsed.code === 'string') return parsed.code;
    }

    await delay(CODE_POLL_MS);
  }

  throw new Error(`No reset code logged for ${userName} within ${CODE_WAIT_MS / 1000}s`);
}

interface WorkerLogLine {
  message?: string;
  userName?: string;
  triggerSource?: string;
  code?: string;
}

// Lambda's JSON logging nests the worker's own object under `message`, so the fields the handler
// logged sit one level down rather than at the top of the event.
function parseLogLine(line: string | undefined): WorkerLogLine | undefined {
  if (!line) return undefined;
  try {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const logged = (parsed as { message?: unknown }).message;
    return typeof logged === 'object' && logged !== null ? (logged as WorkerLogLine) : undefined;
  } catch {
    return undefined;
  }
}

// =============================================================================
// Staff pool
// =============================================================================

const seniorStaff = `staff-${run}`;
const juniorStaff = `staff-finance-${run}`;

const seniorSignUp = await cognito.send(
  new SignUpCommand({
    ClientId: staffClientId,
    Username: seniorStaff,
    Password: PASSWORD,
    UserAttributes: attributes({
      email: simulatorEmail(seniorStaff),
      'custom:department': 'admissions',
      'custom:staffNumber': '48120',
    }),
  }),
);
if (!seniorSignUp.UserConfirmed) throw new Error('Senior staff sign-up was not auto-confirmed');
report('senior staff sign-up', 'confirmed by the trigger');

await expectFailure('staff sign-up without a staff number', 'User attributes validation failed', () =>
  cognito.send(
    new SignUpCommand({
      ClientId: staffClientId,
      Username: `staff-incomplete-${run}`,
      Password: PASSWORD,
      UserAttributes: attributes({
        email: simulatorEmail(`staff-incomplete-${run}`),
        'custom:department': 'admissions',
      }),
    }),
  ),
);

const juniorSignUp = await cognito.send(
  new SignUpCommand({
    ClientId: staffClientId,
    Username: juniorStaff,
    Password: PASSWORD,
    UserAttributes: attributes({
      email: simulatorEmail(juniorStaff),
      'custom:department': 'finance',
      'custom:staffNumber': '51907',
    }),
  }),
);
if (juniorSignUp.UserConfirmed) throw new Error('Finance staff sign-up should wait on confirmation');
report('finance staff sign-up', 'left unconfirmed');

await cognito.send(new ResendConfirmationCodeCommand({ ClientId: staffClientId, Username: juniorStaff }));
report('finance staff code resent', 'custom email sender invoked');

await cognito.send(new ForgotPasswordCommand({ ClientId: staffClientId, Username: seniorStaff }));
const resetCode = await waitForStaffCode(seniorStaff);
report('senior staff reset code', `read from the worker log (${resetCode.length} characters)`);

await cognito.send(
  new ConfirmForgotPasswordCommand({
    ClientId: staffClientId,
    Username: seniorStaff,
    ConfirmationCode: resetCode,
    Password: NEW_PASSWORD,
  }),
);
report('senior staff password reset', 'confirmed with the decrypted code');

const staffSignIn = await cognito.send(
  new InitiateAuthCommand({
    ClientId: staffClientId,
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: { USERNAME: seniorStaff, PASSWORD: NEW_PASSWORD },
  }),
);
const staffAccessToken = staffSignIn.AuthenticationResult?.AccessToken;
if (!staffAccessToken) throw new Error('Senior staff sign-in returned no tokens');
report('senior staff sign-in', 'new password accepted');

await cognito.send(
  new GetUserAttributeVerificationCodeCommand({ AccessToken: staffAccessToken, AttributeName: 'email' }),
);
report('staff email verification code', 'custom email sender invoked');

await cognito.send(
  new UpdateUserAttributesCommand({
    AccessToken: staffAccessToken,
    UserAttributes: attributes({ email: simulatorEmail(`${seniorStaff}-updated`) }),
  }),
);
report('staff email change', 'custom email sender invoked');

await cognito.send(
  new AdminCreateUserCommand({
    UserPoolId: staffPoolId,
    Username: `staff-invited-${run}`,
    TemporaryPassword: PASSWORD,
    DesiredDeliveryMediums: ['EMAIL'],
    UserAttributes: attributes({
      email: simulatorEmail(`staff-invited-${run}`),
      'custom:department': 'estates',
      'custom:staffNumber': '60314',
    }),
  }),
);
report('invited staff member', 'created by an admin call');

// =============================================================================
// Applicants pool
// =============================================================================

const applicant = `applicant-${run}`;
const withdrawn = `withdrawn-${run}`;
const invited = `invited-${run}`;
const migrating = `legacy-${run}`;
const resetting = `legacy-reset-${run}`;

const applicantSignUp = await cognito.send(
  new SignUpCommand({
    ClientId: applicantsClientId,
    Username: applicant,
    Password: PASSWORD,
    UserAttributes: attributes({ email: simulatorEmail(applicant), 'custom:programme': 'msc-physics' }),
  }),
);
if (applicantSignUp.UserConfirmed) throw new Error('Applicant sign-up should wait on confirmation');
report('applicant sign-up', 'queued for review');

await expectFailure('test account sign-up', 'Test accounts cannot sign up', () =>
  cognito.send(
    new SignUpCommand({
      ClientId: applicantsClientId,
      Username: `test-${run}`,
      Password: PASSWORD,
      UserAttributes: attributes({ email: simulatorEmail(`test-${run}`), 'custom:programme': 'msc-physics' }),
    }),
  ),
);

await expectFailure('doctoral sign-up', 'No route matched for trigger PreSignUp_SignUp', () =>
  cognito.send(
    new SignUpCommand({
      ClientId: applicantsClientId,
      Username: `phd-${run}`,
      Password: PASSWORD,
      UserAttributes: attributes({ email: simulatorEmail(`phd-${run}`), 'custom:programme': 'phd-history' }),
    }),
  ),
);

await cognito.send(
  new SignUpCommand({
    ClientId: applicantsClientId,
    Username: withdrawn,
    Password: PASSWORD,
    UserAttributes: attributes({ email: simulatorEmail(withdrawn), 'custom:programme': 'msc-withdrawn' }),
  }),
);
report('withdrawn applicant sign-up', 'queued for review');

await cognito.send(new ResendConfirmationCodeCommand({ ClientId: applicantsClientId, Username: applicant }));
report('applicant code resent', 'default message left in place');

await cognito.send(new AdminConfirmSignUpCommand({ UserPoolId: applicantsPoolId, Username: applicant }));
await cognito.send(new AdminConfirmSignUpCommand({ UserPoolId: applicantsPoolId, Username: withdrawn }));
report('applicants confirmed', 'two accounts provisioned by an admin call');

const signIn = await cognito.send(
  new InitiateAuthCommand({
    ClientId: applicantsClientId,
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: { USERNAME: applicant, PASSWORD },
  }),
);
const idToken = signIn.AuthenticationResult?.IdToken;
const refreshToken = signIn.AuthenticationResult?.RefreshToken;
const accessToken = signIn.AuthenticationResult?.AccessToken;
if (!(idToken && refreshToken && accessToken)) throw new Error('Applicant sign-in returned no tokens');
expectClaim('applicant sign-in', idToken, 'programme', 'msc-physics');
expectClaim('applicant sign-in', idToken, 'tokenSource', 'sign-in');
report('applicant sign-in', 'ID token carries programme and tokenSource claims');

await expectFailure('withdrawn applicant sign-in', 'has withdrawn', () =>
  cognito.send(
    new InitiateAuthCommand({
      ClientId: applicantsClientId,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: { USERNAME: withdrawn, PASSWORD },
    }),
  ),
);

const refreshed = await cognito.send(
  new InitiateAuthCommand({
    ClientId: applicantsClientId,
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    AuthParameters: { REFRESH_TOKEN: refreshToken },
  }),
);
const refreshedIdToken = refreshed.AuthenticationResult?.IdToken;
if (!refreshedIdToken) throw new Error('Refresh returned no ID token');
expectClaim('token refresh', refreshedIdToken, 'tokenSource', 'refresh');
report('token refresh', 'ID token carries the refresh claim');

await cognito.send(new GetUserAttributeVerificationCodeCommand({ AccessToken: accessToken, AttributeName: 'email' }));
report('email verification code', 'default message left in place');

await cognito.send(
  new UpdateUserAttributesCommand({
    AccessToken: accessToken,
    UserAttributes: attributes({ email: simulatorEmail(`${applicant}-updated`) }),
  }),
);
report('applicant email change', 'default message left in place');

await cognito.send(
  new AdminCreateUserCommand({
    UserPoolId: applicantsPoolId,
    Username: invited,
    TemporaryPassword: PASSWORD,
    DesiredDeliveryMediums: ['EMAIL'],
    UserAttributes: attributes({ email: simulatorEmail(invited), 'custom:programme': 'msc-law' }),
  }),
);
report('invited applicant', 'created by an admin call');

const challenged = await cognito.send(
  new AdminInitiateAuthCommand({
    UserPoolId: applicantsPoolId,
    ClientId: applicantsClientId,
    AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
    AuthParameters: { USERNAME: invited, PASSWORD },
  }),
);
if (challenged.ChallengeName !== 'NEW_PASSWORD_REQUIRED') {
  throw new Error(`Invited applicant returned ${String(challenged.ChallengeName)}`);
}

const passwordSet = await cognito.send(
  new AdminRespondToAuthChallengeCommand({
    UserPoolId: applicantsPoolId,
    ClientId: applicantsClientId,
    ChallengeName: 'NEW_PASSWORD_REQUIRED',
    Session: challenged.Session,
    ChallengeResponses: { USERNAME: invited, NEW_PASSWORD },
  }),
);
const invitedIdToken = passwordSet.AuthenticationResult?.IdToken;
if (!invitedIdToken) throw new Error('New password challenge returned no tokens');
expectClaim('invited applicant sign-in', invitedIdToken, 'programme', 'msc-law');
report('invited applicant sign-in', 'new password accepted and claims added');

const customStart = await cognito.send(
  new InitiateAuthCommand({
    ClientId: applicantsClientId,
    AuthFlow: 'CUSTOM_AUTH',
    AuthParameters: { USERNAME: applicant },
  }),
);
if (customStart.ChallengeName !== 'CUSTOM_CHALLENGE') {
  throw new Error(`Custom auth returned ${String(customStart.ChallengeName)}`);
}

const customAnswer = await cognito.send(
  new RespondToAuthChallengeCommand({
    ClientId: applicantsClientId,
    ChallengeName: 'CUSTOM_CHALLENGE',
    Session: customStart.Session,
    ChallengeResponses: { USERNAME: applicant, ANSWER: CHALLENGE_ANSWER },
  }),
);
const customIdToken = customAnswer.AuthenticationResult?.IdToken;
if (!customIdToken) throw new Error('Custom auth returned no tokens');
expectClaim('custom auth', customIdToken, 'programme', 'msc-physics');
report('custom auth', 'correct answer issued tokens');

const wrongStart = await cognito.send(
  new InitiateAuthCommand({
    ClientId: applicantsClientId,
    AuthFlow: 'CUSTOM_AUTH',
    AuthParameters: { USERNAME: applicant },
  }),
);
await expectFailure('custom auth with a wrong answer', 'Incorrect username or password', () =>
  cognito.send(
    new RespondToAuthChallengeCommand({
      ClientId: applicantsClientId,
      ChallengeName: 'CUSTOM_CHALLENGE',
      Session: wrongStart.Session,
      ChallengeResponses: { USERNAME: applicant, ANSWER: 'not-the-reference' },
    }),
  ),
);

const migrated = await cognito.send(
  new InitiateAuthCommand({
    ClientId: applicantsClientId,
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: { USERNAME: migrating, PASSWORD: LEGACY_PASSWORD },
  }),
);
const migratedIdToken = migrated.AuthenticationResult?.IdToken;
if (!migratedIdToken) throw new Error('Migration sign-in returned no tokens');
expectClaim('legacy sign-in', migratedIdToken, 'programme', 'msc-classics');
report('legacy sign-in', 'account created during sign-in');

await cognito.send(new ForgotPasswordCommand({ ClientId: applicantsClientId, Username: resetting }));
report('legacy reset', 'account created during a password reset');

console.log(`\nRun ${run} finished. Worker log: ${workerLogGroup}`);
