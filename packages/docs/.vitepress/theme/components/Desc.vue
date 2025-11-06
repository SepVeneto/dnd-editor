<template>
  <span style="display: flex; align-items: center;">
    <slot />
    <ElTooltip
      effect="dark"
      :content="desc"
      :raw-content="raw"
      trigger="click"
    >
      <ElIcon
        :size="16"
        style="margin-left: 10px; cursor: pointer;"
      >
        <IconWarning />
      </ElIcon>
    </ElTooltip>
  </span>
</template>

<script setup lang="ts">
import { Warning as IconWarning } from '@element-plus/icons-vue'

defineProps({
  desc: {
    type: String,
    required: true,
  },
  raw: {
    type: Boolean,
    default: true,
  },
})
</script>
