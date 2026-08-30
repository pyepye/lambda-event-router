import { createCloudWatchLogsRouter } from '@lambda-event-router/cloudwatch';

import { reportFailedLogins } from './cloudwatch-handlers/reportFailedLogins.js';
import { logLogsInvocation } from './middleware/logInvocation.js';

export const cloudWatchLogsRouter = createCloudWatchLogsRouter({
  middleware: [logLogsInvocation],
});

cloudWatchLogsRouter.route(reportFailedLogins);
