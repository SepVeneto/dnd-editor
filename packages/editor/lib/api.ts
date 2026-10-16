/**
 * `<mpd-editor>` 的指令式 API（`register` / `validate` / `getData` / `setData`）。
 *
 * 元素在模块加载时就已经注册好（见 main.ts），但真正的编辑器要等宿主调用 `register()`
 * 拿到生产者地址、生产者 `setup` 加载完成之后才会挂载。也就是说「元素已经在页面上」和
 * 「编辑器已经就绪」是两个时刻，宿主不应该被迫去对齐它们。
 *
 * 这里的做法：挂载前宿主如果已经调用了这些方法，先把调用排队（返回值是 Promise），
 * 挂载完成时（Editor.vue 的 setup 里调用 `bindEditorApi`）再按顺序补上。
 * 因此 `el.setData(data)` 这种写法在挂载前后都成立，宿主不需要 v-if / nextTick。
 */

/** 编辑器对外暴露的方法名（与 Editor.vue 的 defineExpose 保持一致） */
export type EditorApiMethod = 'register' | 'validate' | 'getData' | 'setData'

/** 已挂载编辑器的真实实现，由 Editor.vue 提供 */
export type EditorApi = Record<EditorApiMethod, (...args: any[]) => any>

const API_IMPL = Symbol('dnde.editor.api')
const API_QUEUE = Symbol('dnde.editor.queue')

interface PendingCall {
  method: EditorApiMethod
  args: any[]
  resolve: (value: any) => void
  reject: (error: any) => void
}

/**
 * 实现与队列都挂在自定义元素本身，不额外包一层对象。
 * 只按元素用到的成员描述，函数入参放宽成 any：Vue 的 VueElement 类型没有带上 HTMLElement
 * 的成员（defineCustomElement 返回的元素类型在这里当元素用即可）。
 */
type EditorHost = Element & {
  [API_IMPL]?: EditorApi
  [API_QUEUE]?: PendingCall[]
}

/**
 * 调用元素的指令式 API：编辑器已经挂载就直接执行，否则排队等挂载后补上。
 * 此时返回的是 Promise（挂载后调用返回真实结果，`await` 在两种情况下都适用）。
 */
export function invokeEditorApi(host: any, method: EditorApiMethod, args: any[]): any {
  if (!host)
    return undefined

  const element = host as EditorHost
  const api = element[API_IMPL]
  if (api)
    return api[method](...args)

  return new Promise((resolve, reject) => {
    const queue = element[API_QUEUE] || (element[API_QUEUE] = [])
    queue.push({ method, args, resolve, reject })
  })
}

/** 编辑器挂载完成：交出真正的实现，并补齐挂载前的调用 */
export function bindEditorApi(host: any, api: EditorApi): void {
  if (!host)
    return

  const element = host as EditorHost
  element[API_IMPL] = api
  const queue = element[API_QUEUE]
  element[API_QUEUE] = undefined
  queue?.forEach((call) => {
    try {
      call.resolve(api[call.method](...call.args))
    }
    catch (error) {
      call.reject(error)
    }
  })
}
