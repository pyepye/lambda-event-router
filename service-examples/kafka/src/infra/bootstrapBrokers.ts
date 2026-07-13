import { GetBootstrapBrokersCommand, KafkaClient } from '@aws-sdk/client-kafka';
import type { CdkCustomResourceEvent, CdkCustomResourceResponse } from 'aws-lambda';

const kafkaClient = new KafkaClient();

// CloudFormation exposes no broker addresses on an MSK cluster, and the worker needs one for its
// bootstrapServer filter while the producer needs all of them to connect.
export const handler = async (event: CdkCustomResourceEvent): Promise<CdkCustomResourceResponse> => {
  const clusterArn = String(event.ResourceProperties.clusterArn);

  if (event.RequestType === 'Delete') {
    return { PhysicalResourceId: clusterArn };
  }

  const { BootstrapBrokerString } = await kafkaClient.send(new GetBootstrapBrokersCommand({ ClusterArn: clusterArn }));

  if (!BootstrapBrokerString) {
    throw new Error(`Cluster ${clusterArn} reports no plaintext bootstrap brokers`);
  }

  return { PhysicalResourceId: clusterArn, Data: { bootstrapServers: BootstrapBrokerString } };
};
