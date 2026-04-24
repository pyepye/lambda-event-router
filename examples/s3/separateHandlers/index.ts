import type { Handler } from 'aws-lambda';

import { LambdaRouter } from '@lambda-event-router/base';
import { createS3Router } from '@lambda-event-router/s3';

import { batchOperation } from './handlers/batchOperation.js';
import {
  lifecycleExpirationDelete,
  lifecycleExpirationDeleteMarkerCreated,
  lifecycleTransition,
} from './handlers/lifecycle.js';
import { intelligentTiering, reducedRedundancyLostObject, testEvent } from './handlers/misc.js';
import { objectAclPut } from './handlers/objectAcl.js';
import {
  isLargeFile,
  objectCreated,
  objectCreatedCompleteMultipartUpload,
  objectCreatedCopy,
  objectCreatedPost,
  objectCreatedPut,
  objectCreatedThumbnail,
} from './handlers/objectCreated.js';
import { objectRemoved, objectRemovedDelete, objectRemovedDeleteMarkerCreated } from './handlers/objectRemoved.js';
import { objectRestoreCompleted, objectRestoreDelete, objectRestorePost } from './handlers/objectRestore.js';
import { objectTaggingDelete, objectTaggingPut } from './handlers/objectTagging.js';

const s3Router = createS3Router();

// =============================================================================
// ObjectCreated Events
// =============================================================================

// Catch-all for any ObjectCreated event
s3Router.objectCreated({
  filters: {
    bucket: 'my-uploads-bucket',
    key: ['uploads/*', '*.json'],
  },
  handler: objectCreated,
});

// Specific ObjectCreated:Put events (multiple prefixes and suffixes)
s3Router.objectCreatedPut({
  filters: {
    bucket: 'my-images-bucket',
    key: ['images/*', 'photos/*', '*.jpg', '*.jpeg', '*.png', '*.gif', '*.webp'],
  },
  handler: objectCreatedPut,
});

// Specific ObjectCreated:Post events
s3Router.objectCreatedPost({
  filters: { bucket: 'my-form-bucket' },
  handler: objectCreatedPost,
});

// Specific ObjectCreated:Copy events
s3Router.objectCreatedCopy({
  filters: { bucket: ['my-backup-bucket'] },
  handler: objectCreatedCopy,
});

// Specific ObjectCreated:CompleteMultipartUpload events
s3Router.objectCreatedCompleteMultipartUpload({
  filters: { bucket: 'my-large-files-bucket' },
  handler: objectCreatedCompleteMultipartUpload,
});

// Files containing 'thumbnail' or 'thumb' in the key
s3Router.objectCreatedPut({
  filters: { bucket: 'my-images-bucket', key: ['*thumbnail*', '*thumb*'] },
  handler: objectCreatedThumbnail,
});

// Large file uploads filtered by object size
s3Router.objectCreated({
  filters: {
    bucket: 'my-uploads-bucket',
    customFilter: isLargeFile,
  },
  handler: objectCreated,
});

// =============================================================================
// ObjectRemoved Events
// =============================================================================

// Catch-all for any ObjectRemoved event
s3Router.objectRemoved({
  filters: { bucket: 'my-uploads-bucket' },
  handler: objectRemoved,
});

// Specific ObjectRemoved:Delete events
s3Router.objectRemovedDelete({
  filters: { bucket: 'my-permanent-bucket' },
  handler: objectRemovedDelete,
});

// Specific ObjectRemoved:DeleteMarkerCreated events (versioned buckets)
s3Router.objectRemovedDeleteMarkerCreated({
  filters: { bucket: 'my-versioned-bucket' },
  handler: objectRemovedDeleteMarkerCreated,
});

// =============================================================================
// ObjectRestore Events (Glacier/Deep Archive)
// =============================================================================

// Restore initiated
s3Router.objectRestorePost({
  filters: { bucket: 'my-archive-bucket' },
  handler: objectRestorePost,
});

// Restore completed
s3Router.objectRestoreCompleted({
  filters: { bucket: 'my-archive-bucket' },
  handler: objectRestoreCompleted,
});

// Restored copy expired
s3Router.objectRestoreDelete({
  filters: { bucket: 'my-archive-bucket' },
  handler: objectRestoreDelete,
});

// =============================================================================
// Lifecycle Events
// =============================================================================

// Lifecycle expiration delete
s3Router.lifecycleExpirationDelete({
  filters: { bucket: 'my-temp-bucket' },
  handler: lifecycleExpirationDelete,
});

// Lifecycle expiration delete marker created
s3Router.lifecycleExpirationDeleteMarkerCreated({
  filters: { bucket: 'my-versioned-bucket' },
  handler: lifecycleExpirationDeleteMarkerCreated,
});

// Lifecycle transition to another storage class
s3Router.lifecycleTransition({
  filters: { bucket: 'my-tiered-bucket' },
  handler: lifecycleTransition,
});

// =============================================================================
// ObjectTagging Events
// =============================================================================

// Tags added to object
s3Router.objectTaggingPut({
  filters: { bucket: 'my-tagged-bucket' },
  handler: objectTaggingPut,
});

// Tags removed from object
s3Router.objectTaggingDelete({
  filters: { bucket: 'my-tagged-bucket' },
  handler: objectTaggingDelete,
});

// =============================================================================
// ObjectAcl Events
// =============================================================================

// ACL updated on object
s3Router.objectAclPut({
  filters: { bucket: 'my-public-bucket' },
  handler: objectAclPut,
});

// =============================================================================
// Other Events
// =============================================================================

// Reduced redundancy storage object lost
s3Router.reducedRedundancyLostObject({
  filters: { bucket: 'my-rrs-bucket' },
  handler: reducedRedundancyLostObject,
});

// Intelligent tiering archive access tier change
s3Router.intelligentTiering({
  filters: { bucket: 'my-intelligent-bucket' },
  handler: intelligentTiering,
});

// S3 test event (sent when configuring notifications)
s3Router.testEvent({
  handler: testEvent,
});

// =============================================================================
// S3 Batch Operations
// =============================================================================

s3Router.batchOperation({ handler: batchOperation });

// =============================================================================
// Lambda Router
// =============================================================================

const lambdaRouter = new LambdaRouter({
  routers: [s3Router],
});

export const handler: Handler = lambdaRouter.handler();
