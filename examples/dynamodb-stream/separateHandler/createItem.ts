import type {
  DynamoDBStreamInsertRequest,
  DynamoDBStreamModifyRequest,
  DynamoDBStreamRemoveRequest,
  DynamoDBStreamRequest,
  DynamoDBStreamResponse,
} from '@lambda-event-router/dynamodb-stream';

interface Keys {
  pk: string;
  sk: string;
}

interface Item extends Keys {
  data: {
    orgId: string;
    itemId: string;
  };
}

export async function createItem({
  newImage,
  keys,
}: DynamoDBStreamInsertRequest<Keys, Item>): Promise<DynamoDBStreamResponse> {
  const { pk, sk } = keys;
  console.log(`Creating item: newImage ${newImage.data.itemId} - pk ${pk} - sk ${sk}`);
}

// Using general type - newImage/oldImage depend on eventName
export async function updateItem({
  newImage,
  oldImage,
  keys,
}: DynamoDBStreamRequest<Keys, Item, Item>): Promise<DynamoDBStreamResponse> {
  const { pk, sk } = keys;
  console.log(`Creating item: newImage ${newImage} - oldImage ${oldImage} - pk ${pk} - sk ${sk}`);
}

// Using specific MODIFY type - both newImage and oldImage are guaranteed
export async function modifyItem({
  newImage,
  oldImage,
  keys,
}: DynamoDBStreamModifyRequest<Keys, Item, Item>): Promise<DynamoDBStreamResponse> {
  const { pk, sk } = keys;
  console.log(
    `Modifying item: newImage ${newImage.data.itemId} - oldImage ${oldImage.data.itemId} - pk ${pk} - sk ${sk}`,
  );
}

// Using specific REMOVE type - only oldImage is available
export async function removeItem({
  oldImage,
  keys,
}: DynamoDBStreamRemoveRequest<Keys, Item>): Promise<DynamoDBStreamResponse> {
  const { pk, sk } = keys;
  console.log(`Removing item: oldImage ${oldImage.data.itemId} - pk ${pk} - sk ${sk}`);
}
