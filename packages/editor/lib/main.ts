import App from './App.ce.vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import BasicComp from '@sepveneto/basic-comp'
// import { router } from './router'
import { init } from '@module-federation/enhanced/runtime'
import * as Vue from 'vue'
import { createApp, defineCustomElement, getCurrentInstance, h } from 'vue'
import { editorProps } from './props'
import packageJson from '../package.json'

function createElementInstance() {
  console.log(packageJson.dependencies.vue)
  return defineCustomElement({
    props: editorProps,
    setup() {
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
    },

    render() {
      return h(App, this.$props)
    },
  })
}

export function register() {
  customElements.define('mpd-editor', createElementInstance())
}
