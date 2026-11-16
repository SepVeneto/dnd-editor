import type { MaybeRefOrGetter } from 'vue'
import type {
  AgentConversation,
  AgentConversationClientOptions,
  AgentConversationSummary,
} from '../conversationStorage'
import type { ChatMessage } from '../types'
import { computed, ref, toValue } from 'vue'
import {
  getAgentConversation,
  listAgentConversations,
} from '../conversationStorage.ts'

export interface UseConversationHistoryOptions {
  enabled: MaybeRefOrGetter<boolean>
  clientOptions: MaybeRefOrGetter<AgentConversationClientOptions>
  preferredSessionId: MaybeRefOrGetter<string>
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function useConversationHistory(
  options: UseConversationHistoryOptions,
) {
  const initialSessionId = toValue(options.preferredSessionId).trim()
  const enabled = computed(() => Boolean(toValue(options.enabled)))
  const sessionId = ref(initialSessionId || crypto.randomUUID())
  const messages = ref<ChatMessage[]>([])
  const conversations = ref<AgentConversationSummary[]>([])
  const ready = ref(false)
  const loading = ref(false)
  const listLoading = ref(false)
  const open = ref(false)
  const error = ref('')
  const revision = ref(0)

  function upsertConversation(conversation: AgentConversationSummary) {
    const next = conversations.value.filter(
      item => item.id !== conversation.id,
    )
    conversations.value = [conversation, ...next]
      .sort((left, right) => (
        new Date(right.updatedAt).getTime()
          - new Date(left.updatedAt).getTime()
      ))
  }

  function selectConversation(conversation: AgentConversation) {
    sessionId.value = conversation.id
    messages.value = conversation.messages
    revision.value += 1
    upsertConversation(conversation)
  }

  async function loadList() {
    if (!enabled.value)
      return

    listLoading.value = true
    error.value = ''
    try {
      conversations.value = await listAgentConversations(
        toValue(options.clientOptions),
      )
    }
    catch (loadError) {
      error.value = errorMessage(loadError, '历史会话加载失败')
    }
    finally {
      listLoading.value = false
    }
  }

  async function loadConversation(id: string) {
    try {
      return await getAgentConversation(
        toValue(options.clientOptions),
        id,
      )
    }
    catch {
      return undefined
    }
  }

  async function initialize() {
    if (ready.value || loading.value)
      return

    loading.value = true
    error.value = ''
    try {
      if (!enabled.value) {
        ready.value = true
        return
      }

      const preferredId = toValue(options.preferredSessionId).trim()
      const conversation = preferredId
        ? await loadConversation(preferredId)
        : undefined
      if (conversation)
        selectConversation(conversation)
    }
    catch (loadError) {
      error.value = errorMessage(loadError, '历史会话加载失败')
    }
    finally {
      loading.value = false
      ready.value = true
    }
  }

  async function toggle() {
    if (open.value) {
      open.value = false
      return
    }
    open.value = true
    await loadList()
  }

  async function switchTo(id: string) {
    open.value = false
    if (id === sessionId.value)
      return true

    loading.value = true
    error.value = ''
    try {
      const conversation = await getAgentConversation(
        toValue(options.clientOptions),
        id,
      )
      selectConversation(conversation)
      return true
    }
    catch (loadError) {
      error.value = errorMessage(loadError, '会话加载失败')
      open.value = true
      return false
    }
    finally {
      loading.value = false
    }
  }

  function startNewSession(id = crypto.randomUUID()) {
    sessionId.value = id
    messages.value = []
    revision.value += 1
    open.value = false
    error.value = ''
    ready.value = true
    return id
  }

  function usePreferredSession(id: string) {
    sessionId.value = id
    messages.value = []
    ready.value = false
    error.value = ''
  }

  return {
    acceptSaved: upsertConversation,
    conversations,
    enabled,
    error,
    initialize,
    listLoading,
    loading,
    messages,
    open,
    ready,
    revision,
    sessionId,
    startNewSession,
    switchTo,
    toggle,
    usePreferredSession,
  }
}
