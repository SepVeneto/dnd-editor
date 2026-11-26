<template>
  <ElFormItem
    :label="config.label"
    :prop="config.key"
    :rules="config.rules"
    v-bind="config.formItem"
  >
    <template v-if="config.tips" #label>
      <span class="config-label">
        {{ config.label }}
        <ElTooltip :content="config.tips" placement="top">
          <ElIcon class="config-tip"><QuestionFilled /></ElIcon>
        </ElTooltip>
      </span>
    </template>
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
import { QuestionFilled } from '@element-plus/icons-vue'
import { ElFormItem, ElIcon, ElTooltip } from 'element-plus'
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

<style scoped>
.config-label {
  display: inline-flex;
  align-items: center;
}

.config-tip {
  margin-left: 4px;
  color: var(--el-text-color-secondary);
}
</style>
