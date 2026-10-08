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
    @add="drag.onAdd"
    @end="editor.dragging = null"
    @update:model-value="drag.onInput"
  >
    <template #item="{ element }">
      <TreePanelItem :node="element" />
    </template>
  </Vuedraggable>
</template>

<script lang="ts" setup>
import type { Node } from '@sepveneto/dnde-core/class'
import Vuedraggable from 'vuedraggable'
import { useNodeListDrag } from '@/composables/useNodeListDrag'
import { useEditor } from '@/store'
import TreePanelItem from './treePanel.item.vue'

const editor = useEditor()
const drag = useNodeListDrag({
  get list() {
    return editor.rootNode.list
  },
  get parent() {
    return editor.rootNode as Node
  },
  setList: list => editor.rootNode.setList(list),
})
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
