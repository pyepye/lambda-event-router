import type { RabbitMQRequest, RabbitMQResponse } from '../../../../packages/mq/src';

// General handler for all messages
export async function handleAllMessages({ message, queue }: RabbitMQRequest): Promise<RabbitMQResponse> {
  console.log(`Received message on queue ${queue}: ${message.data}`);
}

// Handler for messages from a specific queue
export async function handleQueueMessage({ message, queue }: RabbitMQRequest): Promise<RabbitMQResponse> {
  console.log(`Message from ${queue}: ${message.data}`);
}

// Handler for JSON content type messages
export async function handleJsonMessage({ message, queue }: RabbitMQRequest): Promise<RabbitMQResponse> {
  console.log(`JSON message from ${queue}: ${message.data}`);
}

// Handler for order messages
export async function handleOrderMessage({ message, queue }: RabbitMQRequest): Promise<RabbitMQResponse> {
  console.log(`Order message from ${queue}: ${message.data}`);
}
