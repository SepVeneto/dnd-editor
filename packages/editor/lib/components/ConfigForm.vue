<template>
  <ElForm
    ref="formRef"
    :model="form"
    label-width="80px"
  >
    <ConfigItem
      v-for="item in list"
      :key="item.key"
      :form="form"
      :config="item"
      @change="onChange"
    />
  </ElForm>
</template>

<script lang="ts" setup>
import type { SchemaItem } from '@sepveneto/dnde-core/class'
import { ref, useTemplateRef, watch } from 'vue'
import ConfigItem from './ConfigItem.vue'

const props = defineProps<{ list: SchemaItem[], modelValue: Record<string, any> | undefined }>()
const emit = defineEmits(['update:modelValue'])

const refForm = useTemplateRef('formRef')
defineExpose({
  validate: () => refForm.value?.validate(),
  clearValidate: () => refForm.value?.clearValidate(),
})

const form = ref<Record<string, any>>({})
watch(() => props.modelValue, () => {
  form.value = props.modelValue || {}
}, { immediate: true })

function onChange() {
  emit('update:modelValue', form.value)
}
</script>
