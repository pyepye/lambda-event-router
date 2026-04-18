import type { EventTypeRouter, Middleware } from '@lambda-event-router/base';
import { handleEventWithMiddleware, isObject, safeJsonParse, validateSchema } from '@lambda-event-router/base';
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
  middleware: Middleware<SNSRequest, void>[];
  handler: SNSRecordHandler;
}

interface RouteInput<
  TBodySchema extends StandardSchemaV1 | undefined = undefined,
  TMessageAttributesSchema extends StandardSchemaV1 | undefined = undefined,
> {
  filters: SNSFilters;
  bodySchema?: TBodySchema;
  messageAttributesSchema?: TMessageAttributesSchema;
  middleware?: Middleware<SNSRequest, void>[];
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
  private middleware: Middleware<SNSRequest, void>[];

  constructor(options?: SNSRouterOptions) {
    this.batchItemFailures = options?.batchItemFailures ?? false;
    this.middleware = options?.middleware ?? [];
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
      // @ts-expect-error Contravariance: typed middleware stored in general InternalRoute, safe because schema validates before calling
      middleware: definition.middleware ?? [],
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

  private async matchRoute(
    record: SNSEventRecord,
    body: unknown,
    rawMessageAttributes: SNSRawMessageAttributes,
  ): Promise<InternalRoute | undefined> {
    for (const route of this.routes) {
      const { filters } = route;
      const sns = record.Sns;

      if (filters.topicArn) {
        const arns = Array.isArray(filters.topicArn) ? filters.topicArn : [filters.topicArn];
        if (!arns.includes(sns.TopicArn)) {
          continue;
        }
      }

      if (filters.subject) {
        const subjects = Array.isArray(filters.subject) ? filters.subject : [filters.subject];
        const subject = sns.Subject;
        if (subject === undefined || !subjects.includes(subject)) {
          continue;
        }
      }

      if (filters.messageAttributes) {
        let matched = true;
        for (const [key, allowed] of Object.entries(filters.messageAttributes)) {
          const allowedValues = Array.isArray(allowed) ? allowed : [allowed];
          const attr = rawMessageAttributes[key];
          const attrMatchesFilter = attr && allowedValues.includes(attr.Value);
          if (!attrMatchesFilter) {
            matched = false;
            break;
          }
        }
        if (!matched) {
          continue;
        }
      }

      if (filters.customFilter) {
        const match = await filters.customFilter({ body, messageAttributes: rawMessageAttributes, record });
        if (!match) continue;
      }

      return route;
    }
    return undefined;
  }

  private async processRecord(record: SNSEventRecord, context: Context): Promise<void> {
    const parsedBody = safeJsonParse(record.Sns.Message);
    const rawMessageAttributes = record.Sns.MessageAttributes;

    const route = await this.matchRoute(record, parsedBody, rawMessageAttributes);
    if (!route) {
      throw new Error(`No route matched for record from ${record.Sns.TopicArn}`);
    }
    const bodyValidationError = `Body validation failed for record ${record.Sns.MessageId}`;
    const body = await validateSchema(parsedBody, route.bodySchema, bodyValidationError);

    const convertedAttributes = this.convertMessageAttributes(rawMessageAttributes);
    const validatedMessageAttributes = await validateSchema(
      convertedAttributes,
      route.messageAttributesSchema,
      `Message attributes validation failed for record ${record.Sns.MessageId}`,
    );

    const request: SNSRequest = {
      body,
      messageAttributes: validatedMessageAttributes,
      record,
      context,
    };

    const allMiddleware = [...this.middleware, ...route.middleware];
    await handleEventWithMiddleware(allMiddleware, request, route.handler);
  }
}

export function createSNSRouter(options?: SNSRouterOptions): SNSRouter {
  return new SNSRouter(options);
}
