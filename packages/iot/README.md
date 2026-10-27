# @latcher/iot

Handles IoT Core rule actions. They arrive as plain Lambda invocations, so you route them with `EventMatcher` from `@latcher/base`.

**Supported AWS Services:** `AWS IoT Core`

**Available Matchers:** None (uses `EventMatcher` from `@latcher/base`)

**Docs:** [EventMatcher](https://pyepye.github.io/latcher/matchers/EventMatcher)

## Install

```bash
npm install @latcher/base @latcher/iot
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

See [EventMatcher](https://pyepye.github.io/latcher/matchers/EventMatcher) for how to route, filter and
validate these events.
