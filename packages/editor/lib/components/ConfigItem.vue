<template>
  <ElFormItem
    :label="config.label"
    :prop="config.key"
    :rules="config.rules"
    v-bind="config.formItem"
  >
    <ConfigRender
      :model-value="getSchemaValue(form, config.key) ?? null"
      :config="config"
      :data="form"
      @update:model-value="updateData(config.key, $event)"
    />
  </ElFormItem>

  <ConfigItem
    v-for="item in linkItems"
    :key="item.key"
    :config="item"
    :form="form"
    @change="emit('change')"
  />
</template>

<script lang="ts" setup>
import type { SchemaItem } from '@sepveneto/dnde-core/class'
import { ElFormItem } from 'element-plus'
import { computed } from 'vue'
import { getLinkedSchemaItems, getSchemaValue, setSchemaValue } from '@/schemaPath'
import ConfigRender from './ConfigRender.vue'

const props = defineProps<{
  config: SchemaItem
  form: Record<string, any>
}>()
const emit = defineEmits(['change'])

const linkItems = computed(() => getLinkedSchemaItems(props.config, props.form))

function updateData(key: string, val: unknown) {
  setSchemaValue(props.form, key, val)
  emit('change')
}
</script>
