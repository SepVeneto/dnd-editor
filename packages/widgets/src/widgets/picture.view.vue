<template>
  <div>{{ config.data }}</div>
</template>

<script lang="ts" setup>
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
</script>
