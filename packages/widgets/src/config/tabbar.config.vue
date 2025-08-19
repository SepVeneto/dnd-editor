<template>
  <div>{{ model }}</div>
</template>

<script setup lang="ts">
const model = defineModel('modelValue', {
  type: Object,
  default: () => ({
    list: [],
  }),
})
</script>
