<template>
  <App v-bind="$props" />
</template>

<script lang="ts" setup>
import { init, registerPlugins } from '@module-federation/enhanced/runtime'
import BasicComp from '@sepveneto/basic-comp'
import { useEventListener } from '@vueuse/core'
import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'
import * as Vue from 'vue'
import App from './App.ce.vue'
import mfShadowdom from './mf-shadowdom'
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

registerPlugins([mfShadowdom()])

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
// 编辑器内不需要触发取消选中的已经通过click.stop屏蔽了
useEventListener(editor.shadowRoot, 'click', () => {
  editor.selectNode()
})
useEventListener(document, 'click', (e) => {
  const node = e.target as HTMLElement
  if (node.tagName !== 'MPD-EDITOR') {
    editor.selectNode()
  }
})

defineExpose({
  register(fn: (ctx: typeof editor) => { init: () => void }) {
    const editor = useEditor()
    const pluginConstructor = fn(editor)
    pluginConstructor.init()
  },
  validate() {

  },
  getData() {
    return editor.getData()
  },
  setData(data: any[]) {
    editor.setData(data)
  },
})
</script>
