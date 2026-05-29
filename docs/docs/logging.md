# Logging

Every router logs through one shared logger, and your own code can use the same one. Import `logger`
from `base` and your logs come out in the same shape, at the same level, as the ones the library writes
for you.

It stays small on purpose: levels, keys that last for one invocation and JSON output when Lambda asks
for it. Install the [Powertools logger](https://docs.aws.amazon.com/powertools/typescript/2.8.0/core/logger/) and the library uses that instead, with nothing to configure.

## Logger

This is the logger you get without installing anything. It keeps to the essentials, and you can tune
it with environment variables or build your own `Logger` when you need more.

### Default settings

Import `logger` and start logging. There is nothing to construct, and it writes at `INFO` and above
until you change the level.

```typescript
import { logger } from '@lambda-event-router/base';

logger.info('My log');
```

Set the level with your function's application log level, part of Lambda's Advanced Logging Controls,
which Lambda exposes to the runtime as `AWS_LAMBDA_LOG_LEVEL`. You can set that variable directly
instead. A level writes itself and everything more severe, so `WARN` keeps warnings and errors and
drops `INFO` and `DEBUG`.

The levels, least to most severe: `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `CRITICAL`. `SILENT` turns
logging off. **AWS's own `FATAL` is not one of these**, so setting the level to it falls back to `INFO`.

### Custom settings

Build your own `Logger` when the environment variables do not get you far enough, usually to name the
service or to put account and region on every line.

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

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `logLevel` | `LogLevelName` | `AWS_LAMBDA_LOG_LEVEL`, or `INFO` | The lowest level that gets written. Setting it here wins over the environment variable |
| `serviceName` | `string` | Not set | Added to every log as `serviceName` |
| `persistentLogAttributes` | `Record<string, unknown>` | `{}` | Merged into every log, and left alone by the per-invocation reset |

**A logger you build this way is yours alone.** The routers carry on using the shared one, so their
logs will not pick up your `serviceName` or your attributes. Pass it to `setLogger` to make it the
logger everything uses, as in [custom logger](#custom-logger) below.

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
