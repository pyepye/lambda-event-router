import { defineRoute } from '@lambda-event-router/sns';
import { z } from 'zod';

const SOME_TOPIC_ARN = 'arn:aws:sns:region:account-id:some-topic';
const SOME_DL_TOPIC_ARN = 'arn:aws:sns:region:account-id:some-dl-topic';

const BodySchema = z.object({
  name: z.string(),
  price: z.number(),
});

const MessageAttributesSchema = z.object({
  dryRun: z.coerce.boolean().default(false),
});

export const createItemRoute = defineRoute({
  filters: {
    topicArns: [SOME_TOPIC_ARN, SOME_DL_TOPIC_ARN],
  },
  bodySchema: BodySchema,
  messageAttributesSchema: MessageAttributesSchema,
}).handle(async (request) => {
  const { name, price } = request.body;
  const { dryRun } = request.messageAttributes;
  console.log(`Creating item: ${name} with price ${price} - dryRun: ${dryRun}`);
});
