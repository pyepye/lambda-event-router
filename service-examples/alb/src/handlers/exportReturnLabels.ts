import { defineRoute } from '@lambda-event-router/alb';
import { logger } from '@lambda-event-router/base';

const LABEL_LINE = 'ret-8801,dpd,GB-LEEDS-01,parcel,1 of 1\n';
const LABEL_COUNT = 30_000;

// ALB caps a Lambda response at 1 MB and answers 502 when one is bigger. The router builds this
// response happily, so the size is the one failure the load balancer owns rather than the router.
export const exportReturnLabels = defineRoute({
  filters: { method: 'GET', path: '/reports/labels' },
}).handle(async () => {
  const sheet = LABEL_LINE.repeat(LABEL_COUNT);

  logger.info({ message: 'Return labels exported', bytes: sheet.length });

  return sheet;
});
