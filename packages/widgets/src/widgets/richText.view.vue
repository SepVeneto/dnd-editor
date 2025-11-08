<template>
  <view>{{ config.data }}</view>
</template>

<script lang="ts" setup>
const props = defineProps({
  config: {
    type: Object,
    default: () => ({}),
  },
})
console.log(props.config)
</script>
