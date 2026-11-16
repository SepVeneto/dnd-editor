import type { ChatMessage, ChatMode } from './types'

export interface AgentHistoryStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function getLocalStorage(): AgentHistoryStorage | undefined {
  try {
    return globalThis.localStorage
  }
  catch {
    return undefined
  }
}

function messageKey(
  storageNamespace: string,
  mode: ChatMode,
  sessionId: string,
) {
  return `${storageNamespace}:${mode}:${sessionId}`
}

export function readStoredHistory(
  storageNamespace: string,
  mode: ChatMode,
  sessionId: string,
  storage = getLocalStorage(),
): ChatMessage[] {
  try {
    const stored = storage?.getItem(messageKey(storageNamespace, mode, sessionId))
    if (!stored)
      return []

    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed as ChatMessage[] : []
  }
  catch {
    return []
  }
}

export function writeStoredHistory(
  storageNamespace: string,
  mode: ChatMode,
  sessionId: string,
  messages: ChatMessage[],
  storage = getLocalStorage(),
) {
  try {
    storage?.setItem(
      messageKey(storageNamespace, mode, sessionId),
      JSON.stringify(messages),
    )
  }
  catch {
    // The chat remains usable when storage is unavailable.
  }
}
