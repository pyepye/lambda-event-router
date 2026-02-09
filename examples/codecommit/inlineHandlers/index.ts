import { EventRouter } from '@lambda-event-router/base';
import { createCodeCommitRouter } from '@lambda-event-router/codecommit';
import type { Handler } from 'aws-lambda';

import { branchCreatedRoute } from './handlers/branchCreatedRoute.js';
import { branchDeletedRoute } from './handlers/branchDeletedRoute.js';
import { featureBranchRoute } from './handlers/featureBranchRoute.js';
import { pushRoute } from './handlers/pushRoute.js';

const codeCommitRouter = createCodeCommitRouter();

codeCommitRouter.route(pushRoute).route(featureBranchRoute).route(branchCreatedRoute).route(branchDeletedRoute);

const eventRouter = new EventRouter({
  routers: [codeCommitRouter],
});

export const handler: Handler = eventRouter.handler();
