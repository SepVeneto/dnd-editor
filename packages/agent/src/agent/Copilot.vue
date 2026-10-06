<template>
  <div class="assistant-root">
    <section v-if="open" class="assistant-panel">
      <AssistantThread
        :capabilities="props.capabilities"
        :workflows="props.workflows"
        :context="props.context"
        @init="onInit"
        @edit="onEdit"
        @capability="onCapability"
      />
    </section>
    <button class="assistant-button" type="button" @click="open = !open">
      <span>装修助手</span>
      <span class="dot" :class="{ ok: isRunning }" />
    </button>

  </div>
</template>

<script setup lang="ts">
import AssistantThread from './AssistantThread.vue'
import { ref } from 'vue'
import type { Capability } from './capability'
import type { Workflow } from './workflow'
import type { EditIR, LayoutIR } from './ir'

const props = defineProps<{
  capabilities?: Capability<any, any>[]
  workflows?: Workflow[]
  context?: () => Record<string, unknown>
}>()

const emit = defineEmits<{
  init: [payload: { layout: LayoutIR }]
  edit: [payload: { edits: EditIR[] }]
  capability: [payload: { name: string, result: unknown }]
}>()

const open = ref(false)
const isRunning = ref(false)

function onInit(payload: { layout: LayoutIR }) {
  emit('init', payload)
}

function onEdit(payload: { edits: EditIR[] }) {
  emit('edit', payload)
}

function onCapability(payload: { name: string, result: unknown }) {
  emit('capability', payload)
}
</script>

<style lang="scss" scoped>
.assistant-root {
  position: fixed;
  top: 24px;
  bottom: 24px;
  right: 10px;
  z-index: 20;
  display: flex;
  align-items: stretch;
  gap: 12px;
  justify-content: flex-end;
}
.assistant-button {
  align-self: flex-end;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 10px 18px;
  background: #1677ff;
  color: #fff;
  border: none;
  box-shadow: 0 8px 20px rgba(22, 119, 255, 0.35);
  cursor: pointer;
  flex-shrink: 0;
}
.assistant-button .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ffccc7;
}

.assistant-button .dot.ok {
  background: #b7eb8f;
}
.assistant-panel {
  flex-shrink: 0;
  min-height: 0;
  width: 400px;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.16);
  overflow: hidden;
}
</style>
