import { logger } from '@lambda-event-router/base';
import type { CdkCustomResourceEvent, CdkCustomResourceResponse } from 'aws-lambda';

import { CHANGE_STREAM_SOURCES } from '../utils/cluster.js';
import { connectToCluster } from './mongoClient.js';

const PHYSICAL_ID = 'change-streams';

// Change streams are turned on with a mongo admin command, which no CloudFormation resource can
// send. A rule covers one database or one collection, and an event source mapping is only accepted
// by a rule of its own scope, so each mapping gets a rule naming the same database and collection it
// reads. An empty collection name covers every collection in the database.
export async function handler(event: CdkCustomResourceEvent): Promise<CdkCustomResourceResponse> {
  if (event.RequestType === 'Delete') {
    return { PhysicalResourceId: PHYSICAL_ID };
  }

  const client = await connectToCluster();
  const admin = client.db('admin');

  for (const source of CHANGE_STREAM_SOURCES) {
    const collection = source.collection ?? '';
    await admin.command({ modifyChangeStreams: 1, database: source.database, collection, enable: true });
    logger.info({ message: 'Change streams enabled', database: source.database, collection });
  }

  return { PhysicalResourceId: PHYSICAL_ID };
}
