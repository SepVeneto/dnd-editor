<template>
  <div
    class="dialog-view"
    :title="config.title"
  >
    <span class="dialog-view__text">{{ config.title || '浮窗' }}</span>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  config?: Record<string, any>
  data?: Record<string, any>
}>()
</script>

<style lang="scss" scoped>
.dialog-view {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #4089ef;
  color: #fff;
  font-size: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  user-select: none;
}
.dialog-view__text {
  padding: 0 4px;
  text-align: center;
  line-height: 1.2;
}
</style>
