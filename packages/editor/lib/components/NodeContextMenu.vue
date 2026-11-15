<template>
  <Teleport :to="editor.shadowRoot">
    <div
      v-if="visible"
      ref="menu"
      class="node-context-menu"
      :style="{ left: `${position.x}px`, top: `${position.y}px` }"
      @click.stop
      @contextmenu.prevent.stop
    >
      <div class="node-context-menu__title">
        {{ node.name }}
      </div>
      <button
        v-for="action in actions"
        :key="action.name"
        type="button"
        class="node-context-menu__item"
        @click="runAction(action)"
      >
        {{ action.title }}
      </button>
    </div>
  </Teleport>
</template>

<script lang="ts" setup>
import type { Node } from '@sepveneto/dnde-core/class'
import type { HelperAction } from '@/type'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useEditor } from '@/store'

const props = defineProps<{ node: Node }>()

const editor = useEditor()
const menu = ref<HTMLElement>()
const visible = ref(false)
const position = ref({ x: 0, y: 0 })
const actions = computed(() => editor.plugins.helper.list.filter(
  item => !item.condition || item.condition(props.node),
))

let activeMenu: (() => void) | undefined

function close() {
  visible.value = false
  if (activeMenu === close)
    activeMenu = undefined
}

function open(event: MouseEvent) {
  activeMenu?.()
  position.value = { x: event.clientX, y: event.clientY }
  activeMenu = close
  visible.value = true
  nextTick(() => {
    const rect = menu.value?.getBoundingClientRect()
    if (!rect)
      return
    position.value = {
      x: Math.max(0, Math.min(event.clientX, window.innerWidth - rect.width)),
      y: Math.max(0, Math.min(event.clientY, window.innerHeight - rect.height)),
    }
  })
}

function runAction(action: HelperAction) {
  close()
  action.action?.(props.node)
}

function handleGlobalPointerDown(event: PointerEvent) {
  if (!visible.value || event.composedPath().includes(menu.value!))
    return
  close()
}

onMounted(() => window.addEventListener('pointerdown', handleGlobalPointerDown, true))
onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handleGlobalPointerDown, true)
  close()
})

defineExpose({ open, close })
</script>

<style lang="scss" scoped>
.node-context-menu {
  position: fixed;
  z-index: 3000;
  min-width: 160px;
  padding: 4px;
  box-sizing: border-box;
  background: var(--mpd-bg-color-overlay, #fff);
  border: 1px solid var(--mpd-border-color-light, #e4e7ed);
  border-radius: 4px;
  box-shadow: var(--mpd-box-shadow-light, 0 2px 12px rgb(0 0 0 / 10%));
}
.node-context-menu__item {
  display: flex;
  width: 100%;
  padding: 6px 12px;
  color: var(--mpd-text-color-regular, #606266);
  font-size: 14px;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: 2px;
  cursor: pointer;
  &:hover {
    color: var(--mpd-color-primary, #4089ef);
    background: var(--mpd-color-primary-light-9, #ecf5ff);
  }
}
.node-context-menu__title {
  padding: 6px 12px;
  margin-bottom: 4px;
  color: var(--mpd-text-color-primary, #303133);
  font-size: 14px;
  font-weight: 500;
  border-bottom: 1px solid var(--mpd-border-color-lighter, #ebeef5);
}
</style>
