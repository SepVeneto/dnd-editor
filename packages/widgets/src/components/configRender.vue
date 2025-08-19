<template>
  <component
    :is="configView"
    v-bind="$attrs"
  />
</template>

<script lang="ts">
import { defineAsyncComponent, defineComponent, shallowRef, watch } from 'vue'
export default defineComponent({
  props: {
    type: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const configView = shallowRef()

    watch(() => props.type, (type) => {
      configView.value = defineAsyncComponent(
        () => import(`@/config/${type}.config.vue`),
      )
    }, { immediate: true })
    return {
      configView,
    }
  },
})
</script>
