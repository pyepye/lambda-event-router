import { createS3Router } from '@lambda-event-router/s3';

import { cleanupProcessed } from './s3-handlers/cleanupProcessed.js';
import { convertToBlackAndWhite } from './s3-handlers/convertToBlackAndWhite.js';

export const s3Router = createS3Router();

s3Router
  .objectCreated({
    filters: { key: ['originals/*.jpg', 'originals/*.jpeg', 'originals/*.png'] },
    handler: convertToBlackAndWhite,
  })
  .objectRemoved({
    filters: { key: 'originals/*' },
    handler: cleanupProcessed,
  });
