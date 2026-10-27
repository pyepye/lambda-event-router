import { createS3Matcher } from '@latcher/s3';

import { cleanupProcessed } from './s3-handlers/cleanupProcessed.js';
import { convertToBlackAndWhite } from './s3-handlers/convertToBlackAndWhite.js';

export const s3Matcher = createS3Matcher();

s3Matcher
  .objectCreated({
    filters: { key: ['originals/*.jpg', 'originals/*.jpeg', 'originals/*.png'] },
    handler: convertToBlackAndWhite,
  })
  .objectRemoved({
    filters: { key: 'originals/*' },
    handler: cleanupProcessed,
  });
