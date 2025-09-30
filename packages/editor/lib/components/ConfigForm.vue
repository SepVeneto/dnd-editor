<template>
  <ElForm
    ref="formRef"
    :model="form"
    label-width="80px"
  >
    <ElFormItem
      v-for="item in list"
      :key="item.key"
      :label="item.label"
      :prop="item.key"
      :rules="item.rules"
      :label-width="item.label ? '' : '0px'"
    >
      <ConfigRender
        :model-value="getData(form, item.key)"
        stylesheet
        :config="form"
        @update:model-value="updateData(item.key, $event)"
      />
    </ElFormItem>
  </ElForm>
</template>

<script lang="ts" setup>
import type { SchemaItem } from '@sepveneto/dnde-core/class'
import { ref, useTemplateRef, watch } from 'vue'
import ConfigRender from './ConfigRender.vue'

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

function updateData(key: string, val: unknown) {
  const path = key.split('.')
  const _path = path.slice(0, -1)
  const parent = (path.length === 1
    ? form.value
    : _path.reduce((obj, curr) => {
        if (!obj) {
          obj = {}
        }
        return obj[curr]
      }, form.value)) || {}
  parent[path.slice(-1)[0]] = val
  emit('update:modelValue', form.value)
}
function getData(data: Record<string, any> | undefined, key: string): any {
  if (!data)
    return null

  const path = key.split('.')

  if (path.length === 1) {
    return data[key]
  }
  // 自动补全数据结构
  const res = path.reduce((obj, curr, index) => {
    if (!obj[curr] && index !== path.length - 1) {
      obj[curr] = {}
    }
    return obj[curr] == null ? '' : obj[curr]
  }, data)
  return res || null
}
</script>
