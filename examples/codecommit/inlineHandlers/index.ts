import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import { createCodeCommitRouter } from '@lambda-event-router/codecommit';

import { branchCreatedRoute } from './handlers/branchCreatedRoute.js';
import { branchDeletedRoute } from './handlers/branchDeletedRoute.js';
import { deployBotPushRoute, pushRoute } from './handlers/pushRoute.js';
import { testBranchRoute } from './handlers/testBranchRoute.js';

const codeCommitRouter = createCodeCommitRouter();

codeCommitRouter
  .route(pushRoute)
  .route(testBranchRoute)
  .route(branchCreatedRoute)
  .route(branchDeletedRoute)
  .route(deployBotPushRoute);

const lambdaRouter = new LambdaRouter({
  routers: [codeCommitRouter],
});

export const handler: Handler = lambdaRouter.handler();
