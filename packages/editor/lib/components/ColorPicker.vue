<template>
  <ElTooltip
    ref="popperRef"
    v-model:visible="visible"
    :append-to="appendTo"
    :gpu-acceleration="false"
    :show-arrow="false"
    :stop-popper-mouse-event="false"
    pure
    effect="light"
    trigger="click"
    width="350px"
  >
    <template #content>
      <ElColorPickerPanel
        v-model="color"
        :border="false"
        @click.stop
      >
        <template #footer>
          <div>
            <ElButton
              text
              size="small"
              @click="clear"
            >
              清除
            </ElButton>
            <ElButton
              plain
              size="small"
              @click="confirm"
            >
              确定
            </ElButton>
          </div>
        </template>
      </ElColorPickerPanel>
    </template>
    <div
      class="mpd-color-picker"
      style="width: 200px;"
    >
      <div
        class="mpd-color-picker__trigger"
      >
        <span
          class="mpd-color-picker__color"
          :class="[showAlpha && 'mpd-color-picker__alpha']"
        >
          <span
            class="mpd-color-picker__color-inner"
            :style="{
              backgroundColor: displayedColor,
            }"
          >
            <el-icon
              v-show="modelValue"
              class="mpd-color-picker__icon is-icon-arrow-down"
            >
              <IconArrowDown />
            </el-icon>
            <el-icon
              v-show="!modelValue"
              class="mpd-color-picker__empty is-icon-close"
            >
              <IconClose />
            </el-icon>
          </span>
        </span>
      </div>
    </div>
  </ElTooltip>
</template>

<script setup lang="ts">
import { ArrowDown as IconArrowDown, Close as IconClose } from '@element-plus/icons-vue'
import { computed, ref, useTemplateRef, watch, watchEffect } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: string
  showAlpha?: boolean
  showPanelColor?: boolean
  appendTo?: HTMLElement
}>(), { modelValue: '' })
const emit = defineEmits(['update:modelValue'])
const color = ref()
const visible = ref(false)

const displayedColor = computed(() => {
  if (!props.modelValue) {
    return 'transparent'
  }
  return props.modelValue
})

watchEffect(() => {
  if (!visible.value) {
    setTimeout(() => {
      color.value = props.modelValue
    }, 1000)
  }
})

watch(() => props.modelValue, (val) => {
  color.value = val
}, { immediate: true })

const refPopper = useTemplateRef('popperRef')

function confirm() {
  emit('update:modelValue', color.value)
  refPopper.value?.hide()
}
function clear() {
  emit('update:modelValue', '')
  refPopper.value?.hide()
  setTimeout(() => {
    color.value = ''
  }, 1000)
}

// function handleTrigger() {
// }
</script>
