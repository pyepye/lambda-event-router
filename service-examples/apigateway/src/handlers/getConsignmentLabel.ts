import { defineRoute, TemporaryRedirect } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

// Labels are held by the carrier, so the caller is sent there instead. A redirect is thrown like any
// other non-2xx response.
export const getConsignmentLabel = defineRoute({
  filters: { method: 'GET', path: '/dispatch/:consignmentId/label' },
}).handle(async (request) => {
  const { consignmentId } = request.path;
  const location = `https://labels.carrier.example/${consignmentId}.pdf`;

  logger.info({ message: 'Label redirect issued', consignmentId, location });

  throw TemporaryRedirect(location);
});
