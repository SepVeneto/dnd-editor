<template>
  <VueDraggable
    class="node-container "
    :model-value="node.list"
    :group="{ name: 'editor', pull: true, put: true }"
    style=""
    :component-data="{ type: 'transition-group', name: 'flip-list' }"
    :animation="200"
    handle=".node-wrap.draggable"
    ghost-class="dragging-ghost"
    item-key="wid"
    @update:model-value="onInput"
    @start="handleStart"
    @add="onAdd"
    @end="editor.dragging = null"
  >
    <template #item="{ element }">
      <NodeWrap
        :node="element"
      >
        <ViewRender
          :type="element.type"
          :config="element.data"
          :style="element.style"
        />
      </NodeWrap>
    </template>
  </VueDraggable>
</template>

<script lang="ts" setup>
import type { Node } from '@sepveneto/dnde-core/class'
import type { DraggableEvt } from '@/type'
import VueDraggable from 'vuedraggable'
import { useEditor } from '@/store'
import { loadFromRemote } from '@/utils'
import NodeWrap from './NodeWrap.vue'

const props = defineProps<{ node: Node }>()

const ViewRender = loadFromRemote('widgets', 'viewRender')
const editor = useEditor()

function handleStart(evt: DraggableEvt) {
  const nodeId = evt.item.dataset.id
  const draggingNode = props.node.list.find(node => node.wid === nodeId)!
  editor.dragging = draggingNode
}
function onInput(list: Node[]) {
  props.node.setList(list)
}
function onAdd(evt: DraggableEvt) {
  const list = [...props.node.list]
  const nextNode = list[evt.newIndex + 1]
  if (nextNode && nextNode.widget.isFixed) {
    const deletedNode = list.splice(0, 1)[0]

    // 跨容器移动触发fixed时需要手动还原到旧容器中
    if (evt.to !== evt.from) {
      const oldContainer = editor.nodeMap.get(evt.from.dataset.id!)!
      ;(oldContainer.list as Node[]).splice(evt.oldIndex, 0, deletedNode)
    }

    onInput(list)
    return
  }
  const node = props.node.list[evt.newDraggableIndex]
  editor.addNode(node, props.node)
}
</script>

<style scoped lang="scss">
.node-container {
  width: 375px;
  // min-height: calc(667px - 60px);
  height: 100%;
  background: #ddd;
  position: relative;
  &::before {
    content: '拖曳组件到这里';
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    color: #aaa;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
  }
}
</style>
