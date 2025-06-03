// import { router } from './router'
import { init } from '@module-federation/enhanced/runtime'
import BasicComp from '@sepveneto/basic-comp'
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
        console.log('inst', inst)
        Object.assign(inst.appContext, app._context)
        // Object.assign(inst.provides, app._context.provides)
      }
      const editor = useEditor()
      editor.shadowRoot = Vue.useShadowRoot()!

      expose({
        register(fn: any) {
          const editor = useEditor()
          editor.register(fn)
        },
      })
    },

    render() {
      return h(App, this.$props)
    },
  })
}

export const Editor = createElementInstance()

export function register() {
  console.log(customElements.getName(Editor))
  if (customElements.getName(Editor))
    return
  customElements.define('mpd-editor', Editor)
}
