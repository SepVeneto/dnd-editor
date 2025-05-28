import { defineAsyncComponent, h } from "vue"
import { loadRemote } from "@module-federation/enhanced/runtime"
export function loadFromRemote(scope: string, module: string) {
  const renderer = defineAsyncComponent({
    loader: () => loadRemote(`${scope}/${module}`) as any,
    loadingComponent: () => h('div', '加载中...'),
    onError(error, retry, fail) {
      console.error(error)
      fail()
    },
  })

  return renderer
}
