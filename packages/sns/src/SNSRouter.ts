import type { EventTypeRouter } from '@lambda-event-router/base';
import { isObject, validateSchema } from '@lambda-event-router/base';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Context, SNSEvent, SNSEventRecord } from 'aws-lambda';
import type {
  SNSFilters,
  SNSMessageAttributes,
  SNSRawMessageAttributes,
  SNSRecordHandler,
  SNSRequest,
  SNSRouteDefinition,
  SNSRouterOptions,
} from './types.js';

interface InternalRoute {
  filters: SNSFilters;
  bodySchema?: StandardSchemaV1;
  messageAttributesSchema?: StandardSchemaV1<unknown, SNSMessageAttributes>;
  handler: SNSRecordHandler;
}

interface RouteInput<
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  TMessageAttributesSchema extends StandardSchemaV1 | undefined = undefined,
> {
  filters: SNSFilters;
  bodySchema?: TBodySchema;
  messageAttributesSchema?: TMessageAttributesSchema;
}

interface RouteBuilder<TBody, TMessageAttributes extends SNSMessageAttributes> {
  handle(handler: SNSRecordHandler<TBody, TMessageAttributes>): SNSRouteDefinition<TBody, TMessageAttributes>;
}

export function defineRoute<
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  TMessageAttributesSchema extends StandardSchemaV1 | undefined = undefined,
  TBody = TBodySchema extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TBodySchema> : unknown,
  TMessageAttributes extends SNSMessageAttributes = TMessageAttributesSchema extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TMessageAttributesSchema> & SNSMessageAttributes
    : SNSMessageAttributes,
>(config: RouteInput<TBodySchema, TMessageAttributesSchema>): RouteBuilder<TBody, TMessageAttributes> {
  return {
    // biome-ignore lint/nursery/useExplicitType: handler type is inferred from RouteBuilder return type
    handle(handler): SNSRouteDefinition<TBody, TMessageAttributes> {
      return { ...config, handler } as SNSRouteDefinition<TBody, TMessageAttributes>;
    },
  };
}

export class SNSRouter implements EventTypeRouter<SNSEvent, undefined> {
  private routes: InternalRoute[] = [];
  private batchItemFailures: boolean;

  constructor(options?: SNSRouterOptions) {
    this.batchItemFailures = options?.batchItemFailures ?? false;
  }

  canHandleEvent(event: unknown): event is SNSEvent {
    if (!isObject(event)) return false;
    if (!Array.isArray(event.Records)) return false;

    const firstRecord = event.Records[0];
    if (!isObject(firstRecord)) return false;

    return firstRecord.EventSource === 'aws:sns';
  }

  route<TBody, TMessageAttributes extends SNSMessageAttributes>(
    definition: SNSRouteDefinition<TBody, TMessageAttributes>,
  ): this {
    this.routes.push({
      filters: definition.filters,
      bodySchema: definition.bodySchema,
      messageAttributesSchema: definition.messageAttributesSchema,
      handler: definition.handler as SNSRecordHandler,
    });
    return this;
  }

  async handleEvent(event: SNSEvent, context: Context): Promise<undefined> {
    if (!this.batchItemFailures) {
      const recordPromises = event.Records.map((record) => this.processRecord(record, context));
      await Promise.all(recordPromises);
      return;
    }

    const recordPromises = event.Records.map((record) => this.processRecord(record, context));
    await Promise.allSettled(recordPromises);
  }

  private convertMessageAttributes(raw: SNSRawMessageAttributes): SNSMessageAttributes {
    const result: SNSMessageAttributes = {};
    for (const [key, attr] of Object.entries(raw)) {
      result[key] = attr.Value;
    }
    return result;
  }

  private matchRoute(
    record: SNSEventRecord,
    body: unknown,
    rawMessageAttributes: SNSRawMessageAttributes,
  ): InternalRoute | undefined {
    return this.routes.find((route) => {
      const { filters } = route;
      const sns = record.Sns;

      if (filters.topicArns && !filters.topicArns.includes(sns.TopicArn)) {
        return false;
      }

      if (filters.subjects) {
        const subject = sns.Subject;
        if (subject === undefined || !filters.subjects.includes(subject)) {
          return false;
        }
      }

      if (filters.messageAttributes) {
        for (const [key, allowedValues] of Object.entries(filters.messageAttributes)) {
          const attr = rawMessageAttributes[key];
          const attrMatchesFilter = attr && allowedValues.includes(attr.Value);
          if (!attrMatchesFilter) {
            return false;
          }
        }
      }

      if (filters.customFilter) {
        return filters.customFilter({ body, messageAttributes: rawMessageAttributes, record });
      }

      return true;
    });
  }

  private parseJsonBody(record: SNSEventRecord): unknown {
    try {
      return JSON.parse(record.Sns.Message);
    } catch {
      return record.Sns.Message;
    }
  }

  private async processRecord(record: SNSEventRecord, context: Context): Promise<void> {
    const parsedBody = this.parseJsonBody(record);
    const rawMessageAttributes = record.Sns.MessageAttributes;

    const route = this.matchRoute(record, parsedBody, rawMessageAttributes);
    if (!route) {
      throw new Error(`No route matched for record from ${record.Sns.TopicArn}`);
    }
    const bodyValidationError = `Body validation failed for record ${record.Sns.MessageId}`;
    const body = await validateSchema(parsedBody, route.bodySchema, bodyValidationError);

    const convertedAttributes = this.convertMessageAttributes(rawMessageAttributes);
    const validatedMessageAttributes = (await validateSchema(
      convertedAttributes,
      route.messageAttributesSchema,
      `Message attributes validation failed for record ${record.Sns.MessageId}`,
    )) as SNSMessageAttributes; // TODO: Fix / improve typing so `as` isn't needed

    const request: SNSRequest = {
      body,
      messageAttributes: validatedMessageAttributes,
      record,
      context,
    };

    await route.handler(request);
  }
}

export function createSNSRouter(options?: SNSRouterOptions): SNSRouter {
  return new SNSRouter(options);
}
