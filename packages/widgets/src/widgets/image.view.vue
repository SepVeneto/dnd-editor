<template>
  <img
    style="width: 100%; height: 100%;"
    :src="config.img"
  >
</template>

<script lang="ts" setup>
defineProps({
  config: {
    type: Object,
    required: true,
  },
})
</script>
