<template>
  <div
    class="node-wrap"
    :class="[isActive && 'selected']"
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
</template>

<script lang="ts" setup>
import type { Node } from '@/class'
import { computed } from 'vue'
import { useEditor } from '@/store'
import NodeContainer from './NodeContainer.vue'

const props = defineProps<{ node: Node }>()

const editor = useEditor()
const isActive = computed(() => props.node.wid === editor.selected)
</script>

<style lang="scss" scoped>
.selected {
  outline: 1px solid #4089Ef;
}
.node-wrap {
  &:hover {
    outline: 1px dashed #4089Ef;
  }
}
</style>
