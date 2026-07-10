import { SendTaskFailureCommand } from '@aws-sdk/client-sfn';
import { isObject, logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/stepfunctions';

import { sfnClient } from '../config.js';

// The fallback for callback tasks. It carries no custom filter and no eventSchema, so it takes any
// payload with a TaskToken that the routes above it did not claim, and fails the waiting state.
// Registered last, because the router returns the first route that matches.
export const failUnknownCallback = defineRoute({
  filters: {
    taskToken: true,
  },
}).handle(async (request) => {
  const task = isObject(request.input) ? String(request.input.task) : 'unknown';

  logger.warn({
    message: 'Unknown callback task refused',
    task,
  });

  await sfnClient.send(
    new SendTaskFailureCommand({
      taskToken: request.taskToken,
      error: 'UnknownCallbackTask',
      cause: `No callback route handles ${task}`,
    }),
  );
});
