import type { ChatMessage, ChatMode } from './types'
import { resolveAgentServiceURL } from './services.ts'

export interface AgentConversationSummary {
  id: string
  namespace: string
  mode: ChatMode
  title: string
  preview: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

export interface AgentConversation extends AgentConversationSummary {
  messages: ChatMessage[]
}

export interface AgentConversationClientOptions {
  baseURL: string
  userId: string
  namespace: string
  headers?: Record<string, string>
}

interface AgentConversationResponse<T> {
  code?: number
  data?: T
  msg?: string
  message?: string
}

async function readConversationResponse<T>(response: Response): Promise<T> {
  let result: AgentConversationResponse<T> | undefined
  try {
    result = await response.json() as AgentConversationResponse<T>
  }
  catch {
    // Report the HTTP status when the service did not return JSON.
  }

  if (!response.ok || result?.code !== 0 || result.data === undefined) {
    throw new Error(
      result?.message
      ?? result?.msg
      ?? `会话服务请求失败（HTTP ${response.status}）`,
    )
  }

  return result.data
}

function conversationURL(baseURL: string, suffix = '') {
  return resolveAgentServiceURL(
    baseURL,
    `v1/conversations${suffix}`,
  )
}

function requestHeaders(
  options: AgentConversationClientOptions,
  withBody = false,
) {
  const userId = options.userId.trim()
  if (!userId)
    throw new Error('会话服务未授权')

  return {
    ...(withBody ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
    'Agent-User-Id': userId,
    'X-Agent-Namespace': options.namespace,
  }
}

function messageText(message: ChatMessage) {
  return message.parts
    .map(part => part.type === 'text' ? part.text.trim() : '')
    .filter(Boolean)
    .join(' ')
}

export function conversationTitle(messages: readonly ChatMessage[]) {
  const firstUserText = messages
    .find(message => message.role === 'user')
  const title = firstUserText ? messageText(firstUserText) : ''
  return (title || '新会话').slice(0, 80)
}

export function conversationPreview(messages: readonly ChatMessage[]) {
  const text = messages
    .map(messageText)
    .find(Boolean)
    ?? ''
  return text.slice(0, 160)
}

export async function listAgentConversations(
  options: AgentConversationClientOptions,
): Promise<AgentConversationSummary[]> {
  const response = await fetch(conversationURL(options.baseURL), {
    headers: requestHeaders(options),
  })
  return readConversationResponse<AgentConversationSummary[]>(response)
}

export async function getAgentConversation(
  options: AgentConversationClientOptions,
  id: string,
): Promise<AgentConversation> {
  const response = await fetch(
    conversationURL(options.baseURL, `/${encodeURIComponent(id)}`),
    { headers: requestHeaders(options) },
  )
  return readConversationResponse<AgentConversation>(response)
}

export async function saveAgentConversation(
  options: AgentConversationClientOptions,
  input: {
    id: string
    mode: ChatMode
    messages: ChatMessage[]
  },
): Promise<AgentConversationSummary> {
  const response = await fetch(
    conversationURL(options.baseURL, `/${encodeURIComponent(input.id)}`),
    {
      method: 'PUT',
      headers: requestHeaders(options, true),
      body: JSON.stringify({
        mode: input.mode,
        title: conversationTitle(input.messages),
        preview: conversationPreview(input.messages),
        messages: input.messages,
      }),
    },
  )
  return readConversationResponse<AgentConversationSummary>(response)
}
