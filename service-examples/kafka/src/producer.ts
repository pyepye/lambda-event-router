import { logger } from '@lambda-event-router/base';
import { Kafka } from 'kafkajs';

import { BROKER_COUNT, FAILED_RECORDS_TOPIC, ORDERS_TOPIC, PAYMENTS_TOPIC, TOPIC_PARTITIONS } from './config.js';
import { BOOTSTRAP_SERVERS } from './environment.js';
import { messageGroups } from './utils/messages.js';

const TOPICS = [ORDERS_TOPIC, PAYMENTS_TOPIC, FAILED_RECORDS_TOPIC];

const kafka = new Kafka({ clientId: 'ler-example-kafka-producer', brokers: BOOTSTRAP_SERVERS.split(',') });

// The event source mappings reach the cluster before anything is produced, so a topic may already
// exist by the time this runs. Creating it again is a no-op, and the partition count is checked
// afterwards because an existing topic keeps the shape it was created with.
async function prepareTopics(): Promise<void> {
  const admin = kafka.admin();
  await admin.connect();

  try {
    await admin.createTopics({
      waitForLeaders: true,
      topics: TOPICS.map((topic) => ({
        topic,
        numPartitions: TOPIC_PARTITIONS,
        replicationFactor: BROKER_COUNT,
      })),
    });

    const metadata = await admin.fetchTopicMetadata({ topics: TOPICS });
    for (const topic of metadata.topics) {
      if (topic.partitions.length < TOPIC_PARTITIONS) {
        throw new Error(
          `Topic ${topic.name} has ${topic.partitions.length} partitions, the sample messages need ${TOPIC_PARTITIONS}`,
        );
      }
    }
  } finally {
    await admin.disconnect();
  }
}

export const handler = async (): Promise<{ sent: number }> => {
  await prepareTopics();

  const producer = kafka.producer();
  await producer.connect();

  let sent = 0;
  try {
    for (const group of messageGroups) {
      await producer.send({ topic: group.topic, messages: group.messages });
      sent += group.messages.length;
    }
  } finally {
    await producer.disconnect();
  }

  logger.info({ message: 'Sample messages produced', sent });
  return { sent };
};
