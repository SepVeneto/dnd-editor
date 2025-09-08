import type { EditorRoute, EditorSchema, EditorSettings } from '@sepveneto/dnde-core'
import type { PropType } from 'vue'
import type { LikeWidget } from './store'

export const editorProps = {
  remoteUrl: {
    type: String,
    required: true,
  },
  root: {
    type: Object as PropType<EditorSchema>,
    default: () => ({}),
  },
  widgets: {
    type: Array as PropType<LikeWidget[]>,
    default: () => ([]),
  },
  routes: {
    type: Array as PropType<EditorRoute[]>,
    default: () => ([{ name: 'Home', path: '/' }]),
  },
  settings: {
    type: Object as PropType<EditorSettings>,
    default: () => ({}),
  },
  extra: {
    type: Object as PropType<Record<string, any>>,
    default: () => ({}),
  },
} as const
