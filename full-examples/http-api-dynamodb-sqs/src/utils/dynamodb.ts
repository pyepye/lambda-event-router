import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

import { ddb, TABLE_NAME } from '../config.js';
import { DbOrderToOrder, DbStockToStock, type TDbOrder, type TOrder, type TOrderLine, type TStock } from './schemas.js';

export async function findOrder(orderId: string): Promise<TOrder | undefined> {
  const result = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: 'ORDER', sk: orderId },
    }),
  );
  if (!result.Item) return undefined;
  return DbOrderToOrder.parse(result.Item);
}

export async function insertOrder(orderId: string, items: TOrderLine[]): Promise<TOrder> {
  const row: TDbOrder = {
    pk: 'ORDER',
    sk: orderId,
    items,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: row }));
  return DbOrderToOrder.parse(row);
}

export async function markOrderProcessed(orderId: string): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: 'ORDER', sk: orderId },
      UpdateExpression: 'SET #status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': 'processed' },
    }),
  );
}

// Returns undefined when the SKU has less than qty in stock, or does not exist.
export async function removeStock(sku: string, qty: number): Promise<TStock | undefined> {
  try {
    const result = await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'STOCK', sk: sku },
        UpdateExpression: 'SET #quantity = #quantity - :qty',
        ConditionExpression: '#quantity >= :qty',
        ExpressionAttributeNames: { '#quantity': 'quantity' },
        ExpressionAttributeValues: { ':qty': qty },
        ReturnValues: 'ALL_NEW',
      }),
    );
    return DbStockToStock.parse(result.Attributes);
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return undefined;
    throw error;
  }
}
