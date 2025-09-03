<template>
  <Vuedraggable
    :model-value="editor.rootNode.list"
    :group="{ name: 'editor', pull: true, put: true }"
    class="tree-panel-container"
    :component-data="{ type: 'transition-group', name: 'flip-list' }"
    :animation="200"
    ghost-class="dragging-ghost"
    handle=".node-wrap.draggable"
    item-key="wid"
    @add="onAdd"
    @end="editor.dragging = null"
    @update:model-value="onInput"
  >
    <template #item="{ element }">
      <TreePanelItem :node="element" />
    </template>
  </Vuedraggable>
</template>

<script lang="ts" setup>
import type { Node } from '@sepveneto/dnde-core/class'
import type { DraggableEvt } from '@/type'
import { nextTick } from 'vue'
import Vuedraggable from 'vuedraggable'
import { useEditor } from '@/store'
import TreePanelItem from './treePanel.item.vue'

const editor = useEditor()
function onAdd(evt: DraggableEvt) {
  const node = editor.rootNode.list[evt.newDraggableIndex]
  node && editor.addNode(node)
}
function onInput(val: Node[]) {
  if (editor.rootNode.list.length >= val.length) {
    editor.rootNode.list = val
  }
  else {
    const wid = findExistWid(val)
    const originIndex = editor.rootNode.list.findIndex(node => node.wid === wid)
    if (originIndex === -1) {
      (editor.rootNode as Node).list = val
      return
    }
    // 只处理同级同节点跨组件移动节点消失的情况
    // 需要比较在移动后数组中，相较原数组中的位置
    // 如果是向上移动，那originIndex就不是被复制元素的位置
    // 可以被删除的前提一定是该元素的wid与其原始位置的元素一样
    // 否则就向下找，即下标加1
    if (wid === val[originIndex].wid) {
      val.splice(originIndex, 1)
    }
    else {
      val.splice(originIndex + 1, 1)
    }
    nextTick().then(() => {
      (editor.rootNode as Node).list = val
    })
  }
}

function findExistWid(list: Node[]) {
  const wids: string[] = []
  for (const item of list) {
    const exist = wids.includes(item.wid)
    if (exist) {
      return item.wid
    }
    else {
      wids.push(item.wid)
    }
  }
}
</script>

<style scoped>
.tree-panel-container {
  min-width: 375px;
  min-height: calc(667px - 60px);
  background: linear-gradient(135deg, #f5f7fa 0%, #e4edf5 100%);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.tree-panel-container:hover {
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
  transition: all 0.3s ease;
}

.tree-panel-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 12px;
  padding: 1px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: destination-out;
  mask-composite: exclude;
}

/* 拖拽列表动画 */
.flip-list-move {
  transition: transform 0.3s ease;
}

.flip-list-enter-active,
.flip-list-leave-active {
  transition: all 0.3s ease;
}

.flip-list-enter-from,
.flip-list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

/* 拖拽时的幽灵元素样式 */
.dragging-ghost {
  opacity: 0.6;
  background: #f0f4f8;
  border: 2px dashed #a0aec0;
  border-radius: 8px;
  transform: scale(0.98);
}
</style>
