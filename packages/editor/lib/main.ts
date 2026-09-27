import { defineCustomElement } from 'vue'
import Main from './Editor.vue'
import { createPinia } from 'pinia'
import { initMf } from './utils.js'

export type EditorInstance = InstanceType<typeof Main>

let initPromise = new Map<string, Promise<boolean>>()

export function register(options: { remoteUrl: string }): Promise<boolean> {
  const cached = initPromise.get(options.remoteUrl)
  if (cached) return cached

  const promise = (async () => {
    const mf = initMf(options.remoteUrl)
    const setup: any = await mf.loadRemote('widgets/setup').catch((err) => {
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
      styles: setup?.styles,
    })

    // 自定义元素只能注册一次，已注册时复用即可。
    // 这里不能再提前 return，否则 promise 永远不会 settle，调用方将永久挂起
    if (!customElements.get('mpd-editor')) {
      customElements.define('mpd-editor', Editor)
    }

    return true
  })().catch((err) => {
    // 失败时清除缓存，允许调用方重试，而不是一直复用同一个 rejected promise
    initPromise.delete(options.remoteUrl)
    throw err
  })

  initPromise.set(options.remoteUrl, promise)
  return promise
}
