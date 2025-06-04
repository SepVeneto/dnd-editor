import type { Node } from '@sepveneto/dnde-core/class'
import type { HelperAction } from '@/type'
import {
  CopyDocument as IconCopy,
  Delete as IconDelete,
} from '@element-plus/icons-vue'
import { EditorContext } from '@sepveneto/dnde-core'
import { ElIcon } from 'element-plus'
import { defineComponent, getCurrentInstance, h, inject } from 'vue'
import { useEditor } from '@/store'
import { createPopper, loadFromRemote } from '@/utils'

export default defineComponent({
  components: {
    IconDelete,
  },
  setup() {
    const ctx = inject(EditorContext)!
    const editor = useEditor()
    const inst = getCurrentInstance()!
    const parent: HTMLElement = editor.shadowRoot!.querySelector('.mpd-editor')!

    const actionIcon = (action: HelperAction['name']) => {
      switch (action) {
        case 'copy':
          return h(ElIcon, () => h(IconCopy))
        case 'delete':
          return h(ElIcon, () => h(IconDelete))
        default:
          return h(loadFromRemote('widgets', 'helperRender'))
      }
    }

    const actionWrap = (action: HelperAction) => (h(actionIcon(action.name), {
      onClick() {
        const node = editor.selectedNode
        if (!node)
          return
        // if (typeof action === 'object') {
        action.action?.(node)
        // return
        // }
        // switch (action) {
        //   case 'copy':
        //     editor.addNode(node.copy(), node.parent, true)
        //     break
        //   case 'delete':
        //     editor.delNode(node.wid)
        //     break
        // }
      },
      onMouseenter(evt: Event) {
        const target = evt.target as HTMLElement
        createPopper(inst.appContext, target, action.title, parent)
      },
    }))

    const plugins = [{
      name: 'copy',
      title: '复制',
      action: (node: Node) => {
        editor.addNode(node.copy(), node.parent, true)
      },
    }, {
      name: 'delete',
      title: '删除',
      action: (node: Node) => {
        editor.delNode(node.wid)
      },
    }]

    return {
      editor,
      ctx,
      plugins,
      actionWrap,
    }
  },
  render() {
    return h('div', this.editor.plugins.helper.map((item) => {
      return this.actionWrap(item)
    }))
    // return this.editor.plugins.map(item => createVNode(item.init()))
  },
})
