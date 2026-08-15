# @lambda-event-router/iot

Handles IoT Core rule actions. They arrive as plain Lambda invocations, so you route them with `EventRouter` from `@lambda-event-router/base`.

**Supported AWS Services:** `AWS IoT Core`

**Available Routers:** None (uses `EventRouter` from `@lambda-event-router/base`)

**Docs:** [EventRouter](https://pyepye.github.io/lambda-event-router/routers/EventRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/iot
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

See [EventRouter](https://pyepye.github.io/lambda-event-router/routers/EventRouter) for how to route, filter and
validate these events.
