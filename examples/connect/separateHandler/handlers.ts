import type { ConnectRequest, ConnectResponse } from '@lambda-event-router/connect';

export async function handleVoiceCall({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  const customerNumber = contactData.CustomerEndpoint?.Address;
  console.log(`Voice call from ${customerNumber}`);

  return { status: 'voice_handled' };
}

export async function handleChatMessage({ contactData, parameters }: ConnectRequest): Promise<ConnectResponse> {
  const customerName = contactData.Attributes.customerName;
  console.log(`Chat message from ${customerName}, topic: ${parameters.topic}`);

  return { status: 'chat_handled' };
}

export async function handleEmailMessage({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  const customerAddress = contactData.CustomerEndpoint?.Address;
  console.log(`Email from ${customerAddress}`);

  return { status: 'email_handled' };
}

export async function handleInboundCall({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  const customerNumber = contactData.CustomerEndpoint?.Address;
  console.log(`Inbound call from ${customerNumber}`);

  return { status: 'inbound_handled' };
}

export async function handleOutboundCall({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  const systemNumber = contactData.SystemEndpoint?.Address;
  console.log(`Outbound call from ${systemNumber}`);

  return { status: 'outbound_handled' };
}

export async function handleTransferCall({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  const queueName = contactData.Queue?.Name;
  console.log(`Transfer to queue ${queueName}`);

  return { status: 'transfer_handled' };
}

export async function handleCallbackCall({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  const customerNumber = contactData.CustomerEndpoint?.Address;
  console.log(`Callback to ${customerNumber}`);

  return { status: 'callback_handled' };
}

export async function handleApiCall({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  const contactId = contactData.ContactId;
  console.log(`API-initiated contact ${contactId}`);

  return { status: 'api_handled' };
}
