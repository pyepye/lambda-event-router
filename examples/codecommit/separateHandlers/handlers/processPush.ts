import type { CodeCommitRequest, CodeCommitResponse } from '@lambda-event-router/codecommit';

export async function processMainPush(request: CodeCommitRequest): Promise<CodeCommitResponse> {
  const { references, userIdentityARN, eventTriggerName } = request;

  for (const reference of references) {
    console.log(`Push to main: commit ${reference.commit} by ${userIdentityARN}`);
    console.log(`Trigger: ${eventTriggerName}, ref: ${reference.ref}`);
  }
}

export async function processFeaturePush(request: CodeCommitRequest): Promise<CodeCommitResponse> {
  const { references, userIdentityARN } = request;

  for (const reference of references) {
    console.log(`Feature branch push: ${reference.ref} commit ${reference.commit} by ${userIdentityARN}`);
  }
}

export async function processBranchCreated(request: CodeCommitRequest): Promise<CodeCommitResponse> {
  const { references, userIdentityARN } = request;

  for (const reference of references) {
    console.log(`Branch created: ${reference.ref} at commit ${reference.commit} by ${userIdentityARN}`);
  }
}

export async function processBranchDeleted(request: CodeCommitRequest): Promise<CodeCommitResponse> {
  const { references, userIdentityARN } = request;

  for (const reference of references) {
    console.log(`Branch deleted: ${reference.ref} by ${userIdentityARN}`);
  }
}
