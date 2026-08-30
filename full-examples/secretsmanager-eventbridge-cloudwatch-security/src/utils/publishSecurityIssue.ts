import { PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

import { cloudWatch, METRIC_NAME, METRIC_NAMESPACE } from '../config.js';

export async function publishSecurityIssue(count: number): Promise<void> {
  await cloudWatch.send(
    new PutMetricDataCommand({
      Namespace: METRIC_NAMESPACE,
      MetricData: [{ MetricName: METRIC_NAME, Value: count, Unit: 'Count' }],
    }),
  );
}
