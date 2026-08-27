import{C as a,o as n,c as o,ak as e,E as h}from"./chunks/framework.DiNuf6zK.js";const k=JSON.parse('{"title":"WebSocketRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/WebSocketRouter.md","filePath":"routers/WebSocketRouter.md"}'),d={name:"routers/WebSocketRouter.md"},c=Object.assign(d,{setup(r){const i=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { wsRouter } from './websocket.js'

const lambdaRouter = new LambdaRouter({
  routers: [wsRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"websocket.ts",code:`import { createWebSocketRouter } from '@lambda-event-router/apigateway'

import { joinRoom, onConnect, onDisconnect, sendMessage, unknownAction } from './handlers/rooms.js'
import { JoinRoomSchema, SendMessageSchema } from './schemas/message.js'

export const wsRouter = createWebSocketRouter()

wsRouter
  .connect({ handler: onConnect })
  .disconnect({ handler: onDisconnect })
  .message({
    routeKey: 'joinRoom',
    bodySchema: JoinRoomSchema,
    handler: joinRoom,
  })
  .message({
    routeKey: 'sendMessage',
    bodySchema: SendMessageSchema,
    handler: sendMessage,
  })
  .message({
    routeKey: '$default',
    handler: unknownAction,
  })`},{path:"handlers/rooms.ts",code:`import { GoneException } from '@aws-sdk/client-apigatewaymanagementapi'
import type {
  WebSocketConnectRequest,
  WebSocketConnectResponse,
  WebSocketDisconnectRequest,
  WebSocketMessageRequest,
} from '@lambda-event-router/apigateway'
import { postToConnection, WebSocketOk, WebSocketUnauthorised } from '@lambda-event-router/apigateway'
import { logger } from '@lambda-event-router/base'

import { connections } from '../connections.js'
import type { JoinRoom, SendMessage } from '../schemas/message.js'

export async function onConnect(request: WebSocketConnectRequest): Promise<WebSocketConnectResponse> {
  const { connectionId, queryStringParameters } = request

  const token = queryStringParameters?.token
  if (!token) {
    return WebSocketUnauthorised()
  }

  await connections.add(connectionId, token)
  logger.info(\`Connection \${connectionId} opened\`)

  return WebSocketOk()
}

export async function onDisconnect({ connectionId }: WebSocketDisconnectRequest): Promise<void> {
  await connections.remove(connectionId)
  logger.info(\`Connection \${connectionId} closed\`)
}

export async function joinRoom(request: WebSocketMessageRequest<JoinRoom>): Promise<void> {
  const { connectionId, body } = request

  await connections.join(connectionId, body.roomId)
  logger.info(\`Connection \${connectionId} joined room \${body.roomId}\`)
}

export async function sendMessage(request: WebSocketMessageRequest<SendMessage>): Promise<void> {
  const { connectionId, domainName, stage, body } = request
  const data = JSON.stringify({ roomId: body.roomId, content: body.content, from: connectionId })

  for (const id of await connections.inRoom(body.roomId)) {
    try {
      await postToConnection({ domainName, stage, connectionId: id, data })
    } catch (error) {
      // A client that has closed since we stored it answers 410, so forget it and carry on
      if (!(error instanceof GoneException)) throw error
      await connections.remove(id)
    }
  }

  logger.info(\`Broadcast a message to room \${body.roomId} from \${connectionId}\`)
}

export async function unknownAction(request: WebSocketMessageRequest): Promise<void> {
  const { connectionId, routeKey } = request

  logger.warn(\`Connection \${connectionId} sent an action with no route, arriving as \${routeKey}\`)
}`},{path:"schemas/message.ts",code:`import { z } from 'zod'

export const JoinRoomSchema = z.object({
  action: z.literal('joinRoom'),
  roomId: z.string(),
})

export const SendMessageSchema = z.object({
  action: z.literal('sendMessage'),
  roomId: z.string(),
  content: z.string(),
})

export type JoinRoom = z.infer<typeof JoinRoomSchema>
export type SendMessage = z.infer<typeof SendMessageSchema>`}];return(l,s)=>{const t=a("CodeFileViewer");return n(),o("div",null,[s[0]||(s[0]=e("",108)),h(t,{files:i,id:"websocket-example","default-file":"websocket.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("",3))])}}});export{k as __pageData,c as default};
