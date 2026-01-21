import type { Handler } from 'aws-lambda';

import { EventRouter } from '@lambda-event-router/base';
import { createS3Router } from '@lambda-event-router/s3';

import { batchOperation } from './handlers/batchOperation.js';
import { lifecycleExpirationDelete, lifecycleExpirationDeleteMarkerCreated, lifecycleTransition } from './handlers/lifecycle.js';
import { intelligentTiering, reducedRedundancyLostObject, testEvent } from './handlers/misc.js';
import { objectAclPut } from './handlers/objectAcl.js';
import {
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
    buckets: ['my-uploads-bucket'],
    prefixes: ['uploads/'],
    suffixes: ['.json'],
  },
  handler: objectCreated,
});

// Specific ObjectCreated:Put events (multiple prefixes and suffixes)
s3Router.objectCreatedPut({
  filters: {
    buckets: ['my-images-bucket'],
    prefixes: ['images/', 'photos/'],
    suffixes: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  },
  handler: objectCreatedPut,
});

// Specific ObjectCreated:Post events
s3Router.objectCreatedPost({
  filters: { buckets: ['my-form-bucket'] },
  handler: objectCreatedPost,
});

// Specific ObjectCreated:Copy events
s3Router.objectCreatedCopy({
  filters: { buckets: ['my-backup-bucket'] },
  handler: objectCreatedCopy,
});

// Specific ObjectCreated:CompleteMultipartUpload events
s3Router.objectCreatedCompleteMultipartUpload({
  filters: { buckets: ['my-large-files-bucket'] },
  handler: objectCreatedCompleteMultipartUpload,
});

// Files containing 'thumbnail' or 'thumb' in the key
s3Router.objectCreatedPut({
  filters: { buckets: ['my-images-bucket'], includes: ['thumbnail', 'thumb'] },
  handler: objectCreatedThumbnail,
});

// =============================================================================
// ObjectRemoved Events
// =============================================================================

// Catch-all for any ObjectRemoved event
s3Router.objectRemoved({
  filters: { buckets: ['my-uploads-bucket'] },
  handler: objectRemoved,
});

// Specific ObjectRemoved:Delete events
s3Router.objectRemovedDelete({
  filters: { buckets: ['my-permanent-bucket'] },
  handler: objectRemovedDelete,
});

// Specific ObjectRemoved:DeleteMarkerCreated events (versioned buckets)
s3Router.objectRemovedDeleteMarkerCreated({
  filters: { buckets: ['my-versioned-bucket'] },
  handler: objectRemovedDeleteMarkerCreated,
});

// =============================================================================
// ObjectRestore Events (Glacier/Deep Archive)
// =============================================================================

// Restore initiated
s3Router.objectRestorePost({
  filters: { buckets: ['my-archive-bucket'] },
  handler: objectRestorePost,
});

// Restore completed
s3Router.objectRestoreCompleted({
  filters: { buckets: ['my-archive-bucket'] },
  handler: objectRestoreCompleted,
});

// Restored copy expired
s3Router.objectRestoreDelete({
  filters: { buckets: ['my-archive-bucket'] },
  handler: objectRestoreDelete,
});

// =============================================================================
// Lifecycle Events
// =============================================================================

// Lifecycle expiration delete
s3Router.lifecycleExpirationDelete({
  filters: { buckets: ['my-temp-bucket'] },
  handler: lifecycleExpirationDelete,
});

// Lifecycle expiration delete marker created
s3Router.lifecycleExpirationDeleteMarkerCreated({
  filters: { buckets: ['my-versioned-bucket'] },
  handler: lifecycleExpirationDeleteMarkerCreated,
});

// Lifecycle transition to another storage class
s3Router.lifecycleTransition({
  filters: { buckets: ['my-tiered-bucket'] },
  handler: lifecycleTransition,
});

// =============================================================================
// ObjectTagging Events
// =============================================================================

// Tags added to object
s3Router.objectTaggingPut({
  filters: { buckets: ['my-tagged-bucket'] },
  handler: objectTaggingPut,
});

// Tags removed from object
s3Router.objectTaggingDelete({
  filters: { buckets: ['my-tagged-bucket'] },
  handler: objectTaggingDelete,
});

// =============================================================================
// ObjectAcl Events
// =============================================================================

// ACL updated on object
s3Router.objectAclPut({
  filters: { buckets: ['my-public-bucket'] },
  handler: objectAclPut,
});

// =============================================================================
// Other Events
// =============================================================================

// Reduced redundancy storage object lost
s3Router.reducedRedundancyLostObject({
  filters: { buckets: ['my-rrs-bucket'] },
  handler: reducedRedundancyLostObject,
});

// Intelligent tiering archive access tier change
s3Router.intelligentTiering({
  filters: { buckets: ['my-intelligent-bucket'] },
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
// Event Router
// =============================================================================

const eventRouter = new EventRouter({
  routers: [s3Router],
});

export const handler: Handler = eventRouter.handler();
