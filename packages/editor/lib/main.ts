import { defineCustomElement } from 'vue'
import Main from './Editor.vue'
import { createPinia } from 'pinia'
import { initMf } from './utils.js'

export type EditorInstance = InstanceType<typeof Main>

let initPromise = new Map<string, Promise<boolean>>()

export async function register(options: { remoteUrl: string }) {
  const p = initPromise.get(options.remoteUrl)
  if (p) return p

  const { promise, resolve } = Promise.withResolvers<boolean>()
  initPromise.set(options.remoteUrl, promise)

  const mf = initMf(options.remoteUrl)
  const setup: any = await mf.loadRemote('widgets/setup').catch(err => {
    console.error(err)
    return {}
  })
  const Editor = defineCustomElement(Main, {
    configureApp(app) {
      const store = createPinia()
      app.use(store)

      setup.use?.forEach((item: any) => {
        app.use(item.plugin, item.options)
      })
    },
    styles: setup?.styles
  })

  if (customElements.get('mpd-editor'))
    return
  customElements.define('mpd-editor', Editor)
  resolve(true)
}
