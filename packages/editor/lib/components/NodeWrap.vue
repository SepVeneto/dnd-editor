<template>
  <div>
    <div
      class="node-wrap"
      :class="[isActive && 'selected']"
      :data-name="node.name"
      @click.stop="editor.selected = node.wid"
    >
      <NodeContainer
        v-if="node.type === 'container'"
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
import type { Node } from '@/class'
import { computed } from 'vue'
import { useEditor } from '@/store'
import NodeContainer from './NodeContainer.vue'
import NodeOperate from './NodeOperate.vue'

const props = defineProps<{ node: Node }>()

const editor = useEditor()
const isActive = computed(() => props.node.wid === editor.selected)
</script>

<style lang="scss" scoped>
.node-wrap {
  position: relative;
  &.selected::after {
    border: 1px solid #4089Ef;
  }
  &:not(.selected):hover::after {
    border: 1px dashed #4089Ef;
  }
  &:not(.selected):hover::before {
    content: attr(data-name);
    position: absolute;
    top: 0;
    transform: translateY(-100%);
    font-size: 14px;
    color: #4089Ef;
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
