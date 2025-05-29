<template>
  <div
    :class="[isActive && 'selected']"
    @click="editor.selected = node.wid"
  >
    <slot />
  </div>
</template>

<script lang="ts" setup>
import type { Node } from '@/class'
import { computed } from 'vue'
import { useEditor } from '@/store'

const props = defineProps<{ node: Node }>()

const editor = useEditor()
const isActive = computed(() => props.node.wid === editor.selected)
</script>

<style lang="scss" scoped>
.selected {
  border: 1px solid #4089Ef;
}
</style>
