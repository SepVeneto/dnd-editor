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
    @update:model-value="drag.onInput"
    @start="drag.onStart"
    @add="drag.onAdd"
    @end="editor.dragging = null"
  >
    <template #item="{ element }">
      <NodeWrap
        :node="element"
      >
        <RemoteRender
          scope="widgets"
          :type="`${element.type}.view`"
          :config="element.data"
          :style="element.style"
        />
      </NodeWrap>
    </template>
  </VueDraggable>
</template>

<script lang="ts" setup>
import type { Node } from '@sepveneto/dnde-core/class'
import VueDraggable from 'vuedraggable'
import { useNodeListDrag } from '@/composables/useNodeListDrag'
import { useEditor } from '@/store'
import { loadFromRemote } from '@/utils'
import NodeWrap from './NodeWrap.vue'

const props = defineProps<{ node: Node }>()

const RemoteRender = loadFromRemote('widgets', 'remote')
const editor = useEditor()
const drag = useNodeListDrag({
  get list() {
    return props.node.list
  },
  get parent() {
    return props.node
  },
  setList: list => props.node.setList(list),
})

</script>

<style scoped lang="scss">
.node-container {
  width: 100%;
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
