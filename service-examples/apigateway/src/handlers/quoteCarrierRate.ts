import { defineRoute } from '@lambda-event-router/apigateway';
import { logger } from '@lambda-event-router/base';

import { CarrierQuoteSchema } from '../utils/schemas.js';

// The carrier answers -1 when it has no lorry for the route, and the response schema requires a
// positive price. The router rejects the handler's own return value and answers 500.
const NO_CAPACITY_PRICE = -1;

export const quoteCarrierRate = defineRoute({
  filters: { method: 'GET', path: '/dispatch/quote' },
  responseSchema: CarrierQuoteSchema,
}).handle(async () => {
  const quote = { carrier: 'palletline', price: NO_CAPACITY_PRICE };

  logger.info({ message: 'Carrier quote fetched', ...quote });

  return quote;
});
