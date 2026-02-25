import { createAppSyncRouter } from '@lambda-event-router/appsync';
import { EventRouter } from '@lambda-event-router/base';
import type { Handler } from 'aws-lambda';

import { CreateUserInputSchema, createUser } from './createUser.js';
import { getUser } from './getUser.js';
import { getUserPosts } from './getUserPosts.js';
import { listUsers } from './listUsers.js';
import { onUserCreated } from './onUserCreated.js';
import { updateUser } from './updateUser.js';

const appSyncRouter = createAppSyncRouter();

// Convenience methods for common parent types
appSyncRouter.query({
  fieldName: 'getUser',
  handler: getUser,
});

appSyncRouter.query({
  fieldName: 'listUsers',
  handler: listUsers,
});

appSyncRouter.mutation({
  fieldName: 'createUser',
  argumentsSchema: CreateUserInputSchema,
  handler: createUser,
});

appSyncRouter.mutation({
  fieldName: 'updateUser',
  handler: updateUser,
});

appSyncRouter.route({
  filters: {
    parentTypeNames: ['User'],
    fieldNames: ['posts'],
  },
  handler: getUserPosts,
});

appSyncRouter.subscription({
  fieldName: 'onUserCreated',
  handler: onUserCreated,
});

const eventRouter = new EventRouter({
  routers: [appSyncRouter],
});

export const handler: Handler = eventRouter.handler();
