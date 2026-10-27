import { logger } from '@latcher/base';
import { defineRoute } from '@latcher/cloudwatch';

import { FAILED_LOGIN_FILTER } from '../config.js';
import { publishSecurityIssue } from '../utils/publishSecurityIssue.js';

export const reportFailedLogins = defineRoute({
  filters: {
    subscriptionFilter: FAILED_LOGIN_FILTER,
    messageType: 'DATA_MESSAGE',
  },
}).handle(async (request) => {
  const failedLogins = request.logEvents.map((logEvent) => logEvent.message);

  logger.warn({ message: 'Failed logins found', logGroup: request.logGroup, failedLogins });

  await publishSecurityIssue(failedLogins.length);
});
