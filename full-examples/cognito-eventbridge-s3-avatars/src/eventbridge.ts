import { createEventBridgeRouter } from '@lambda-event-router/eventbridge';

import { CognitoCloudTrailDetailSchema, userDeleted } from './eventbridge-handlers/userDeleted.js';

export const eventBridgeRouter = createEventBridgeRouter();

// The EventBridge rule in template.yaml only passes AdminDeleteUser and DeleteUser, so the source and
// detail type are enough to match. The schema validates the payload.
eventBridgeRouter.route({
  filters: {
    source: 'aws.cognito-idp',
    detailType: 'AWS API Call via CloudTrail',
  },
  detailSchema: CognitoCloudTrailDetailSchema,
  handler: userDeleted,
});
