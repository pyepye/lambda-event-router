import { CognitoIdentityProviderClient, ListUserPoolsCommand } from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient();

const LIST_PAGE_SIZE = 60;

async function findUserPoolId(name: string): Promise<string> {
  let nextToken: string | undefined;

  do {
    const page = await cognitoClient.send(
      new ListUserPoolsCommand({ MaxResults: LIST_PAGE_SIZE, NextToken: nextToken }),
    );
    const match = page.UserPools?.find((pool) => pool.Name === name);
    if (match?.Id) return match.Id;
    nextToken = page.NextToken;
  } while (nextToken);

  throw new Error(`No user pool named ${name}`);
}

// The userPoolId filters match against these. A pool holds the ARN of the Lambda it triggers, so
// CloudFormation rejects a template that also puts the pool's id in that Lambda's environment. CDK
// injects the two pool names instead, and the ids are read once per cold start.
export const APPLICANTS_POOL_ID = await findUserPoolId(process.env.APPLICANTS_POOL_NAME ?? '');
export const STAFF_POOL_ID = await findUserPoolId(process.env.STAFF_POOL_NAME ?? '');

export const CUSTOM_SENDER_KEY_ARN = process.env.CUSTOM_SENDER_KEY_ARN ?? '';
