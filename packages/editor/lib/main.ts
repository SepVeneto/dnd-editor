import { defineCustomElement } from 'vue'
import Main from './Editor.vue'

export const Editor = defineCustomElement(Main)
export type EditorInstance = InstanceType<typeof Main>

// export const Editor = createElementInstance()

export function register() {
  if (customElements.get('mpd-editor'))
    return
  customElements.define('mpd-editor', Editor)
}
