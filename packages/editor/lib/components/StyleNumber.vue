<template>
  <div>
    <ElInputNumber
      v-model="value"
      controls-position="right"
    />
  </div>
</template>

<script setup lang="ts">
import { customRef, watch } from 'vue'

const props = defineProps<{ modelValue: string | number }>()
const emit = defineEmits(['update:modelValue'])

const value = customRef<string | number>((track, trigger) => {
  let inner: number
  let outer: number | string
  return {
    get() {
      track()
      if (!inner) {
        return 0
      }
      else {
        return inner
      }
    },
    set(val) {
      if (!val || typeof val === 'string') {
        inner = 0
        outer = '100%'
      }
      else {
        inner = val
        outer = val
      }
      emit('update:modelValue', outer)
      trigger()
    },
  }
})

watch(() => props.modelValue, (val) => {
  value.value = val
}, { immediate: true })
</script>
