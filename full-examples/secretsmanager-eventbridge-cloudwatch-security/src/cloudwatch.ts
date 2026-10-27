import { createCloudWatchLogsMatcher } from '@latcher/cloudwatch';

import { reportFailedLogins } from './cloudwatch-handlers/reportFailedLogins.js';
import { logLogsInvocation } from './middleware/logInvocation.js';

export const cloudWatchLogsMatcher = createCloudWatchLogsMatcher({
  middleware: [logLogsInvocation],
});

cloudWatchLogsMatcher.route(reportFailedLogins);
