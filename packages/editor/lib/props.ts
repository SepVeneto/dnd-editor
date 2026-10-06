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
  capabilities: {
    type: Array as PropType<any[]>,
    default: () => ([]),
  },
  workflows: {
    type: Array as PropType<any[]>,
    default: () => ([]),
  },
} as const
