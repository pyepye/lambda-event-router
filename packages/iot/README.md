# @lambda-event-router/iot

IoT Core rule action routing for Lambda function actions.

**Supported AWS Services:** `AWS IoT Core`

**Available Routers:** None (uses `EventRouter` from `@lambda-event-router/base`)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/iot
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.


## Quick Start

IoT Core events are handled via the base `EventRouter` since they arrive as generic Lambda invocations. See the [`@lambda-event-router/base`](../base/README.md) package for usage with `defineEventRoute` and custom filters.

## Examples

See the [examples/iot](../../examples/iot) directory for complete working examples.
