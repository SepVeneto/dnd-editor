<template>
  <ElInput
    v-if="config.type === 'input'"
    v-model="model"
    v-bind="config.attrs"
  />

  <ElSelect
    v-else-if="config.type === 'select'"
    v-model="model"
    :append-to="appendTo"
    v-bind="config.attrs"
  >
    <ElOption
      v-for="(item, index) in config.options"
      :key="index"
      v-bind="item"
    />
  </ElSelect>

  <ElRadioGroup
    v-else-if="config.type === 'radio' || config.type === 'radioButton'"
    v-model="model"
    v-bind="config.attrs"
  >
    <template v-if="config.type === 'radio'">
      <ElRadio
        v-for="item in config.options"
        :key="String(item.value)"
        v-bind="item"
      />
    </template>
    <template v-else-if="config.type === 'radioButton'">
      <ElRadioButton
        v-for="item in config.options"
        :key="String(item.value)"
        v-bind="item"
      />
    </template>
  </ElRadioGroup>

  <ElInputNumber
    v-else-if="config.type === 'number'"
    v-model="model"
    controls-position="right"
    v-bind="config.attrs"
  />

  <StyleNumber
    v-else-if="config.type === 'styleNumber'"
    v-model="model"
  />

  <ElSwitch
    v-else-if="config.type === 'switch'"
    v-model="model"
    v-bind="config.attrs"
  />

  <ElDatePicker
    v-else-if="config.type === 'datetimePicker'"
    v-model="model"
    :append-to="appendTo"
    v-bind="config.attrs"
  />

  <ColorPicker
    v-else-if="config.type === 'colorPicker'"
    v-model="model"
    :append-to="appendTo"
    :show-alpha="config.attrs?.showAlpha"
  />

  <component
    :is="configRender"
    v-else-if="config.type === 'custom'"
    v-model="model"
    :config="config"
    :type="config.name"
    :data="data"
    v-bind="config.attrs"
  />

  <div v-else>
    unknown type: {{ config.type }}
  </div>
</template>

<script lang="ts" setup>
import type { SchemaItem } from '@sepveneto/dnde-core/class'
import { onMounted, shallowRef } from 'vue'
import { useEditor } from '@/store'
import { loadFromRemote } from '@/utils'
import ColorPicker from './ColorPicker.vue'
import StyleNumber from './StyleNumber.vue'

defineProps<{ data: Record<string, any>, config: SchemaItem, stylesheet: boolean }>()
const model = defineModel<any>({ required: true })

const configRender = loadFromRemote('widgets', 'configRender')

const editor = useEditor()
const appendTo = shallowRef<HTMLElement>()

onMounted(() => {
  const parent: HTMLElement = editor.shadowRoot!.querySelector('.mpd-editor')!
  appendTo.value = parent
})
</script>
