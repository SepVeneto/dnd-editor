// import { router } from './router'
import { init } from '@module-federation/enhanced/runtime'
import BasicComp from '@sepveneto/basic-comp'
import { useEventListener } from '@vueuse/core'
import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'
import * as Vue from 'vue'
import { createApp, defineCustomElement, getCurrentInstance, h } from 'vue'
import App from './App.ce.vue'
import { editorProps } from './props'
import { useEditor } from './store'

export function createElementInstance() {
  return defineCustomElement({
    props: editorProps,
    setup(props, { expose }) {
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
      const app = createApp(App)
      const store = createPinia()
      app.use(ElementPlus, { namespace: 'mpd' })
      app.use(BasicComp, {})
      app.use(store)

      // app.use(router)

      const inst = getCurrentInstance()
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

      expose({
        register(fn: any) {
          const editor = useEditor()
          const pluginConstructor = fn(editor)
          pluginConstructor.init()
        },
      })
    },

    render() {
      // console.log(this.$slots)
      return h(
        App,
        this.$props,
      )
    },
  })
}

export const Editor = createElementInstance()

export function register() {
  if (customElements.getName(Editor))
    return
  customElements.define('mpd-editor', Editor)
}
