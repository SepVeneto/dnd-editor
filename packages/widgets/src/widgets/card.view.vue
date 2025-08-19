<template>
  <div
    :style="style"
    class="card-view"
  >
    <el-image
      v-if="config.defaultImg"
      style="width: 100%; height: 100%;"
      :src="config.defaultImg"
    />
    <div
      v-else
      style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;"
    >
      {{ config.age }}111
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useNormalizeStyle } from '@/hooks'
const props = defineProps({
  config: {
    type: Object,
    default: () => ({}),
  },
})
const style = useNormalizeStyle(props.config.style)
</script>

<style scoped>
.card-view {
  margin: 0 auto;
}
</style>
