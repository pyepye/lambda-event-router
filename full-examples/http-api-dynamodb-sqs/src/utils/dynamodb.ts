import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

import { ddb, tableName } from '../config.js';
import { DbOrderToOrder, DbStockToStock, type TDbOrder, type TOrder, type TOrderLine, type TStock } from './schemas.js';

export function orderPartitionKey(orderId: string): string {
  return `ORDER#${orderId}`;
}

export function stockPartitionKey(sku: string): string {
  return `STOCK#${sku}`;
}

export async function getOrder(orderId: string): Promise<TOrder> {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: { pk: 'ORDER', sk: orderId },
    }),
  );
  if (!result.Item) {
    throw new Error(`Order ${orderId} not found`);
  }
  return DbOrderToOrder.parse(result.Item);
}

export async function createOrder(orderId: string, items: TOrderLine[]): Promise<TOrder> {
  const row: TDbOrder = {
    pk: 'ORDER',
    sk: orderId,
    items,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await ddb.send(new PutCommand({ TableName: tableName, Item: row }));
  return DbOrderToOrder.parse(row);
}

export async function decrementStock(sku: string, qty: number): Promise<TStock> {
  const result = await ddb.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { pk: 'STOCK', sk: sku },
      UpdateExpression: 'ADD #quantity :neg',
      ExpressionAttributeNames: { '#quantity': 'quantity' },
      ExpressionAttributeValues: { ':neg': -qty },
      ConditionExpression: 'attribute_exists(pk)',
      ReturnValues: 'ALL_NEW',
    }),
  );
  return DbStockToStock.parse(result.Attributes);
}
