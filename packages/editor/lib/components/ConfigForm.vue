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
    >
      <ConfigRender
        v-model="form[item.key]"
        stylesheet
        :config="item"
      />
    </ElFormItem>
  </ElForm>
</template>

<script lang="ts" setup>
import type { SchemaItem } from '@sepveneto/dnde-core/class'
import { useTemplateRef } from 'vue'
import ConfigRender from './ConfigRender.vue'

defineProps<{ list: SchemaItem[] }>()
const form = defineModel<Record<string, any>>({ required: true })

const refForm = useTemplateRef('formRef')
defineExpose({
  validate: () => refForm.value?.validate(),
  clearValidate: () => refForm.value?.clearValidate(),
})
</script>
