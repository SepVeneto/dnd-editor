<template>
  <div class="assistant-root">
    <section v-if="open" class="assistant-panel">
      <AssistantThread />
    </section>
    <button class="assistant-button" type="button" @click="open = !open">
      <span>装修助手</span>
      <span class="dot" :class="{ ok: isRunning }" />
    </button>

  </div>
</template>

<script setup lang="ts">
import AssistantThread from './AssistantThread.vue';
import { ref } from 'vue';

const props = defineProps({
  widgets: Object
})

console.log(props)

const open = ref(false)
const isRunning = ref(false)
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
