import { nextTick, ref } from 'vue'

export function useEditor() {
  // 由于编辑器的js较大，使用异步加载可以显著提升首屏速度
  const dnde = import('@sepveneto/dnde/core')
  // 这里可以替换成loading让用户体验更友好
  const render = ref(false)
  // 区分开发环境，不推荐跨域部署
  const mode = import.meta.env.MODE
  const remoteUrl = mode === 'development'
    ? 'http://localhost:8090'
    : `${window.location.origin}/design-widgets`

  // 通过接口获取编辑器数据和编辑器初始化都是异步操作
  // 而设置数据需要等两者都完成
  const { promise, resolve } = Promise.withResolvers()

  const extra = {
    // 可以是文件上传之类的接口
    // 也可以直接共享store
  }

  async function register() {
    (await dnde).register()
    render.value = true
    nextTick().then(resolve)
  }

  return {
    waitForMounted: promise,
    render,
    register,
    remoteUrl,
    extra,
  }
}