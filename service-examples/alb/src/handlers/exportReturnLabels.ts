import { defineRoute } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

const LABEL = { returnId: 'ret-8801', carrier: 'dpd', depot: 'GB-LEEDS-01', packaging: 'parcel' };
const LABEL_COUNT = 15_000;

// ALB caps a Lambda response at 1 MB and answers 502 when one is bigger. The router builds this
// response happily, so the size is the one failure the load balancer owns rather than the router.
export const exportReturnLabels = defineRoute({
  filters: { method: 'GET', path: '/reports/labels' },
}).handle(async () => {
  const labels = Array.from({ length: LABEL_COUNT }, () => LABEL);

  logger.info({ message: 'Return labels exported', bytes: JSON.stringify(labels).length });

  return labels;
});
