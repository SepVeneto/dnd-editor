import type {
  MaybeRefOrGetter,
  Ref,
} from 'vue'
import type {
  AgentConversationClientOptions,
  AgentConversationSummary,
} from '../conversationStorage'
import type { ChatMessage, ChatMode } from '../types'
import { ref, toValue, watch } from 'vue'
import { saveAgentConversation } from '../conversationStorage.ts'

interface UseConversationPersistenceOptions {
  messages: Ref<ChatMessage[]>
  enabled: MaybeRefOrGetter<boolean>
  clientOptions: MaybeRefOrGetter<AgentConversationClientOptions>
  sessionId: MaybeRefOrGetter<string>
  mode: MaybeRefOrGetter<ChatMode>
  delay?: number
  onSaved?: (conversation: AgentConversationSummary) => void
}

function cloneMessages(messages: ChatMessage[]) {
  // Vue exposes ref values as reactive proxies; JSON also strips non-protocol
  // metadata from message parts before they are sent to the BFF.
  return JSON.parse(JSON.stringify(messages)) as ChatMessage[]
}

export function useConversationPersistence(
  options: UseConversationPersistenceOptions,
) {
  const saving = ref(false)
  const error = ref('')
  let timer: ReturnType<typeof setTimeout> | undefined
  let queue = Promise.resolve()
  let pending = 0

  function flush() {
    if (!toValue(options.enabled) || options.messages.value.length === 0)
      return Promise.resolve()

    const snapshot = cloneMessages(options.messages.value)
    const sessionId = toValue(options.sessionId)
    const mode = toValue(options.mode)
    const clientOptions = toValue(options.clientOptions)
    pending += 1
    saving.value = true
    error.value = ''

    const task = queue.then(async () => {
      const conversation = await saveAgentConversation(
        clientOptions,
        {
          id: sessionId,
          mode,
          messages: snapshot,
        },
      )
      options.onSaved?.(conversation)
    })

    queue = task.catch((saveError) => {
      error.value = saveError instanceof Error
        ? saveError.message
        : '会话历史保存失败'
    })

    const finish = () => {
      pending = Math.max(0, pending - 1)
      saving.value = pending > 0
    }
    return task.then(finish, finish)
  }

  function schedule() {
    if (!toValue(options.enabled) || options.messages.value.length === 0)
      return
    clearTimeout(timer)
    timer = setTimeout(() => {
      void flush()
    }, options.delay ?? 500)
  }

  function dispose() {
    if (timer)
      clearTimeout(timer)
    return flush()
  }

  watch(options.messages, schedule, { deep: true })
  watch(() => toValue(options.enabled), (enabled) => {
    if (enabled)
      schedule()
  })

  return {
    dispose,
    error,
    flush,
    saving,
    schedule,
  }
}
