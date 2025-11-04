import type { PropType } from 'vue'
import type { LikeWidget } from './store'

export const editorProps = {
  remoteUrl: {
    type: String,
    required: true,
  },
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
} as const
