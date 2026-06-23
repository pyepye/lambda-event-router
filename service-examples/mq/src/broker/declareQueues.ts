import { setTimeout as sleep } from 'node:timers/promises';

import { logger } from '@lambda-event-router/base';
import type { CdkCustomResourceEvent, CdkCustomResourceResponse } from 'aws-lambda';

import { PAYMENT_QUEUES, SECRET_NAMES } from '../utils/brokers.js';
import { readBrokerCredentials } from './credentials.js';
import { withRabbitMqChannel } from './rabbitMqClient.js';

const PHYSICAL_ID = 'rabbitmq-queues';

// A broker reports RUNNING a little before it accepts AMQP connections.
const CONNECT_ATTEMPTS = 6;
const CONNECT_RETRY_MS = 10_000;

// A RabbitMQ event source mapping needs its queue to exist already, and no CloudFormation resource
// declares one. Declaring a queue over AMQP is idempotent, so create and update do the same work.
export async function handler(event: CdkCustomResourceEvent): Promise<CdkCustomResourceResponse> {
  if (event.RequestType === 'Delete') {
    return { PhysicalResourceId: PHYSICAL_ID };
  }

  const endpoint = process.env.PAYMENT_BROKER_ENDPOINT;
  if (!endpoint) {
    throw new Error('PAYMENT_BROKER_ENDPOINT is not set, so there is no broker to declare queues on.');
  }

  const { username, password } = await readBrokerCredentials(SECRET_NAMES.paymentBroker);

  for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt++) {
    try {
      await withRabbitMqChannel(endpoint, username, password, async (channel) => {
        for (const queue of Object.values(PAYMENT_QUEUES)) {
          await channel.assertQueue(queue, { durable: true });
          logger.info({ message: 'Queue declared', queue });
        }
      });
      return { PhysicalResourceId: PHYSICAL_ID };
    } catch (error) {
      if (attempt === CONNECT_ATTEMPTS) throw error;
      logger.warn({ message: 'Broker not reachable yet, retrying', attempt });
      await sleep(CONNECT_RETRY_MS);
    }
  }

  return { PhysicalResourceId: PHYSICAL_ID };
}
