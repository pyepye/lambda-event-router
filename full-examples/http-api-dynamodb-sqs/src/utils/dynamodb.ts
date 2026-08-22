import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

import { ddb, TABLE_NAME } from '../config.js';
import {
  DbOrderToOrder,
  DbStockToStock,
  ORDER_PREFIX,
  STOCK_PREFIX,
  type TDbOrder,
  type TOrder,
  type TOrderLine,
  type TStock,
} from './schemas.js';

function orderKey(orderId: string) {
  return { pk: `${ORDER_PREFIX}${orderId}`, sk: 'ORDER' } as const;
}

function stockKey(sku: string) {
  return { pk: `${STOCK_PREFIX}${sku}`, sk: 'STOCK' } as const;
}

export async function findOrder(orderId: string): Promise<TOrder | undefined> {
  const result = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: orderKey(orderId),
    }),
  );
  if (!result.Item) return undefined;
  return DbOrderToOrder.parse(result.Item);
}

export async function insertOrder(orderId: string, items: TOrderLine[]): Promise<TOrder> {
  const row: TDbOrder = {
    ...orderKey(orderId),
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
      Key: orderKey(orderId),
      UpdateExpression: 'SET #status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': 'processed' },
    }),
  );
}

export async function removeStock(sku: string, qty: number): Promise<TStock | undefined> {
  try {
    const result = await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: stockKey(sku),
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
