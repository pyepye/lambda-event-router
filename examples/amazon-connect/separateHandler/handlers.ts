import type { AmazonConnectRequest, AmazonConnectResponse } from '@lambda-event-router/amazon-connect';

export async function handleVoiceCall({ contactData }: AmazonConnectRequest): Promise<AmazonConnectResponse> {
  const customerNumber = contactData.CustomerEndpoint?.Address;
  console.log(`Voice call from ${customerNumber}`);

  return { status: 'voice_handled' };
}

export async function handleChatMessage({
  contactData,
  parameters,
}: AmazonConnectRequest): Promise<AmazonConnectResponse> {
  const customerName = contactData.Attributes.customerName;
  console.log(`Chat message from ${customerName}, topic: ${parameters.topic}`);

  return { status: 'chat_handled' };
}

export async function handleEmailMessage({ contactData }: AmazonConnectRequest): Promise<AmazonConnectResponse> {
  const customerAddress = contactData.CustomerEndpoint?.Address;
  console.log(`Email from ${customerAddress}`);

  return { status: 'email_handled' };
}

export async function handleInboundCall({ contactData }: AmazonConnectRequest): Promise<AmazonConnectResponse> {
  const customerNumber = contactData.CustomerEndpoint?.Address;
  console.log(`Inbound call from ${customerNumber}`);

  return { status: 'inbound_handled' };
}

export async function handleOutboundCall({ contactData }: AmazonConnectRequest): Promise<AmazonConnectResponse> {
  const systemNumber = contactData.SystemEndpoint?.Address;
  console.log(`Outbound call from ${systemNumber}`);

  return { status: 'outbound_handled' };
}

export async function handleTransferCall({ contactData }: AmazonConnectRequest): Promise<AmazonConnectResponse> {
  const queueName = contactData.Queue?.Name;
  console.log(`Transfer to queue ${queueName}`);

  return { status: 'transfer_handled' };
}

export async function handleCallbackCall({ contactData }: AmazonConnectRequest): Promise<AmazonConnectResponse> {
  const customerNumber = contactData.CustomerEndpoint?.Address;
  console.log(`Callback to ${customerNumber}`);

  return { status: 'callback_handled' };
}

export async function handleApiCall({ contactData }: AmazonConnectRequest): Promise<AmazonConnectResponse> {
  const contactId = contactData.ContactId;
  console.log(`API-initiated contact ${contactId}`);

  return { status: 'api_handled' };
}
