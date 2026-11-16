import type { PropType } from 'vue'
import type { LikeWidget } from './store'

export const editorProps = {
  name: {
    type: String,
    default: 'widgets',
  },
  widgets: {
    type: Array as PropType<LikeWidget[]>,
    default: () => ([]),
  },
  extra: {
    type: Object as PropType<Record<string, any>>,
    default: () => ({}),
  },
  agent: Boolean,
  agentApi: {
    type: Object as PropType<Record<string, any>>,
    default: () => ({}),
  },
  agentSubAgents: {
    type: Array as PropType<any[]>,
    default: () => ([]),
  },
  agentHistoryEnabled: {
    type: Boolean,
    default: true,
  },
  agentHistoryUserId: {
    type: String,
    default: 'anonymous',
  },
} as const
