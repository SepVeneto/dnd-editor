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
  const prevNode = editor.rootNode.list[evt.newIndex - 1]
  const nextNode = editor.rootNode.list[evt.newIndex + 1]
  if (nextNode && nextNode.widget.isFixed === 'header') {
    const deletedNode = editor.rootNode.list.splice(evt.newIndex, 1)[0]

    // 跨容器移动触发fixed时需要手动还原到旧容器中
    if (evt.to !== evt.from) {
      const oldContainer = editor.nodeMap.get(evt.from.dataset.id!)!
      // 如果没有父容器说明是从组件栏中拖动的，就不需要还原了
      if (!oldContainer) {
        return
      }
      ;(oldContainer.list as Node[]).splice(evt.oldIndex, 0, deletedNode)
    }

    return
  }

  if (prevNode && prevNode.widget.isFixed === 'footer') {
    const deletedNode = editor.rootNode.list.splice(evt.newIndex, 1)[0]

    // 跨容器移动触发fixed时需要手动还原到旧容器中
    if (evt.to !== evt.from) {
      const oldContainer = editor.nodeMap.get(evt.from.dataset.id!)!
      // 如果没有父容器说明是从组件栏中拖动的，就不需要还原了
      if (!oldContainer) {
        return
      }
      ;(oldContainer.list as Node[]).splice(evt.oldIndex, 0, deletedNode)
    }

    return
  }
  const node = editor.rootNode.list[evt.newDraggableIndex]
  node && editor.addNode(node)
}
function onInput(val: Node[]) {
  // 新增的可以忽略
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
      // 旧元素在上方
      // 下移检查
      const newIndex = val.findLastIndex(node => node.wid === wid)
      const prevIndex = newIndex - 1
      const nextIndex = newIndex + 1

      // 先检查是否满足Fixed的条件
      const prevNode = val[prevIndex]
      const nextNode = val[nextIndex]
      if ((prevNode && prevNode.widget.isFixed === 'footer')
        || (nextNode && nextNode.widget.isFixed === 'header')
      ) {
        // pass
      }
      else {
        val.splice(originIndex, 1)
      }
    }
    else {
      // 旧元素在下方
      // 上移检查
      const newIndex = val.findIndex(node => node.wid === wid)
      const prevIndex = newIndex - 1
      const nextIndex = newIndex + 1

      // 先检查是否满足Fixed的条件
      const prevNode = val[prevIndex]
      const nextNode = val[nextIndex]
      if ((prevNode && prevNode.widget.isFixed === 'footer')
        || (nextNode && nextNode.widget.isFixed === 'header')
      ) {
        // pass
      }
      else {
        val.splice(originIndex + 1, 1)
      }
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
  min-height: 500px;
  box-sizing: border-box;
}

.tree-panel-container:hover {
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
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
  opacity: 0.7;
  background-color: #f5f7fa;
  border: 1px dashed #409eff;
  border-radius: 4px;
  transform: scale(0.98);
}
</style>
