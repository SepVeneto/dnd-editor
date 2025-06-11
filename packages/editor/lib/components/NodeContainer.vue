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
    @update:model-value="list => node.setList(list)"
    @add="onAdd"
  >
    <template #item="{ element }">
      <NodeWrap
        :node="element"
      >
        <ViewRender :type="element.type" />
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

function onAdd(evt: DraggableEvt) {
  const node = props.node.list[evt.newDraggableIndex]
  editor.addNode(node, props.node)
}
</script>

<style scoped lang="scss">
.node-container {
  width: 375px;
  min-height: calc(667px - 60px);
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
