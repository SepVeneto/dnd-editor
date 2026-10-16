<template>
  <App
    ref="appRef"
    v-bind="$props"
  />
</template>

<script lang="ts" setup>
import { useDebounceFn, useEventListener } from '@vueuse/core'
import * as Vue from 'vue'
import { onUnmounted, useHost, useTemplateRef } from 'vue'
import App from './App.vue'
import { bindEditorElement } from './element'
import { isHmrEnabled, getSnapshot, saveSnapshot } from './hmr'
import { editorProps } from './props'
import { installShadowCssRuntime, registerShadowCssRoot } from './shadowCss'
import { useApp, useEditor } from './store'

const props = defineProps(editorProps)
const emit = defineEmits(['change'])

const appStore = useApp()
appStore.setWidgets(props.widgets)
const editor = useEditor()
editor.shadowRoot = Vue.useShadowRoot()!

// 业务侧改组件配置（schema）会触发宿主页面热更新，<mpd-editor> 会被卸载再挂载，
// 开发态下从快照恢复上次的数据，避免用户正在编辑的内容被清空
let restored = false
if (isHmrEnabled()) {
  const snapshot = getSnapshot(props.name)
  if (snapshot) {
    editor.setData(snapshot)
    restored = true
  }
}

const updateModelValue = useDebounceFn(() => {
  const data = editor.getData()
  emit('change', data)
}, 1000)
// 恢复出来的数据也要同步回宿主，否则宿主自己的那一份还是空的
if (restored)
  updateModelValue()

Vue.watch(() => editor.rootNode, () => {
  // 快照同步保存：热更新随时可能发生，不能等防抖
  if (isHmrEnabled())
    saveSnapshot(props.name, editor.getData())
  updateModelValue()
}, { deep: true })
// 业务侧重新下发组件配置（改 schema、按需加载配置等）时就地更新组件定义，
// 不重建根节点，因此画布上的数据与选中态都会保留
Vue.watch(() => props.widgets, widgets => appStore.setWidgets(widgets))
// 让动态组件的样式加载在 shadow dom 中，而不是宿主环境中：
// 生产者运行时的 <link> 由 shadowCss 接管，热更新与 shadow root 重建（宿主热更新、路由切换）
// 也一并处理，避免改了样式不生效 / 重建后样式丢失。
installShadowCssRuntime()
// 编辑器卸载（shadow root 会被丢弃）时注销，卸载后不再参与样式查找
const unregisterShadowCssRoot = registerShadowCssRoot(editor.shadowRoot)
onUnmounted(() => unregisterShadowCssRoot())

const refApp = useTemplateRef('appRef')
// 编辑器内不需要触发取消选中的已经通过click.stop屏蔽了
useEventListener(editor.shadowRoot, 'click', () => {
  editor.selectNode()
})

const api = {
  register(fn: (ctx: typeof editor) => { init: () => void }) {
    const editor = useEditor()
    const pluginConstructor = fn(editor)
    pluginConstructor.init()
  },
  async validate() {
    const isValid = await editor.plugins.config.validate(editor.rootNode.data)
    if (!isValid) {
      editor.selectNode()
      await Vue.nextTick()
      refApp.value?.validate()
      throw new Error('验证未通过')
    }

    const invalidNode = await editor.rootNode.validate()
    if (invalidNode) {
      editor.selectNode(invalidNode)
      await Vue.nextTick()
      refApp.value?.validate()
      throw new Error('验证未通过')
    }
  },
  getData() {
    return editor.getData()
  },
  setData(data: { _view: 'page', list: any[] }) {
    editor.setData(data)
  },
}

defineExpose(api)
// 元素在模块加载时就注册好了，宿主可以不等 register() 直接渲染 <mpd-editor>（见 main.ts）：
// 编辑器挂载前的指令式调用会先排队，这里挂载完成后再补上，宿主不需要关心渲染时机。
bindEditorElement(useHost(), api)
</script>
