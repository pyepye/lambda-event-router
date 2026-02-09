import { EventRouter } from '@lambda-event-router/base';
import type { CodeCommitFilterInput } from '@lambda-event-router/codecommit';
import { createCodeCommitRouter } from '@lambda-event-router/codecommit';
import type { Handler } from 'aws-lambda';

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
    eventSourceArns: [REPO_ARN],
    branches: ['main'],
  },
  handler: processMainPush,
});

// Filter by repository name (extracted from the last segment of the ARN)
codeCommitRouter.route({
  filters: {
    repositoryNames: [REPO_NAME],
    branches: ['main'],
  },
  handler: processMainPush,
});

// =============================================================================
// Branch name filters
// =============================================================================

// Exact branch name match
codeCommitRouter.route({
  filters: {
    repositoryNames: [REPO_NAME],
    branches: ['main', 'develop'],
  },
  handler: processMainPush,
});

// Branch prefix match
codeCommitRouter.route({
  filters: {
    repositoryNames: [REPO_NAME],
    branchPrefixes: ['feature/'],
  },
  handler: processFeaturePush,
});

// Branch suffix match
codeCommitRouter.route({
  filters: {
    repositoryNames: [REPO_NAME],
    branchSuffixes: ['-hotfix'],
  },
  handler: processMainPush,
});

// Branch includes (substring match)
codeCommitRouter.route({
  filters: {
    repositoryNames: [REPO_NAME],
    branchIncludes: ['release'],
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
    repositoryNames: [REPO_NAME],
    branches: ['main', 'develop'],
  },
  handler: processMainPush,
});

// .branchCreated() matches events with created references
codeCommitRouter.branchCreated({
  filters: {
    repositoryNames: [REPO_NAME],
  },
  handler: processBranchCreated,
});

// .branchDeleted() matches events with deleted references
codeCommitRouter.branchDeleted({
  filters: {
    repositoryNames: [REPO_NAME],
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
    repositoryNames: [REPO_NAME],
    customFilter: isMainBranchBySpecificUser,
  },
  handler: processMainPush,
});

const eventRouter = new EventRouter({
  routers: [codeCommitRouter],
});

export const handler: Handler = eventRouter.handler();
