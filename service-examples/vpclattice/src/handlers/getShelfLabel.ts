import { logger } from '@latcher/base';
import { defineRoute, NotFound } from '@latcher/vpclattice';

import { SHELF_LABEL_PNG } from '../utils/inventory.js';

// A binary route base64 encodes the bytes and sets `isBase64Encoded`, which is what VPC Lattice needs
// to send the image back as the bytes the handler built.
export const getShelfLabel = defineRoute({
  filters: { method: 'GET', path: '/stock/:sku/label' },
  responseType: { type: 'binary', contentType: 'image/png' },
}).handle(async (request) => {
  const label = SHELF_LABEL_PNG[request.path.sku];
  if (!label) throw NotFound(`SKU ${request.path.sku} has no shelf label`);

  logger.info({ message: 'Shelf label read', sku: request.path.sku, bytes: label.length });

  return label;
});
