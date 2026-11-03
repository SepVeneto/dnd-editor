import type {
  Agent,
  AgentInputItem,
  RunItemStreamEvent,
  RunStreamEvent,
} from '@openai/agents'
import type { AgentHostApi, ChatMessage, ChatMode, MessagePart, ToolPart } from './types'
import type { AgentToolDefinition } from './tool'
import {
  assistant,
  MemorySession,
  OpenAIProvider,
  Runner,
  system,
  user,
} from '@openai/agents'
import OpenAI from 'openai'
import {
  createAgents,
  DEFAULT_AGENT_BFF_URL,
  DEFAULT_AGENT_MODEL,
} from './agents'

export interface AgentRuntimeConfig {
  baseURL: string
  model: string
  apiMode: 'responses' | 'chat_completions'
}

export interface AgentRuntimeOptions extends Partial<AgentRuntimeConfig> {
  api?: AgentHostApi
  tools?: AgentToolDefinition[]
  getContext?: () => Record<string, unknown>
}

export interface AgentRuntimeTurn {
  runtimeSessionId: string
  prompt: string
  mode: ChatMode
  message: ChatMessage
  history: ChatMessage[]
  signal: AbortSignal
  onUpdate: () => void
}

export interface AgentRuntime {
  readonly config: Readonly<AgentRuntimeConfig>
  runTurn: (turn: AgentRuntimeTurn) => Promise<void>
}

interface RuntimeSession {
  activeAgentName: string
  session: MemorySession
}

const browserProxyPlaceholder = 'browser-proxy'

function normalizeBaseURL(baseURL: string | undefined) {
  return baseURL?.trim().replace(/\/+$/, '') || DEFAULT_AGENT_BFF_URL
}

function normalizeApiMode(value: string | undefined): AgentRuntimeConfig['apiMode'] {
  return value === 'chat_completions' ? 'chat_completions' : 'responses'
}

function appendPart<T extends MessagePart>(message: ChatMessage, part: T): T {
  message.parts.push(part)
  return message.parts[message.parts.length - 1] as T
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {}
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function parseArguments(value: unknown): unknown {
  if (typeof value !== 'string')
    return value

  try {
    return JSON.parse(value)
  }
  catch {
    return value
  }
}

function reasoningText(item: RunItemStreamEvent['item']) {
  const raw = asRecord(item.rawItem)
  const content = Array.isArray(raw.content) ? raw.content : []
  return content
    .map(part => readString(asRecord(part), 'text'))
    .filter((text): text is string => Boolean(text))
    .join('\n')
}

function findToolPart(message: ChatMessage, callId: string) {
  return message.parts.find(
    (part): part is ToolPart =>
      part.type === 'tool' && part.toolCallId === callId,
  )
}

function handleRunItemEvent(
  event: RunItemStreamEvent,
  message: ChatMessage,
  mode: ChatMode,
  onUpdate: () => void,
) {
  if (event.name === 'reasoning_item_created' && mode === 'data') {
    const text = reasoningText(event.item)
    if (text) {
      appendPart(message, { type: 'reasoning', text })
      onUpdate()
    }
    return
  }

  if (
    (event.name === 'tool_called'
      || event.name === 'handoff_requested'
      || event.name === 'tool_search_called')
    && mode === 'data'
  ) {
    const raw = asRecord(event.item.rawItem)
    const callId = readString(raw, 'callId')
      ?? readString(raw, 'call_id')
      ?? readString(raw, 'id')
      ?? globalThis.crypto.randomUUID()
    if (findToolPart(message, callId))
      return

    const toolName = readString(raw, 'name')
      ?? readString(asRecord(event.item), 'toolName')
      ?? (event.name === 'handoff_requested' ? 'transfer_to_agent' : 'tool')
    const input = parseArguments(raw.arguments ?? raw.input)
    const output = raw.output
    appendPart(message, {
      type: 'tool',
      toolCallId: callId,
      toolName,
      state: output === undefined ? 'input-available' : 'output-available',
      input,
      output,
    })
    onUpdate()
    return
  }

  if (
    (event.name === 'tool_output'
      || event.name === 'tool_search_output_created')
    && mode === 'data'
  ) {
    const raw = asRecord(event.item.rawItem)
    const callId = readString(raw, 'callId')
      ?? readString(raw, 'call_id')
      ?? readString(raw, 'id')
    if (!callId)
      return

    const toolPart = findToolPart(message, callId)
    if (toolPart) {
      toolPart.state = 'output-available'
      toolPart.output = asRecord(event.item).output
      onUpdate()
    }
    return
  }

  if (event.name === 'handoff_occurred' && mode === 'data') {
    const item = event.item
    if (item.type === 'handoff_output_item') {
      appendPart(message, {
        type: 'data',
        name: 'agent_handoff',
        data: {
          from: item.sourceAgent.name,
          to: item.targetAgent.name,
        },
      })
      onUpdate()
    }
  }
}

function messageText(message: ChatMessage) {
  return message.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('')
}

function toAgentHistory(messages: ChatMessage[]): AgentInputItem[] {
  const items: AgentInputItem[] = []
  for (const message of messages) {
    const text = messageText(message).trim()
    if (!text)
      continue

    if (message.role === 'assistant')
      items.push(assistant(text))
    else if (message.role === 'system')
      items.push(system(text))
    else
      items.push(user(text))
  }
  return items
}

function readStoredAgent(key: string) {
  try {
    return localStorage.getItem(key) ?? undefined
  }
  catch {
    return undefined
  }
}

function saveStoredAgent(key: string, agentName: string) {
  try {
    localStorage.setItem(key, agentName)
  }
  catch {
    // The runtime remains usable when storage is unavailable.
  }
}

/**
 * llm-agent runtime. The Agents SDK owns the agent loop, tool calls and session
 * history; this module only maps its stream events to the chat UI parts.
 */
export function createAgentRuntime(
  options: AgentRuntimeOptions = {},
): AgentRuntime {
  const config: AgentRuntimeConfig = {
    baseURL: normalizeBaseURL(options.baseURL),
    model: options.model?.trim() || DEFAULT_AGENT_MODEL,
    apiMode: normalizeApiMode(options.apiMode),
  }
  const { agent } = createAgents({
    model: config.model,
    api: options.api ?? {},
    tools: options.tools,
    getContext: options.getContext,
  })
  const agentRegistry = new Map<string, Agent<any, any>>([
    [agent.name, agent],
  ])
  const sessionStore = new Map<string, Promise<RuntimeSession>>()
  const runtimeStoragePrefix = [
    'dnd-agent:runtime',
    encodeURIComponent(config.baseURL),
    encodeURIComponent(config.model),
  ].join(':')
  let runner: Runner | undefined

  function getRunner() {
    if (!runner) {
      const client = new OpenAI({
        apiKey: browserProxyPlaceholder,
        baseURL: config.baseURL,
        dangerouslyAllowBrowser: true,
      })
      runner = new Runner({
        modelProvider: new OpenAIProvider({
          openAIClient: client,
          useResponses: config.apiMode === 'responses',
          cacheResponsesWebSocketModels: false,
        }),
        tracingDisabled: true,
      })
    }
    return runner
  }

  function agentStorageKey(runtimeSessionId: string) {
    return `${runtimeStoragePrefix}:agent:${runtimeSessionId}`
  }

  function saveActiveAgent(runtimeSessionId: string, agentName: string) {
    saveStoredAgent(agentStorageKey(runtimeSessionId), agentName)
  }

  function createRuntimeSession(
    runtimeSessionId: string,
    history: ChatMessage[],
  ): RuntimeSession {
    const storedAgentName = readStoredAgent(agentStorageKey(runtimeSessionId))
    const activeAgentName = storedAgentName && agentRegistry.has(storedAgentName)
      ? storedAgentName
      : agent.name

    return {
      activeAgentName,
      session: new MemorySession({
        sessionId: runtimeSessionId,
        initialItems: toAgentHistory(history),
      }),
    }
  }

  function getRuntimeSession(
    runtimeSessionId: string,
    history: ChatMessage[],
  ) {
    let pending = sessionStore.get(runtimeSessionId)
    if (!pending) {
      pending = Promise.resolve(createRuntimeSession(runtimeSessionId, history))
      sessionStore.set(runtimeSessionId, pending)
    }
    return pending
  }

  async function runTurn({
    runtimeSessionId,
    prompt,
    mode,
    message,
    history,
    signal,
    onUpdate,
  }: AgentRuntimeTurn) {
    const runtime = await getRuntimeSession(runtimeSessionId, history)
    if (signal.aborted)
      return

    const activeAgent = agentRegistry.get(runtime.activeAgentName) ?? agent
    const stream = await getRunner().run(activeAgent, prompt, {
      stream: true,
      session: runtime.session,
      signal,
    })

    let textPart: { type: 'text', text: string } | undefined

    for await (const event of stream as AsyncIterable<RunStreamEvent>) {
      if (signal.aborted)
        break

      if (event.type === 'raw_model_stream_event') {
        if (event.data.type === 'response_started') {
          textPart = undefined
        }
        else if (event.data.type === 'output_text_delta') {
          if (!textPart)
            textPart = appendPart(message, { type: 'text', text: '' })
          textPart.text += event.data.delta
          onUpdate()
        }
        continue
      }

      if (event.type === 'run_item_stream_event') {
        if (
          event.name === 'message_output_created'
          && event.item.type === 'message_output_item'
          && (!textPart || !textPart.text)
        ) {
          const content = event.item.content
          if (content) {
            textPart = appendPart(message, { type: 'text', text: content })
            onUpdate()
          }
          continue
        }
        handleRunItemEvent(event, message, mode, onUpdate)
        continue
      }

      runtime.activeAgentName = event.agent.name
      saveActiveAgent(runtimeSessionId, runtime.activeAgentName)
      if (mode === 'data') {
        appendPart(message, {
          type: 'data',
          name: 'active_agent',
          data: { name: event.agent.name },
        })
        onUpdate()
      }
    }

    await stream.completed
    runtime.activeAgentName = stream.currentAgent?.name ?? runtime.activeAgentName
    saveActiveAgent(runtimeSessionId, runtime.activeAgentName)
  }

  return {
    config,
    runTurn,
  }
}
