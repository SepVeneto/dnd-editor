<template>
  <testComp />
  <!-- <component
    :is="compView"
    v-bind="$attrs"
  /> -->
</template>

<script lang="ts" setup>
import { defineAsyncComponent, getCurrentInstance, shallowRef, watch } from 'vue'
import aC from '@/icons/column.vue'

// const props = defineProps({
//   scope: {
//     type: String,
//     required: true,
//   },
//   type: {
//     type: String,
//     required: true,
//   },
// })

console.log(getCurrentInstance())

const testComp = defineAsyncComponent(async () => {
  const mod = await import('@/icons/column.vue')
  console.log(mod.default === aC)
  debugger
  return mod.default
})

// const compView = shallowRef()
// watch([() => props.type, () => props.scope], ([type, scope]) => {
//   if (!type || !scope)
//     return
//   compView.value = defineAsyncComponent(() => import(`@/${scope}/${type}.vue`))
//   console.log('?', compView.value, testComp)
// }, { immediate: true })
</script>
