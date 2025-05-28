import type { PropType } from 'vue'
import type { EditorRoute, EditorSchema, EditorSettings, EditorWidget } from '@sepveneto/mpd-core'

export const editorProps = {
  remoteUrl: {
    type: String,
    required: true,
  },
  schema: {
    type: Object as PropType<EditorSchema>,
    default: () => ({}),
  },
  widgets: {
    type: Array as PropType<EditorWidget[]>,
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
