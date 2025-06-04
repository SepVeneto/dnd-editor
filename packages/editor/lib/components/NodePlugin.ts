import { defineComponent, h, inject } from 'vue'
import { useEditor } from '@/store'
import { EditorContext, loadFromRemote } from '@/utils'

export default defineComponent({
  setup() {
    const ctx = inject(EditorContext)!
    const editor = useEditor()

    return {
      editor,
      ctx,
    }
  },
  render() {
    return this.editor.plugins.helper.map((item) => {
      switch (item) {
        case 'copy':
          break
        case 'delete':
          break
        default:
          return h(loadFromRemote('widgets', 'helperRender'))
      }
    })
    // return this.editor.plugins.map(item => createVNode(item.init()))
  },
})
