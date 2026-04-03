<template>
  <div class="mpd-flex">
    <ElSelect
      v-model="type"
      :append-to="appendTo"
      class="mpd-w-24 mpd-shrink-0"
      @change="onChange"
    >
      <ElOption
        label="自适应"
        value="auto"
      />
      <ElOption
        label="自定义"
        value="manual"
      />
    </ElSelect>
    <ElInputNumber
      v-if="type === 'manual'"
      v-model="value"
      class="mpd-flex-1"
      controls-position="right"
    />
    <ElInput
      v-else-if="type === 'auto'"
      class="mpd-flex-1"
      model-value="100%"
      disabled
    />
  </div>
</template>

<script setup lang="ts">
import { computed, customRef, inject, ref } from 'vue'
import { EditorKey } from '@/utils'

const props = defineProps<{ modelValue: string | number | undefined }>()
const emit = defineEmits(['update:modelValue'])
const ctx = inject(EditorKey)

const appendTo = computed(() => ctx!.root.value!)

const type = ref(typeof props.modelValue === 'string' ? 'auto' : 'manual')

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
      if (typeof val === 'string') {
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

if (type.value === 'manual') {
  value.value = Number(props.modelValue)
}

function onChange(type: 'auto' | 'manual') {
  if (type === 'auto') {
    value.value = '100%'
  }
  else {
    value.value = 0
  }
}
</script>
