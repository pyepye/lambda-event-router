import { createEventBridgeMatcher } from '@latcher/eventbridge';

import { CognitoCloudTrailDetailSchema, userDeleted } from './eventbridge-handlers/userDeleted.js';

export const eventBridgeMatcher = createEventBridgeMatcher();

// The EventBridge rule in template.yaml only passes AdminDeleteUser and DeleteUser, so the source and
// detail type are enough to match. The schema validates the payload.
eventBridgeMatcher.route({
  filters: {
    source: 'aws.cognito-idp',
    detailType: 'AWS API Call via CloudTrail',
  },
  detailSchema: CognitoCloudTrailDetailSchema,
  handler: userDeleted,
});
