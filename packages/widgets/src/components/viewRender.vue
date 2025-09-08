<template>
  <component
    :is="compView"
    v-bind="$attrs"
  />
</template>

<script lang="ts" setup>
import { defineAsyncComponent, shallowRef, watch } from 'vue'

const props = defineProps({
  type: {
    type: String,
    required: true,
  },
})
const compView = shallowRef()
watch(() => props.type, (val) => {
  if (!val)
    return
  compView.value = defineAsyncComponent(() => import(`@/widgets/${val}.view.vue`))
}, { immediate: true })
</script>
