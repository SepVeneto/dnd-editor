<template>
  <App
    ref="appRef"
    v-bind="$props"
  />
</template>

<script lang="ts" setup>
import { init } from '@module-federation/enhanced/runtime'
import BasicComp from '@sepveneto/basic-comp'
import { useEventListener } from '@vueuse/core'
import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'
import * as Vue from 'vue'
import { onMounted, useTemplateRef } from 'vue'
import App from './App.ce.vue'
import { editorProps } from './props'
import { useEditor } from './store'

defineProps(editorProps)

init({
  name: 'editor',
  remotes: [],
  shared: {
    vue: {
      version: '3.5.15',
      lib: () => Vue,
      shareConfig: {
        singleton: true,
        requiredVersion: '^3.5.15',
      },
    },
  },
})

const app = Vue.createApp(App)
const store = createPinia()
app.use(ElementPlus, { namespace: 'mpd' })
app.use(BasicComp, {})
app.use(store)

const inst = Vue.getCurrentInstance()
if (inst) {
  Object.assign(inst.appContext, app._context)
}
const editor = useEditor()
editor.shadowRoot = Vue.useShadowRoot()!
// 让动态组件的样式加载在shadow dom中，而不是宿主环境中
// @ts-expect-error: ignore
window.__shadowdom_css_runtime__ = async (tagLink: HTMLLinkElement) => {
  try {
    const res = await fetch(tagLink.href)
    const stylecontent = await res.text()
    const style = document.createElement('style')
    style.textContent = stylecontent
    const shadowRoot = editor.shadowRoot
    shadowRoot?.appendChild(style)
    // 手动触发link标签的load事件，保证组件渲染流程正常
    tagLink.dispatchEvent(new Event('load'))
  }
  catch (err) {
    console.error(err)
    tagLink.dispatchEvent(new Event('error'))
  }
}

const refApp = useTemplateRef('appRef')
// 编辑器内不需要触发取消选中的已经通过click.stop屏蔽了
useEventListener(editor.shadowRoot, 'click', () => {
  editor.selectNode()
})

defineExpose({
  register(fn: (ctx: typeof editor) => { init: () => void }) {
    const editor = useEditor()
    const pluginConstructor = fn(editor)
    pluginConstructor.init()
  },
  async validate() {
    const invalidNode = await editor.rootNode.validate()
    if (invalidNode) {
      editor.selectNode(invalidNode)
      await Vue.nextTick()
      refApp.value?.validate()
    }
  },
  getData() {
    return editor.getData()
  },
  setData(data: any[]) {
    editor.setData(data)
  },
})
</script>
