# Logging

## Logger


Default settings:

```typescript
import { logger } from '@lambda-event-router/base';

logger.info('My log');
```

Use `AWS_LAMBDA_LOG_LEVEL` environment variable to set the log level.

Supported levels are:

- `TRACE`
- `DEBUG`
- `INFO`
- `WARN`
- `ERROR`
- `CRITICAL`
- `SILENT`


Custom settings:

```typescript
import { Logger } from '@lambda-event-router/base';

const logger = new Logger({
  logLevel: 'INFO',
  serviceName: 'serverlessAirline',
  persistentLogAttributes: {
    aws_account_id: '123456789012',
    aws_region: 'eu-west-1',
  },
})

logger.info('My log');
```

### Per-invocation keys

`LambdaRouter` calls `resetKeys()` on the active logger at the start of every invocation. This clears any temporary keys added with `appendKeys()` during a previous invocation so that state does not leak across warm-container reuse.

If you need attributes that persist for the lifetime of the container (e.g. region, account id), use `appendPersistentKeys()` / `persistentLogAttributes` instead. Persistent keys are not affected by the per-invocation reset.

### Structured JSON logs

If your Lambda function is configured with log format `JSON` (Advanced Logging Controls), the runtime sets `AWS_LAMBDA_LOG_FORMAT=JSON`. The default `Logger` detects this and emits a single structured object per log call so the runtime can merge its properties into CloudWatch as queryable fields rather than a single stringified `message`. For heavier structured logging (Lambda context injection, sampling, child loggers) install `@aws-lambda-powertools/logger` as shown below.


## Powertools

Powertools for AWS Lambda (TypeScript) has a [logger](https://docs.aws.amazon.com/powertools/typescript/latest/features/logger/) which "provides an opinionated logger with output structured as JSON".

If you have the Powertools logger installed and you are using the default settings / environment variables, you can use the logger as normal. Under the hood the `lambda-event-router` will use the powertools logger for any of its logging

```bash
npm install @aws-lambda-powertools/logger
```

```typescript
import { logger } from '@lambda-event-router/base';

logger.info('My log');
```

As a note, this is the same as

```typescript
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger();

logger.info('My log');
```


### Custom logger

```typescript
import { Logger } from '@aws-lambda-powertools/logger';
import { setLogger, LambdaRouter } from '@lambda-event-router/base';

const customLogger = new Logger({
  serviceName: 'serverlessAirline',
  logLevel: 'INFO',
  persistentLogAttributes: {
    aws_account_id: '123456789012',
    aws_region: 'eu-west-1',
  },
});

setLogger(customLogger);

const lambdaRouter = new LambdaRouter({
  routers: [sqsRouter]
})

export const handler = lambdaRouter.handler()
```
