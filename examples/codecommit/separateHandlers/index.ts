import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import type { CodeCommitFilterInput } from '@lambda-event-router/codecommit';
import { createCodeCommitRouter } from '@lambda-event-router/codecommit';

import {
  processBranchCreated,
  processBranchDeleted,
  processFeaturePush,
  processMainPush,
} from './handlers/processPush.js';

const codeCommitRouter = createCodeCommitRouter();

const REPO_ARN = 'arn:aws:codecommit:eu-west-1:123456789012:my-repo';
const REPO_NAME = 'my-repo';

// =============================================================================
// Filter by full ARN or repository name
// =============================================================================

// Filter by full eventSourceArn
codeCommitRouter.route({
  filters: {
    eventSourceArn: REPO_ARN,
    branch: 'main',
  },
  handler: processMainPush,
});

// Filter by repository name (extracted from the last segment of the ARN)
codeCommitRouter.route({
  filters: {
    repositoryName: REPO_NAME,
    branch: 'main',
  },
  handler: processMainPush,
});

// =============================================================================
// Branch name filters
// =============================================================================

// Exact branch name match
codeCommitRouter.route({
  filters: {
    repositoryName: REPO_NAME,
    branch: ['main', 'develop'],
  },
  handler: processMainPush,
});

// Branch prefix match
codeCommitRouter.route({
  filters: {
    repositoryName: REPO_NAME,
    branch: 'hotfix/*',
  },
  handler: processFeaturePush,
});

// Branch suffix match
codeCommitRouter.route({
  filters: {
    repositoryName: REPO_NAME,
    branch: '*-hotfix',
  },
  handler: processMainPush,
});

// Branch includes (substring match)
codeCommitRouter.route({
  filters: {
    repositoryName: REPO_NAME,
    branch: '*release*',
  },
  handler: processMainPush,
});

// =============================================================================
// Convenience methods
// =============================================================================

// .push() matches commits pushed to existing branches
// (references where created and deleted are both falsy)
codeCommitRouter.push({
  filters: {
    repositoryName: REPO_NAME,
    branch: ['main', 'develop'],
  },
  handler: processMainPush,
});

// .branchCreated() matches events with created references
codeCommitRouter.branchCreated({
  filters: {
    repositoryName: REPO_NAME,
  },
  handler: processBranchCreated,
});

// .branchDeleted() matches events with deleted references
codeCommitRouter.branchDeleted({
  filters: {
    repositoryName: REPO_NAME,
  },
  handler: processBranchDeleted,
});

// =============================================================================
// Custom filter
// =============================================================================

function isMainBranchBySpecificUser({ userIdentityARN, references }: CodeCommitFilterInput): boolean {
  const isTargetUser = userIdentityARN.includes('deploy-bot');
  const isMainBranch = references.some((ref) => ref.ref === 'refs/heads/main');
  return isTargetUser && isMainBranch;
}

codeCommitRouter.route({
  filters: {
    repositoryName: REPO_NAME,
    customFilter: isMainBranchBySpecificUser,
  },
  handler: processMainPush,
});

const lambdaRouter = new LambdaRouter({
  routers: [codeCommitRouter],
});

export const handler: Handler = lambdaRouter.handler();
