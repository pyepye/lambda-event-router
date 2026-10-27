import{C as t,o as n,c as h,ak as e,E as o}from"./chunks/framework.C2AAou88.js";const c=JSON.parse('{"title":"WebSocketMatcher","description":"","frontmatter":{},"headers":[],"relativePath":"matchers/WebSocketMatcher.md","filePath":"matchers/WebSocketMatcher.md"}'),d={name:"matchers/WebSocketMatcher.md"},k=Object.assign(d,{setup(r){const i=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { wsMatcher } from './websocket.js'

const latcher = new Latcher({
  matchers: [wsMatcher],
})

export const handler: Handler = latcher.handler()`},{path:"websocket.ts",code:`import { createWebSocketMatcher } from '@latcher/apigateway'

import { joinRoom, onConnect, onDisconnect, sendMessage, unknownAction } from './handlers/rooms.js'
import { JoinRoomSchema, SendMessageSchema } from './schemas/message.js'

export const wsMatcher = createWebSocketMatcher()

wsMatcher
  .connect({ handler: onConnect })
  .disconnect({ handler: onDisconnect })
  .message({
    filters: { routeKey: 'joinRoom' },
    bodySchema: JoinRoomSchema,
    handler: joinRoom,
  })
  .message({
    filters: { routeKey: 'sendMessage' },
    bodySchema: SendMessageSchema,
    handler: sendMessage,
  })
  .message({
    filters: { routeKey: '$default' },
    handler: unknownAction,
  })`},{path:"handlers/rooms.ts",code:`import { GoneException } from '@aws-sdk/client-apigatewaymanagementapi'
import type {
  WebSocketConnectRequest,
  WebSocketConnectResponse,
  WebSocketDisconnectRequest,
  WebSocketMessageRequest,
} from '@latcher/apigateway'
import { postToConnection, WebSocketOk, WebSocketUnauthorized } from '@latcher/apigateway'
import { logger } from '@latcher/base'

import { connections } from '../connections.js'
import type { JoinRoom, SendMessage } from '../schemas/message.js'

export async function onConnect(request: WebSocketConnectRequest): Promise<WebSocketConnectResponse> {
  const { connectionId, queryStringParameters } = request

  const token = queryStringParameters?.token
  if (!token) {
    return WebSocketUnauthorized()
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
export type SendMessage = z.infer<typeof SendMessageSchema>`}];return(l,s)=>{const a=t("CodeFileViewer");return n(),h("div",null,[s[0]||(s[0]=e("",113)),o(a,{files:i,id:"websocket-example","default-file":"websocket.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("",3))])}}});export{c as __pageData,k as default};
