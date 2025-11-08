<template>
  <ElInput v-model="model" />
</template>

<script lang="ts" setup>
const model = defineModel<string>()
</script>
