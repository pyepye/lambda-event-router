import { defineRoute } from '@lambda-event-router/sqs';
import { z } from 'zod';

const SOME_QUEUE_ARN = 'arn:aws:sqs:region:account-id:some-queue';
const SOME_DL_QUEUE_ARN = 'arn:aws:sqs:region:account-id:some-dl-queue';

const BodySchema = z.object({
  name: z.string(),
  price: z.number(),
});

const MessageAttributesSchema = z.object({
  dryRun: z.coerce.boolean().default(false),
});

export const createItemRoute = defineRoute({
  filters: {
    eventSourceArns: [SOME_QUEUE_ARN, SOME_DL_QUEUE_ARN],
  },
  bodySchema: BodySchema,
  messageAttributesSchema: MessageAttributesSchema,
}).handle(async (request) => {
  const { name, price } = request.body;
  const { dryRun } = request.messageAttributes;
  console.log(`Creating item: ${name} with price ${price} - ${dryRun}`);
});
