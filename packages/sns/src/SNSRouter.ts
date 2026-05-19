import type { Context, SNSEvent, SNSEventRecord } from 'aws-lambda';

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { EventTypeRouter, FilterStringMatcher, Middleware } from '@lambda-event-router/base';
import {
  filterStringMatcher,
  handleEventWithMiddleware,
  isObject,
  safeJsonParse,
  validateSchema,
} from '@lambda-event-router/base';

import type {
  SNSFilters,
  SNSMessageAttributes,
  SNSMessageAttributeValue,
  SNSRawMessageAttributes,
  SNSRecordHandler,
  SNSRequest,
  SNSRouteDefinition,
  SNSRouterOptions,
  SNSStringArrayItem,
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
      if (attr.Type === 'Number') {
        result[key] = Number(attr.Value);
      } else if (attr.Type === 'Binary') {
        result[key] = Buffer.from(attr.Value, 'base64');
      } else if (attr.Type === 'String.Array') {
        result[key] = this.parseStringArrayValue(attr.Value);
      } else {
        result[key] = attr.Value;
      }
    }
    return result;
  }

  private isStringArrayItem(value: unknown): value is SNSStringArrayItem {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null;
  }

  private parseStringArrayValue(rawValue: string): SNSStringArrayItem[] {
    const parsed: unknown = JSON.parse(rawValue);
    if (!(Array.isArray(parsed) && parsed.every(this.isStringArrayItem))) {
      throw new Error(`Invalid SNS String.Array attribute value: ${rawValue}`);
    }
    return parsed;
  }

  private async matchRoute(
    record: SNSEventRecord,
    body: unknown,
    messageAttributes: SNSMessageAttributes,
  ): Promise<InternalRoute | undefined> {
    for (const route of this.routes) {
      const { filters } = route;
      const sns = record.Sns;

      if (filters.topicArn) {
        const topicArnMatch = filterStringMatcher(sns.TopicArn, filters.topicArn);
        if (!topicArnMatch) continue;
      }

      if (filters.subject) {
        if (!sns.Subject) continue;
        const subjectMatch = filterStringMatcher(sns.Subject, filters.subject);
        if (!subjectMatch) continue;
      }

      if (filters.messageAttributes) {
        let matched = true;
        for (const [key, allowed] of Object.entries(filters.messageAttributes)) {
          const attr = messageAttributes[key];
          if (attr === undefined || !this.matchMessageAttribute(attr, allowed)) {
            matched = false;
            break;
          }
        }
        if (!matched) continue;
      }

      if (filters.custom) {
        const match = await filters.custom({ body, messageAttributes, record });
        if (!match) continue;
      }

      return route;
    }
    return undefined;
  }

  private async processRecord(record: SNSEventRecord, context: Context): Promise<void> {
    const parsedBody = safeJsonParse(record.Sns.Message);
    const convertedAttributes = this.convertMessageAttributes(record.Sns.MessageAttributes);

    const route = await this.matchRoute(record, parsedBody, convertedAttributes);
    if (!route) {
      throw new Error(`No route matched for record from ${record.Sns.TopicArn}`);
    }
    const bodyValidationError = `Body validation failed for record ${record.Sns.MessageId}`;
    const body = await validateSchema(parsedBody, route.bodySchema, bodyValidationError);

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

  private matchMessageAttribute(
    attr: SNSMessageAttributeValue,
    allowed: FilterStringMatcher | number | number[],
  ): boolean {
    if (typeof allowed === 'number') {
      return attr === allowed;
    }
    if (Array.isArray(allowed)) {
      return allowed.some((item) => this.matchMessageAttribute(attr, item));
    }
    return typeof attr === 'string' && filterStringMatcher(attr, allowed);
  }
}

export function createSNSRouter(options?: SNSRouterOptions): SNSRouter {
  return new SNSRouter(options);
}
