<template>
  <div class="dialog1-view">
    <span class="dialog1-view__title">{{ config.title || '弹窗' }}</span>
    <span
      v-if="config.enable"
      class="dialog1-view__badge"
    >
      启用
    </span>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  config?: Record<string, any>
  data?: Record<string, any>
}>()
</script>

<style lang="scss" scoped>
.dialog1-view {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #4089ef;
  color: #4089ef;
  font-size: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  user-select: none;
}
.dialog1-view__badge {
  color: #fff;
  background: #4089ef;
  border-radius: 4px;
  padding: 0 4px;
  font-size: 10px;
}
</style>
