<template>
  <input
    type="file"
    @change="onChange"
  >
</template>

<script lang="ts" setup>
const emit = defineEmits(['update:modelValue'])
function onChange(evt: Event) {
  const url = URL.createObjectURL((evt.target as HTMLInputElement).files![0])
  emit('update:modelValue', url)
}
</script>
