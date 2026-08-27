import{C as n,o as h,c as l,ak as p,E as r,j as e,a as i}from"./chunks/framework.DiNuf6zK.js";const E=JSON.parse('{"title":"AppSyncEventsRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/AppSyncEventsRouter.md","filePath":"routers/AppSyncEventsRouter.md"}'),d={name:"routers/AppSyncEventsRouter.md"},y=Object.assign(d,{setup(o){const a=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { eventsRouter } from './events.js'

const lambdaRouter = new LambdaRouter({
  routers: [eventsRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"events.ts",code:`import { createAppSyncEventsRouter } from '@lambda-event-router/appsync'

import { onOrderPublish, onOrderSubscribe } from './handlers/orders.js'
import { onPresencePublish, onPresenceSubscribe } from './handlers/presence.js'

export const eventsRouter = createAppSyncEventsRouter()

eventsRouter
  .publish({ channelPath: '/orders/*', handler: onOrderPublish })
  .subscribe({ channelPath: '/orders/*', handler: onOrderSubscribe })
  .publish({ channelPath: '/presence/*', handler: onPresencePublish })
  .subscribe({ channelPath: '/presence/*', handler: onPresenceSubscribe })`},{path:"handlers/orders.ts",code:`import type { AppSyncEventsRequest } from '@lambda-event-router/appsync'
import { isObject, logger } from '@lambda-event-router/base'

export async function onOrderPublish({ channelPath, events }: AppSyncEventsRequest): Promise<unknown> {
  logger.info(\`Publishing \${events.length} events to \${channelPath}\`)

  const stamped = events.map((event) => {
    // A payload the rest of the app cannot read fails on its own rather than with the batch
    if (!isObject(event.payload)) {
      return { id: event.id, error: 'A payload has to be an object' }
    }

    return { id: event.id, payload: { ...event.payload, receivedAt: new Date().toISOString() } }
  })

  return { events: stamped }
}

export async function onOrderSubscribe({ channelPath, identity }: AppSyncEventsRequest): Promise<void> {
  const groups = identity?.groups ?? []

  if (!groups.includes('staff')) {
    // Throwing is how a subscription gets refused
    throw new Error(\`\${identity?.username} may not subscribe to \${channelPath}\`)
  }

  logger.info(\`\${identity?.username} subscribed to \${channelPath}\`)
}`},{path:"handlers/presence.ts",code:`import type { AppSyncEventsRequest } from '@lambda-event-router/appsync'
import { isObject, logger } from '@lambda-event-router/base'

const STALE_AFTER_MS = 60_000

export async function onPresencePublish({ channelPath, events }: AppSyncEventsRequest): Promise<unknown> {
  const fresh = events.filter((event) => {
    if (!isObject(event.payload) || typeof event.payload.sentAt !== 'number') return false

    return Date.now() - event.payload.sentAt < STALE_AFTER_MS
  })

  // Anything left out of the returned array is never delivered
  logger.info(\`Delivering \${fresh.length} of \${events.length} heartbeats on \${channelPath}\`)

  return { events: fresh }
}

export async function onPresenceSubscribe({ channelPath }: AppSyncEventsRequest): Promise<void> {
  // Presence is open to anyone the API let in, so there is nothing to check
  logger.info(\`A client subscribed to \${channelPath}\`)
}`}];return(k,s)=>{const t=n("CodeFileViewer");return h(),l("div",null,[s[0]||(s[0]=p("",69)),r(t,{files:a,id:"appsync-events-example","default-file":"events.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("p",null,"Each route pins both an operation and a channel pattern, and the two namespaces do not overlap, so no request can match two routes and the order they are registered in makes no difference. Between them the four routes cover every request the two namespaces can send, which is what keeps a stray publish from failing on a route that was never registered.",-1)),s[2]||(s[2]=e("p",null,[e("code",null,"index.ts"),i(" hands the router to "),e("code",null,"LambdaRouter"),i(", which is what AWS invokes and what every router in the Lambda gets registered on. See "),e("a",{href:"/docs/routers"},"routers"),i(" for how the two levels of matching fit together.")],-1))])}}});export{E as __pageData,y as default};
