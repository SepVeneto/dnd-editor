/**
 * 开发态编辑器数据的快照。
 *
 * 宿主不再需要用 v-if 控制 `<mpd-editor>` 的渲染时机（编辑器自己等 register() 与生产者
 * setup，见 main.ts），但宿主页面自身的热更新仍可能重建挂载元素的那个组件实例，
 * `<mpd-editor>` 随之被卸载后重新挂载。自定义元素重新挂载会新建一整套 pinia 状态，
 * 用户正在编辑的数据就被清空了。
 *
 * 这里把最近一次数据快照留在模块作用域（不随组件实例销毁），重新挂载时恢复，
 * 于是改 schema / 改视图都不再丢数据。只有在宿主跑着开发服务器（有 HMR）时才生效：
 * 生产构建里 `import.meta.hot` 是 undefined，页面里也不会有 Vite dev client。
 *
 * 快照按宿主传入的 `name`（默认 `widgets`）区分，同一个页面上多个同名编辑器会共用一份。
 */
const snapshots = new Map<string, any>()

let detected: boolean | undefined

export function isHmrEnabled(): boolean {
  if (detected === undefined)
    detected = detectHmr()
  return detected
}

function detectHmr(): boolean {
  // 宿主用 Vite 时，被打包器替换成热更新上下文（生产构建里为 undefined）
  if ((import.meta as any)?.hot)
    return true
  if (typeof document === 'undefined')
    return false
  // 兜底：Vite 的开发服务器会往页面注入 dev client，产物本身不受构建模式影响
  return [...document.querySelectorAll<HTMLScriptElement>('script[type="module"]')]
    .some(item => item.src.includes('/@vite/client'))
}

export function saveSnapshot(key: string, data: any) {
  if (isHmrEnabled())
    snapshots.set(key, data)
}

export function getSnapshot(key: string) {
  return isHmrEnabled() ? snapshots.get(key) : undefined
}
