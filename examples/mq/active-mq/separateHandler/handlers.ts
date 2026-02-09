import type {
  ActiveMQBytesMessageRequest,
  ActiveMQRequest,
  ActiveMQResponse,
  ActiveMQTextMessageRequest,
} from '../../../../packages/mq/src';

// General handler for all message types
export async function handleAllMessages({ message, destination }: ActiveMQRequest): Promise<ActiveMQResponse> {
  console.log(`Received message on ${destination}: ${message.data}`);
}

// Handler specifically for text messages
export async function handleTextMessage({
  message,
  destination,
}: ActiveMQTextMessageRequest): Promise<ActiveMQResponse> {
  console.log(`Text message on ${destination}: ${message.data}`);
}

// Handler specifically for bytes messages
export async function handleBytesMessage({
  message,
  destination,
}: ActiveMQBytesMessageRequest): Promise<ActiveMQResponse> {
  console.log(`Bytes message on ${destination}: ${message.data}`);
}

// Handler for messages from a specific destination
export async function handleOrderMessage({
  message,
  destination,
}: ActiveMQTextMessageRequest): Promise<ActiveMQResponse> {
  console.log(`Order message from ${destination}: ${message.data}`);
}
