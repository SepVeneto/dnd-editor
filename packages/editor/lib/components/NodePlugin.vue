<script lang="ts">
import type { HelperAction } from '@/type'
import {
  CopyDocument as IconCopy,
  Delete as IconDelete,
} from '@element-plus/icons-vue'
import { editorContextKey } from '@sepveneto/dnde-core'
import { ElIcon } from 'element-plus'
import { defineComponent, getCurrentInstance, h, inject } from 'vue'
import { useEditor } from '@/store'
import { createPopper, loadFromRemote } from '@/utils'

export default defineComponent({
  setup() {
    const ctx = inject(editorContextKey)!
    const editor = useEditor()
    const inst = getCurrentInstance()!
    const parent: HTMLElement = editor.shadowRoot!.querySelector('.mpd-editor')!

    const actionIcon = (action: HelperAction['name']) => {
      switch (action) {
        case 'copy':
          return h(ElIcon, () => h(IconCopy))
        case 'delete':
          return h(ElIcon, () => h(IconDelete))
        default: {
          const render = loadFromRemote('widgets', 'remote')
          return h(render, { scope: 'helper', type: action })
        }
      }
    }

    const actionWrap = (action: HelperAction) => h(
      'div',
      {
        class: 'node-helper',
        onClick() {
          const node = editor.selectedNode
          if (!node)
            return
          action.action?.(node)
        },
        onMouseenter(evt: Event) {
          const target = evt.target as HTMLElement
          createPopper(inst.appContext, target, action.title, parent)
        },
      },
      h(actionIcon(action.name)),
    )

    return {
      editor,
      ctx,
      actionWrap,
    }
  },
  render() {
    return h('div', this.editor.selectedNodeOperates.map((item) => {
      return this.actionWrap(item)
    }))
    // return this.editor.plugins.map(item => createVNode(item.init()))
  },
})
</script>

<style lang="scss" scoped>
.node-helper {
  cursor: pointer;
}
</style>
