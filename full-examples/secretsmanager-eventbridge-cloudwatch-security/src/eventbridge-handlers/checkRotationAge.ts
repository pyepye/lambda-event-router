import { DescribeSecretCommand } from '@aws-sdk/client-secrets-manager';
import { logger } from '@lambda-event-router/base';
import { defineRoute } from '@lambda-event-router/eventbridge';

import { ROTATION_MAX_AGE_DAYS, SECRET_ARN, secretsManager } from '../config.js';
import { publishSecurityIssue } from '../utils/publishSecurityIssue.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const checkRotationAge = defineRoute({
  filters: {
    source: 'aws.events',
    detailType: 'Scheduled Event',
  },
}).handle(async () => {
  const { LastRotatedDate } = await secretsManager.send(new DescribeSecretCommand({ SecretId: SECRET_ARN }));

  if (!LastRotatedDate) {
    logger.warn({ message: 'Secret has never been rotated', secretId: SECRET_ARN });
    await publishSecurityIssue(1);
    return;
  }

  const ageDays = Math.floor((Date.now() - LastRotatedDate.getTime()) / MS_PER_DAY);

  if (ageDays > ROTATION_MAX_AGE_DAYS) {
    logger.warn({ message: 'Secret rotation is overdue', secretId: SECRET_ARN, ageDays });
    await publishSecurityIssue(1);
    return;
  }

  logger.info({ message: 'Secret rotation is up to date', secretId: SECRET_ARN, ageDays });
});
