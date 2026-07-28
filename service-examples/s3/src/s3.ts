import { createS3BatchRouter, createS3Router } from '@lambda-event-router/s3';

import { MAX_UPLOAD_BYTES, REPORTS_BUCKET, UPLOADS_BUCKET } from './config.js';
import { acceptFormUpload } from './handlers/acceptFormUpload.js';
import { applyRetentionTags } from './handlers/applyRetentionTags.js';
import { archiveDocument } from './handlers/archiveDocument.js';
import { archiveReportCopy } from './handlers/archiveReportCopy.js';
import { assembleTranscript } from './handlers/assembleTranscript.js';
import { auditAclChange } from './handlers/auditAclChange.js';
import { beginArchiveRestore } from './handlers/beginArchiveRestore.js';
import { clearRetentionTags } from './handlers/clearRetentionTags.js';
import { completeArchiveRestore } from './handlers/completeArchiveRestore.js';
import { coolDownLedger } from './handlers/coolDownLedger.js';
import { expireRestoredCopy } from './handlers/expireRestoredCopy.js';
import { logRemoval } from './handlers/logRemoval.js';
import { notifyReviewer } from './handlers/notifyReviewer.js';
import { processArchiveTask } from './handlers/processArchiveTask.js';
import { publishReport } from './handlers/publishReport.js';
import { purgeDocumentVersion } from './handlers/purgeDocumentVersion.js';
import { purgeExpiredVersion } from './handlers/purgeExpiredVersion.js';
import { quarantineExecutable } from './handlers/quarantineExecutable.js';
import { recordDeleteMarker } from './handlers/recordDeleteMarker.js';
import { recordLifecycleDeleteMarker } from './handlers/recordLifecycleDeleteMarker.js';
import { recordNotificationSetup } from './handlers/recordNotificationSetup.js';
import { rejectOversizedUpload } from './handlers/rejectOversizedUpload.js';
import { scanDocument } from './handlers/scanDocument.js';
import { logRecord } from './middleware/logRecord.js';
import { withBatchContext } from './middleware/withBatchContext.js';
import { withDocumentContext } from './middleware/withDocumentContext.js';

export const s3Router = createS3Router({ middleware: [logRecord] });

// rejectOversizedUpload's size filter and scanDocument's key filter cannot be ranked against each
// other, so rejectOversizedUpload goes first to claim a large PDF. logRemoval and expireRestoredCopy
// are wildcards, which the router ranks behind the narrower routes in their event family.
s3Router
  .objectCreated({
    filters: {
      bucket: UPLOADS_BUCKET,
      custom: ({ record }) => record.s3.object.size > MAX_UPLOAD_BYTES,
    },
    handler: rejectOversizedUpload,
  })
  .route(quarantineExecutable)
  .objectCreatedPut({
    filters: { bucket: UPLOADS_BUCKET, key: ['documents/*.pdf', 'documents/*.docx'] },
    middleware: [withDocumentContext],
    handler: scanDocument,
  })
  .objectCreatedPut({
    filters: { bucket: UPLOADS_BUCKET, key: 'reviews/*' },
    handler: notifyReviewer,
  })
  .objectCreatedPut({
    filters: { bucket: UPLOADS_BUCKET, key: 'archive/*' },
    handler: archiveDocument,
  })
  .objectCreatedPost({
    filters: { bucket: UPLOADS_BUCKET },
    handler: acceptFormUpload,
  })
  .objectCreatedCompleteMultipartUpload({
    filters: { bucket: UPLOADS_BUCKET, key: 'transcripts/*' },
    handler: assembleTranscript,
  })
  .objectCreatedPut({
    filters: { bucket: REPORTS_BUCKET },
    handler: publishReport,
  })
  .objectCreatedCopy({
    filters: { bucket: REPORTS_BUCKET },
    handler: archiveReportCopy,
  })
  .objectRemovedDelete({
    filters: { bucket: UPLOADS_BUCKET },
    handler: purgeDocumentVersion,
  })
  .objectRemovedDeleteMarkerCreated({
    filters: { bucket: UPLOADS_BUCKET },
    handler: recordDeleteMarker,
  })
  .objectRemoved({ handler: logRemoval })
  .objectTaggingPut({
    filters: { bucket: UPLOADS_BUCKET },
    handler: applyRetentionTags,
  })
  .objectTaggingDelete({
    filters: { bucket: UPLOADS_BUCKET },
    handler: clearRetentionTags,
  })
  .objectAclPut({
    filters: { bucket: UPLOADS_BUCKET },
    handler: auditAclChange,
  })
  .objectRestorePost({
    filters: { bucket: UPLOADS_BUCKET },
    handler: beginArchiveRestore,
  })
  .objectRestoreCompleted({
    filters: { bucket: UPLOADS_BUCKET },
    handler: completeArchiveRestore,
  })
  .objectRestore({ handler: expireRestoredCopy })
  .lifecycleExpirationDelete({
    filters: { bucket: UPLOADS_BUCKET },
    handler: purgeExpiredVersion,
  })
  .lifecycleExpirationDeleteMarkerCreated({
    filters: { bucket: UPLOADS_BUCKET },
    handler: recordLifecycleDeleteMarker,
  })
  .lifecycleTransition({
    filters: { bucket: UPLOADS_BUCKET },
    handler: coolDownLedger,
  })
  .testEvent({ handler: recordNotificationSetup });

export const s3BatchRouter = createS3BatchRouter().route({
  treatMissingKeysAs: 'TemporaryFailure',
  middleware: [withBatchContext],
  handler: processArchiveTask,
});
