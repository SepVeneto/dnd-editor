<template>
  <component
    :is="compView"
    v-bind="$attrs"
  />
</template>

<script lang="ts" setup>
import { defineAsyncComponent, shallowRef, watch } from 'vue'

const props = defineProps({
  scope: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
})
const compView = shallowRef()
watch([() => props.type, () => props.scope], ([type, scope]) => {
  if (!type || !scope)
    return
  compView.value = defineAsyncComponent(() => import(`@/${scope}/${type}.vue`))
}, { immediate: true })
</script>
