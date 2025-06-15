<template>
  <div class="mpd-node mpd-relative">
    <div
      class="node-wrap"
      :class="[isActive && 'selected', isDraggable && 'draggable', isHover && 'hover']"
      :data-name="node.name"
      @mouseenter.stop="editor.hovering = node.wid"
      @mouseleave.stop="editor.hovering = undefined"
      @click.stop="editor.selected = node.wid"
    >
      <NodeContainer
        v-if="node.type === 'containerGrid'"
        :node="node"
      />
      <slot v-else>
        <div>拖曳组件</div>
      </slot>
    </div>
    <NodeOperate
      v-if="isActive"
      :node="node"
    />
  </div>
</template>

<script lang="ts" setup>
import type { Node } from '@sepveneto/dnde-core/class'
import { computed } from 'vue'
import { useEditor } from '@/store'
import NodeContainer from './NodeContainer.vue'
import NodeOperate from './NodeOperate.vue'

const props = defineProps<{ node: Node }>()

const editor = useEditor()
const isActive = computed(() => props.node.wid === editor.selected)
const isHover = computed(() => {
  if (isActive.value)
    return false

  return props.node.wid === editor.hovering
})
const isDraggable = computed(() => props.node.widget?.draggable)
</script>

<style lang="scss" scoped>
.node-wrap {
  position: relative;
  cursor: default;
  &.draggable {
    cursor: grab;
    &:active {
      cursor: grabbing;
    }
  }
  &.selected::after {
    border: 1px solid #4089Ef;
  }
  &.hover::after {
    border: 1px dashed #4089Ef;
  }
  &.hover::before {
    content: attr(data-name);
    position: absolute;
    top: 0;
    // transform: translateY(100%);
    font-size: 14px;
    z-index: 1;
    color: #fff;
    background: #4089Ef;
    padding: 4px;
  }
  &::after {
    content: '';
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    pointer-events: none;
  }
  // &.mask::after {
  //   pointer-events: auto;
  // }
}
</style>
