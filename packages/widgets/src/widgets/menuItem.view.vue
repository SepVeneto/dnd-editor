<template>
  <div
    class="menu-item-wrapper"
    :style="renderStyle"
  >
    <div>
      <img
        v-if="config.icon"
        style="width: 22px; height: 22px; margin-right: 8px"
        :src="config.icon"
      >
      <span
        v-else
        style="display: inline-block; width: 22px; height: 22px; margin-right: 8px"
      />
      <span>{{ config.title }}</span>
    </div>
    <div>
      <span class="menu-item-pointer" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { toRef } from 'vue'
import { useNormalizeStyle } from '@/hooks'

const props = defineProps({
  config: {
    type: Object,
    default: () => ({}),
  },
  style: {
    type: Object,
    default: () => ({}),
  },
})
const renderStyle = useNormalizeStyle(toRef(props, 'style'))
</script>

<style lang="scss" scoped>
.menu-item-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.menu-item-pointer {
  display: inline-block;
  border: 1px solid #222;
  width: 9px;
  height: 9px;
  border-left-color: transparent;
  border-bottom-color: transparent;
  transform: translateX(-5px) rotate(45deg);
}
</style>
