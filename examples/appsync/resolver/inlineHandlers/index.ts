import type { Handler } from 'aws-lambda';

import { createAppSyncRouter } from '@lambda-event-router/appsync';
import { LambdaRouter } from '@lambda-event-router/base';

import { adminCreateUserRoute, createUserRoute } from './createUser.js';
import { getUserRoute } from './getUser.js';
import { getUserPostsRoute } from './getUserPosts.js';
import { listUsersRoute } from './listUsers.js';
import { onUserCreatedRoute } from './onUserCreated.js';
import { updateUserRoute } from './updateUser.js';

const appSyncRouter = createAppSyncRouter();

appSyncRouter
  .route(getUserRoute)
  .route(listUsersRoute)
  .route(createUserRoute)
  .route(updateUserRoute)
  .route(getUserPostsRoute)
  .route(onUserCreatedRoute)
  .route(adminCreateUserRoute);

const lambdaRouter = new LambdaRouter({
  routers: [appSyncRouter],
});

export const handler: Handler = lambdaRouter.handler();
